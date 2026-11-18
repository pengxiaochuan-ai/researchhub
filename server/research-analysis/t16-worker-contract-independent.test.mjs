import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});const {buildDescriptiveInput,mapDescriptiveWorkerResult}=require('./src/research-methods/descriptive-analysis-policy.ts');
const current=key=>({basis:{snapshotId:'snapshot',manifestHash:'a'.repeat(64)},manifest:{statisticalUnit:'subject',rowCount:1,subjectCount:1,variables:[{key,valueType:'number'}],rows:[{subjectId:'synthetic',cells:[{key,value:1,missing:null}]}]}});
function worker(input){const code='import json,sys\nfrom serve import execute_job\nstatus,result=execute_job({"schemaVersion":"research-methods-worker.v1","executorKey":"descriptive-statistics","requestId":"synthetic","input":json.load(sys.stdin)})\nprint(json.dumps({"status":status,"result":result}))';const p=spawnSync('python3',['-c',code],{cwd:new URL('../../../app/research-methods-worker/',import.meta.url),input:JSON.stringify(input),encoding:'utf8'});assert.equal(p.status,0);return JSON.parse(p.stdout);}
test('actual Python serve output is accepted by TypeScript mapper with distinct executor and worker versions',()=>{const source=current('score'),out=worker(buildDescriptiveInput(source));assert.equal(out.status,200);assert.equal(out.result.workerVersion,'t19-1');assert.equal(out.result.executorVersion,'descriptive-v1');assert.equal(mapDescriptiveWorkerResult(out.result,{skillKey:'descriptive-statistics',skillVersion:1,inputHash:'x'},source).status,'needs_review');});
test('valid T15 variable key with hyphen is accepted by actual worker',()=>{const out=worker(buildDescriptiveInput(current('a-b')));assert.equal(out.status,200);assert.equal(out.result.ok,true);});

test('full T15 key bounds match real TS→Python→TS path',()=>{
 for(const key of ['a-b','1abc','a'.repeat(160)]){const source=current(key),out=worker(buildDescriptiveInput(source));assert.equal(out.status,200,key);assert.equal(mapDescriptiveWorkerResult(out.result,{skillKey:'descriptive-statistics',skillVersion:1,inputHash:'x'},source).status,'needs_review');}
 assert.throws(()=>buildDescriptiveInput(current('a'.repeat(161))));assert.equal(worker({manifestHash:'a'.repeat(64),columns:[{key:'a'.repeat(161),type:'number'}],rows:[{rowId:'r1',values:{['a'.repeat(161)]:0}}]}).status,400);
});
test('prototype-like legitimate keys retain zero false and null end to end',()=>{
 for(const key of ['constructor','toString'])for(const [kind,value] of [['number',0],['boolean',false],['number',null]]){
  const source={basis:{snapshotId:'snapshot',manifestHash:'a'.repeat(64)},manifest:{statisticalUnit:'subject',rowCount:1,subjectCount:1,variables:[{key,valueType:kind}],rows:[{subjectId:'synthetic',cells:[{key,value,missing:value===null?'null':null}]}]}};
  const input=buildDescriptiveInput(source);assert.equal(Object.hasOwn(input.rows[0].values,key),true,`${key} ${value}`);assert.equal(input.rows[0].values[key],value);const out=worker(input);assert.equal(out.status,200,`${key} ${value}`);const mapped=mapDescriptiveWorkerResult(out.result,{skillKey:'descriptive-statistics',skillVersion:1,inputHash:'x'},source);assert.equal(mapped.status,'needs_review');assert.equal(Object.hasOwn(mapped.outputs.columns,key),true,`mapped ${key}`);
 }
});

test('prototype pollution alias is rejected by TS input',()=>{assert.throws(()=>buildDescriptiveInput(current('__proto__')));});
test('prototype pollution alias is rejected by direct Python worker',()=>{
 const values=JSON.parse('{"__proto__":0}');const out=worker({manifestHash:'a'.repeat(64),columns:[{key:'__proto__',type:'number'}],rows:[{rowId:'r1',values}]});assert.equal(out.status,400);
});
