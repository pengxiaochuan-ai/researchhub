import test from 'node:test';import assert from 'node:assert/strict';
import {createT17ReportExports} from './t17-report-exports.mjs';import {reportDigest} from './t17-report-content.mjs';
function fixture(hooks={}){
 const user={accountId:'actor',authVersion:1},studyId='study',s={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},job={id:'job',...s,artifactId:'rh-formal-report-test',artifactVersionId:'version',format:'docx',status:'queued',requestedBy:'actor'},c={artifact:{id:job.artifactId,title:'合成报告',status:'released',releasedVersionNo:1},version:{id:'version',contentHash:'content',sourceSnapshotHash:'source',contentMd:'固定结果',contentBlocks:[]}};
 const state={valid:true,renders:0,puts:0,files:0,ready:0,removed:0},buffer=Buffer.from('explicit unit renderer double'),objects=new Map();
 const tx={researchArtifactExportJob:{findFirst:async()=>job,updateMany:async({data})=>{Object.assign(job,data);if(data.status==='ready')state.ready++;return {count:1};}},auditLog:{findMany:async()=>[{meta:{authVersion:1,studyId}}],create:async()=>({})},researchArtifactFile:{create:async({data})=>{state.files++;job.file={...data,id:'file'};return job.file;}}};
 const deps={transact:async(_u,_study,fn)=>{const result=await fn(tx,s);if(hooks.commit&&state.ready)await hooks.commit(state);return result;},current:async()=>{if(!state.valid)throw Object.assign(Error('basis revoked'),{code:'ANALYSIS_BASIS_STALE',status:409});return c;},permission:async()=>{},configured:()=>{},render:async()=>{state.renders++;await hooks.render?.(state);return {buffer,mimeType:'application/test'};},filename:()=> 'test.docx',claim:async()=>{job.status='rendering';return {executionToken:'token',workerOwner:'owner'};},liveClaim:async()=>{if(job.status!=='rendering')throw Error('CLAIM_LOST');},heartbeat:async()=>true,owner:'owner',deploymentScope:{},storage:{put:async(k,b)=>{state.puts++;objects.set(k,b);await hooks.put?.(state);},getBuffer:async k=>{await hooks.get?.(state);return objects.get(k);},remove:async()=>{state.removed++;}}};
 return {api:createT17ReportExports(deps),user,studyId,job,state,buffer,objects};
}
test('withdrawal during render or storage blocks terminal publication; private unconfirmed object is retained without a ready file',async()=>{
 for(const phase of ['render','put']){const f=fixture({[phase]:state=>{state.valid=false;}});await assert.rejects(()=>f.api.processExport(f.user,f.studyId,'job'),e=>e.code==='ANALYSIS_BASIS_STALE');assert.equal(f.state.files,0);assert.equal(f.state.ready,0);assert.equal(f.job.status,'failed');assert.equal(f.state.removed,0);assert.equal(f.state.puts,phase==='put'?1:0);}
});
test('same job is rendered once and a changed original authVersion is never substituted',async()=>{
 const f=fixture();const ready=await f.api.processExport(f.user,f.studyId,'job');assert.equal(ready.status,'ready');await f.api.processExport(f.user,f.studyId,'job');assert.equal(f.state.renders,1);assert.equal(f.state.puts,1);assert.equal(ready.file.sha256,reportDigest(f.buffer));assert.equal('storageKey'in ready.file,false);
 const other=fixture();await assert.rejects(()=>other.api.processExport({...other.user,authVersion:2},other.studyId,'job'),e=>e.code==='REPORT_EXPORT_ACTOR_CHANGED');assert.equal(other.state.renders,0);assert.equal(other.job.status,'queued');
});
test('lost commit acknowledgment preserves the committed file and original job, never deletes or re-renders it',async()=>{
 let lost=true;const f=fixture({commit:()=>{if(lost){lost=false;throw Error('COMMIT_ACK_LOST');}}});await assert.rejects(()=>f.api.processExport(f.user,f.studyId,'job'),/COMMIT_ACK_LOST/);assert.equal(f.job.status,'ready');assert.equal(f.state.removed,0);assert.equal((await f.api.processExport(f.user,f.studyId,'job')).status,'ready');assert.equal(f.state.renders,1);
});
test('download rechecks current basis after storage read and never hands off bytes when it changed',async()=>{
 const f=fixture();await f.api.processExport(f.user,f.studyId,'job');f.state.valid=false;await assert.rejects(()=>f.api.download(f.user,f.studyId,'job'),e=>e.code==='ANALYSIS_BASIS_STALE');
 let fetching=false;const g=fixture({get:s=>{if(fetching)s.valid=false;}});await g.api.processExport(g.user,g.studyId,'job');fetching=true;await assert.rejects(()=>g.api.download(g.user,g.studyId,'job'),e=>e.code==='ANALYSIS_BASIS_STALE');
});
test('resume marks expired claims interrupted and never requeues or re-renders them',async()=>{
 const f=fixture();await f.api.processExport(f.user,f.studyId,'job');let recovered=0;const tx={researchArtifactExportJob:{findMany:async({where})=>where.status==='rendering'?[{id:'interrupted'}]:[]}};
 const api=createT17ReportExports({transact:async(_u,_s,fn)=>fn(tx,{}),permission:async()=>{},configured:()=>{},recoverExpiredClaim:async(_tx,_scope,kind,id)=>{assert.equal(kind,'research-artifact-export');assert.equal(id,'interrupted');recovered++;return true;}});
 assert.deepEqual(await api.resume(f.user,f.studyId),{studyId:f.studyId,items:[],interrupted:1,limit:20});assert.equal(recovered,1);
});
