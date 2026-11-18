import {taskError} from './authorization.mjs';
import {parseTaskContext} from './contract.mjs';
import {canReadTaskEvidence} from './evidence.mjs';
import {edcDigest} from '../../scripts/synthetic-edc-contract.mjs';
const scope=a=>({tenantId:a.tenantId,studyGroupId:a.studyGroupId,researchProjectId:a.researchProjectId});
const reject=()=>{throw taskError('STUDY_TASK_CONTEXT_RESTRICTED',403,'关联来源当前不可读或已变化，请重新核对');};
const restricted=kind=>({kind,status:'restricted',message:'关联来源当前不可读或已变化，请重新核对；不交付旧摘要。'});

async function deriveSynthetic(db,a,ref,deps){
 if(!deps?.readSynthetic||!await canReadTaskEvidence(db,a))reject();
 const account=await db.account.findFirst({where:{id:a.actorAccountId,tenantId:a.tenantId,status:'active'},select:{role:true,authVersion:true}});if(!account)reject();
 const user={...scope(a),accountId:a.actorAccountId,role:account.role,authVersion:account.authVersion};
 const ids=[ref.parentId,ref.rootId].sort();
 await db.$queryRaw`SELECT id FROM research_artifact WHERE "tenantId"=${a.tenantId} AND "studyGroupId"=${a.studyGroupId}
  AND "researchProjectId"=${a.researchProjectId} AND id=ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
 let value;
 try{value=await deps.readSynthetic(db,user,ref);}catch(error){const code=error.code??error.getResponse?.()?.code;if(error.status===403||error.getStatus?.()===403||/^(EDC_|PLAN_|KNOWLEDGE_)/.test(code??''))reject();throw error;}
 const {plan,packet,sourceStatus}=value??{};
 if(!plan?.a||!packet?.b||sourceStatus!=='current'||plan.a.id!==ref.rootId||packet.a.id!==ref.parentId||packet.b.binding.planId!==ref.rootId||packet.a.currentVersionNo!==packet.v.versionNo||packet.b.ownerAccountId!==a.actorAccountId||[plan.a,packet.a].some(row=>Object.entries(scope(a)).some(([k,v])=>row[k]!==v)||row.ownerAccountId!==a.actorAccountId||row.createdBy!==a.actorAccountId||row.deletedAt!==null))reject();
 const record=packet.b.records.find(r=>r.recordId===ref.sourceId);if(!record)reject();
 const context={kind:'synthetic_crf_record',sourceId:record.recordId,parentId:packet.a.id,rootId:plan.a.id,sourceVersion:packet.v.versionNo};
 context.sourceHash=edcDigest({...context,sourceSeal:packet.b.seal,contentHash:packet.v.contentHash});
 return {context,summary:{kind:context.kind,status:'current',label:packet.a.title,subjectLabel:packet.b.subjects.find(s=>s.key===record.syntheticSubjectKey)?.label??'合成被试',visitLabel:packet.b.config.visits.find(v=>v.key===record.visitKey)?.name??record.visitKey,
  recordStatus:record.status,responseRevision:record.responseRevision,sourceVersion:context.sourceVersion,sourceHash:context.sourceHash,
  navigation:{href:null,reason:'现有采集页不支持固定版本回链；请在本页核对版本摘要，不跳转到演示访视。'}}};
}
async function deriveFormal(db,a,ref,deps){
 // Current local acceptance explicitly excludes real formal visits.
 if(!deps?.allowFormal)reject();
 const visit=await db.subjectVisit.findFirst({where:{...scope(a),id:ref.sourceId,acceptanceFixture:false},include:{enrollment:{include:{subject:true}},visitPlan:true}});
 const enrollment=visit?.enrollment,subject=enrollment?.subject;
 if(!visit||!enrollment||!subject||Object.entries(scope(a)).some(([k,v])=>enrollment[k]!==v||subject[k]!==v)||enrollment.id!==ref.parentId||subject.id!==ref.rootId||visit.enrollmentId!==enrollment.id||visit.subjectId!==subject.id||enrollment.acceptanceFixture!==false||subject.acceptanceFixture!==false||subject.deletedAt!==null)reject();
 const context={kind:'formal_visit',sourceId:visit.id,parentId:enrollment.id,rootId:subject.id,sourceVersion:visit.version};
 context.sourceHash=edcDigest({...context,protocolVersionId:visit.protocolVersionId,visitPlanId:visit.visitPlanId,status:visit.status});
 return {context,summary:{kind:'formal_visit',status:'current',label:visit.visitPlan?.name??'正式访视',subjectLabel:subject.subjectId,sourceVersion:visit.version,sourceHash:context.sourceHash,navigation:{href:null,reason:'当前没有可用的固定版本正式访视页面入口。'}}};
}
const derive=(db,a,ref,deps)=>ref.kind==='synthetic_crf_record'?deriveSynthetic(db,a,ref,deps):deriveFormal(db,a,ref,deps);
export async function verifyTaskContext(db,authority,raw,deps){
 const ref=parseTaskContext(raw);if(ref.kind==='none')return {context:ref,summary:{kind:'none',status:'unlinked'}};
 const result=await derive(db,authority,ref,deps);
 if(result.context.sourceVersion!==ref.sourceVersion||result.context.sourceHash!==ref.sourceHash)throw taskError('STUDY_TASK_CONTEXT_CHANGED',409,'关联记录版本已变化，请重新核对');
 return result;
}
export async function readTaskContext(db,authority,raw,deps){
 if(!raw||raw.kind==='none')return {kind:'none',status:'unlinked'};
 try{return (await verifyTaskContext(db,authority,raw,deps)).summary;}
 catch(error){if(error.code?.startsWith('STUDY_TASK_'))return restricted(['formal_visit','synthetic_crf_record'].includes(raw.kind)?raw.kind:'none');throw error;}
}
export async function readTaskLinkOptions(db,a,query,cursor,deps){
 if(query.kind==='formal_visit')return {items:[],nextCursor:null,availability:'local_synthetic_only'};
 if(!await canReadTaskEvidence(db,a))return {items:[],nextCursor:null,availability:'restricted'};
 const binding={...a,researchProjectId:a.researchProjectId+'-synthetic-context'},last=query.cursor?cursor.decode(binding,query,query.cursor):null;
 const lastAt=last?.createdAt??new Date('9999-12-31'),lastId=last?.id??'z';
 const rows=await db.$queryRaw`SELECT a.id collection_id,a."createdAt" created_at,r.value->>'recordId' record_id,
   v."contentBlocks"#>>'{0,binding,planId}' plan_id FROM research_artifact a
   JOIN research_artifact_version v ON v."artifactId"=a.id AND v."versionNo"=a."currentVersionNo"
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(v."contentBlocks"#>'{0,records}')='array' THEN v."contentBlocks"#>'{0,records}' ELSE '[]'::jsonb END) r
   WHERE a."tenantId"=${a.tenantId} AND a."studyGroupId"=${a.studyGroupId} AND a."researchProjectId"=${a.researchProjectId}
   AND a."ownerAccountId"=${a.actorAccountId} AND a."createdBy"=${a.actorAccountId} AND a."deletedAt" IS NULL AND a.status='draft'
   AND a."typeKey"='research_report' AND a."idempotencyKey" LIKE 'rh-edc-20261023:%'
   AND v."contentBlocks"#>>'{0,type}'='rh-synthetic-edc.v1' AND position(lower(${query.q}) IN lower(a.title))>0
   AND (a."createdAt"<${lastAt} OR (a."createdAt"=${lastAt} AND concat(a.id,'__',r.value->>'recordId')<${lastId}))
   ORDER BY a."createdAt" DESC,concat(a.id,'__',r.value->>'recordId') DESC LIMIT ${query.limit+1}`;
 const items=[];let invalidRecords=0;
 for(const row of rows.slice(0,query.limit)){
  try{const value=await deriveSynthetic(db,a,{kind:'synthetic_crf_record',sourceId:row.record_id,parentId:row.collection_id,rootId:row.plan_id},deps);items.push({...value.context,...value.summary,context:value.context});}
  catch(error){if(error.code?.startsWith('STUDY_TASK_'))invalidRecords++;else throw error;}
 }
 const end=rows[query.limit-1];
 return {items,nextCursor:rows.length>query.limit?cursor.encode(binding,query,{id:end.collection_id+'__'+end.record_id,createdAt:end.created_at}):null,availability:'available',invalidRecords};
}
