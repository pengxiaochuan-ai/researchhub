import test from 'node:test';
import assert from 'node:assert/strict';
import {releasePolicyPeople} from './protocol-release.mjs';
test('policy responsibility names are scoped to the tenant and preserve fixed audit IDs and content',async()=>{
 const policy={id:'policy',createdBy:'author',reviewedBy:'reviewer',sections:{ethics:{status:'configured'}},contentHash:'fixed'};let query;
 const tx={account:{findMany:async q=>{query=q;return [{id:'author',displayName:'记录研究员'},{id:'reviewer',displayName:'审核研究员'}];}}};
 const result=await releasePolicyPeople(tx,{tenantId:'tenant'},policy);
 assert.deepEqual(query,{where:{tenantId:'tenant',id:{in:['author','reviewer']}},select:{id:true,displayName:true}});
 assert.equal(result.createdByName,'记录研究员');assert.equal(result.reviewedByName,'审核研究员');assert.equal(result.createdBy,'author');assert.equal(result.reviewedBy,'reviewer');assert.equal(result.sections,policy.sections);assert.equal(result.contentHash,'fixed');assert(!('createdByName'in policy));
});
test('absent or unavailable responsibility names do not invent a person',async()=>{
 const tx={account:{findMany:async()=>[]}};
 assert.equal(await releasePolicyPeople(tx,{tenantId:'tenant'},null),null);
 const result=await releasePolicyPeople(tx,{tenantId:'tenant'},{createdBy:'missing',reviewedBy:null});assert.equal(result.createdByName,null);assert.equal(result.reviewedByName,null);
});
