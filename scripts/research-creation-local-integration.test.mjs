import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLocalResearchPrisma,researchCreationBodyRoute} from './research-creation-local-integration.mjs';
import {resolveLocalResearchLaunch} from './research-creation-local.mjs';

test('old creation start command forwards to19501 without another fixture or port',()=>{
 assert.equal(resolveLocalResearchLaunch([]).url,'http://127.0.0.1:19501/pages/q02/');
 assert.equal(resolveLocalResearchLaunch(['--mode','local-synthetic']).url,'http://127.0.0.1:19501/pages/q02/');
 assert.throws(()=>resolveLocalResearchLaunch(['--mode','local-synthetic','--fixture','private.json']));
});

test('new research transaction uses the allowed tenant and its own explicit group/project in one app transaction',async()=>{
 const seen=[],tx={$executeRaw:async(strings,...values)=>seen.push(values)};
 const adapter=createLocalResearchPrisma({tenantId:'tenant-test',transaction:async callback=>{seen.push('transaction');return callback(tx);}});
 const result=await adapter.withTenantTransaction('tenant-test','new-group','new-project',async current=>{assert.equal(current,tx);seen.push('business');return 12;});
 assert.equal(result,12);assert.deepEqual(seen,['transaction',['tenant-test','new-group','new-project'],'business']);
});
test('cross tenant and malformed scopes never open a transaction; missing scope clears context',async()=>{
 let calls=0,values;const adapter=createLocalResearchPrisma({tenantId:'tenant-test',transaction:async callback=>{calls++;return callback({$executeRaw:async(_,...v)=>values=v});}});
 await assert.rejects(()=>adapter.withTenantTransaction('other',undefined,undefined,async()=>{}));
 await assert.rejects(()=>adapter.withTenantTransaction('tenant-test',"group'",undefined,async()=>{}));assert.equal(calls,0);
 await adapter.withTenantTransaction('tenant-test',undefined,undefined,async()=>{});assert.deepEqual(values,['tenant-test','','']);
});
test('body routing is limited to the new research module and leaves existing contracts untouched',()=>{
 for(const path of ['/api/research-projects','/api/research-projects/id/studies','/api/research-studies/id','/api/research-hub-roles/hub/account'])assert(researchCreationBodyRoute(path));
 for(const path of ['/api/research-projects-else','/api/research-plan-drafts/id','/api/study-tasks','/api/hubs/hub'])assert.equal(researchCreationBodyRoute(path),false);
});
