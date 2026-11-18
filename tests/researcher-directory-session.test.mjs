import test from 'node:test';import assert from 'node:assert/strict';
import * as session from '../src/directory-session.js';
test('researcher routes preserve exact filters and reject duplicate and external return paths',()=>{
 assert.equal(typeof session.readResearcherLocation,'function');
 const state=session.readResearcherLocation('?q=针灸&organizationId=org&rank=教授&page=2');
 const list=session.researcherListUrl(state),detail=session.researcherDetailUrl('person',state);
 assert.equal(session.safeResearcherReturn(new URL(detail,'http://local').searchParams.get('returnTo')),list+'#researcher-person');
 assert.equal(session.safeResearcherReturn('//evil.test/'),'/pages/r01/');assert.equal(session.safeResearcherReturn('/pages/r01/?q=a&q=b'),'/pages/r01/');
 assert.throws(()=>session.readResearcherLocation('?rank=教授&rank=医生'));assert.throws(()=>session.readResearcherLocation('?sort=members'));
 assert.equal(session.safeTeamReturn(detail),detail);assert.equal(session.safeTeamReturn('/pages/r02/?id=p&returnTo=https://evil.test'),'/pages/r01/');
});
test('researcher client uses member scope, rejects caller identity and cancels stale results',async()=>{
 const seen=[];const c=session.createDirectoryClient({fetchImpl:async(path,init)=>{seen.push({path,init});return Response.json({items:[],pagination:{page:1,totalItems:0},dataRevision:'revision'});}});
 assert.equal(typeof c.researchers,'function');await c.researchers({rank:'教授'},'tenant');assert.equal(seen[0].path,'/api/hubs/lingshu-xinyu/member/researchers?rank=%E6%95%99%E6%8E%88');assert.equal(seen[0].init.method,'GET');
 await assert.rejects(()=>c.researchers({accountId:'x'}));
});
test('a researcher→team→researcher round trip retains valid Hub and filtered list, rejecting all other Hub variants',()=>{
 const detail='/pages/r02/?'+new URLSearchParams({id:'p',hubId:'lingshu-xinyu',returnTo:'/pages/r01/?q=needle#researcher-p'}),back=session.safeTeamReturn(detail),url=new URL(back,'http://local');assert.equal(url.pathname,'/pages/r02/');assert.equal(url.searchParams.get('hubId'),'lingshu-xinyu');assert.equal(url.searchParams.get('returnTo'),'/pages/r01/?q=needle#researcher-p');
 assert.equal(session.safeTeamReturn('/pages/r02/?id=p&hubId=other'),'/pages/r01/');assert.equal(session.safeTeamReturn('/pages/r02/?id=p&hubId=lingshu-xinyu&hubId=lingshu-xinyu'),'/pages/r01/');
 const spaced='/pages/r02/?'+new URLSearchParams({id:'p',hubId:'lingshu-xinyu',returnTo:'/pages/r01/?q='+encodeURIComponent('[合成验收] 负责人')+'#researcher-p'});assert.equal(new URL(session.safeTeamReturn(spaced),'http://local').pathname,'/pages/r02/');
});
