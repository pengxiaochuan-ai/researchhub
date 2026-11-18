import test from 'node:test';import assert from 'node:assert/strict';
import {assertVerifiedReportSource,buildReportSourceRegistration} from '../server/research-assets/report-source.mjs';
import {assetDigest} from '../scripts/research-assets-registration-contract.mjs';
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a',displayName:'研究者'},content='# 原统计报告\n\n仅使用确定性算子的原始结果。',target={studyId:'study',reportId:'rh-formal-report-generic',version:1,contentHash:assetDigest(content)};
const source=()=>({artifact:{id:target.reportId,tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'a',typeKey:'analysis_report',status:'released',currentVersionNo:1,title:'原方法报告'},version:{id:'fixed-v1',versionNo:1,contentMd:content,contentHash:target.contentHash},basis:{studyId:'study',snapshotId:'snapshot'},source:{id:'method-run'}});
test('generic report source binds a native verified result, fixed body, current parent and ownership',()=>{
 assert.equal(assertVerifiedReportSource(source(),p,target).version.contentMd,content);
 for(const change of [s=>s.artifact.ownerAccountId='other',s=>s.artifact.researchProjectId='other',s=>s.artifact.tenantId='other',s=>s.artifact.typeKey='research_report',s=>s.artifact.status='draft',s=>s.artifact.currentVersionNo=2,s=>s.version.contentMd='forged',s=>s.version.contentHash='a'.repeat(64),s=>s.basis.studyId='other',s=>s.source=null]){const s=source();change(s);assert.throws(()=>assertVerifiedReportSource(s,p,target));}
});
test('only notes are client supplied; statistics, provenance, version and private policy are server derived',()=>{
 const notes={purpose:'研究讨论',limitations:'历史合成报告，不代表新研究结论。',rightsEvidence:'本人原创材料，仅限私有登记和审核。',requestKey:'generic-report-source-create'};
 const v=buildReportSourceRegistration(notes,source(),p,target);assert.equal(v.contentMd,content);assert.equal(v.kind,'publication');assert.equal(v.metadata.title,'原方法报告');assert.deepEqual(v.sourceBindings,[{kind:'artifact',id:target.reportId,version:1,contentHash:target.contentHash}]);assert.deepEqual(v.policy.discoveryRecipients,[]);
 for(const extra of [{contentMd:'替换结果'},{ownerAccountId:'other'},{sourceBindings:[]},{purpose:''},{requestKey:'x'}])assert.throws(()=>buildReportSourceRegistration({...notes,...extra},source(),p,target));
});
test('incomplete principals never become implicit owners or matching parents',()=>{
 for(const key of ['tenantId','studyGroupId','researchProjectId','accountId']){const actor={...p},s=source();delete actor[key];if(key==='accountId')delete s.artifact.ownerAccountId;else delete s.artifact[key];assert.throws(()=>assertVerifiedReportSource(s,actor,target));}
});
