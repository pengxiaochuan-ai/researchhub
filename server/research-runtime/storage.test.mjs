import test from'node:test';import assert from'node:assert/strict';
import{storageSettings,createRuntimeStorage}from'./storage.mjs';
const env={S3_ENDPOINT:'http://storage:9000',S3_BUCKET:'hub-test',S3_ACCESS_KEY:'synthetic',S3_SECRET_KEY:'synthetic-secret'};
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
