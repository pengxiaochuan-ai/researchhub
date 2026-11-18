import {researchError} from '../research-studies/contract.mjs';
import {currentManager} from './review-queue.mjs';

const invalid=()=>{throw researchError(400,'RESEARCH_DECISION_QUERY_INVALID','审核记录条件已变化，请重新读取第一页。');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const binding=u=>({actor:u.accountId,tenant:u.tenantId,version:u.authVersion});
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
function query(input,user){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['limit','cursor'].includes(k)))invalid();
 const limit=input.limit??'20';if(typeof limit!=='string'||!/^[1-9]\d{0,2}$/.test(limit)||Number(limit)>100)invalid();
 let state={v:1,kind:'protocol-decisions',...binding(user),directory:null,study:null,after:null};
 if(input.cursor!==undefined){
  if(typeof input.cursor!=='string'||input.cursor.length>8192||!/^[A-Za-z0-9_-]+$/.test(input.cursor))invalid();
  try{state=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'));}catch{invalid();}
  if(!state||Object.keys(state).sort().join(',')!=='actor,after,directory,kind,study,tenant,v,version'||state.v!==1||state.kind!=='protocol-decisions'||Object.entries(binding(user)).some(([k,v])=>state[k]!==v)||state.directory!==null&&(typeof state.directory!=='string'||state.directory.length>4096)||state.study!==null&&!id(state.study)||state.after!==null&&(!state.study||!state.after||Object.keys(state.after).sort().join(',')!=='id,time'||!id(state.after.id)||!validTime(state.after.time)))invalid();
 }
 return {limit:Number(limit),state};
}
export function presentProtocolDecision(event,protocol,names){
 const kind=event.action==='study_protocol_approve'?'approved':event.action==='study_protocol_activate'?'activated':event.action==='study_protocol_transition'&&event.meta?.to==='draft'?'returned':null;
 if(!kind)return null;
 if(!id(event.id)||!protocol||event.target!==protocol.id||event.createdAt==null||!Number.isFinite(new Date(event.createdAt).getTime()))throw researchError(503,'RESEARCH_DECISION_UNAVAILABLE','审核记录暂时无法核对，请重新读取。');
 return {id:event.id,kind,createdAt:new Date(event.createdAt).toISOString(),actorName:names.get(event.accountId)??null,reason:kind==='returned'&&typeof event.meta?.reason==='string'?event.meta.reason.trim().slice(0,5000)||null:null};
}
export function createProtocolDecisionHistory({studies}){
 return {async list(user,input={}){
  const {limit,state}=query(input,user),items=[];let scanned=0,exhausted=false;
  while(items.length<limit&&scanned<25){
   if(!state.study){
    const page=await studies.directory(user,{limit:'1',...(state.directory?{cursor:state.directory}:{})});scanned++;
    state.directory=page.nextCursor??null;state.study=page.items[0]?.studyId??null;state.after=null;
    if(!state.study){if(!state.directory){exhausted=true;break;}continue;}
   }
   const studyId=state.study,remaining=limit-items.length;let rows=[];
   try{
    rows=await studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
     if(!await currentManager(tx,user,ctx))return [];
     const scope={tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};
     const project=await tx.researchProject.findFirst({where:{id:ctx.executionProjectId,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,status:'active'},select:{name:true}});if(!project)return [];
     const protocols=await tx.studyProtocolVersion.findMany({where:{...scope,acceptanceFixture:false},select:{id:true,title:true,versionNumber:true,status:true}});
     if(!protocols.length)return [];
     const events=await tx.auditLog.findMany({where:{...scope,target:{in:protocols.map(p=>p.id)},OR:[{action:{in:['study_protocol_approve','study_protocol_activate']}},{action:'study_protocol_transition',meta:{path:['to'],equals:'draft'}}],...(state.after?{AND:[{OR:[{createdAt:{lt:new Date(state.after.time)}},{createdAt:new Date(state.after.time),id:{lt:state.after.id}}]}]}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:remaining+1,select:{id:true,accountId:true,action:true,target:true,meta:true,createdAt:true}});
     const actorIds=[...new Set(events.map(e=>e.accountId).filter(Boolean))],people=actorIds.length?await tx.account.findMany({where:{tenantId:ctx.tenantId,id:{in:actorIds}},select:{id:true,displayName:true}}):[];
     const names=new Map(people.map(p=>[p.id,typeof p.displayName==='string'?p.displayName.trim()||null:null])),byId=new Map(protocols.map(p=>[p.id,p]));
     return events.map(e=>{const protocol=byId.get(e.target),decision=presentProtocolDecision(e,protocol,names);if(!decision)throw researchError(503,'RESEARCH_DECISION_UNAVAILABLE','审核记录暂时无法核对，请重新读取。');return{studyId,studyTitle:project.name,protocol,decision};});
    });
   }catch(error){if(error.status!==404)throw error;}
   items.push(...rows.slice(0,remaining));
   if(rows.length>remaining){const last=items.at(-1).decision;state.after={id:last.id,time:last.createdAt};break;}
   state.study=null;state.after=null;if(!state.directory){exhausted=true;break;}
  }
  return{items,nextCursor:exhausted?null:Buffer.from(JSON.stringify(state)).toString('base64url')};
 }};
}
