import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createResearchStudiesController} from './controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('reflect-metadata');
class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){}createProtocolVersionInTransaction(){}}
test('due-visits is a no-store GET forwarding strict query without POST metadata or unrelated transaction',async()=>{
 let transactions=0,cache;const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction:()=>{transactions++;throw Error('unexpected transaction');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example'});
 assert.equal(typeof Controller.prototype.dueVisits,'function','WF05 original controller must register the read-only card');assert.equal(Reflect.getMetadata('method',Controller.prototype.dueVisits),0);assert.equal(Reflect.getMetadata('path',Controller.prototype.dueVisits),'research-studies/:id/due-visits');assert.equal(Reflect.getMetadata('__httpCode__',Controller.prototype.dueVisits),undefined);
 await assert.rejects(new Controller().dueVisits({user:{tenantId:'tenant',accountId:'actor',authVersion:0}},{setHeader:(name,value)=>{if(name==='Cache-Control')cache=value;}},undefined,{id:'study'},{limit:'0'}),e=>e.getStatus()===400);assert.equal(cache,'no-store');assert.equal(transactions,0);
});
