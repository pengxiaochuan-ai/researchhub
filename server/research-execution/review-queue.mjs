import {researchError} from '../research-studies/contract.mjs';
import {canManageRelease} from './policy-input.mjs';

const invalid=()=>{throw researchError(400,'RESEARCH_REVIEW_QUERY_INVALID','待审列表条件已变化，请重新读取第一页。');};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const binding=user=>({actor:user.accountId,tenant:user.tenantId,version:user.authVersion});
function query(input,user){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['status','limit','cursor'].includes(k))||input.status!==undefined&&input.status!=='pending_review')invalid();
 const raw=input.limit??'20';if(typeof raw!=='string'||!/^[1-9]\d{0,2}$/.test(raw)||Number(raw)>100)invalid();
 let state={v:1,...binding(user),directory:null,study:null,after:null};
 if(input.cursor!==undefined){
  if(typeof input.cursor!=='string'||input.cursor.length>8192||!/^[A-Za-z0-9_-]+$/.test(input.cursor))invalid();
  try{state=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'));}catch{invalid();}
  if(!state||Object.keys(state).sort().join(',')!=='actor,after,directory,study,tenant,v,version'||state.v!==1||Object.entries(binding(user)).some(([k,v])=>state[k]!==v)||state.directory!==null&&(typeof state.directory!=='string'||state.directory.length>4096)||state.study!==null&&!id(state.study)||state.after!==null&&(!state.study||!id(state.after)))invalid();
 }
 return {limit:Number(raw),state};
}
export async function currentManager(tx,user,ctx){
 if(!await tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ctx.tenantId,featureKey:'study_operations',enabled:true}}))throw researchError(403,'FEATURE_NOT_ENABLED','该功能尚未向当前租户开放，请联系平台管理员。');
 const [account,projectMember,groupMember]=await Promise.all([
  tx.account.findFirst({where:{id:user.accountId,tenantId:ctx.tenantId},select:{tenantId:true,role:true,isTenantAdmin:true}}),
  tx.researchProjectMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId,accountId:user.accountId,status:'active'}}),
  tx.studyGroupMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}}),
 ]);
 return canManageRelease({account,projectMember,groupMember});
}

export function createProtocolReviewQueue({studies}){
 return {async list(user,input={}){
  const {limit,state}=query(input,user),items=[],buffer=[];let scanned=0,exhausted=false;
  while(items.length<limit&&scanned<25){
   if(!state.study){
    if(!buffer.length){
     const batched=typeof studies.reviewDirectory==='function';
     const page=await(batched?studies.reviewDirectory(user,{limit:String(25-scanned),...(state.directory?{cursor:state.directory}:{})}):studies.directory(user,{limit:'1',...(state.directory?{cursor:state.directory}:{})}));
     if(batched&&page.items.length){for(const item of page.items){if(!Object.hasOwn(item,'reviewCursor'))invalid();buffer.push({studyId:item.studyId,directory:item.reviewCursor});}}
     else buffer.push({studyId:page.items[0]?.studyId,directory:page.nextCursor??null});
    }
    const entry=buffer.shift();scanned++;state.directory=entry.directory;state.study=entry.studyId??null;state.after=null;
    if(!state.study){if(!state.directory){exhausted=true;break;}continue;}
   }
   const studyId=state.study,remaining=limit-items.length;
   let rows=[];
   try{
    rows=await studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
     if(!await currentManager(tx,user,ctx))return [];
     const where={tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};
     const project=await tx.researchProject.findFirst({where:{id:ctx.executionProjectId,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,status:'active'},select:{name:true}});
     if(!project)return [];
     const protocols=await tx.studyProtocolVersion.findMany({where:{...where,status:'pending_review',acceptanceFixture:false,...(state.after?{id:{gt:state.after}}:{})},orderBy:{id:'asc'},take:remaining+1,select:{id:true,title:true,versionNumber:true,status:true,updatedAt:true}});
     return protocols.map(p=>({studyId,studyTitle:project.name,protocol:{id:p.id,title:p.title,versionNumber:p.versionNumber,status:p.status,updatedAt:new Date(p.updatedAt).toISOString()},href:'/pages/s07/?'+new URLSearchParams({formalPreparation:'1',studyId,protocolId:p.id})}));
    });
   }catch(error){if(error.status!==404)throw error;}
   items.push(...rows.slice(0,remaining));
   if(rows.length>remaining){state.after=items.at(-1).protocol.id;break;}
   state.study=null;state.after=null;
   if(!state.directory){exhausted=true;break;}
  }
  return {items,nextCursor:exhausted?null:Buffer.from(JSON.stringify(state)).toString('base64url')};
 }};
}
