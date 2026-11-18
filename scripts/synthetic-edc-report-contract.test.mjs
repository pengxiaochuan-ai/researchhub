import test from 'node:test';
import assert from 'node:assert/strict';
import {packet,validate} from '../tests/fixtures/synthetic-edc-runtime.mjs';
import {runSyntheticQuality} from './synthetic-edc-contract.mjs';
import {buildEdcReportFacts,renderEdcReport,edcReportCurrent} from './synthetic-edc-report-contract.mjs';
function fixture(){const b=packet();b.binding={planId:'plan',parentRootVersionNo:4};b.quality=runSyntheticQuality(b,{id:'quality',accountId:'owner',at:'now'},validate);return b;}
test('EDC report facts are deterministic from actual saved packet quality, not old seeded Python runs',()=>{
 const b=fixture(),facts=buildEdcReportFacts({id:'packet',versionNo:3},b,[],{explanation:null,job:null},[]);assert.equal(facts.schema,'rh-synthetic-edc-report.v1');assert.equal(facts.quality.id,'quality');assert.deepEqual(facts.recordVersions,[{recordId:'record',syntheticSubjectKey:'SIM_01',visitKey:'baseline',formKey:'crf',status:'draft',responseRevision:0}]);assert.equal(facts.ai.status,'not_run');assert.deepEqual(facts.ai.unexplainedFindingIds,b.quality.findings.map(f=>f.findingId));assert(!Object.hasOwn(facts,'seed'));assert(!Object.hasOwn(facts,'runId'));assert(!Object.hasOwn(facts,'operatorVersion'));
 assert(edcReportCurrent(facts,b));assert(!edcReportCurrent(facts,{...b,dataRevision:1}));assert(!edcReportCurrent(facts,{...b,quality:{...b.quality,id:'different'}}));assert(edcReportCurrent(facts,{...b,operations:[{kind:'metadata'}]}));assert.throws(()=>buildEdcReportFacts({id:'packet',versionNo:3},{...b,dataRevision:1},[],{},[]));
});
test('notes never replace machine facts; plain text is escaped and old report schemas are rejected',()=>{
 const b=fixture(),facts=buildEdcReportFacts({id:'packet',versionNo:3},b,[],{job:{status:'failed'},explanation:null},[]),md=renderEdcReport(facts,'<script>payload</script>');assert.equal(facts.ai.status,'failed');assert(md.includes('未执行Python'));assert(md.includes('不是正式'));assert(!md.includes('<script>'));assert.throws(()=>renderEdcReport({...facts,schema:'rh-synthetic-report.v1'},''));assert.throws(()=>renderEdcReport(facts,'x'.repeat(6001)));
});
