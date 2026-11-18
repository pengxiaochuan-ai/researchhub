// Explicit synthetic acceptance inputs only; never imported by the product runtime.
import assert from 'node:assert/strict';
import {POLICY_SECTIONS,policySectionsForSave} from '../src/execution-policy-session.js';
const source='WF03合成软件流程验收，不用于真实临床';
const reason='仅核对应用权限、审核与恢复流程，无真实受试者或临床处置。';
const configured={
 screening:{criteria:'仅使用SYNTHETIC编号进行软件验证',decisionMethod:'由本研究有权人员人工确认并记录'},
 researchConsent:{textVersion:'synthetic-wf03-research-consent-v1',evidenceRequirement:'合成测试明确选择的同意事件'},
 dataUse:{purposes:'科研流程软件验收',scope:'本研究合成记录，不含患者资料'},
 withdrawal:{effectiveRule:'停止新的合成采集',retentionRule:'保留合成历史与审计',futureUseRule:'停止新增使用并依当前记录核对'},
 captureReview:{correction:'保留原修订并记录更正原因',locking:'当前修订审阅通过后锁定',unlocking:'有权人员明确填写原因',reviewResponsibility:'当前研究有权审阅者分别承担记录与审核责任'},
};
export function wf03PolicySections(code){
 assert(['A','B','D'].includes(code));
 const result=Object.fromEntries(POLICY_SECTIONS.map(({key,fields})=>{
  const active=key==='site'||Object.hasOwn(configured,key),rules=Object.fromEntries(fields.map(([field])=>[field,configured[key]?.[field]??'']));
  if(key==='captureReview')rules.reviewIndependence=code==='B'?'required':'not_required';
  return[key,{status:active?'configured':'not_applicable',source,reason:reason+(key==='captureReview'?(code==='B'?'本例要求另一有权账号独立审核。':'本例仅验证传输恢复，明确不要求独立审核，不作为临床规则。'):''),...(key==='site'?{mode:'study_wide'}:{}),rules}];
 }));
 assert.deepEqual(policySectionsForSave(result),result);return result;
}
