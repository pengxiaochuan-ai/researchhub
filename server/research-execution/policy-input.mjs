import {invalid,only} from '../research-studies/contract.mjs';
import {normalizeSimulationSection} from '../research-simulation/policy.mjs';
const fields={ethics:['approvalReference','scope'],screening:['criteria','decisionMethod'],researchConsent:['textVersion','evidenceRequirement'],dataUse:['purposes','scope'],withdrawal:['effectiveRule','retentionRule','futureUseRule'],safety:['workflow','responsibility'],site:[],blinding:[],captureReview:['correction','locking','unlocking','reviewResponsibility','reviewIndependence']};
const string=(v)=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>5000||v.includes('\0'))invalid();return v.trim();};
export function normalizePolicySections(input,actor,at){
 only(input,[...Object.keys(fields),'populationSchedule','simulation']);if(typeof actor!=='string'||!actor||!(at instanceof Date)||!Number.isFinite(at.getTime()))invalid();
 const ordinary=Object.fromEntries(Object.entries(fields).map(([key,ruleNames])=>{
  const section=input[key];if(section===undefined)return[key,{status:'missing'}];
  only(section,['status','source','reason','mode','rules']);if(!['missing','configured','not_applicable'].includes(section.status))invalid();
  if(section.status==='missing')return[key,{status:'missing'}];
  const rules=section.rules??{};only(rules,ruleNames);
  return[key,{status:section.status,source:string(section.source),reason:string(section.reason),...(section.mode===undefined?{}:{mode:string(section.mode)}),rules:Object.fromEntries(Object.entries(rules).map(([k,v])=>[k,string(v)])),decidedBy:actor,decidedAt:at.toISOString()}];
 }));
 for(const key of ['populationSchedule','simulation'])if(input[key]!==undefined)ordinary[key]=normalizeSimulationSection(key,input[key],actor,at);
 return ordinary;
}
export function canManageRelease({account,projectMember,groupMember}){
 if(account?.role==='tenant_admin'&&account.isTenantAdmin===true)return true;
 const role=groupMember?.role;
 return account?.role==='researcher'&&account.isTenantAdmin===false&&projectMember?.status==='active'&&projectMember.roleKey==='project_manager'&&groupMember?.status==='active'&&role?.status==='active'&&role.tenantId===account.tenantId&&Array.isArray(role.menuPermissions)&&role.menuPermissions.includes('workbench')&&Array.isArray(role.buttonPermissions)&&role.buttonPermissions.includes('study.configure');
}
