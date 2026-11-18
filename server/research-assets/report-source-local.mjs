// Approved local C2/C3 fixture boundary; not the formal product's source policy.
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
export const C2_REPORT=Object.freeze({tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:'cmwczp5hk0003lud9lsla5b75',ownerAccountId:'rh-kb-local-b0e2af9d-admin',studyId:'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d',reportId:'rh-formal-report-2d0c1ee7-a6b9-48b9-8433-f47be111ae58',version:1,contentHash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b',runId:'cmwdq0636001jlud6scho3s1q',snapshotId:'t15-snapshot-c7c8c9fe-cf98-4a2d-b395-2e0dff721f43',title:'C2科研资产来源合成报告'});
const fail=()=>{throw catalogError('FORBIDDEN',403,'当前操作超出已确认的报告资产范围。');};
export const isC2Scope=p=>p?.tenantId===C2_REPORT.tenantId&&p.studyGroupId===C2_REPORT.studyGroupId&&p.researchProjectId===C2_REPORT.researchProjectId&&p.accountId===C2_REPORT.ownerAccountId;
export const c2ReportPolicy=(policy,p)=>isC2Scope(p)&&policy?.sourceKind==='artifact'&&assetDigest(policy.sourceBindings)===assetDigest([{kind:'artifact',id:C2_REPORT.reportId,version:1,contentHash:C2_REPORT.contentHash}]);
const nextAction=r=>({1:'submit',2:'review',3:'edit',4:'submit',5:'review'}[r.revision]);
export function c2ReportActions(record,p){const action=nextAction(record.registry);return ['read','versions',...(isC2Scope(p)&&record.registry.ownerAccountId===p.accountId&&record.policies?.length&&record.policies.every(v=>c2ReportPolicy(v,p)&&v.sourceValid===true)&&action&&action!=='edit'?[action]:[])];}
export function assertC2ReportEvent(p,{record,action,input}){
 const r=record.registry;
 if(!isC2Scope(p)||!p.isTenantAdmin||r.ownerAccountId!==p.accountId||!record.policies?.length||!record.policies.every(v=>c2ReportPolicy(v,p)&&v.sourceValid===true)||r.kind!=='publication'||action!==nextAction(r)||action==='edit'||r.workingVersionNo!==(r.revision<=3?1:2)||r.workingState!==({1:'draft',2:'in_review',4:'draft',5:'in_review'}[r.revision])||action==='review'&&input.conclusion!==(r.revision===2?'changes_requested':'approved'))fail();
}
export async function assertC2ReportDraft(tx,p,command){
 const{value,action,registry:r,next}=command;
 if(!isC2Scope(p)||!p.isTenantAdmin||value.kind!=='publication'||!c2ReportPolicy(value,p)||value.metadata.title!==C2_REPORT.title||!value.metadata.limitations.includes('合成')||value.policy.discoveryRecipients.length)fail();
 if(action==='create'){
  const rows=await tx.$queryRawUnsafe("SELECT asset_id FROM rh_asset.asset_registry WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND asset_id LIKE 'rhab-%'",p.tenantId,p.studyGroupId,p.researchProjectId);
  if(rows.length)fail();
 }else if(action!=='revise'||r.ownerAccountId!==p.accountId||r.revision!==3||r.workingVersionNo!==1||r.workingState!=='changes_requested'||next.workingVersionNo!==2)fail();
}
