import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createResearchStudiesController} from '../research-studies/controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('reflect-metadata');
class UnusedCore {executeHubTaskCommandInTransaction(){} enrollInTransaction(){} fixedReferenceStatusInTransaction(){} createProtocolVersionInTransaction(){}}
test('participation receipt forwards strict query to the native service and keeps GET/POST metadata',async()=>{
 let transactions=0;
 const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction:()=>{transactions++;throw Error('unexpected transaction');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example'});
 const instance=new Controller(),req={user:{tenantId:'tenant',accountId:'actor',authVersion:0}},res={setHeader(){}};
 await assert.rejects(instance.participationReceipt(req,res,undefined,{id:'study',subjectId:'subject',requestKey:'original_request'},{action:'record',requestHash:'bad'}),e=>e.getStatus()===400&&e.getResponse().code==='RESEARCH_INPUT_INVALID');assert.equal(transactions,0);
 assert.equal(Reflect.getMetadata('method',Controller.prototype.participationReceipt),0);assert.equal(Reflect.getMetadata('path',Controller.prototype.participationReceipt),'research-studies/:id/subjects/:subjectId/participation/receipts/:requestKey');
 for(const action of ['participationEvent','enrollSubject'])assert.equal(Reflect.getMetadata('__httpCode__',Controller.prototype[action]),200);
});
