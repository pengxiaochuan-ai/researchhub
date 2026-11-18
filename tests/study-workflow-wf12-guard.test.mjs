import test from 'node:test';
import assert from 'node:assert/strict';
import {requireWF12Window,allowWF12Request} from '../scripts/study-workflow-wf12-qa.mjs';
const origin='http://127.0.0.1:19501',env={STUDY_WORKFLOW_WF12_QA_WINDOW:'explicit',STUDY_WORKFLOW_WF08_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit',WF12_RUNTIME_PID:'9185'};
test('WF12 target I/O requires exact root window, PID and named local mode',()=>{
 assert.deepEqual(requireWF12Window(['--local-synthetic','--read'],env),{mode:'read',pid:9185});
 for(const key of Object.keys(env))assert.throws(()=>requireWF12Window(['--local-synthetic','--read'],{...env,[key]:''}));
 for(const args of [[],['--read'],['--local-synthetic','--all'],['--local-synthetic','--read','--force']])assert.throws(()=>requireWF12Window(args,env));
});
test('WF12 denies business writes and external destinations while allowing original readonly paths',()=>{
 assert(allowWF12Request('GET',origin+'/api/research-studies/study/analysis/reports'));
 for(const method of ['POST','PUT','PATCH','DELETE'])assert(!allowWF12Request(method,origin+'/api/research-studies/study/analysis/reports'));
 assert(!allowWF12Request('GET','https://example.org/'));
 assert(!allowWF12Request('GET','http://localhost:19501/api/auth/me'));
});
test('WF12 renew requires original empty-body session protocol',()=>{
 const opts={headers:{'x-researchhub-request':'session-v1'},body:{}};
 assert(allowWF12Request('POST',origin+'/api/auth/renew',opts));
 assert(!allowWF12Request('POST',origin+'/api/auth/renew',{...opts,body:{action:'write'}}));
 assert(!allowWF12Request('POST',origin+'/api/auth/renew',{body:{}}));
});
test('WF12 real file GET is single-use and bound to branch, study and already-ready job',()=>{
 const path=origin+'/api/research-studies/study/analysis/report-exports/job/file',jobs=[{branch:'full',studyId:'study',jobId:'job'}],opts={mode:'download-full',jobs};
 assert(allowWF12Request('GET',path,opts));
 for(const extra of [{mode:'read'},{mode:'download-ordinary'},{consumed:true},{jobs:[]},{jobs:[{...jobs[0],studyId:'other'}]},{jobs:[{...jobs[0],jobId:'other'}]}])assert(!allowWF12Request('GET',path,{...opts,...extra}));
 assert(!allowWF12Request('HEAD',path,opts));assert(!allowWF12Request('POST',path,opts));
});
