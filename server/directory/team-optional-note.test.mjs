import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDirectoryService} from './commands.mjs';import {directoryRollback} from './test-support.mjs';
for(const note of [undefined,'','   '])test('real PG team review accepts '+JSON.stringify(note)+' and preserves responsibility and claims',async()=>directoryRollback(async({db,ctx,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),c=await s.createTeamWorkspace(admin,{data:{name:'备注选填-'+suffix,verificationMethod:'administrator',organization:{name:'合成机构'},members:[{key:'lead',name:'合成负责人',role:'lead'}]},requestKey:randomUUID()}),p=await s.previewTeamWorkspace(admin,c.id,'tenant');assert(p.canApprove);
 const body={expectedVersion:1,planHash:p.planHash,audience:'tenant',requestKey:randomUUID(),...(note===undefined?{}:{reason:note})};
 for(const reason of [null,12,{},'x'.repeat(2001)])await assert.rejects(()=>s.reviewTeamWorkspace(admin,c.id,{...body,reason,requestKey:randomUUID()}),{status:400});
 await assert.rejects(()=>s.reviewTeamWorkspace(ctx('owner'),c.id,body),{status:403});const result=await s.reviewTeamWorkspace(admin,c.id,body);assert.deepEqual(await s.reviewTeamWorkspace(admin,c.id,body),result);
 const w=await s.teamWorkspace(admin,c.id),record=w.verifications[0];assert.equal(record.reason,'');assert.equal(record.actorId,admin.user.accountId);assert(record.actorDisplayName);assert(record.verifiedAt);assert.equal(record.audience,'tenant');assert(record.claims.length>0);assert.equal(record.claimDigests.length,record.claims.length);
 const facts=(await s.adminEntity(admin,c.id)).facts;assert(facts.length>0);for(const f of facts)assert.equal((await s.adminAssertion(admin,f.id)).decision.reason,'审核通过（未填写备注）');
 const profile=facts.find(f=>f.kind==='profile');await assert.rejects(()=>s.decide(admin,profile.id,{expectedDecisionVersion:1,assertionHash:profile.hash,decision:'approve',audience:'tenant',reason:'',requestKey:randomUUID()}),{status:400});
 assert.equal((await s.team(ctx('owner'),c.id,'tenant')).item.name,w.data.name);
}));
test('real PG existing notes remain immutable while a new optional note is stored exactly',async()=>directoryRollback(async({db,ctx,suffix})=>{
 const s=createDirectoryService({db}),a=ctx('admin'),c=await s.createTeamWorkspace(a,{data:{name:'备注历史-'+suffix,verificationMethod:'administrator',organization:{name:'合成机构'},members:[{key:'lead',name:'合成负责人',role:'lead'}]},requestKey:randomUUID()});
 const approve=async reason=>{const w=await s.teamWorkspace(a,c.id),p=await s.previewTeamWorkspace(a,c.id,'tenant');return s.reviewTeamWorkspace(a,c.id,{expectedVersion:w.version,planHash:p.planHash,audience:'tenant',reason,requestKey:randomUUID()});};
 await approve('  原审核备注  ');let w=await s.teamWorkspace(a,c.id);const original=w.verifications[0];assert.equal(original.reason,'原审核备注');await s.saveTeamWorkspace(a,c.id,{expectedVersion:w.version,baseRevision:w.currentRevision,data:{...w.data,summary:'新简介'},requestKey:randomUUID()});await approve('');w=await s.teamWorkspace(a,c.id);assert.deepEqual(w.verifications[0],original);assert.equal(w.verifications[1].reason,'');
}));
test('source-backed team review also accepts omitted note without weakening provenance',async()=>directoryRollback(async({db,ctx,provenance,suffix})=>{
 const s=createDirectoryService({db}),a=ctx('admin'),c=await s.createTeamWorkspace(a,{data:{name:'来源备注选填-'+suffix,organization:{name:'合成机构'},members:[{key:'lead',name:'合成负责人',role:'lead'}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead']}]},requestKey:randomUUID()}),p=await s.previewTeamWorkspace(a,c.id,'tenant');assert(p.canApprove);
 await s.reviewTeamWorkspace(a,c.id,{expectedVersion:1,planHash:p.planHash,audience:'tenant',requestKey:randomUUID()});const w=await s.teamWorkspace(a,c.id);assert.equal(w.verifications.length,0);assert.equal(w.reviewedVersion,w.version);const facts=(await s.adminEntity(a,c.id)).facts;assert(facts.every(f=>f.provenance.every(ref=>ref.kind==='source_record')));
}));
