import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticEdcAi} from './local-synthetic-edc-ai.mjs';
class HttpException extends Error{}
const require=path=>path==='@nestjs/common'?{HttpException}:{lockAuthorizationMutation:async()=>{}};
test('damaged new task provenance never falls back to ordinary Q&A or leaks body and sources',async()=>{
 for(const [job,meta]of [[{payload:{researchSyntheticEdc:null}},{}],[null,{provenance:{researchSyntheticEdcResult:null,knowledgeSources:[{quote:'HIDDEN'}]}}],[{payload:{researchSyntheticEdc:{kind:'quality_explanation',binding:{}}}},{provenance:{researchSyntheticEdcResult:{items:['HIDDEN']}}}]]){
  const ai=createSyntheticEdcAi({ids:{},edc:{},prisma:{forTenant:()=>({knowledgeChatJob:{findFirst:async()=>job}})},require,root:'/unused/'}),m=await ai.projectMessage({accountId:'owner'}, {id:'message',sessionId:'session',role:'assistant',content:'HIDDEN',meta});assert.equal(m.meta.sourceStatus,'restricted');assert(!JSON.stringify(m).includes('HIDDEN'));assert(!m.meta.provenance);
 }
});
test('ordinary Q&A and original three producer families retain their original projection path',async()=>{
 for(const payload of [{},{researchPlan:{}},{researchDesign:{}},{researchExecutionPreparation:{}}]){const ai=createSyntheticEdcAi({ids:{},edc:{},prisma:{forTenant:()=>({knowledgeChatJob:{findFirst:async()=>({payload})}})},require,root:'/unused/'});assert.equal(await ai.projectMessage({accountId:'owner'}, {id:'m',sessionId:'s',meta:{provenance:{knowledgeSources:[{}]}},content:'ordinary'}),null);}
});
