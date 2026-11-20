import {invalid,only,researchError} from '../research-studies/contract.mjs';
import {cursorCodec,cursorBinding,pageLimit} from '../research-capture/capture-cursor.mjs';
import {subjectPermissionsInTx,createSubjectReadAccess} from './subjects.mjs';
import {PROFILE_FIELD_LABELS} from '../ai-agent/subject-profile-import-contract.mjs';

const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const missing=()=>fail(404,'RESEARCH_NOT_FOUND','被试或资料不存在，或当前账号无权查看。');
const subjectFields=['group','syndrome','sex','age','clinicalLabelSource','consentScope'];
const select=keys=>Object.fromEntries(keys.map(k=>[k,true]));
const pick=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]??null]));
const iso=x=>x instanceof Date?x.toISOString():x??null;
const sourceRef=f=>f.storageKey&&typeof f.meta?.sha256==='string'&&/^[a-f0-9]{64}$/.test(f.meta.sha256)&&f.meta.storageVerifiedSha256===f.meta.sha256?{kind:'modality_file',id:f.id,sha256:f.meta.sha256}:null;

/** Mirrors the native data-menu read boundary inside the existing Study lock.
 * Subjects visibility and private import grants never substitute for data access. */
export async function canReadStudyDataInTx(tx,user,ctx){
 const s=scope(ctx),account=await tx.account.findFirst({where:{id:user.accountId,tenantId:s.tenantId},select:{role:true,isTenantAdmin:true,status:true,authVersion:true,tenant:{select:{status:true}}}});
 if(!account||account.status!=='active'||account.tenant?.status!=='active'||account.authVersion!==user.authVersion||!['researcher','tenant_admin'].includes(account.role)||account.isTenantAdmin!==(account.role==='tenant_admin'))fail(401,'AUTH_SESSION_EXPIRED','登录会话已失效。');
 const [group,project,member,membership]=await Promise.all([
  tx.studyGroup.findFirst({where:{id:s.studyGroupId,tenantId:s.tenantId,status:'active'},select:{id:true}}),
  tx.researchProject.findFirst({where:{id:s.researchProjectId,tenantId:s.tenantId,studyGroupId:s.studyGroupId,status:'active'},select:{id:true}}),
  tx.researchProjectMembership.findFirst({where:{...s,accountId:user.accountId,status:'active'},select:{id:true}}),
  tx.studyGroupMembership.findFirst({where:{tenantId:s.tenantId,studyGroupId:s.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}}),
 ]);
 const role=membership?.role;
 return Boolean(group&&project&&(account.role==='tenant_admin'||member&&role?.tenantId===s.tenantId&&role.status==='active'&&Array.isArray(role.menuPermissions)&&role.menuPermissions.includes('data')));
}

