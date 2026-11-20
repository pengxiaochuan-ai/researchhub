import test from 'node:test';import assert from 'node:assert/strict';
import {createDirectoryClient} from '../src/directory-session.js';
test('origin rejection is not mislabeled as missing business permission and draft-limit conflict is specific',async()=>{
 for(const[code,text]of [['DIRECTORY_ORIGIN_REJECTED','安全校验'],['DIRECTORY_DRAFT_LIMIT','大小']]){
 const c=createDirectoryClient({fetchImpl:async()=>({ok:false,status:code==='DIRECTORY_ORIGIN_REJECTED'?403:409,json:async()=>({code})})});
 await assert.rejects(c.teamWorkspaces(),e=>e.code===code&&e.message.includes(text));}
});
test('team client uses exact same-origin routes and prevents extra scope/body keys',async()=>{
 const calls=[],c=createDirectoryClient({fetchImpl:async(url,opts)=>{calls.push({url,...opts});return {ok:true,json:async()=>({id:'team',version:1,data:{name:'甲'}})};}});
 await c.teamWorkspace('team');await c.saveTeamWorkspace('team',{expectedVersion:0,baseRevision:'a'.repeat(64),data:{name:'甲'},requestKey:'key'});await c.previewTeamWorkspace('team','public');await c.teamWorkspaceReceipt('team','key');
 assert(calls.every(x=>x.url.startsWith('/api/hubs/lingshu-xinyu/directory-admin/team-workspaces/')&&x.credentials==='same-origin'));
 assert.equal(calls[1].method,'POST');assert.equal(calls[2].url,'/api/hubs/lingshu-xinyu/directory-admin/team-workspaces/team/preview?audience=public');
 assert(calls.every(x=>x.mode==='same-origin'),'the browser must reject cross-origin network targets');
 assert.equal(calls[1].headers['X-ResearchHub-Request'],'team-workspace-v1');
 assert.equal(calls[0].headers['X-ResearchHub-Request'],undefined,'read requests do not claim a write proof');
 await assert.rejects(()=>c.saveTeamWorkspace('team',{requestKey:'key',tenantId:'other'}));assert.throws(()=>c.teamWorkspace('../x'));
});
test('only team workspace mutations carry the dedicated browser submission marker',async()=>{
 const calls=[],c=createDirectoryClient({fetchImpl:async(url,opts)=>{calls.push({url,...opts});return Response.json({id:'team'});}});
 await c.createTeamWorkspace({data:{name:'合成'},requestKey:'create'});
 await c.reviewTeamWorkspace('team',{expectedVersion:1,planHash:'hash',audience:'tenant',reason:'合成',requestKey:'review'});
 await c.createEntity({kind:'team',stableKey:'one',requestKey:'entity'});
 assert.equal(calls[0].headers['X-ResearchHub-Request'],'team-workspace-v1');
 assert.equal(calls[1].headers['X-ResearchHub-Request'],'team-workspace-v1');
 assert.equal(calls[2].headers['X-ResearchHub-Request'],undefined);
});
