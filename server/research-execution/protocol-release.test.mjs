import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProtocolReleaseService} from './protocol-release.mjs';
const user={accountId:'u',tenantId:'t',authVersion:1};
test('Hub owner cannot submit, approve or activate without study authority',async()=>{
 const tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({id:'u',authVersion:1,tenantId:'t',role:'researcher',isTenantAdmin:false})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})};
 const svc=createProtocolReleaseService({studies,core:{}});
 for(const action of ['submit','approve','activate'])await assert.rejects(svc[action](user,'study','protocol',{requestKey:'test-key-123',expectedRevision:'a'.repeat(64),...(action==='approve'?{policyVersionId:'policy',expectedPolicyHash:'a'.repeat(64)}:{})}),e=>e.code==='RESEARCH_FORBIDDEN');
});
test('submit uses current transaction, checks revision and returns identical retry receipt',async()=>{
 const {presentProtocol}=await import('./protocols.mjs');
 let row={id:'protocol',status:'draft',versionNumber:1,title:'Synthetic',purpose:'purpose',primaryOutcomes:[],secondaryOutcomes:[],methodsSummary:null,populationSummary:null,statisticsSummary:null,visitPlans:[]};const receipts=[];let transitions=0,audits=0;
 const tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({id:'u',authVersion:1,tenantId:'t',role:'tenant_admin',isTenantAdmin:true})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null},studyProtocolVersion:{findFirst:async()=>row},auditLog:{createMany:async()=>{audits++;}},$queryRaw:async(parts,...v)=>{const sql=parts.join('?');if(sql.includes('rh_research.operation'))return receipts.filter(r=>r.request_key===v[2]);if(sql.includes('study_execution_policy_version'))return [];return [];},$executeRaw:async(parts,...v)=>{if(parts.join('?').includes('INSERT INTO rh_research.operation')){receipts.push({request_key:v[3],request_hash:v[4],action:v[5],target_id:v[6],result:JSON.parse(v[7])});return 1;}throw Error('unexpected SQL');}};
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'p'})},core={transitionProtocolInTransaction:async()=>{transitions++;row={...row,status:'pending_review'};}};
 const svc=createProtocolReleaseService({studies,core}),body={requestKey:'submit-123',expectedRevision:presentProtocol(row).revision};
 const first=await svc.submit(user,'study','protocol',body);assert.equal(first.protocol.status,'pending_review');assert.deepEqual(await svc.submit(user,'study','protocol',body),first);assert.equal(transitions,1);assert.equal(audits,1);
 await assert.rejects(svc.submit(user,'study','protocol',{...body,requestKey:'submit-456',expectedRevision:'0'.repeat(64)}),e=>e.code==='RESEARCH_VERSION_CONFLICT');
});
test('approval and activation capabilities reflect current policy and release gates',async()=>{
 const {releaseCapabilities}=await import('./protocol-release.mjs');
 const p={status:'pending_review'},blocked=releaseCapabilities(true,p,['independent_review_required'],{gate:{ready:true}},{ready:true});assert.equal(blocked.canApprove,false);assert.equal(blocked.canReturn,true);
 assert.equal(releaseCapabilities(true,p,[],{gate:{ready:true}},{ready:true}).canApprove,true);
 assert.equal(releaseCapabilities(true,{status:'approved'},[],{gate:{ready:true}},{ready:false}).canActivate,false);
 assert.equal(releaseCapabilities(true,{status:'draft'},['independent_review_required'],{gate:{ready:true}},{ready:true},[]).canSubmit,true);
 assert.equal(releaseCapabilities(true,{status:'draft'},['policy_missing'],{gate:{ready:true}},{ready:true},['policy_missing']).canSubmit,false);
});
test('release receipt checks current authority and exact actor target/action without replaying any command',async()=>{
 let manager=true,saved=null,calls=0;
 const protocol={id:'p',visitPlans:[]},tx={tenantFeatureEntitlement:{findFirst:async()=>({})},account:{findFirst:async()=>({id:'u',authVersion:1,tenantId:'t',role:manager?'tenant_admin':'researcher',isTenantAdmin:manager})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null},studyProtocolVersion:{findFirst:async()=>protocol},$queryRaw:async()=>saved?[saved]:[]};
 const svc=createProtocolReleaseService({studies:{withResearchStudyTransaction:async(_u,_s,_op,fn)=>fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'e'})},core:{approveProtocolInTransaction:async()=>calls++}});
 assert.deepEqual(await svc.receipt(user,'s','p','request-key',{action:'approve'}),{found:false});
 saved={action:'protocol.approve',target_id:'p',result:{receipt:{requestKey:'request-key'},protocol:{id:'p',status:'approved'}}};
 assert.deepEqual(await svc.receipt(user,'s','p','request-key',{action:'approve'}),{found:true,result:saved.result});assert.equal(calls,0);
 await assert.rejects(svc.receipt(user,'s','p','request-key',{action:'activate'}),e=>e.status===404);
 manager=false;await assert.rejects(svc.receipt(user,'s','p','request-key',{action:'approve'}),e=>e.status===403);
});
