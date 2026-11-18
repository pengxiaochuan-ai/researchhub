import {researchError} from '../research-studies/contract.mjs';
import {authorizeReleaseContext} from './policy-drafts.mjs';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const invalid=()=>fail(400,'PROTOCOL_MIGRATION_QUERY_INVALID','转版列表条件已变化，请重新读取第一页。');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const binding=(user,studyId,protocolId)=>({actor:user.accountId,tenant:user.tenantId,version:user.authVersion,studyId,protocolId});
function query(user,studyId,protocolId,input){
 if(!id(studyId)||!id(protocolId)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['limit','cursor'].includes(k)))invalid();
 const raw=input.limit??'20';if(typeof raw!=='string'||!/^[1-9]\d{0,2}$/.test(raw)||Number(raw)>100)invalid();let after=null;
 if(input.cursor!==undefined){
  if(typeof input.cursor!=='string'||input.cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(input.cursor))invalid();let value;
  try{value=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'));}catch{invalid();}
  if(!value||Object.keys(value).sort().join(',')!=='actor,after,protocolId,studyId,tenant,version'||Object.entries(binding(user,studyId,protocolId)).some(([k,v])=>value[k]!==v)||!id(value.after))invalid();after=value.after;
 }
 return {limit:Number(raw),after};
}
export function createMigrationCandidates({studies}){
 return {list:async(user,studyId,protocolId,input={})=>{
  const {limit,after}=query(user,studyId,protocolId,input);
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
   if(!await authorizeReleaseContext(tx,user,ctx))fail(403,'RESEARCH_FORBIDDEN','当前账号无权管理历史入组转版。');
   const scope={tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};
   const target=await tx.studyProtocolVersion.findFirst({where:{...scope,id:protocolId,acceptanceFixture:false},select:{id:true,status:true,approvedPolicyVersionId:true,approvedPolicyHash:true}});
   if(!target)fail(404,'RESEARCH_NOT_FOUND','研究方案不存在或当前账号无权查看。');
   if(!['approved','executing'].includes(target.status)||!target.approvedPolicyVersionId||!target.approvedPolicyHash)fail(409,'PROTOCOL_MIGRATION_TARGET_UNAVAILABLE','请先完成此方案版本的审批。');
   const rows=await tx.studyEnrollment.findMany({where:{...scope,acceptanceFixture:false,status:'enrolled',protocolVersionId:{not:protocolId},subject:{...scope,acceptanceFixture:false,deletedAt:null},protocolVersion:{...scope,acceptanceFixture:false,status:{in:['executing','superseded']}},...(after?{id:{gt:after}}:{})},include:{subject:{select:{subjectId:true}},protocolVersion:{select:{id:true,title:true,versionNumber:true}}},orderBy:{id:'asc'},take:limit+1});
   const items=rows.slice(0,limit).map(row=>({id:row.id,subjectCode:row.subject.subjectId,sourceProtocol:{id:row.protocolVersion.id,title:row.protocolVersion.title,versionNumber:row.protocolVersion.versionNumber},enrolledAt:row.enrolledAt?new Date(row.enrolledAt).toISOString():null}));
   return {items,nextCursor:rows.length>limit?Buffer.from(JSON.stringify({...binding(user,studyId,protocolId),after:items.at(-1).id})).toString('base64url'):null};
  });
 }};
}
