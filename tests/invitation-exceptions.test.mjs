import test from 'node:test';import assert from 'node:assert/strict';
import{loadGovernanceItems,governanceCoverage,governanceItemHref}from'../src/governance-overview.js';
const api=await import('../src/invitation-exceptions.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const scope={studyGroupId:'group',researchProjectId:'project',name:'合成研究',groupName:'合成组'};
const row=(id,status)=>({id,email:id+'@example.test',status,deliveryStatus:['accepted','revoked','expired'].includes(status)?'captured':status,createdAt:'2026-11-13T00:00:00Z',expiresAt:'2026-11-20T00:00:00Z',version:1});
test('independent Studies read with at most three in flight, retain original source order and exact scopes',async()=>{
 const started=[],releases=[];let active=0,max=0;const scopes=Array.from({length:7},(_,i)=>({...scope,researchProjectId:'project'+i}));
 const done=api.loadInvitationExceptions({studies:async()=>({items:scopes}),list:async(s)=>{started.push(s.projectId);active++;max=Math.max(active,max);await new Promise(r=>releases.push(r));active--;return{items:[row('failed-'+s.projectId,'failed')],nextCursor:null};}});
 await new Promise(setImmediate);assert.equal(started.length,3);assert.equal(max,3);while(releases.length){releases.splice(0).reverse().forEach(r=>r());await new Promise(setImmediate);}const items=await done;assert.equal(max,3);assert.deepEqual(items.map(x=>x.id.split(':')[1]),scopes.map(s=>s.researchProjectId));
});
test('one Study failure aborts other reads and starts no later Study, preserving original denial',async()=>{
 const scopes=Array.from({length:8},(_,i)=>({...scope,researchProjectId:'project'+i}));let calls=0,aborted=0;
 await assert.rejects(()=>api.loadInvitationExceptions({studies:async()=>({items:scopes}),list:async(s,_q,{signal})=>{calls++;if(s.projectId==='project0')throw Object.assign(Error('no access'),{status:403});return new Promise((_,reject)=>{signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('cancelled','AbortError'));},{once:true});});}}),{status:403});assert(calls<=3);assert.equal(aborted,calls-1);
});
test('only actual failed unknown and expired invitations become attention; all pages keep real Study identity',async()=>{
 assert.equal(typeof api.loadInvitationExceptions,'function');const calls=[];
 const rows=await api.loadInvitationExceptions({studies:async()=>({items:[scope]}),list:async(s,q)=>{assert.deepEqual(s,{groupId:'group',projectId:'project'});calls.push(q);return q.cursor?{items:[row('expired-1','expired'),row('accepted1','accepted'),row('revoked-1','revoked')],nextCursor:null}:{items:[row('failed-1','failed'),row('unknown1','unknown'),row('normal-1','captured'),row('pending1','pending')],nextCursor:'next'};}});
 assert.equal(calls.length,2);assert.deepEqual(rows.map(x=>x.status),['failed','unknown','expired']);assert(rows.every(x=>x.disposition==='attention'&&x.module==='access'&&x.timeLabel==='邀请时间'&&x.scopeLabel==='合成研究'));assert.equal(rows[0].id,'group:project:failed-1');assert.equal(rows[0].updatedAt,'2026-11-13T00:00:00Z');
});
test('read failures revoked scope malformed rows duplicate scope/invite and cursor loops never become a partial zero',async()=>{
 assert.equal(typeof api.loadInvitationExceptions,'function');const studies=async()=>({items:[scope]});
 for(const status of [403,503])await assert.rejects(()=>api.loadInvitationExceptions({studies,list:async()=>{throw Object.assign(Error('rejected'),{status});}}),{status});
 await assert.rejects(()=>api.loadInvitationExceptions({studies:async()=>({items:[scope,scope]}),list:async()=>({items:[],nextCursor:null})}));
 for(const items of [[row('failed-1','failed'),row('failed-1','failed')],[row('failed-1','invented')],[{...row('failed-1','failed'),createdAt:'bad'}]])await assert.rejects(()=>api.loadInvitationExceptions({studies,list:async()=>({items,nextCursor:null})}));
 await assert.rejects(()=>api.loadInvitationExceptions({studies,list:async()=>({items:[row('failed-1','failed')],nextCursor:'again'})}));
});
test('cancellation after a valid page stops traversal and suppresses stale delivery',async()=>{
 assert.equal(typeof api.loadInvitationExceptions,'function');const c=new AbortController();let calls=0;
 await assert.rejects(()=>api.loadInvitationExceptions({signal:c.signal,studies:async()=>({items:[scope]}),list:async()=>{calls++;c.abort();return{items:[row('failed-1','failed')],nextCursor:'next'};}}),{name:'AbortError'});assert.equal(calls,1);
});
test('exact invitation lookup reads later pages, never substitutes same email and leaves original order/cursor',async()=>{
 assert.equal(typeof api.readInvitationTarget,'function');const calls=[];
 const r=await api.readInvitationTarget(async q=>{calls.push(q);return q.cursor?{items:[row('target-1','unknown')],nextCursor:'remaining'}:{items:[row('other-id','captured')],nextCursor:'next'};},'target-1');assert.equal(calls.length,2);assert.deepEqual(r.items.map(x=>x.id),['other-id','target-1']);assert.equal(r.nextCursor,'remaining');assert.equal(r.found,true);
 const missing=await api.readInvitationTarget(async()=>({items:[row('other-id','captured')],nextCursor:null}),'target-1');assert.equal(missing.found,false);
});
test('governance wires invitation attention and a safe precise return, without inventing processed history',async()=>{
 const r=await loadGovernanceItems('invitations','pending',{invitationStudies:async()=>({items:[scope]}),invitationList:async()=>({items:[row('failed-1','failed')],nextCursor:null})});assert.equal(r.length,1);assert.deepEqual(governanceCoverage(null,'access').selected,['invitations']);assert.deepEqual(governanceCoverage(null,'access','processed').selected,[]);const url=governanceItemHref(r[0],{module:'access',page:2});assert.match(url,/^\/pages\/s11\/\?members=1&/);assert.match(url,/invitationId=failed-1/);assert.match(url,/overviewModule=access&overviewPage=2/);
});
