import test from 'node:test';import assert from 'node:assert/strict';
import {createBusinessLocalTransaction} from '../server/research-assets/business-local-catalog.mjs';
const ids={tenant:'t',group:'g',project:'a',owner:'owner',admin:'admin'},user={tenantId:'t',studyGroupId:'g',researchProjectId:'rh-asset-detail-20261113-study-b',accountId:'owner'};
test('Study B reuses the existing scoped app transaction adapter instead of loosening the shared startup fence',async()=>{
 const settings=[],tx={$executeRawUnsafe:async(_sql,key,value)=>settings.push([key,value])};
 const prisma={app:{$transaction:async run=>run(tx)},withTenantTransaction:()=>assert.fail('the original local wrapper only accepts Study A')};
 const transaction=createBusinessLocalTransaction({ids,prisma,withAuthorizationMutation:(client,tenant,run,options)=>{assert.equal(tenant,ids.tenant);assert.equal(options.includeOfficial,true);assert.equal(options.elevated,undefined);return client.withTenantTransaction(tenant,options.studyGroupId,options.researchProjectId,run);}});
 assert.equal(await transaction(user,async received=>{assert.equal(received,tx);return 'same transaction';}),'same transaction');
 assert.deepEqual(settings,[['app.tenant_id','t'],['app.study_group_id','g'],['app.research_project_id',user.researchProjectId]]);
 await assert.rejects(transaction({...user,researchProjectId:'unapproved'},()=>assert.fail()),e=>e.status===403);
});
test('Study A retains the original guarded client and real authorization options',async()=>{
 const prisma={},transaction=createBusinessLocalTransaction({ids,prisma,withAuthorizationMutation:async(client,tenant,_run,options)=>{assert.equal(client,prisma);assert.equal(tenant,'t');assert.equal(options.researchProjectId,'a');return true;}});
 assert.equal(await transaction({...user,researchProjectId:'a'},()=>{}),true);
});
