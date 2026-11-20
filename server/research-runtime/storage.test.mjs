import test from'node:test';import assert from'node:assert/strict';
import{storageSettings,createRuntimeStorage,createReadyRuntimeStorage}from'./storage.mjs';
const env={S3_ENDPOINT:'http://storage:9000',S3_BUCKET:'hub-test',S3_ACCESS_KEY:'synthetic',S3_SECRET_KEY:'synthetic-secret'};
test('concurrent startup hooks share one in-flight read-only storage probe',async()=>{
 let release,probes=0;const pending=new Promise(resolve=>{release=resolve;});
 class Base{ready=false;async probeAvailable(){probes++;await pending;this.ready=true;return true;}}class Client{}
 const storage=createRuntimeStorage({load:()=>Base,require:()=>({Client}),settings:storageSettings(env)}),first=storage.onModuleInit(),second=storage.onModuleInit();assert.equal(first,second);assert.equal(probes,1);release();await Promise.all([first,second]);assert.equal(storage.ready,true);
});
test('storage becomes ready before workers assemble; Nest re-entry never resets a ready instance',async()=>{
 let release,probes=0,ready=false;const pending=new Promise(resolve=>{release=resolve;});
 class Base{ready=false;async probeAvailable(){probes++;await pending;this.ready=true;return true;}}
 class Client{}
 const promise=createReadyRuntimeStorage({load:()=>Base,require:()=>({Client}),settings:storageSettings(env)}).then(value=>{ready=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);release();const storage=await promise;assert.equal(storage.ready,true);
 await Promise.all([storage.onModuleInit(),storage.onModuleInit()]);assert.equal(probes,1);assert.equal(storage.ready,true);
});
test('runtime storage cannot select development defaults or create a missing bucket',async()=>{
 for(const bad of [{S3_ENDPOINT:''},{S3_SECRET_KEY:''},{S3_BUCKET:''},{S3_ENDPOINT:'http://user:password@storage:9000'}])assert.throws(()=>storageSettings({...env,...bad}),/RESEARCH_STORAGE_CONFIGURATION_REQUIRED/);
 let writes=0,probes=0;
 class Base{async onModuleInit(){writes++;}async probeAvailable(){probes++;return false;}}
 class Client{makeBucket(){writes++;}}
 const storage=createRuntimeStorage({load:()=>Base,require:()=>({Client}),settings:storageSettings(env)});
 await assert.rejects(storage.onModuleInit(),/RESEARCH_STORAGE_NOT_READY/);assert.equal(writes,0);assert.equal(probes,1);
 Base.prototype.probeAvailable=async function(){probes++;this.ready=true;return true;};
 await storage.onModuleInit();assert.equal(writes,0);assert.equal(storage.ready,true);
});
