import test from 'node:test';
import assert from 'node:assert/strict';
import * as ai from './synthetic-edc-ai-contract.mjs';
import {edcDigest,runSyntheticQuality} from './synthetic-edc-contract.mjs';
import {packet,validate} from '../tests/fixtures/synthetic-edc-runtime.mjs';
import {createRequire} from 'node:module';
import {EDC_AI_REQUEST_TEXT} from './local-synthetic-edc-ai.mjs';
test('the new read-only task wording follows the existing actual KB fast path',()=>{const require=createRequire(new URL('../../app/server/package.json',import.meta.url)),{shouldUseKbAnswerFastPath}=require('../../app/server/src/orchestrator/kb-agent-performance-policy.ts');assert(shouldUseKbAnswerFastPath({message:EDC_AI_REQUEST_TEXT,currentKbId:'kb',canSearch:true,hasAttachments:false}));});
function fixture(){const b=packet();b.binding={planId:'plan',parentRootVersionNo:4,preparationRevisionNo:1,configHash:edcDigest(b.config),picoConfirmationHash:'pico',sourcesHash:'sources',basis:{artifactId:'plan',versionNo:3,contentHash:'content',picoConfirmationHash:'pico',sourcesHash:'sources'},ownerAccountId:'owner',tenantId:'tenant',studyGroupId:'group',researchProjectId:'study',sessionId:'session',kbId:'kb'};b.quality=runSyntheticQuality(b,{id:'quality',accountId:'owner',at:'now'},validate);return b;}
test('EDC binding is exclusive across four task families and binds saved quality and selected IDs',()=>{
 const b=fixture(),ids=[b.quality.findings[0].findingId],binding=ai.syntheticExplanationBinding('collection',b,ids),payload={researchSyntheticEdc:{kind:'quality_explanation',binding}};
 assert.deepEqual(ai.syntheticEdcTask(payload).binding,binding);for(const k of ['researchPlan','researchDesign','researchExecutionPreparation'])assert.throws(()=>ai.syntheticEdcTask({...payload,[k]:{}}));
 for(const k of ['researchPlan','researchDesign','researchExecutionPreparation'])assert.throws(()=>ai.bindSyntheticEdcTask({[k]:{}},binding));
 for(const bad of [null,{}, {kind:'quality_explanation',binding:{...binding,extra:1}},{kind:'other',binding}])assert.throws(()=>ai.syntheticEdcTask({researchSyntheticEdc:bad}));
 assert.equal(ai.syntheticEdcTask({researchPlan:{}}),null);assert.throws(()=>ai.syntheticExplanationBinding('collection',b,[]));assert.throws(()=>ai.syntheticExplanationBinding('collection',b,[...ids,...ids]));assert.throws(()=>ai.syntheticExplanationBinding('collection',b,['fake']));
 assert.throws(()=>ai.syntheticExplanationBinding('collection',{...b,dataRevision:1},ids));assert.throws(()=>ai.selectSyntheticFindings({...b,dataRevision:1},ids));
});
test('model input never includes raw answers, correction prose, numerical parameters or record counts',()=>{
 const b=fixture();b.records[0].answers.note={state:'value',value:'SECRET_RAW_9281'};b.records[0].answers.value={state:'value',value:9281};b.quality=runSyntheticQuality(b,{id:'quality',accountId:'owner',at:'now'},validate);b.lastChange={reason:'SECRET_REASON'};
 const selected=b.quality.findings.slice(0,2).map(f=>f.findingId),projection=ai.syntheticExplanationInput(b,selected,{population:'合成三十名受试者',intervention:'合成干预'}),text=JSON.stringify(projection);
 assert(!text.includes('SECRET_'));assert(!text.includes('9281'));assert(!text.includes('三十'));assert(!text.includes('checkedRecordCount'));assert(!text.includes('answers'));assert.equal(projection.findings.length,2);assert(projection.findings.every(f=>!Object.hasOwn(f,'value')));
});
test('strict explanation JSON ties each narrative citation to actual sources and real selected findings',()=>{
 const b=fixture(),findingId=b.quality.findings[0].findingId,trusted={config:b.config,findingIds:[findingId],sources:[{docId:'doc'}]},good={items:[{findingId,explanation:'必填信息缺失，应由研究者核对原始记录。[1]',question:'是否需要补充缺失原因？[1]',sourceRefs:[1]}]};
 assert.deepEqual(ai.parseSyntheticExplanation(JSON.stringify(good),trusted),good);
 for(const item of [{...good.items[0],findingId:'invented'},{...good.items[0],sourceRefs:[]},{...good.items[0],sourceRefs:[2]},{...good.items[0],explanation:'缺失',question:'',sourceRefs:[1]},{...good.items[0],question:'应该补充'},{...good.items[0],explanation:'共30人。[1]'},{...good.items[0],explanation:'共三十名受试者。[1]'},{...good.items[0],explanation:'立即修改配置。[1]'},{...good.items[0],patch:{a:1}}])assert.throws(()=>ai.parseSyntheticExplanation(JSON.stringify({items:[item]}),trusted));
 assert.throws(()=>ai.parseSyntheticExplanation(JSON.stringify({items:[...good.items,...good.items]}),trusted));assert.throws(()=>ai.parseSyntheticExplanation(JSON.stringify({...good,patch:[]}),trusted));
});
test('only accurate technical IDs are exempt, never neighboring IDs or scientific quantities',()=>{
 const b=fixture(),findingId=b.quality.findings[0].findingId,trusted={config:b.config,findingIds:[findingId],findings:[{recordId:'rec_01',subjectKey:'SIM_01',visitKey:'visit1',formKey:'crf1',fieldKey:'field1'}],sources:[{}]},item={findingId,explanation:'字段field1缺少必填信息，需研究者核对。[1]',question:'',sourceRefs:[1]};
 assert(ai.parseSyntheticExplanation(JSON.stringify({items:[item]}),trusted));
 for(const text of ['字段field12缺少信息。[1]','字段field1有30名受试者。[1]','字段field1为三十例。[1]'])assert.throws(()=>ai.parseSyntheticExplanation(JSON.stringify({items:[{...item,explanation:text}]}),trusted));
 assert(ai.parseSyntheticExplanation(JSON.stringify({items:[{...item,explanation:'需核对资料。'.repeat(90)+'[1]',question:'是否需要研究者核对资料的适用范围'.repeat(30)+'？[1]'}]}),trusted));
});
test('another cited item cannot conceal an uncited literature claim',()=>{
 const b=fixture(),ids=b.quality.findings.slice(0,2).map(f=>f.findingId),items=[{findingId:ids[0],explanation:'原始记录需要核对。[1]',question:'',sourceRefs:[1]},{findingId:ids[1],explanation:'材料显示该问题不影响研究结论。',question:'',sourceRefs:[]}];assert.throws(()=>ai.parseSyntheticExplanation(JSON.stringify({items}),{config:b.config,findingIds:ids,sources:[{}]}));
});
