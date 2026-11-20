import test from 'node:test';
import assert from 'node:assert/strict';
import {isolateContractTasks} from './contract-task-isolation.mjs';
test('normal runtime keeps its tenant/object scope while excluding reserved contract-test sessions',()=>{
 const original={tenantId:'tenant',accountId:{in:['one','two']}};
 const queue={scopeWhere:()=>original};assert.equal(isolateContractTasks(queue),queue);
 assert.deepEqual(queue.scopeWhere(),{AND:[original,{NOT:{sessionId:{startsWith:'rh-aiq-'}}}]});
 assert.deepEqual(original,{tenantId:'tenant',accountId:{in:['one','two']}});
});
test('isolation introduces no account, Study, KB or request-count admission list',()=>{
 const queue={scopeWhere:()=>({tenantId:'hub'})};isolateContractTasks(queue);const filter=queue.scopeWhere().AND[1];
 assert.deepEqual(Object.keys(filter.NOT),['sessionId']);
 assert(!JSON.stringify(filter).includes('accountId'));assert(!JSON.stringify(filter).includes('researchProjectId'));
});
