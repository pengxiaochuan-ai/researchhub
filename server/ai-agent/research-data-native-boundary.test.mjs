import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root='/Users/mac/aisciencesys/app/server/',require=createRequire(root+'package.json');require('ts-node').register({project:root+'tsconfig.json',transpileOnly:true});
const {assignVisitFormInTransaction:assign}=require(root+'src/study-operations/formal-response-assignment.ts'),{writeAnswersInTransaction:write}=require(root+'src/study-operations/formal-response-commands.ts');
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},user={...scope,accountId:'owner',authVersion:5,role:'researcher',isTenantAdmin:false};
const tx={$executeRaw:async()=>0,$queryRaw:async()=>[],$executeRawUnsafe:async()=>0,$queryRawUnsafe:async()=>[],account:{findFirst:async()=>null}};
test('native assign optional server dependency receives the real visit/form and cannot be supplied as a request permit',async()=>{
 const sentinel=Error('checked-resource');let seen;await assert.rejects(assign(tx,user,scope,'actual-visit','actual-form',async(_tx,principal,s,resource)=>{seen={principal,s,resource};throw sentinel;}),e=>e===sentinel);
 assert.deepEqual(seen.resource,{kind:'assign',visitId:'actual-visit',formVersionId:'actual-form'});assert.equal(seen.principal.accountId,'owner');
});
test('native write optional server dependency receives the actual assignment and action',async()=>{
 const sentinel=Error('checked-action');let seen;await assert.rejects(write(tx,user,scope,'actual-assignment',{kind:'submit',requestKey:'request',expectedVersion:0,answers:{}},async(_tx,_u,_s,resource)=>{seen=resource;throw sentinel;}),e=>e===sentinel);
 assert.deepEqual(seen,{kind:'submit',assignmentId:'actual-assignment'});
});
test('ordinary default native paths still require original current authorization',async()=>{
 for(const fn of [()=>assign(tx,user,scope,'visit','form'),()=>write(tx,user,scope,'assignment',{kind:'submit',requestKey:'request',expectedVersion:0,answers:{}})])await assert.rejects(fn,e=>e.getStatus?.()===401);
});
