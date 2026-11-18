import {researchError} from '../research-studies/contract.mjs';
import {fullStudyHash,validateFullStudyCase} from '../research-analysis/full-study-projection.mjs';

const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const scopeKey=scope=>scopeKeys.map(key=>scope?.[key]??'').join('\0');
const changed=()=>{throw researchError(409,'SIMULATION_REGISTRATION_CHANGED','模拟配置登记已变化，请重新核对。');};

/** Targets come from trusted deployment composition, never request parameters. */
export function createSimulationAdmission({targets=[]}={}){
 if(!Array.isArray(targets))throw Error('SIMULATION_ADMISSION_INVALID');
 const byScope=new Map(),studyIds=new Set(),caseIds=new Set();
 for(const input of targets){
  const target=structuredClone(input),key=scopeKey(target.scope);
  if(![target.caseId,target.studyId,target.registrationAuditId,target.registrationActorId,...scopeKeys.map(k=>target.scope?.[k])].every(identifier)||byScope.has(key)||studyIds.has(target.studyId)||caseIds.has(target.caseId))throw Error('SIMULATION_ADMISSION_INVALID');
  byScope.set(key,target);studyIds.add(target.studyId);caseIds.add(target.caseId);
 }
 return{
  isTarget:studyId=>studyIds.has(studyId),
  async resolveCase(tx,scope){
   const target=byScope.get(scopeKey(scope));if(!target)return null;
   const where={...target.scope,id:target.registrationAuditId,accountId:target.registrationActorId,action:'researchhub.simulation.register',target:target.studyId};
   const row=await tx.auditLog.findFirst({where});
   // Registration can follow draft policy creation. Its absence never authorizes execution.
   if(!row)return null;
   if(Object.entries(where).some(([key,value])=>row[key]!==value)||row.meta?.caseId!==target.caseId)changed();
   let value;try{value=validateFullStudyCase(row.meta.case);}catch{changed();}
   if(value.caseId!==target.caseId||value.studyId!==target.studyId||scopeKey(value.scope)!==scopeKey(target.scope)||fullStudyHash(value)!==row.meta.caseHash)changed();
   return structuredClone(value);
  },
 };
}
