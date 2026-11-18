import test from 'node:test';import assert from 'node:assert/strict';import {presentFormalDataQueries} from './query-source.mjs';
test('query source uses scoped pseudonyms and field labels, batching actors without contact details',async()=>{
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},calls=[];
 const tx={formAssignment:{findMany:async input=>{calls.push(input);return [{id:'assignment',subjectId:'subject',subjectVisitId:'visit',subject:{subjectId:'SYNTHETIC-01'},subjectVisit:{visitPlan:{name:'基线访视'}},formVersion:{schema:{fields:[{key:'value',label:'观察值'}]},template:{name:'通用表单'}}}];}},account:{findMany:async input=>{calls.push(input);return [{id:'actor',displayName:'研究者'}];}}};
 const query={id:'query',target:{ref:{assignmentId:'assignment'},fieldKey:'value'},events:[{actorId:'actor'},{actorId:'removed'}]};
 const [row]=await presentFormalDataQueries(tx,scope,[query]);assert.equal(row.source.subjectCode,'SYNTHETIC-01');assert.equal(row.source.fieldLabel,'观察值');assert.equal(row.events[0].actorDisplayName,'研究者');assert.equal(row.events[1].actorDisplayName,'历史账号');assert.equal(calls.length,2);assert.equal(calls[0].where.tenantId,scope.tenantId);assert.equal(calls[1].where.tenantId,scope.tenantId);assert.equal(calls[1].select.username,undefined);
 await assert.rejects(()=>presentFormalDataQueries(tx,scope,[{...query,target:{...query.target,fieldKey:'missing'}}]),e=>e.code==='DATA_QUERY_SOURCE_CHANGED');
});
test('missing source fails closed and empty pages do not read unrelated actors',async()=>{
 assert.deepEqual(await presentFormalDataQueries({}, {}, []),[]);
 await assert.rejects(()=>presentFormalDataQueries({formAssignment:{findMany:async()=>[]},account:{findMany:async()=>[]}}, {tenantId:'tenant'},[{target:{ref:{assignmentId:'missing'},fieldKey:null},events:[]}]),e=>e.code==='DATA_QUERY_SOURCE_CHANGED');
});
