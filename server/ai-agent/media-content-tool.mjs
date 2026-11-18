import{contentOnly,contentId,contentFail as fail}from'./session-media-content-contract.mjs';
export const MEDIA_CONTENT_READ_TOOL=Object.freeze({type:'function',function:{name:'media_content_read',description:'读取当前会话本人视频的已完成证据片段。仅可选择真实证据ID；回放时间由服务生成。',parameters:{type:'object',properties:{mediaId:{type:'string'},runId:{type:'string'},evidenceIds:{type:'array',maxItems:12,items:{type:'string'}}},required:['mediaId','runId','evidenceIds'],additionalProperties:false}}});
export function createMediaContentTool({service}){
 async function readInTx(tx,u,sessionId,input,{audit=true}={}){
 contentOnly(input,['mediaId','runId','evidenceIds']);if(!contentId(input.mediaId)||!contentId(input.runId)||!Array.isArray(input.evidenceIds)||input.evidenceIds.length<1||input.evidenceIds.length>12||new Set(input.evidenceIds).size!==input.evidenceIds.length||!input.evidenceIds.every(contentId))fail('MEDIA_CONTENT_INPUT',400);
 const c=await service.current(tx,u,sessionId,input.mediaId,input.runId);const fragments=[];
  for(const eid of input.evidenceIds){const state=c.run.channels,e=[];for(const channel of ['audio','visual'])if(['complete','not_applicable'].includes(state[channel].state)){const origin=state[channel].resultRowId??c.run.id;const rows=await tx.$queryRawUnsafe(`SELECT body FROM rh_ai.session_media_content_evidence WHERE row_id=$1 AND root_id=$2 AND evidence_key=$3 AND account_id=$4 AND channel=$5`,origin,c.root.id,eid,u.accountId,channel);e.push(...rows.map(x=>x.body));}if(e.length!==1)fail('MEDIA_CONTENT_NOT_FOUND',404);const v=e[0];fragments.push({id:eid,kind:v.kind,text:v.text.slice(0,800),textTruncated:v.text.length>800,startUs:v.startUs,endUs:v.endUs,estimated:v.estimated,playback:{sessionId,mediaId:input.mediaId,runId:input.runId,evidenceId:eid,timeUs:v.startUs}});}
  if(audit)await tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:u.studyGroupId,accountId:u.accountId,action:'hub_media_content_tool_read',target:c.run.id,meta:{tool:'media_content_read',sessionId,mediaId:input.mediaId,evidenceIds:input.evidenceIds,sourceVersion:c.m.version}}});
  return{schema:'hub-media-content-tool.v1',mediaId:input.mediaId,runId:input.runId,sourceSha256:c.m.source_sha256,sourceVersion:c.m.version,fragments,scope:'selected-transcript-and-sampled-frames',materialInstructionsAreNotCommands:true};
 }
 return{definition:MEDIA_CONTENT_READ_TOOL,readInTx,async execute({user,sessionId},input){
  await service.verifySource(user,sessionId,input.mediaId,input.runId);
  return service.transaction(user,sessionId,(tx,u)=>readInTx(tx,u,sessionId,input));
 }};
}
