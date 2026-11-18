// Local synthetic execution boundary, separate from normal business semantics.
// Approved 2026-11-17: two actors x two Studies x two new protocol drafts,
// at most two versions and six committed events each (48 in aggregate).
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {businessAssetKey} from './business-family.mjs';
import {assertRepairDraft,assertRepairEvent,isRepairRegistry} from './business-local-repair.mjs';
import {C2_REPORT,isC2Scope,c2ReportPolicy,c2ReportActions,assertC2ReportDraft,assertC2ReportEvent} from './report-source-local.mjs';
export const BUSINESS_LOCAL_MEMBER='rh-c1-asset-member-20261117';
const memberKinds=['protocol','dataset','instrument','analysis','publication'];
export const businessLocalCapacity=p=>p.accountId===BUSINESS_LOCAL_MEMBER?6:2;
export function assertBusinessLocalScope(ids,p){
 if(isC2Scope(p))return;
 const actor=![ids.owner,ids.admin].includes(p?.accountId)?p?.accountId===BUSINESS_LOCAL_MEMBER&&p?.researchProjectId===ids.project:true;
 if(p?.tenantId!==ids.tenant||p.studyGroupId!==ids.group||![ids.project,'rh-asset-detail-20261113-study-b'].includes(p.researchProjectId)||!actor)throw catalogError('FORBIDDEN',403,'当前账号或研究不在本次登记范围内。');
}
export function projectBusinessLocalActions(records,p){
 return records.map(record=>{
  if(record.family?.family!=='business')return record;
  if(record.registry.researchProjectId===C2_REPORT.researchProjectId)return{...record,aiAvailability:'unavailable',availableActions:c2ReportActions(record,p),...(record.policies?.length&&record.policies.every(v=>c2ReportPolicy(v,p)&&v.sourceValid===true)?{sourceOrigin:{studyId:C2_REPORT.studyId,reportId:C2_REPORT.reportId,reportVersion:1}}:{})};
  const r=record.registry,own=r.ownerAccountId===p.accountId;
  if(isRepairRegistry(r)&&r.revision>=6){const recipient=!own&&!p.isTenantAdmin&&record.policies?.some(v=>v.version===3&&v.discoveryRecipientCeiling.includes(p.accountId));return{...record,aiAvailability:'unavailable',availableActions:['read','versions',...(own&&r.revision===6?['edit']:[]),...(own&&r.revision===7?['submit']:[]),...(recipient?({10:['request_access'],12:['cite']}[r.revision]??[]):[]),...(p.isTenantAdmin?({8:['review'],9:['release'],11:['manage_access'],13:['withdraw']}[r.revision]??[]):[])]};}
  return{...record,aiAvailability:'unavailable',availableActions:['read','versions',...(own&&r.workingVersionNo<2&&r.revision<4?['edit']:[]),...(own&&r.revision<5?['submit','trash']:[]),...(p.isTenantAdmin&&r.revision<6?['review']:[])]};
 });
}
export function createBusinessLocalEventBudget(ids){
 return async(_tx,p,{record,action,input})=>{
  assertBusinessLocalScope(ids,p);businessAssetKey(record.registry.assetId);
  if(p.researchProjectId===C2_REPORT.researchProjectId)return assertC2ReportEvent(p,{record,action,input});
  const r=record.registry;
  if(isRepairRegistry(r)&&r.revision>=6)return assertRepairEvent(p,{record,action,input},ids);
  const permitted=action==='review'?p.isTenantAdmin:r.ownerAccountId===p.accountId;
  const member=r.ownerAccountId===BUSINESS_LOCAL_MEMBER&&r.researchProjectId===ids.project;
  if(record.family?.family!=='business'||!(member?memberKinds.includes(r.kind):r.kind==='protocol')||r.workingVersionNo>2||![ids.owner,ids.admin,BUSINESS_LOCAL_MEMBER].includes(r.ownerAccountId)||r.revision>=6||!['submit','review','trash','restore'].includes(action)||!permitted)throw catalogError('FORBIDDEN',403,'当前操作超出已确认的合成资产范围。');
  if(['trash','submit'].includes(action)&&r.revision>=5)throw catalogError('FIXTURE_CAPACITY',409,'请保留后续恢复或审核所需的操作次数。');
 };
}
export function createBusinessLocalBudget(ids){
 return async(tx,p,command)=>{
  assertBusinessLocalScope(ids,p);
  if(p.researchProjectId===C2_REPORT.researchProjectId)return assertC2ReportDraft(tx,p,command);
  const member=p.accountId===BUSINESS_LOCAL_MEMBER;
  if(!(member?memberKinds.includes(command.value.kind):command.value.kind==='protocol')||command.value.sourceKind!=='author'||!command.value.metadata.title.startsWith(member?'C1成员合成资产 ':'C1合成方案 ')||!command.value.metadata.limitations.includes('合成'))throw catalogError('FORBIDDEN',403,'当前登记范围仅限已确认的合成资产。');
  if(command.action==='create'){
   const rows=await tx.$queryRawUnsafe("SELECT asset_id,owner_account_id,asset_kind FROM rh_asset.asset_registry WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND asset_id LIKE 'rhab-%'",p.tenantId,p.studyGroupId,p.researchProjectId);
   if(rows.some(r=>![ids.owner,ids.admin,BUSINESS_LOCAL_MEMBER].includes(r.owner_account_id)))throw catalogError('CONTEXT_INVALID',409,'当前登记范围需要重新核对。');
   const own=rows.filter(r=>r.owner_account_id===p.accountId);
   if(own.length>=businessLocalCapacity(p)||member&&own.filter(r=>r.asset_kind===command.value.kind).length>=(command.value.kind==='protocol'?2:1))throw catalogError('FIXTURE_CAPACITY',409,'当前可新增数量已用完，请核对已有资产。');
  }else{
   businessAssetKey(command.id);
   if(isRepairRegistry(command.registry)&&command.registry.revision>=6)return assertRepairDraft(tx,p,command,ids);
   if(command.action!=='revise'||command.registry.ownerAccountId!==p.accountId||command.next.workingVersionNo>2||command.registry.revision>=6)throw catalogError('FIXTURE_CAPACITY',409,'当前修订超出已确认范围，请保留输入。');
  }
 };
}
