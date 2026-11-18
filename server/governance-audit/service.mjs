import {auditError,parseAuditQuery,projectAudit,projectProof,safeId,actionLabels} from './contract.mjs';
import {cursorCodec} from '../research-capture/capture-cursor.mjs';
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function createGovernanceAudit({transact,normalize,cursorSecret}){
 const cursors=cursorCodec(cursorSecret);
 async function current(tx,p){
  if(!p||!safeId(p.tenantId)||!safeId(p.accountId)||!Number.isInteger(p.authVersion))throw auditError(403,'HUB_AUDIT_FORBIDDEN','当前账号无权查看租户审计日志。');
  const a=await tx.account.findFirst({where:{id:p.accountId,tenantId:p.tenantId,status:'active',tenant:{status:'active'}},select:{id:true,role:true,status:true,isTenantAdmin:true,authVersion:true,tenant:{select:{status:true}}}});
  if(!a||a.role!=='tenant_admin'||!a.isTenantAdmin||a.authVersion!==p.authVersion||p.role!==a.role||a.status!=='active'||a.tenant?.status!=='active')throw auditError(403,'HUB_AUDIT_FORBIDDEN','当前账号无权查看租户审计日志。');
 }
 async function proof(tx,p,r){
  const m=r.meta??{};
  if(r.action.startsWith('researchhub.protocol.')){const rows=await tx.$queryRaw`SELECT audit_id,actor_id,action,target_id,result FROM rh_research.operation WHERE tenant_id=${p.tenantId} AND audit_id=${r.id} AND actor_id=${r.accountId} LIMIT 2`;return rows.length===1?{kind:'operation',row:rows[0]}:null;}
  if(r.action.startsWith('directory_decision_')&&hash(m.contentHash)){
   const rows=await tx.$queryRaw`SELECT decision_version,decision,audience FROM rh_directory.decision WHERE tenant_id=${p.tenantId} AND assertion_id=${r.target} AND reviewer_account_id=${r.accountId} AND request_hash=${m.contentHash} LIMIT 2`;return rows.length===1?{kind:'decision',row:rows[0]}:null;
  }
  if(r.action.startsWith('directory_team_')&&hash(m.contentHash)){
   const [e]=await tx.$queryRaw`SELECT team_draft FROM rh_directory.entity WHERE tenant_id=${p.tenantId} AND id=${r.target}`;
   const o=e?.team_draft?.operations?.filter(x=>x.actor===r.accountId&&x.hash===m.contentHash&&'directory_team_'+x.operation===r.action);return o?.length===1?{kind:'team',row:o[0].result}:null;
  }
  if(r.action==='update_account'&&m.schemaVersion==='researchhub.account-status.receipt.v1'&&m.result?.id===m.targetAccountId){
   const a=await tx.account.findFirst({where:{id:m.targetAccountId,tenantId:p.tenantId},select:{id:true}});if(a)return{kind:'account',row:m.result};
  }
  if(r.action==='pi_project_member_change'&&m.hubResult?.accountId===r.target){
   const parent=await tx.researchProject.findFirst({where:{tenantId:p.tenantId,id:r.researchProjectId,studyGroupId:r.studyGroupId},select:{id:true}});if(parent)return{kind:'member',row:m.hubResult};
  }
  if(r.action==='researchhub.source_review.receipt'&&m.schemaVersion==='hub-source-review-receipt.v1'&&hash(m.requestHash)&&m.review&&m.input){
   const target=m.kind==='pmc'?m.input.versionId:m.kind==='external'?m.input.documentId:m.input.sourceRecordId??m.input.batchId;
   if(target===r.target)return{kind:'source',row:{kind:m.kind}};
  }
  if(r.action==='hub.token.reconciled'&&m.schema==='rh-token-reconciliation.v1'&&m.result?.id===r.target&&m.result?.status==='settled'&&Number.isSafeInteger(m.actualTokens)&&m.actualTokens>=0&&m.result.actualTokens===m.actualTokens){
   const v=await tx.tokenQuotaReservation.findFirst({where:{tenantId:p.tenantId,id:r.target,status:'settled',accountId:m.affectedAccountId,reconciliationUsageRecordId:m.result.usageRecordId},select:{actualTokens:true}});
   const u=await tx.usageRecord.findFirst({where:{tenantId:p.tenantId,id:m.result.usageRecordId,accountId:m.affectedAccountId},select:{totalTokens:true}});
   if(v?.actualTokens?.toString()===String(m.actualTokens)&&u?.totalTokens===m.actualTokens)return{kind:'billing',row:{actualTokens:m.actualTokens}};
  }
  const n=normalize({action:r.action,meta:r.meta});
  if(n?.schemaVersion==='sensitive-audit.v1'&&n.scope?.tenantId===p.tenantId&&n.scope.studyGroupId===r.studyGroupId&&n.scope.researchProjectId===r.researchProjectId&&n.actor?.accountId===r.accountId)return{kind:'sensitive',row:n};
  return null;
 }
 async function label(tx,p,r){const a=r.accountId?await tx.account.findFirst({where:{id:r.accountId,tenantId:p.tenantId},select:{displayName:true}}):null;return a?.displayName??null;}
 async function link(tx,p,r,pr){
  if(pr?.kind==='operation'&&r.researchProjectId){
   const project=await tx.researchProject.findFirst({where:{id:r.researchProjectId,tenantId:p.tenantId,status:'active',studyGroupId:r.studyGroupId},select:{id:true}});
   const protocol=project&&await tx.studyProtocolVersion.findFirst({where:{id:r.target,tenantId:p.tenantId,studyGroupId:r.studyGroupId,researchProjectId:project.id,acceptanceFixture:false},select:{id:true}});
   const group=project&&await tx.studyGroup.findFirst({where:{id:r.studyGroupId,tenantId:p.tenantId,status:'active'},select:{id:true}});
   if(protocol&&group){const b=await tx.$queryRaw`SELECT id FROM rh_research.study_binding WHERE tenant_id=${p.tenantId} AND execution_project_id=${project.id} AND study_group_id=${r.studyGroupId} LIMIT 2`;if(b.length===1&&safeId(b[0].id)&&safeId(r.target))return{label:'查看研究方案',href:'/pages/s07/?'+new URLSearchParams({formalPreparation:'1',studyId:b[0].id,protocolId:r.target})};}
  }
  if(pr?.kind==='team'){const rows=await tx.$queryRaw`SELECT id FROM rh_directory.entity WHERE tenant_id=${p.tenantId} AND id=${r.target} AND kind='team' AND archived_at IS NULL AND creation_hub_key='lingshu-xinyu'`;if(rows.length===1)return{label:'查看团队审核记录',href:'/pages/g02/?'+new URLSearchParams({view:'directory-review',team:r.target})};}
  if(pr?.kind==='account'||pr?.kind==='member')return{label:'查看用户与权限',href:'/pages/g03/'};
  if(pr?.kind==='source')return{label:'查看资料审核',href:'/pages/g02/?view=source-review'};
  if(pr?.kind==='billing')return{label:'查看Token对账记录',href:'/pages/g02/?'+new URLSearchParams({view:'token-reconciliation',record:r.target})};
  return null;
 }
 return{
  list:async(p,q={})=>{const f=parseAuditQuery(q);return transact(p,async tx=>{await current(tx,p);const where={tenantId:p.tenantId,...(f.action?{action:f.action}:{}),...(f.target?{target:f.target}:{})};
   const binding={tenant:p.tenantId,actor:p.accountId,version:p.authVersion,take:f.take,action:f.action??null,target:f.target??null};
   const last=f.cursor?cursors.decode(f.cursor,binding,x=>safeId(x?.id)&&typeof x.createdAt==='string'&&Number.isFinite(Date.parse(x.createdAt))&&x.skip===f.skip):null;
   if(f.skip&&!last)throw auditError(400,'HUB_AUDIT_QUERY_INVALID','翻页位置已失效，请重新查询。');
   const seek=last?{...where,OR:[{createdAt:{lt:new Date(last.createdAt)}},{createdAt:new Date(last.createdAt),id:{lt:last.id}}]}:where;
   const [found,total]=await Promise.all([tx.auditLog.findMany({where:seek,select:{id:true,tenantId:true,accountId:true,action:true,target:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:f.take+1}),tx.auditLog.count({where})]),rows=found.slice(0,f.take);
   const ids=[...new Set(rows.map(r=>r.accountId).filter(Boolean))],accounts=ids.length?await tx.account.findMany({where:{tenantId:p.tenantId,id:{in:ids}},select:{id:true,displayName:true}}):[],labels=new Map(accounts.map(a=>[a.id,a.displayName]));
   await current(tx,p);const end=rows.at(-1);return{items:rows.map(r=>projectAudit(r,labels.get(r.accountId))),total,...f,nextCursor:found.length>f.take?cursors.encode(binding,{id:end.id,createdAt:new Date(end.createdAt).toISOString(),skip:f.skip+rows.length}):null,actionOptions:Object.entries(actionLabels).map(([value,label])=>({value,label}))};
  });},
  detail:async(p,id)=>{if(!safeId(id))throw auditError(404,'HUB_AUDIT_NOT_FOUND','该记录不存在或当前不可读取。');return transact(p,async tx=>{await current(tx,p);const r=await tx.auditLog.findFirst({where:{tenantId:p.tenantId,id},select:{id:true,tenantId:true,studyGroupId:true,researchProjectId:true,accountId:true,action:true,target:true,createdAt:true,meta:true}});if(!r)throw auditError(404,'HUB_AUDIT_NOT_FOUND','该记录不存在或当前不可读取。');
   const pr=await proof(tx,p,r),evidence=projectProof(r,pr),view={...projectAudit(r,await label(tx,p,r)),evidence,navigation:['verified','receipt'].includes(evidence.status)?await link(tx,p,r,pr):null};await current(tx,p);return view;
  });}
 };
}
