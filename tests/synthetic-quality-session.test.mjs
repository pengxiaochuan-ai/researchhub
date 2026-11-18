import{test}from'node:test';import assert from'node:assert/strict';
import{createKnowledgeClient}from'../src/knowledge-session.js';
import{validateSyntheticEdits}from'../src/synthetic-quality-form.js';
const data={subjects:[{id:'SYN-001',age:null,group:'A'}],visits:[{id:'V-001-T0',completedAt:'2026-01-02T00:00:00.000Z'}],measurements:[]};
test('client only adds nested synthetic create/list/read/revision, never generic method/review/lock/export',async()=>{
 const calls=[],c=createKnowledgeClient({scope:()=>({studyGroupId:'g',researchProjectId:'p'}),fetchImpl:async(path,init)=>{calls.push(path);return{ok:true,headers:new Headers({'Content-Type':'application/json'}),json:async()=>({})};}});
 await c.post('/research-plan-drafts/plan/synthetic-trials',{});await c.get('/research-plan-drafts/plan/synthetic-trials?limit=10');await c.get('/research-plan-drafts/plan/synthetic-trials/run');await c.post('/research-plan-drafts/plan/synthetic-trials/run/revisions',{});
 for(const p of ['/research-method-runs','/research-plan-drafts/plan/synthetic-trials/run/review','/research-plan-drafts/plan/synthetic-trials/run/lock','/research-plan-drafts/plan/synthetic-trials/run/export'])await assert.rejects(c.post(p,{}));
 await assert.rejects(c.get('/research-plan-drafts/plan/synthetic-trials?limit=21'));assert.equal(calls.length,4);
});
test('manual changes validate exact cell values and focus first invalid, preserving blanks instead of zero',()=>{
 const key='subjects:SYN-001:age';let form=validateSyntheticEdits(data,{[key]:'35'},'');assert.equal(form.valid,false);assert.equal(form.firstInvalid,'reason');
 form=validateSyntheticEdits(data,{[key]:'35'},'研究者手动核对后修正软件夹具');assert.equal(form.valid,true);assert.deepEqual(form.edits,[{table:'subjects',rowId:'SYN-001',field:'age',value:35}]);
 assert.equal(validateSyntheticEdits(data,{[key]:''},'研究者手动核对后修正软件夹具').valid,false);
 assert.equal(validateSyntheticEdits(data,{[key]:'NaN'},'研究者手动核对后修正软件夹具').firstInvalid,key);
 assert.equal(validateSyntheticEdits(data,{'visits:V-001-T0:completedAt':'2026-02-30T00:00:00.000Z'},'研究者手动核对后修正软件夹具').valid,false);
 assert.equal(validateSyntheticEdits(data,{},'计算服务恢复后显式重新运行',true).valid,true);
});
