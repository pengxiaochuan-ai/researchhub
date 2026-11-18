import test from 'node:test';import assert from 'node:assert/strict';
import{safeSessionReturn}from'../src/session-lifecycle.js';import{safeAuthenticatedReturnTo}from'../src/route-context.js';
import{governanceItemHref,governanceOverviewHref,governanceOverviewLocation}from'../src/governance-overview.js';
const api=await import('../src/invitation-location.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('invitation URL fixes Study and invitation IDs and survives safe login with exact overview return',()=>{
 assert.equal(typeof api.invitationLocationHref,'function');const href=api.invitationLocationHref('group','project','invite-1',{module:'access',page:2}),q=new URL(href,'http://local').search;
 assert.equal(href,'/pages/s11/?members=1&studyGroupId=group&researchProjectId=project&invitationId=invite-1&overviewModule=access&overviewPage=2');
 assert.deepEqual(api.readInvitationLocation(q),{groupId:'group',projectId:'project',invitationId:'invite-1',overview:{module:'access',page:2}});assert.equal(safeSessionReturn(href),href);assert.equal(safeAuthenticatedReturnTo(href),href);
});
test('malformed duplicate mismatched scope and arbitrary return parameters are rejected, plain S11 stays unchanged',()=>{
 assert.equal(typeof api.readInvitationLocation,'function');assert.equal(api.readInvitationLocation(''),null);
 const q='?members=1&studyGroupId=g&researchProjectId=p&invitationId=invite-1';for(const suffix of ['&invitationId=other-id','&returnTo=https://evil.test','&overviewModule=access','&overviewModule=__proto__&overviewPage=1','&overviewModule=access&overviewPage=0']){assert.throws(()=>api.readInvitationLocation(q+suffix));assert.equal(safeSessionReturn('/pages/s11/'+q+suffix),'/pages/p01/');}
 assert.throws(()=>api.readInvitationLocation('?members=1&invitationId=invite-1'));assert.throws(()=>api.invitationLocationHref('g','p','../../bad'));
});
test('attention page is distinct from the main pending page and survives the precise invitation/login roundtrip',()=>{
 const href=governanceItemHref({kind:'invitations',id:'group:project:invite-1',disposition:'attention'},{module:'access',page:1,attentionPage:2});
 assert.equal(new URL(href,'http://local').searchParams.get('overviewAttentionPage'),'2');assert.equal(safeSessionReturn(href),href);
 const r=api.readInvitationLocation(new URL(href,'http://local').search);assert.deepEqual(r.overview,{module:'access',page:1,attentionPage:2});const back=governanceOverviewHref(r.overview);assert.equal(back,'/pages/g02/?governanceModule=access&governanceAttentionPage=2');assert.deepEqual(governanceOverviewLocation(new URL(back,'http://local').search),{module:'access',page:1,attentionPage:2});
 assert.throws(()=>api.readInvitationLocation(new URL(href,'http://local').search+'&overviewAttentionPage=3'));
});
