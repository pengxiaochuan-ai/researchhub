import {invalid,only,validateMutation} from '../research-studies/contract.mjs';
import {cursorCodec,cursorBinding,pageLimit} from './capture-cursor.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
function reference(ref){only(ref,['responseId','assignmentId','revisionNo','contentHash']);if(!id(ref.responseId)||!id(ref.assignmentId)||!Number.isSafeInteger(ref.revisionNo)||ref.revisionNo<1||typeof ref.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(ref.contentHash))invalid();}
function target(value){only(value,['kind','ref','fieldKey']);if(value.kind!=='formal_response_revision')invalid();reference(value.ref);if(value.fieldKey!=null&&(typeof value.fieldKey!=='string'||!value.fieldKey.trim()||value.fieldKey.length>160))invalid();}
function bodyText(value){if(typeof value!=='string'||!value.trim()||value.length>5000||value.includes('\0'))invalid();}
export function createFormalDataQueryService({studies,core,cursorSecret}){
 const cursor=cursorCodec(cursorSecret),run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',(tx,ctx)=>fn(tx,scope(ctx)));
 const present=(tx,s,items)=>core.present?core.present(tx,s,items):items;
 const result=(studyId,requestKey,action,assignmentId,value)=>({studyId,result:value,receipt:{requestKey,action:'data_query.'+action,targetId:value.id,assignmentId}});
 async function allowed(tx,user,s,permission){try{await core.authorize(tx,user,s.studyGroupId,s.researchProjectId,permission);return true;}catch(error){if(error?.getStatus?.()===403&&error?.getResponse?.()?.code==='RESEARCH_FORBIDDEN')return false;throw error;}}
 async function capabilities(tx,user,s,open=true){const [fill,review]=await Promise.all([allowed(tx,user,s,'form.fill'),allowed(tx,user,s,'study.review')]);return {canCreate:fill,canReply:open&&fill,canClose:open&&review};}
 return {
  list:(user,studyId,input={})=>{only(input,['limit','cursor','assignmentId']);const limit=pageLimit(input.limit);if(input.assignmentId!==undefined&&!id(input.assignmentId))invalid();const binding=cursorBinding(user,studyId,'data-query',input.assignmentId??null),afterId=input.cursor===undefined?undefined:cursor.decode(input.cursor,binding,id);
   return run(user,studyId,async(tx,s)=>{if(input.assignmentId)await core.readResponse(tx,user,s,input.assignmentId);const result=await core.list(tx,user,s,{limit,...(input.assignmentId?{assignmentId:input.assignmentId}:{}),...(afterId?{afterId}:{})});return {studyId,items:await present(tx,s,result.items),nextCursor:result.nextAfterId?cursor.encode(binding,result.nextAfterId):null,capabilities:await capabilities(tx,user,s)};});},
  read:(user,studyId,queryId)=>{if(!id(queryId))invalid();return run(user,studyId,async(tx,s)=>{const query=await core.read(tx,user,s,queryId);return {studyId,query:(await present(tx,s,[query]))[0],capabilities:await capabilities(tx,user,s,query.status==='open')};});},
  receipt:(user,studyId,requestKey,input)=>{validateMutation({requestKey});only(input,['action','assignmentId','queryId']);if(!['create','reply','close'].includes(input.action)||!id(input.assignmentId)||input.queryId!==undefined&&!id(input.queryId))invalid();return run(user,studyId,async(tx,s)=>result(studyId,requestKey,input.action,input.assignmentId,await core.receipt(tx,user,s,requestKey,input)));},
  create:(user,studyId,body)=>{only(body,['requestKey','target','text']);validateMutation(body);target(body.target);bodyText(body.text);return run(user,studyId,async(tx,s)=>result(studyId,body.requestKey,'create',body.target.ref.assignmentId,await core.create(tx,user,s,body)));},
  mutate:(user,studyId,queryId,action,body)=>{if(!id(queryId)||!['reply','close'].includes(action))invalid();only(body,['requestKey','expectedVersion','expectedRef','text']);validateMutation(body,true);reference(body.expectedRef);bodyText(body.text);return run(user,studyId,async(tx,s)=>result(studyId,body.requestKey,action,body.expectedRef.assignmentId,await core.mutate(tx,user,s,queryId,{...body,action})));},
 };
}
