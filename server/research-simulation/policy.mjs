export const ARMS=Object.freeze(['MDD_TARGET','MDD_NON_TARGET','HEALTHY_REFERENCE']);
export const STAGES=Object.freeze(['V1','V2','V3','V4']);
export const DAYS=Object.freeze([0,14,28,56]);
export const ARM_VISITS=Object.freeze({MDD_TARGET:['V1_PATIENT','V2','V3','V4'],MDD_NON_TARGET:['V1_PATIENT','V2','V3','V4'],HEALTHY_REFERENCE:['V1_HEALTHY']});
import {only,invalid,requestHash} from '../research-studies/contract.mjs';
export const hasSimulationPolicy=sections=>['populationSchedule','simulation'].some(key=>sections?.[key]?.status==='configured');
export function normalizeSimulationSection(key,section,actor,at){
 only(section,['status','source','reason','rules']);if(!['missing','configured'].includes(section.status))invalid();
 if(section.status==='missing')return {status:'missing'};
 for(const key of ['source','reason'])if(typeof section[key]!=='string'||!section[key].trim()||section[key].length>5000||section[key].includes('\0'))invalid();
 const rules=section.rules;
 if(key==='populationSchedule'){
  only(rules,['schemaVersion','armVisitCodes']);if(rules.schemaVersion!=='population-schedule-v1')invalid();
  if(requestHash(rules.armVisitCodes)!==requestHash(ARM_VISITS))invalid();
 }else{
  only(rules,['schemaVersion','stageDays','timezone']);
  if(rules.schemaVersion!=='study-simulation-clock-v1'||rules.timezone!=='Asia/Shanghai'||requestHash(rules.stageDays)!==requestHash(DAYS))invalid();
 }
 return {status:'configured',source:section.source.trim(),reason:section.reason.trim(),rules:structuredClone(rules),decidedBy:actor,decidedAt:at.toISOString()};
}
