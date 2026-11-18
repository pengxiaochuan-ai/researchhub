import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createResearchStudiesController} from './controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('reflect-metadata');
class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){}createProtocolVersionInTransaction(){}}
test('WF11 only registers a no-store GET under the current Study and assignment',()=>{
 const C=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction(){throw Error('UNEXPECTED_TRANSACTION');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example'});
 const method=C.prototype.correctionImpact;assert(method);assert.equal(Reflect.getMetadata('method',method),0);assert.equal(Reflect.getMetadata('path',method),'research-studies/:id/assignments/:assignmentId/correction-impact');
});
