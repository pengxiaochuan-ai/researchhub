import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {lockFormalResponseScope,verifyFormalResponseEnrollment}=require('./src/study-operations/formal-response-lock.ts');
test('project then protocol locks precede subject and changed enrollment is rejected',async()=>{
 const locks=[];let version='old';const tx={studyProtocolVersion:{findFirst:async()=>({id:'old'})},studyEnrollment:{findFirst:async()=>({id:'e',subjectId:'s',protocolVersionId:version,status:'enrolled'})},$queryRaw:async strings=>{const sql=strings.join('?');locks.push(sql);return [{id:sql.includes('research_project')?'p':'old'}];}};
 const scope={tenantId:'t',studyGroupId:'g',researchProjectId:'p'},assignment={subjectId:'s',enrollmentId:'e'};
 const captured=await lockFormalResponseScope(tx,scope,assignment);
 assert.match(locks[0],/research_project.*FOR SHARE/);assert.match(locks[1],/research_project.*FOR SHARE/);assert.match(locks[2],/study_protocol_version.*FOR SHARE/);
 version='new';await assert.rejects(verifyFormalResponseEnrollment(tx,scope,assignment,captured),e=>e.response?.code==='PROTOCOL_BINDING_CHANGED');
});
