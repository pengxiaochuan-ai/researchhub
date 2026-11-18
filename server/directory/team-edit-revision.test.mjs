import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDirectoryService} from './commands.mjs';
import {directoryRollback} from './test-support.mjs';
import {prepareTeamReview} from '../../src/team-review-flow.js';

test('real PG archived baseline does not block a freshly loaded draft or bypass incomplete-review rules',async()=>directoryRollback(async({db,ctx,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),c=await s.createTeamWorkspace(admin,{data:{name:'旧草稿-'+suffix},requestKey:randomUUID()});
 await s.createEntity(admin,{kind:'organization',stableKey:'revision-unrelated-'+suffix,requestKey:randomUUID()});
 const w=await s.teamWorkspace(admin,c.id);assert.notEqual(w.baseRevision,w.currentRevision);
 await assert.rejects(()=>s.saveTeamWorkspace(admin,c.id,{expectedVersion:w.version,baseRevision:w.baseRevision,data:w.data,requestKey:randomUUID()}),{status:409});
 let writes=0;const p=await prepareTeamReview({workspace:w,data:{...w.data,members:[{key:'lead',name:'合成负责人',role:'lead'},{key:'empty',name:'',role:'member'}]},dirty:true,audience:'tenant',requestKey:randomUUID(),client:{saveTeamWorkspace:async(id,b)=>{writes++;return s.saveTeamWorkspace(admin,id,b);},teamWorkspace:id=>s.teamWorkspace(admin,id),previewTeamWorkspace:(id,a)=>s.previewTeamWorkspace(admin,id,a)}});
 assert.equal(writes,1);assert.equal((await s.teamWorkspace(admin,c.id)).version,2);assert.equal(p.canApprove,false);assert(p.issues.length>0);
 assert.equal((await s.adminEntity(admin,c.id)).facts.length,0,'saving a draft is not approval');
}));

test('real PG clean stale draft prepares then explicitly approves, but changes after read still conflict',async()=>directoryRollback(async({db,ctx,suffix,provenance})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),c=await s.createTeamWorkspace(admin,{data:{name:'可审核旧草稿-'+suffix,organization:{name:'合成机构'},members:[{key:'lead',name:'合成负责人',role:'lead'}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead']}]},requestKey:randomUUID()});
 await s.createEntity(admin,{kind:'organization',stableKey:'other-before-read-'+suffix,requestKey:randomUUID()});
 const w=await s.teamWorkspace(admin,c.id);assert.notEqual(w.baseRevision,w.currentRevision);
 let writes=0;const client={saveTeamWorkspace:async(id,b)=>{writes++;return s.saveTeamWorkspace(admin,id,b);},teamWorkspace:id=>s.teamWorkspace(admin,id),previewTeamWorkspace:(id,a)=>s.previewTeamWorkspace(admin,id,a)};
 const p=await prepareTeamReview({client,workspace:w,data:w.data,dirty:false,audience:'public',requestKey:randomUUID()});
 assert.equal(writes,1);assert.equal(p.canApprove,true,JSON.stringify(p.issues));assert.equal((await s.adminEntity(admin,c.id)).facts.length,0);
 await s.reviewTeamWorkspace(admin,c.id,{expectedVersion:p.version,planHash:p.planHash,audience:'public',reason:'仅回滚合成试验人工确认',requestKey:randomUUID()});assert.equal((await s.team({},c.id)).item.name,w.data.name);
 const loaded=await s.teamWorkspace(admin,c.id);await s.createEntity(admin,{kind:'organization',stableKey:'other-after-read-'+suffix,requestKey:randomUUID()});
 await assert.rejects(()=>prepareTeamReview({client,workspace:loaded,data:loaded.data,dirty:true,audience:'public',requestKey:randomUUID()}),{status:409});
 assert.equal(writes,2,'one initial save and one rejected later write; no automatic rebase/retry');
}));
