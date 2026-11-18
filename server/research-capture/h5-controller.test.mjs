import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createH5QuestionnaireController} from './h5-controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));const token='t'.repeat(43),session='s'.repeat(43),origin='https://research.example.test';
function response(){const headers={};return {headers,setHeader(k,v){headers[k]=v;},cookie(name,value,opts){this.set={name,value,opts};}};}
const req=(cookie='')=>({headers:{origin,'content-type':'application/json',cookie}});
test('every post-exchange public read and write forwards the expected assignment',async()=>{
 const expected='assignment-a',service={getH5Session:async(_s,target)=>{assert.equal(target,expected);return {assignmentId:expected};},getH5Receipt:async(_s,_k,_o,target)=>{assert.equal(target,expected);return {assignmentId:expected};},saveH5Session:async(_s,_a,_submit,command)=>{assert.equal(command.expectedAssignmentId,expected);return {assignmentId:expected};}};
 const c=new(createH5QuestionnaireController({require,service,origin}))(),cookie=`rh_questionnaire=${session}`;
 await c.read(req(cookie),response(),{expectedAssignmentId:expected});await c.receipt(req(cookie),response(),'request-target',{operation:'draft',expectedAssignmentId:expected});await c.draft(req(cookie),response(),{requestKey:'request-target',expectedVersion:0,expectedAssignmentId:expected,answers:{x:0}});
 await assert.rejects(c.read(req(cookie),response(),{}),e=>e.getStatus()===400);
});
test('public questionnaire cookies require HTTPS except for explicit local loopback origins',()=>{
 for(const value of ['http://research.example.test','http://192.168.1.20:19501'])assert.throws(()=>createH5QuestionnaireController({require,service:{},origin:value}),/H5_ORIGIN_REQUIRED/);
 for(const value of ['https://research.example.test','http://127.0.0.1:19501','http://localhost:19501','http://[::1]:19501'])assert.doesNotThrow(()=>createH5QuestionnaireController({require,service:{},origin:value}));
});
test('public H5 exchanges token into HttpOnly strict cookie and only exposes session-derived responses',async()=>{
 const service={startH5:async value=>{assert.equal(value,token);return{sessionId:session,expiresAt:new Date(Date.now()+60000),schema:{fields:[]}};},getH5Session:async value=>{assert.equal(value,session);return{sessionId:value,answers:{x:0}};},saveH5Session:async(value,answers,submit,cmd)=>{assert.equal(value,session);assert.equal(submit,true);assert.equal(cmd.expectedVersion,0);return{status:'submitted',assignmentId:'assignment'};},getH5Receipt:async(value,key,kind)=>{assert.equal(value,session);assert.equal(kind,'submit');return{status:'submitted',assignmentId:'assignment'};}};
 const C=createH5QuestionnaireController({require,service,origin}),c=new C(),res=response(),started=await c.start(req(),res,{token});assert.equal('sessionId'in started,false);assert.equal(res.set.value,session);assert.equal(res.set.opts.httpOnly,true);assert.equal(res.set.opts.sameSite,'strict');assert.equal(res.set.opts.secure,true);assert.equal(res.headers['Cache-Control'],'no-store');const cookie=`${res.set.name}=${session}`;
 assert.deepEqual(await c.read(req(cookie),response(),{expectedAssignmentId:'assignment'}),{answers:{x:0}});assert.deepEqual(await c.submit(req(cookie),response(),{requestKey:'request-1234',expectedVersion:0,expectedAssignmentId:'assignment',answers:{x:0}}),{status:'submitted',assignmentId:'assignment',receipt:{requestKey:'request-1234',action:'h5.submit',targetId:'assignment'}});assert.deepEqual(await c.receipt(req(cookie),response(),'request-1234',{operation:'submit',expectedAssignmentId:'assignment'}),{status:'submitted',assignmentId:'assignment',receipt:{requestKey:'request-1234',action:'h5.submit',targetId:'assignment'}});
});
test('cross-origin, duplicate cookies, extraneous input and unknown errors fail closed without secrets',async()=>{
 const service={startH5:async()=>{throw Error('secret-value');},getH5Session:async s=>{assert.equal(s,'');throw Error('secret-value');}};const C=createH5QuestionnaireController({require,service,origin}),c=new C();await assert.rejects(c.start({...req(),headers:{...req().headers,origin:'https://evil.example'}},response(),{token}),e=>e.getStatus()===403);await assert.rejects(c.start(req(),response(),{token,tenantId:'x'}),e=>e.getStatus()===400);await assert.rejects(c.read(req(`rh_questionnaire=${session}; rh_questionnaire=${session}`),response(),{expectedAssignmentId:'assignment'}),e=>e.getStatus()===503&&!JSON.stringify(e.getResponse()).includes('secret'));
});
test('opening a different invitation never returns the old session; matching session resumes',async()=>{
 const {ConflictException,GoneException}=require('@nestjs/common');let startCalls=0,mode='match';
 const service={resumeH5:async(cookie,t)=>{assert.equal(cookie,session);if(mode==='mismatch')throw new ConflictException({code:'H5_INVITATION_MISMATCH'});if(mode==='revoked')throw new GoneException({code:'QUESTIONNAIRE_SESSION_REVOKED'});return{sessionId:session,assignmentId:'assignment-a',expiresAt:new Date(Date.now()+60000),answers:{a:1}};},startH5:async()=>{startCalls++;return{sessionId:'b'.repeat(43),assignmentId:'assignment-b',expiresAt:new Date(Date.now()+60000),answers:{b:2}};}};
 const C=createH5QuestionnaireController({require,service,origin}),c=new C(),cookie=`rh_questionnaire=${session}`;
 assert.equal((await c.start(req(cookie),response(),{token})).assignmentId,'assignment-a');assert.equal(startCalls,0);
 mode='mismatch';const next=await c.start(req(cookie),response(),{token});assert.equal(next.assignmentId,'assignment-b');assert.deepEqual(next.answers,{b:2});assert.equal(startCalls,1);
 mode='revoked';await assert.rejects(c.start(req(cookie),response(),{token}),e=>e.getResponse().code==='QUESTIONNAIRE_SESSION_REVOKED');assert.equal(startCalls,1);
});
test('public writes and receipts bind their receipt to the server assignment and key',async()=>{
 const service={saveH5Session:async()=>({id:'response',assignmentId:'server-assignment',version:1,status:'draft',ref:null}),getH5Receipt:async()=>({id:'response',assignmentId:'server-assignment',version:1,status:'draft',ref:null})};
 const C=createH5QuestionnaireController({require,service,origin}),c=new C(),requestKey='request-1234',cookie=`rh_questionnaire=${session}`;
 const result=await c.draft(req(cookie),response(),{requestKey,expectedVersion:0,expectedAssignmentId:'server-assignment',answers:{a:0}});assert.deepEqual(result.receipt,{requestKey,action:'h5.draft',targetId:'server-assignment'});
 const receipt=await c.receipt(req(cookie),response(),requestKey,{operation:'draft',expectedAssignmentId:'server-assignment'});assert.deepEqual(receipt.receipt,result.receipt);
});
