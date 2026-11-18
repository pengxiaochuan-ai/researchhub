import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {crfMethodAssetFixture} from '../tests/fixtures/crf-method-assets.mjs';
import {edcDigest} from './synthetic-edc-contract.mjs';
const api=await import('./crf-method-assets-contract.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('complete hand-checked golden recipe, not a builder-derived expectation',()=>{
 const file=new URL('../tests/fixtures/crf-method-assets-recipe.json',import.meta.url);assert(existsSync(file),'complete golden fixture missing');
 assert.deepEqual(api.buildCrfMethodAssetSnapshot(crfMethodAssetFixture()).snapshot.reuseRecipe,JSON.parse(readFileSync(file)));
});
test('real_report_not_legacy_seed: current saved head and immutable actual method only',()=>{
 assert.equal(typeof api.buildCrfMethodAssetSnapshot,'function','new real-method asset builder missing');
 const input=crfMethodAssetFixture(),before=JSON.stringify(input),{snapshot,snapshotHash}=api.buildCrfMethodAssetSnapshot(input);
 assert.equal(snapshot.report.id,'method-report');assert.equal(snapshot.report.versionNo,2);assert.equal(snapshot.report.versionId,'report-version-2');
 assert.equal(snapshot.historicalFacts.result.evidenceGroups[0].missingRate,0.333333);assert.equal(snapshot.historicalFacts.recordVersions[0].responseRevision,2);
 assert.equal(snapshotHash,edcDigest(snapshot));assert.equal(JSON.stringify(input),before);
 for(const patch of [{sourceStatus:'stale'},{version:1},{typeKey:'research_report'},{factsHash:'damaged'},{facts:{...input.report.facts,schema:'rh-synthetic-report.v1'}}])assert.throws(()=>api.buildCrfMethodAssetSnapshot({...input,report:{...input.report,...patch}}));
 assert.throws(()=>api.buildCrfMethodAssetSnapshot({...input,run:{...input.run,id:'wrong-run'}}));
});
test('recipe_excludes_answers_and_historical_results: closed projection preserves null and manual bounds',()=>{
 assert.equal(typeof api.buildCrfMethodAssetSnapshot,'function');const {snapshot}=api.buildCrfMethodAssetSnapshot(crfMethodAssetFixture()),r=snapshot.reuseRecipe;
 assert.deepEqual(Object.keys(r).sort(),['config','coverage','method','mustReconfirm','schema','source','steps']);
 assert.deepEqual(r.source,{reportId:'method-report',versionNo:2,versionId:'report-version-2',factsHash:snapshot.report.factsHash,materials:[{docId:'document',kbId:'knowledge',chunkId:'chunk',docTitle:'已审核合成方法资料',version:2,contentHash:'1'.repeat(64),chunkHash:'2'.repeat(64)}]});
 assert.deepEqual(r.config.visits[0],{key:'baseline',name:'合成基线',order:1,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null});
 assert.deepEqual(r.config.form.schema.fields[0],{key:'value',label:'软件数值',type:'number',required:true,min:0,max:10});
 assert.equal(r.config.form.schema.fields[2].required,false);
 assert.deepEqual(r.method,{executor:'research-data-quality',workerVersion:'t19-1',adapterVersion:'crf-quality-adapter.v1'});
 assert.deepEqual(r.mustReconfirm,['question_and_material_rights','population_and_eligibility','visits_units_and_missingness','manual_ranges_and_method','new_data_and_quality','formal_governance']);
 const keys=[];function walk(v){if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){keys.push(k);walk(x);}}walk(r);
 for(const key of ['records','answers','recordVersions','syntheticSubjectKey','result','dataset','seed','notes','runId','inputHash','resultHash'])assert(!keys.includes(key),key+' leaked');
 assert(!JSON.stringify(r).includes('0.333333'));assert(!JSON.stringify(r).includes('前序配置说明'));
});
test('every recipe object rejects unknown keys, including nested answer injection',()=>{
 assert.equal(typeof api.assertCrfMethodReuseRecipe,'function');const {snapshot}=api.buildCrfMethodAssetSnapshot(crfMethodAssetFixture());
 const paths=[[],['source'],['source','materials',0],['config'],['config','outcomes',0],['config','visits',0],['config','form'],['config','form','schema'],['config','form','schema','fields',0],['config','form','schema','fields',2,'options',0],['config','mappings',0],['method'],['coverage']];
 for(const path of paths){const recipe=structuredClone(snapshot.reuseRecipe);let target=recipe;for(const key of path)target=target[key];target.answers={value:'forbidden'};assert.throws(()=>api.assertCrfMethodReuseRecipe(recipe),JSON.stringify(path));}
});
test('recipe inherits validated source set rather than inventing a six-source limit',()=>{
 const {snapshot}=api.buildCrfMethodAssetSnapshot(crfMethodAssetFixture()),recipe=structuredClone(snapshot.reuseRecipe);
 recipe.source.materials=Array.from({length:7},(_,i)=>({...recipe.source.materials[0],chunkId:'chunk-'+i}));
 assert.doesNotThrow(()=>api.assertCrfMethodReuseRecipe(recipe));
});
test('no_AI_is_not_fake_explained; historical results and notes are escaped, not regenerated',()=>{
 assert.equal(typeof api.renderCrfMethodAsset,'function');const input=crfMethodAssetFixture(),{snapshot}=api.buildCrfMethodAssetSnapshot(input);
 assert.equal(snapshot.historicalFacts.ai.status,'not_requested');
 const md=api.renderCrfMethodAsset(snapshot,'<script>本人说明</script>',[]);assert(md.includes('待重新确认'));assert(md.includes('0.333333'));assert(md.includes('不是新研究结果'));assert(!md.includes('<script>'));
 assert.throws(()=>api.buildCrfMethodAssetSnapshot({...input,report:{...input.report,facts:{...input.report.facts,answers:{raw:'do not copy'}}}}));
});
test('notes_no_change_422_no_operation, CAS and persisted retry keep the original version',()=>{
 assert.equal(typeof api.crfMethodAssetNotesOperation,'function','asset notes/CAS contract missing');
 const state={versionNo:1,notes:'',operations:[]},body={baseVersionNo:1,notes:'本人待核对复用范围',requestKey:'notes-request-001'},out=api.crfMethodAssetNotesOperation(state,body);
 assert.equal(out.operation.versionNo,2);assert.equal(out.notes,body.notes);assert.equal(state.operations.length,0);
 const next={versionNo:2,notes:out.notes,operations:[out.operation]};assert.equal(api.crfMethodAssetNotesOperation(next,body).idempotent,true);
 assert.throws(()=>api.crfMethodAssetNotesOperation(next,{...body,notes:'改输入'}),e=>e.message==='CRF_ASSET_KEY_CONFLICT');
 assert.throws(()=>api.crfMethodAssetNotesOperation(next,{...body,baseVersionNo:2,requestKey:'no-change-002'}),e=>e.message==='CRF_ASSET_NO_CHANGE');
 assert.throws(()=>api.crfMethodAssetNotesOperation(next,{...body,requestKey:'stale-CAS-003'}),e=>e.message==='CRF_ASSET_VERSION_CONFLICT');
 assert.throws(()=>api.crfMethodAssetNotesOperation({...next,versionNo:30},{baseVersionNo:30,notes:'超30版',requestKey:'capacity-004'}),e=>e.message==='CRF_ASSET_CAPACITY');
 assert.equal(api.crfMethodAssetNotesOperation({...next,versionNo:30},body).operation.versionNo,2);
});
test('parent_changed_back_still_stale; real root head and conditional source status drive delivery',()=>{
 assert.equal(typeof api.crfMethodAssetSourceState,'function','current source-state contract missing');const f=crfMethodAssetFixture(),{snapshot}=api.buildCrfMethodAssetSnapshot(f),parent={id:'parent',version:1,currentVersion:1,sourceStatus:'current'};
 assert.equal(api.crfMethodAssetSourceState({snapshot,report:f.report,ancestors:[parent]}),'current');
 assert.equal(api.crfMethodAssetSourceState({snapshot,report:{...f.report,currentVersion:3},ancestors:[]}),'stale');
 assert.equal(api.crfMethodAssetSourceState({snapshot,report:f.report,ancestors:[{...parent,currentVersion:3}]}),'stale');
 assert.equal(api.crfMethodAssetSourceState({snapshot,report:{...f.report,sourceStatus:'restricted'},ancestors:[]}),'restricted');
 assert.equal(api.crfMethodAssetSourceState({snapshot,report:f.report,ancestors:[{...parent,sourceStatus:'restricted'}]}),'restricted');
 assert.throws(()=>api.crfMethodAssetSourceState({snapshot,report:{...f.report,id:'wrong-report'},ancestors:[]}));
});
test('derive_eighth_is_last; lineage is fixed, acyclic and does not mutate parent notes',()=>{
 assert.equal(typeof api.deriveCrfMethodAssetLineage,'function','private derivation contract missing');
 const parent={id:'parent',version:2,currentVersion:2,sourceStatus:'current',contentHash:'a'.repeat(64),notes:'固定本人说明',lineage:Array.from({length:7},(_,i)=>({id:'ancestor-'+i,version:1,contentHash:'b'.repeat(64),notes:'旧说明'}))},before=JSON.stringify(parent),out=api.deriveCrfMethodAssetLineage(parent);
 assert.equal(out.length,8);assert.deepEqual(out[7],{id:'parent',version:2,contentHash:'a'.repeat(64),notes:'固定本人说明'});assert.equal(JSON.stringify(parent),before);
 for(const change of [{lineage:out},{currentVersion:3},{sourceStatus:'stale'},{lineage:[out[7]]}])assert.throws(()=>api.deriveCrfMethodAssetLineage({...parent,...change}));
 assert.throws(()=>api.deriveCrfMethodAssetLineage({...parent,lineage:out.map((v,i)=>({...v,id:'eight-'+i}))}),e=>e.message==='CRF_ASSET_CAPACITY');
});
