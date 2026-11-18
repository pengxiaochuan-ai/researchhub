import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';

// Read the actual Nest route metadata in both isolated staging and the repository.
// No application, request, database transaction, worker or listener is started.
const controllerURL=[new URL('../server/research-studies/controller.mjs',import.meta.url),new URL('../../../server/research-studies/controller.mjs',import.meta.url)].find(existsSync);
if(!controllerURL)throw Error('ACTUAL_ANALYSIS_JOB_CONTROLLER_REQUIRED');
const {createResearchStudiesController}=await import(controllerURL.href),require=createRequire(new URL('../../../app/server/package.json',controllerURL));
require('reflect-metadata');
class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){}createProtocolVersionInTransaction(){}}
const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction(){throw Error('route contract must not query');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'https://offline.example',createAnalysisServices:()=>({jobs:{}})});
const names={create:'analysisJobCreate',read:'analysisJob',receipt:'analysisJobReceipt',cancellation:'analysisJobCancellation',cancellationReceipt:'analysisJobCancellationReceipt'};
export const actualJobRoutes=Object.fromEntries(Object.entries(names).map(([key,name])=>{const fn=Controller.prototype[name];return[key,{path:Reflect.getMetadata('path',fn),method:Reflect.getMetadata('method',fn),status:Reflect.getMetadata('__httpCode__',fn)}];}));
export const actualJobPath=(name,params)=>'/'+actualJobRoutes[name].path.replace(/:([A-Za-z]+)/g,(_,key)=>params[key]);
