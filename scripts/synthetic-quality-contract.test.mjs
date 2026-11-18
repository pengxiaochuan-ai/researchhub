import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {generateSyntheticDataset,qualitySourceRows,reviseSyntheticDataset,assertSyntheticBinding,datasetHash,locateSyntheticFinding} from './synthetic-quality-contract.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const{assembleQualityManifest,findQualityPhiKey}=require('../../app/server/src/research-methods/research-method-quality-manifest.ts');
function operator(dataset){const manifest=assembleQualityManifest(qualitySourceRows(dataset));assert.equal(findQualityPhiKey(manifest),null);const code="import sys,json;sys.path.insert(0,'app/research-methods-worker');from data_quality import execute_data_quality;print(json.dumps(execute_data_quality(json.load(sys.stdin))))";const [status,result]=JSON.parse(execFileSync('python3',['-B','-c',code],{cwd:new URL('../../',import.meta.url),input:JSON.stringify(manifest),encoding:'utf8'}));assert.equal(status,200);return{manifest,result};}
test('fixed seed reproduces synthetic data without LLM, and bounds input',()=>{
 const a=generateSyntheticDataset(42);assert.deepEqual(a,generateSyntheticDataset(42));assert.notEqual(datasetHash(a),datasetHash(generateSyntheticDataset(43)));assert.equal(a.subjects.length,8);assert.equal(a.visits.length,16);assert.equal(a.measurements.length,16);
 for(const seed of [0,-1,1e6,1.2,'42',NaN])assert.throws(()=>generateSyntheticDataset(seed),/SEED/);
});
test('actual original manifest and Python operator detect all five planted defect categories',()=>{
 const dataset=generateSyntheticDataset(42),before=JSON.stringify(dataset),{result}=operator(dataset),codes=result.outputs.findings.map(f=>f.code);
 for(const code of ['MISSING_RATE_WARNING','RANGE_ABOVE_MAX','LEAKAGE_MULTI_GROUP','TIME_ORDER_BLOCKING','DUPLICATE_KEY'])assert.ok(codes.includes(code),code);
 assert.equal(result.outputs.llm,false);assert.equal(result.outputs.autoRepaired,false);assert.equal(JSON.stringify(dataset),before);
 const finding=result.outputs.findings.find(f=>f.code==='RANGE_ABOVE_MAX');assert.ok(locateSyntheticFinding(dataset,finding).some(p=>p.table==='subjects'&&p.rowId==='SYN-002'&&p.field==='age'));
});
test('only explicit whitelisted edits with reason create a new immutable snapshot, then actual DQ changes',()=>{
 const data=generateSyntheticDataset(42),before=JSON.stringify(data),edits=[{table:'subjects',rowId:'SYN-001',field:'age',value:35},{table:'subjects',rowId:'SYN-004',field:'age',value:36},{table:'subjects',rowId:'SYN-002',field:'age',value:37},{table:'subjects',rowId:'SYN-003',field:'group',value:'A'},{table:'visits',rowId:'V-004-T1',field:'completedAt',value:'2026-01-03T00:00:00.000Z'},{table:'measurements',rowId:'M-005-T1',field:'collectedAt',value:'2026-01-03T00:00:00.000Z'}];
 const revision=reviseSyntheticDataset(data,edits,'人工核对软件夹具后修正预埋错误');assert.equal(JSON.stringify(data),before);assert.equal(revision.changes.length,6);assert.notEqual(datasetHash(data),datasetHash(revision.dataset));const{result}=operator(revision.dataset);
 assert.ok(!result.outputs.findings.some(f=>['MISSING_RATE_WARNING','RANGE_ABOVE_MAX','LEAKAGE_MULTI_GROUP','TIME_ORDER_BLOCKING','DUPLICATE_KEY'].includes(f.code)));
 for(const [patches,reason]of [[edits,''],[[{...edits[0],field:'patientName'}],'合法修改理由足够长'],[[{...edits[0],rowId:'foreign'}],'合法修改理由足够长'],[[{...edits[0],value:'真实姓名'}],'合法修改理由足够长'],[[edits[0],edits[0]],'合法修改理由足够长'],[[{...edits[4],value:'2026-02-30T00:00:00.000Z'}],'合法修改理由足够长']])assert.throws(()=>reviseSyntheticDataset(data,patches,reason));
});
test('binding rejects changed plan, PICO, content, or restricted source instead of rebasing',()=>{
 const b={planId:'p',version:4,contentHash:'body',picoHash:'pico'},live={...b,sourceStatus:'current'};assert.doesNotThrow(()=>assertSyntheticBinding(b,live));for(const c of [{...live,planId:'other'},{...live,version:5},{...live,contentHash:'changed'},{...live,picoHash:'changed'},{...live,sourceStatus:'restricted'}])assert.throws(()=>assertSyntheticBinding(b,c),/BINDING/);
});
