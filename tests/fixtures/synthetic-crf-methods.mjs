import {syntheticEdcConfig} from './synthetic-edc.mjs';
import {edcDigest,runSyntheticQuality,classifySyntheticAnswers} from '../../scripts/synthetic-edc-contract.mjs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
export const validateCrfFixture=require('./src/study-operations/study-forms-policy.ts').normalizeAndValidateAnswers;
export function crfPacketFixture(){
 const config=syntheticEdcConfig(),subjects=[1,2,3].map(n=>({key:'SIM_0'+n,label:'合成被试 '+n}));
 const binding={planId:'plan',parentRootVersionNo:3,preparationRevisionNo:1,configHash:edcDigest(config),picoConfirmationHash:'pico',sourcesHash:'sources',basis:{},ownerAccountId:'owner',tenantId:'tenant',studyGroupId:'group',researchProjectId:'study',sessionId:'session',kbId:'kb'};
 const values=[{value:{state:'value',value:0},flag:{state:'value',value:false},note:{state:'value',value:'不应离开记录包的合成原文'}},{value:{state:'not_measured'},flag:{state:'not_applicable'}},{value:{state:'value',value:12},flag:{state:'value',value:true}}];
 const records=subjects.flatMap((s,i)=>['baseline','followup'].map(visitKey=>({recordId:s.key+'_'+visitKey,syntheticSubjectKey:s.key,visitKey,formKey:'crf',status:'draft',responseRevision:0,answers:classifySyntheticAnswers(config,visitKey==='baseline'?values[i]:{},validateCrfFixture).answers,updatedBy:'owner',updatedAt:'2026-10-25T00:00:00.000Z',recordedBy:null,recordedAt:null})));
 let b={type:'rh-synthetic-edc.v1',schemaVersion:1,purpose:'synthetic_capture_rehearsal',ownerAccountId:'owner',binding,config,selectedVisitKeys:['baseline','followup'],subjects,records,dataRevision:0,quality:null,pending:null,operations:[]};
 b.quality=runSyntheticQuality(b,{id:'dq-fixture',accountId:'owner',at:'2026-10-25T00:00:00.000Z'},validateCrfFixture);return{...b,seal:edcDigest(b)};
}
export const crfVersionFixture=()=>({collectionId:'collection',versionId:'packet-version',versionNo:7});
