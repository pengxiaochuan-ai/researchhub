import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createVisitFileUploadService} from './file-upload.mjs';

function setup(change){
 const user={tenantId:'tenant',accountId:'actor',authVersion:1};
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
 const counters={transactions:0,authorizations:0,reads:0,updates:0,audits:0,ingests:0};
 const digest=createHash('sha256').update('synthetic').digest('hex');
 const value={studyId:'study',visitId:'visit',fileId:'file',taskId:'task',sourceSha256:digest,receipt:{requestKey:'original-key',action:'file.preprocessed',targetId:'visit',studyId:'study'}};
 const tx={
  subjectVisit:{findFirst:async()=>({id:'visit',subjectId:'subject',enrollmentId:'enrollment',protocolVersionId:'protocol',subject:{subjectId:'SYNTHETIC'}})},
  studyEnrollment:{findFirst:async()=>({id:'enrollment',subjectId:'subject',protocolVersionId:'protocol',status:'enrolled'})},
  processingTask:{findFirst:async()=>({id:'task'})},
  modalityFile:{findFirst:async()=>change==='source'&&counters.transactions===2?null:{id:'file',storageKey:'synthetic',meta:{sha256:digest}},update:async()=>{counters.updates++;}},
  auditLog:{create:async()=>{counters.audits++;}},
  $queryRaw:async(strings,...values)=>{
   if(strings.join('').includes('SELECT action,target_id,result')){
    assert.deepEqual(values,['tenant','actor','original-key']);
    return [{action:'file.preprocessed',target_id:'visit',result:value}];
   }
   return [];
  },
 };
 const studies={withResearchStudyTransaction:async(_user,_study,operation,callback)=>{
  assert.equal(operation,'read');counters.transactions++;
  return callback(tx,{...scope,executionProjectId:'project'});
 }};
 const core={readVisit:async()=>{},authorizeUpload:async()=>{
  counters.authorizations++;
  if(change==='authority'&&counters.transactions===2)throw Object.assign(Error('current upload revoked'),{status:403});
 },lockBinding:async(_tx,_scope,binding)=>assert.equal(binding.requireCurrentConsent,true),ingest:async()=>{counters.ingests++;throw Error('must not re-ingest');}};
 const storage={getStream:async()=>{counters.reads++;return Readable.from(['synthetic']);}};
 return {user,counters,api:createVisitFileUploadService({studies,core,storage})};
}

test('reverify rechecks upload authority between receipt resolution and storage verification before object I/O or writes',async()=>{
 const {user,counters,api}=setup('authority');
 await assert.rejects(api.reverify(user,'study','visit','original-key'),error=>error.status===403);
 assert.deepEqual(counters,{transactions:2,authorizations:2,reads:0,updates:0,audits:0,ingests:0});
});

test('reverify refuses a source that changes after receipt lookup before object I/O or writes',async()=>{
 const {user,counters,api}=setup('source');
 await assert.rejects(api.reverify(user,'study','visit','original-key'),error=>error.code==='FILE_SOURCE_CHANGED');
 assert.deepEqual(counters,{transactions:2,authorizations:2,reads:0,updates:0,audits:0,ingests:0});
});
