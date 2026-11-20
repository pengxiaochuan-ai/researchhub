import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createResearchStudiesController} from './controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('reflect-metadata');
class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){}createProtocolVersionInTransaction(){}}
test('subject data is a no-store GET and rejects invalid selectors before any transaction',async()=>{
 let transactions=0,cache;
 const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction:()=>{transactions++;throw Error('no transaction');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example'}),method=Controller.prototype.subjectData;
 assert.equal(Reflect.getMetadata('method',method),0);assert.equal(Reflect.getMetadata('path',method),'research-studies/:id/subjects/:subjectId/data');assert.equal(Reflect.getMetadata('__httpCode__',method),undefined);
 await assert.rejects(new Controller().subjectData({user:{tenantId:'tenant',accountId:'actor',authVersion:0}},{setHeader:(name,value)=>{if(name==='Cache-Control')cache=value;}},undefined,{id:'study',subjectId:'subject'},{section:'features',fileId:'file'}),e=>e.getStatus()===400);
 assert.equal(cache,'no-store');assert.equal(transactions,0);
});
