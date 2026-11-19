import test from'node:test';import assert from'node:assert/strict';import{boundWorkerLifecycle,disabledEmbeddings,disabledModelExecution}from'./worker-lifecycle.mjs';
test('shutdown gate blocks a late startup scan before database/claim access',async()=>{
 let reads=0,destroys=0;const stops=[],worker={enabled:()=>true,async resumePending(){if(!this.enabled())return;reads++;},onModuleDestroy(){destroys++;}};
 boundWorkerLifecycle(worker,stops);await worker.resumePending();assert.equal(reads,1);stops.forEach(s=>s());await worker.resumePending();assert.equal(reads,1);await worker.onModuleDestroy();await worker.resumePending();assert.equal(reads,1);assert.equal(destroys,1);
});
test('worker gates preserve the research consumer kind argument',()=>{
 const stops=[],worker={enabled:kind=>kind==='research-stage-attempt'};boundWorkerLifecycle(worker,stops);
 assert.equal(worker.enabled('research-stage-attempt'),true);assert.equal(worker.enabled('other'),false);stops[0]();assert.equal(worker.enabled('research-stage-attempt'),false);
});
test('disabled services produce no embeddings, model text or external call',async()=>{
 const e=disabledEmbeddings();assert.equal(await e.embedOne('synthetic'),null);assert.equal(await e.healthy(),false);
 const{provider,pool}=disabledModelExecution();assert.equal(provider.hasKey,false);assert.equal(pool.available(),false);for(const method of ['chat','chatJson','chatWithTools'])await assert.rejects(provider[method](),e=>e.code==='RESEARCH_RUNTIME_AI_NOT_ENABLED');await assert.rejects(pool.acquire(),e=>e.code==='RESEARCH_RUNTIME_AI_NOT_ENABLED');
});
