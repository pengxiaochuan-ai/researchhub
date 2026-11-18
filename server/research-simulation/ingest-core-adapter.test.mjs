import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {simulationIngestServiceClass} from './ingest-core-adapter.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},metadata={modality:'eeg'},file={originalname:'eeg.csv',buffer:Buffer.from('key,value\nx,0\n')},formal={studyId:'s',visitId:'v',requestKey:'key'};
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected=sha(JSON.stringify({parserVersion:'parseFormalFeatureFile-v1',studyId:'s',visitId:'v',subjectId:'db-subject',modality:'eeg',filename:'eeg.csv',digest:sha(file.buffer)}));
function fixture(saved){const events=[],tx={$queryRaw:async()=>{events.push('receipt');return saved?[saved]:[];}},simulation={withExecutionTx:async(t,u,s,fn)=>{events.push('project-lock');assert.equal(t,tx);return fn();},guardVisitSchedule:async()=>{events.push('stage');}};
 class Legacy{async ingestPreprocessed(u,m,f,c){return this.withUploadPublication(u,m,{},async()=>{events.push('legacy-publish');return{originalReceipt:true};});}async withUploadPublication(u,m,p,fn,before){await before?.(tx);events.push('legacy-bind-lock');return fn(tx,{subject:{id:'db-subject'}});}}
 return{events,Service:simulationIngestServiceClass({Service:Legacy,simulation}),Legacy};}
test('upload locks scope then checks schedule after saved receipt lookup',async()=>{const f=fixture();assert.deepEqual(await new f.Service().ingestPreprocessed(user,metadata,file,formal),{originalReceipt:true});assert.deepEqual(f.events,['project-lock','legacy-bind-lock','receipt','stage','legacy-publish']);});
test('same upload replays across stages and changed body conflicts',async()=>{const f=fixture({request_hash:expected,action:'file.preprocessed',target_id:'v'});await new f.Service().ingestPreprocessed(user,metadata,file,formal);assert(!f.events.includes('stage'));await assert.rejects(new f.Service().ingestPreprocessed(user,metadata,{...file,buffer:Buffer.from('changed')},formal),e=>e.code==='RESEARCH_REQUEST_KEY_CONFLICT');});
test('nonformal and original instances keep legacy paths',async()=>{const f=fixture();await new f.Service().ingestPreprocessed(user,metadata,file);assert.deepEqual(f.events,['legacy-bind-lock','legacy-publish']);f.events.length=0;await new f.Legacy().ingestPreprocessed(user,metadata,file,formal);assert.deepEqual(f.events,['legacy-bind-lock','legacy-publish']);});
test('both pre-binding not-ready and postreceipt stage failures preserve legacy staged-object cleanup',async()=>{
 const {HttpException}=runtimeDependencies().require('@nestjs/common');
 for(const phase of ['before','stage']){
  let cleaned=0;const tx={$queryRaw:async()=>[]};
  class Legacy{async ingestPreprocessed(u,m,f,c){try{return await this.withUploadPublication(u,m,{},async()=>({}),undefined);}catch(e){if(e instanceof HttpException)cleaned++;throw e;}}async withUploadPublication(u,m,p,fn,before){await before?.(tx);return fn(tx,{subject:{id:'db-subject'}});}}
  const reject=()=>{throw Object.assign(Error('blocked'),{status:409,code:'SIMULATION_BLOCKED'});};
  const simulation={withExecutionTx:async(t,u,s,fn)=>phase==='before'?reject():fn(),guardVisitSchedule:async()=>phase==='stage'?reject():null};
  const Service=simulationIngestServiceClass({Service:Legacy,simulation,HttpException});
  await assert.rejects(new Service().ingestPreprocessed(user,metadata,file,formal),e=>e instanceof HttpException&&e.getResponse().code==='SIMULATION_BLOCKED');assert.equal(cleaned,1);
 }
});
