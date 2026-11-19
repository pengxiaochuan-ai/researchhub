import test from'node:test';import assert from'node:assert/strict';import{closeRuntimeResources}from'./shutdown.mjs';
test('failed capture shutdown still closes the application, with gates closed first',async()=>{
 const calls=[];await assert.rejects(closeRuntimeResources({foundation:{stop(){calls.push('gates');}},accounts:{close(){calls.push('mail');throw Error('synthetic failure');}},app:{async close(){calls.push('app');}},prisma:{onModuleDestroy(){calls.push('prisma-fallback');}}}),/RESEARCH_RUNTIME_SHUTDOWN_FAILED/);assert.deepEqual(calls,['gates','mail','app']);
});
test('both early resource failures still attempt Prisma cleanup and hide internal details',async()=>{
 const calls=[];await assert.rejects(closeRuntimeResources({accounts:{close(){throw Error('must-not-leak');}},app:{close(){throw Error('must-not-leak');}},prisma:{onModuleDestroy(){calls.push('prisma');}}}),e=>e.message==='RESEARCH_RUNTIME_SHUTDOWN_FAILED');assert.deepEqual(calls,['prisma']);
});
