import test from'node:test';import assert from'node:assert/strict';
const api=await import('./local-crf-methods-ai.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
class HttpException extends Error{}
const require=p=>p==='@nestjs/common'?{HttpException}:{lockAuthorizationMutation:async()=>{}};
test('damaged_provenance_never_QA_fallback or delivers private body',async()=>{
 assert.equal(typeof api.createCrfMethodsAi,'function','fifth-family projection missing');
 for(const[job,meta]of [[{payload:{researchCrfMethods:null}},{}],[null,{provenance:{researchCrfMethodsResult:null,knowledgeSources:[{quote:'HIDDEN'}]}}],[{payload:{researchCrfMethods:{kind:'result_interpretation',binding:{}}}},{provenance:{researchCrfMethodsResult:{items:['HIDDEN']}}}]]){
 const ai=api.createCrfMethodsAi({ids:{},methods:{},prisma:{forTenant:()=>({knowledgeChatJob:{findFirst:async()=>job}})},require,root:'/unused/'}),m=await ai.projectMessage({accountId:'owner'},{id:'m',sessionId:'s',content:'HIDDEN',meta});assert.equal(m.meta.sourceStatus,'restricted');assert(!JSON.stringify(m).includes('HIDDEN'));
 }
});
test('original four families retain their ordinary message projection path',async()=>{
 assert.equal(typeof api.createCrfMethodsAi,'function');for(const payload of [{},{researchPlan:{}},{researchDesign:{}},{researchExecutionPreparation:{}},{researchSyntheticEdc:{}}]){
 const ai=api.createCrfMethodsAi({ids:{},methods:{},prisma:{forTenant:()=>({knowledgeChatJob:{findFirst:async()=>({payload})}})},require,root:'/unused/'});assert.equal(await ai.projectMessage({accountId:'owner'},{id:'m',sessionId:'s',meta:{},content:'ordinary'}),null);}
});
