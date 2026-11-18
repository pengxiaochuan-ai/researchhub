import {methodsBase,validMethodsCapabilities,validMethodsRun,validMethodsList,validDescriptiveOutputs} from './formal-methods-session.js';
import {createCaptureClient} from './formal-capture-session.js';

export const isMethodsAccessLoss=e=>[401,403].includes(e.status)||['PARTICIPATION_CAPTURE_BLOCKED','PROTOCOL_BINDING_CHANGED','FORM_ASSIGNMENT_CHANGED','ANALYSIS_USE_POLICY_UNAVAILABLE'].includes(e.code);
const metadata=r=>Object.fromEntries(['id','skillKey','status','reviewStatus','createdAt','updatedAt','analysisState','errorCode','errorMessage'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));

// Current detail deliberately does not depend on the separately authorized recent list.
export async function readMethodsCurrent({studyId,ids,request,readSource,quiet=false,current}){
 const base=methodsBase(studyId),value={};
 if(ids.runId){const caps=await request(base+'/runs/'+ids.runId+'/capabilities');if(!validMethodsCapabilities(caps,studyId,ids.runId))throw Error('当前运行操作权限暂不可核对，请重新读取。');value.capabilities=caps;
  try{const run=await request(base+'/runs/'+ids.runId);if(!validMethodsRun(run,studyId,ids.runId))throw Error('运行与研究或固定快照不匹配。');const basis=run.dataSources.analysisBasis;if(ids.snapshotId&&(ids.snapshotId!==basis.snapshotId||ids.planId!==basis.planId))throw Error('此运行不属于所选快照，请从原运行重新进入。');
   const source=await readSource(basis.planId,basis.snapshotId);if(Object.entries(source.basis).some(([k,v])=>basis[k]!==v))throw Error('运行的固定来源与当前快照不匹配。');
   if(run.status!==caps.status||run.reviewStatus!==caps.reviewStatus){const fresh=await request(base+'/runs/'+ids.runId+'/capabilities');if(!validMethodsCapabilities(fresh,studyId,ids.runId)||fresh.status!==run.status||fresh.reviewStatus!==run.reviewStatus)throw Error('运行状态已有变化，请重新读取后核对。');value.capabilities=fresh;}
   const hasResult=['needs_review','completed','needs_input'].includes(run.status);if(hasResult&&!validDescriptiveOutputs(run,source))throw Error('统计值与固定来源或算子证据不一致，已停止展示。');
   if(quiet&&current?.run?.inputHash&&current.run.inputHash!==run.inputHash)throw Error('本次运行来源已有变化，请重新读取。');value.run=run;value.source=source;value.sourceCurrent=true;value.resultValid=hasResult;
  }catch(e){if(e.stale||isMethodsAccessLoss(e))throw e;value.run={id:ids.runId,skillKey:'descriptive-statistics',status:value.capabilities.status,reviewStatus:value.capabilities.reviewStatus,analysisState:'blocked',errorMessage:e.message};value.sourceError=e.message;value.sourceCurrent=false;value.resultValid=false;}
 }else if(ids.snapshotId){try{value.source=await readSource(ids.planId,ids.snapshotId);value.sourceCurrent=true;}catch(e){if(e.stale||isMethodsAccessLoss(e))throw e;value.sourceError=e.message;value.sourceCurrent=false;}}
 return value;
}

// This sole GET has a longer bound; it never owns the detail reader or a writer.
export function createMethodsListReader({fetchImpl=globalThis.fetch,timeoutSignal=ms=>AbortSignal.timeout(ms)}={}){
 let epoch=0,controller=new AbortController();const identityClient=createCaptureClient({fetchImpl});
 return {
  invalidate(){epoch++;controller.abort();controller=new AbortController();identityClient.invalidate();},
  identity(){return identityClient.request('/auth/me');},
  async read(studyId){
   const token=epoch;let response;
   try{response=await fetchImpl('/api'+methodsBase(studyId)+'/runs',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,timeoutSignal(60000)])});}
   catch{if(token!==epoch)throw Object.assign(Error('读取已作废。'),{stale:true});throw Error('近期分析运行暂不可读取。');}
   const data=await response.json().catch(()=>null);if(token!==epoch)throw Object.assign(Error('读取已作废。'),{stale:true});
   if(!response.ok)throw Object.assign(Error(data?.message||'近期分析运行暂不可读取。'),{status:response.status,code:data?.code});
   if(!validMethodsList(data,studyId))throw Error('运行列表暂不可核对，请重新读取。');return {...data,items:data.items.map(metadata)};
  }
 };
}
