import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createResearchStudiesController} from './controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('reflect-metadata');
class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){}createProtocolVersionInTransaction(){}}
test('WF09 actual controller registers no-store GET and forwards the exact actor/study/selector to the existing report service',async()=>{
 const calls=[],headers={},user={accountId:'actor',authVersion:0},query={runGroupId:'group-run'};
 const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction(){throw Error('CONTROLLER_MUST_NOT_WRITE');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example',createAnalysisServices:()=>({reports:{preview:async(...args)=>{calls.push(args);return{status:'preview'};}}})});
 const method=Controller.prototype.formalReportPreview;assert.equal(Reflect.getMetadata('method',method),0);assert.equal(Reflect.getMetadata('path',method),'research-studies/:id/analysis/report-preview');assert.equal(Reflect.getMetadata('__httpCode__',method),undefined);
 assert.deepEqual(await new Controller().formalReportPreview({user},{setHeader:(k,v)=>headers[k]=v},undefined,{id:'study'},query),{status:'preview'});assert.equal(headers['Cache-Control'],'no-store');assert.deepEqual(calls,[[user,'study',query]]);
});
