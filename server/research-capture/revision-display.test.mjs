import test from 'node:test';import assert from 'node:assert/strict';import {presentFormalRevisions} from './revision-display.mjs';
test('revision responsibility uses exact tenant account display names or truthful H5 and historical labels',async()=>{
 let calls=0;const tx={account:{findMany:async input=>{calls++;assert.equal(input.where.tenantId,'tenant');assert.deepEqual(input.where.id.in,['actor','removed']);assert.deepEqual(input.select,{id:true,displayName:true});return [{id:'actor',displayName:'研究者'}];}}};
 const items=await presentFormalRevisions(tx,{tenantId:'tenant'},[{actorKind:'account',actorId:'actor'},{actorKind:'h5_session',actorId:'private-session'},{actorKind:'account',actorId:'removed'}]);assert.deepEqual(items.map(i=>i.actorDisplayName),['研究者','问卷自填','历史账号']);assert.equal(calls,1);assert.deepEqual(await presentFormalRevisions({}, {}, []),[]);
});
