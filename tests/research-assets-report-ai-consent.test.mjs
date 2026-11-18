import test from 'node:test';
import assert from 'node:assert/strict';
import {createReportAiConsent} from '../server/research-assets/report-ai-consent.mjs';
import {REPORT_AI_LOCAL as L} from '../server/research-assets/report-ai-local.mjs';
const now=Date.parse('2026-11-17T05:00:00Z');
function setup(){
 let latest=null,sourceValid=true,writes=0;const receipts=new Map(),p={...L,authVersion:1,identityRevision:'f'.repeat(64)},a={...L,id:L.assetId,version:2,ownerAccountId:L.accountId,kind:'publication',state:'approved',bodyAllowed:true,sourceValid:true};
 const service=createReportAiConsent({withAccess:(_u,permission,run)=>{assert.equal(permission,'artifact.read');return run({},p);},loadMetadata:async()=>({...a,sourceValid}),readConsent:async()=>latest,lock:async()=>{},findRequest:async(_t,_p,key)=>receipts.get(key),append:async(_t,_p,c,request)=>{writes++;latest=c;const r={...c,...request};receipts.set(request.requestKey,r);return r;},now:()=>now});
 return{service,writes:()=>writes,breakSource:()=>sourceValid=false};
}
const input=(action,expectedConsentRevision,requestKey)=>({action,expectedConsentRevision,requestKey});
test('consent grant/revoke/regrant use one immutable seven-day window and receipt replay never writes again',async()=>{
 const s=setup(),grant=input('grant',0,'aq02-first-grant'),first=await s.service.execute({},L.assetId,2,grant);
 assert.equal(first.revision,1);assert.equal(first.state,'active');assert.equal(s.writes(),1);
 assert.deepEqual(await s.service.execute({},L.assetId,2,grant),first);assert.equal(s.writes(),1);
 await assert.rejects(s.service.execute({},L.assetId,2,input('revoke',1,grant.requestKey)),/请求/);
 const revoke=await s.service.execute({},L.assetId,2,input('revoke',1,'aq02-first-revoke'));assert.equal(revoke.state,'revoked');
 const third=await s.service.execute({},L.assetId,2,input('grant',2,'aq02-last-grant'));assert.equal(third.expiresAt,first.expiresAt);assert.equal(third.revision,3);
 await assert.rejects(s.service.execute({},L.assetId,2,input('revoke',3,'aq02-over-budget')));assert.equal(s.writes(),3);
});
test('CAS, wrong fixed target and changed source refuse grants but allow reducing existing consent',async()=>{
 const s=setup();await assert.rejects(s.service.execute({},L.assetId,2,input('grant',1,'aq02-stale-request')));assert.equal(s.writes(),0);
 await assert.rejects(s.service.execute({},'other',2,input('grant',0,'aq02-other-request')));
 await s.service.execute({},L.assetId,2,input('grant',0,'aq02-valid-request'));s.breakSource();
 assert.equal((await s.service.status({},L.assetId,2)).canSearch,false);
 assert.equal((await s.service.execute({},L.assetId,2,input('revoke',1,'aq02-reduce-request'))).state,'revoked');
 await assert.rejects(s.service.execute({},L.assetId,2,input('grant',2,'aq02-bad-source')));assert.equal(s.writes(),2);
});
