import test from 'node:test';
import assert from 'node:assert/strict';
import {deferredRuntimeService} from './materials.mjs';
test('native dependency resolves after assembly and methods retain their actual receiver',()=>{
 let ready=false,lookups=0;
 const service={count:2,increment(){return ++this.count;}};
 const deferred=deferredRuntimeService(()=>{lookups++;assert(ready);return service;});
 assert.equal(lookups,0);ready=true;assert.equal(deferred.increment(),3);assert.equal(service.count,3);assert.equal(deferred.count,3);
});