export function createSubjectDataService({studies,limitedImportRead,limitedMediaRead,cursorSecret}){
 const cursor=cursorCodec(cursorSecret),readLimit=createSubjectReadAccess({limitedImportRead,limitedMediaRead});
 async function read(user,studyId,subjectId,input={}){
  if(!id(subjectId))invalid();only(input,['section','fileId','taskId','limit','cursor']);
  const section=input.section??'files',fileId=input.fileId??null,taskId=input.taskId??null,limit=pageLimit(input.limit);
  if(!['files','tasks','features'].includes(section)||section==='files'&&(fileId!==null||taskId!==null)||section==='tasks'&&(!id(fileId)||taskId!==null)||section==='features'&&(!id(fileId)||!id(taskId)))invalid();
  const binding=cursorBinding(user,studyId,'subject-data',{subjectId,section,fileId,taskId}),after=input.cursor===undefined?null:cursor.decode(input.cursor,binding,id);
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
   const s=scope(ctx),canRead=await canReadStudyDataInTx(tx,user,ctx),permissions=await subjectPermissionsInTx(tx,user,ctx),limited=canRead?null:await readLimit(tx,user,ctx,permissions);
   if(limited&&!limited.subjectIds.includes(subjectId))missing();
   const subject=await tx.subject.findFirst({where:{...s,id:subjectId,deletedAt:null,acceptanceFixture:false,...(limited?{createdBy:user.accountId}:{})},select:{id:true,subjectId:true,...(canRead?select(subjectFields):{})}});if(!subject)missing();
   const result={schema:'hub-subject-data.v1',studyId,subject:{id:subject.id,subjectId:subject.subjectId},capabilities:{canReadClinicalData:canRead},clinical:{status:'restricted',subject:null,profile:null},data:{status:canRead?'available':'restricted',section,fileId,taskId,items:[],nextCursor:null}};
   if(!canRead)return result;
   const profile=await tx.subjectProfile.findFirst({where:{tenantId:s.tenantId,subjectId},select:{...select(Object.keys(PROFILE_FIELD_LABELS)),updatedAt:true}});
   result.clinical={status:'available',subject:pick(subject,subjectFields),profile:{status:profile?'available':'missing',values:profile?pick(profile,Object.keys(PROFILE_FIELD_LABELS)):{},updatedAt:iso(profile?.updatedAt)}};
   const fileWhere={tenantId:s.tenantId,subjectId,subjectVisitId:null,deletedAt:null,subject:{...s,deletedAt:null,acceptanceFixture:false}},fileSelect={id:true,subjectId:true,subjectVisitId:true,filename:true,modality:true,kind:true,status:true,collectedAt:true,createdAt:true,meta:true,storageKey:true};
   const taskWhere=fid=>({...s,subjectId,modalityFileId:fid});
   const featureWhere=(fid,tid)=>({tenantId:s.tenantId,subjectId,sourceModalityFileId:fid,...(tid?{sourceProcessingTaskId:tid}:{}),sourceProcessingTask:{is:taskWhere(fid)}});
   let rows;
   if(section==='files'){
    rows=await tx.modalityFile.findMany({where:{...fileWhere,...(after?{id:{gt:after}}:{})},select:fileSelect,orderBy:{id:'asc'},take:limit+1});
    const selected=rows.slice(0,limit),fileIds=selected.map(f=>f.id);
    if(fileIds.length){
     const [tasks,features]=await Promise.all([
      tx.processingTask.groupBy({by:['modalityFileId'],where:{...s,subjectId,modalityFileId:{in:fileIds}},_count:{_all:true}}),
      tx.$queryRawUnsafe(`SELECT x."sourceModalityFileId" AS "fileId",count(*)::integer AS count FROM public.feature x JOIN public.processing_task t ON t.id=x."sourceProcessingTaskId" AND t."tenantId"=x."tenantId" AND t."subjectId"=x."subjectId" AND t."modalityFileId"=x."sourceModalityFileId" WHERE x."tenantId"=$1 AND x."subjectId"=$2 AND x."sourceModalityFileId"=ANY($3::text[]) AND t."studyGroupId"=$4 AND t."researchProjectId"=$5 GROUP BY x."sourceModalityFileId"`,s.tenantId,subjectId,fileIds,s.studyGroupId,s.researchProjectId),
     ]);
     const taskCounts=new Map(tasks.map(x=>[x.modalityFileId,x._count._all])),featureCounts=new Map(features.map(x=>[x.fileId,x.count]));
     result.data.items=selected.map(f=>({id:f.id,modality:f.modality,kind:f.kind,status:f.status,filename:f.filename,collectedAt:iso(f.collectedAt),createdAt:iso(f.createdAt),sourceRef:sourceRef(f),taskCount:taskCounts.get(f.id)??0,featureCount:featureCounts.get(f.id)??0}));
    }
   }else{
    const file=await tx.modalityFile.findFirst({where:{...fileWhere,id:fileId},select:fileSelect});if(!file)missing();
    if(section==='tasks'){
     const keys=['id','status','skillKey','progress','createdAt','updatedAt','completedAt'];
     rows=await tx.processingTask.findMany({where:{...taskWhere(fileId),...(after?{id:{gt:after}}:{})},select:select(keys),orderBy:{id:'asc'},take:limit+1});
     for(const t of rows.slice(0,limit))result.data.items.push({...pick(t,keys),createdAt:iso(t.createdAt),updatedAt:iso(t.updatedAt),completedAt:iso(t.completedAt),featureCount:await tx.feature.count({where:featureWhere(fileId,t.id)})});
    }else{
     const task=await tx.processingTask.findFirst({where:{...taskWhere(fileId),id:taskId},select:{id:true}});if(!task)missing();
     const keys=['id','featureKey','modality','timeWindow','sourcePipeline','extractionVersion','collectedAt'];
     rows=await tx.feature.findMany({where:{...featureWhere(fileId,taskId),...(after?{id:{gt:after}}:{})},select:select(keys),orderBy:{id:'asc'},take:limit+1});
     result.data.items=rows.slice(0,limit).map(x=>({...pick(x,keys),collectedAt:iso(x.collectedAt),sourceRef:sourceRef(file)?{kind:'feature',id:x.id,fileId,taskId}:null}));
    }
   }
   result.data.nextCursor=rows.length>limit?cursor.encode(binding,rows[limit-1].id):null;return result;
  });
 }
 return{read};
}
