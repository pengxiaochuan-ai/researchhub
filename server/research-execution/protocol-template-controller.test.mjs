import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createResearchStudiesController} from '../research-studies/controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('reflect-metadata');
class UnusedCore {
 executeHubTaskCommandInTransaction(){} enrollInTransaction(){}
 fixedReferenceStatusInTransaction(){throw Error('unused');}
 createProtocolVersionInTransaction(){throw Error('unused');}
}
test('native template endpoints retain GET preview/receipt and explicit POST 200 metadata',()=>{
 const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction:()=>{throw Error('unused');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example'});
 for(const [name,path]of [['protocolTemplates','research-studies/:id/protocol-templates'],['protocolTemplatePreview','research-studies/:id/protocol-templates/:sourceStudyId/:sourceProtocolId'],['protocolTemplateReceipt','research-studies/:id/protocol-template-imports/receipts/:requestKey']]){
  const method=Controller.prototype[name];assert.equal(Reflect.getMetadata('path',method),path);assert.equal(Reflect.getMetadata('method',method),0);
 }
 const method=Controller.prototype.protocolTemplateImport;assert.equal(Reflect.getMetadata('path',method),'research-studies/:id/protocol-template-imports');assert.equal(Reflect.getMetadata('method',method),1);assert.equal(Reflect.getMetadata('__httpCode__',method),200);
 assert.equal(Reflect.getMetadata('__httpCode__',Controller.prototype.create),201);
});
