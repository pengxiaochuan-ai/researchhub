import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDirectoryService} from './commands.mjs';import {directoryRollback} from './test-support.mjs';

const review=async(s,a,id,audience='public')=>{const w=await s.teamWorkspace(a,id),p=await s.previewTeamWorkspace(a,id,audience);assert.equal(p.canApprove,true,JSON.stringify(p.issues));const body={expectedVersion:w.version,planHash:p.planHash,audience,reason:'管理员核实：仅合成测试',requestKey:randomUUID()};return {result:await s.reviewTeamWorkspace(a,id,body),body,p};};
test('real PG explicit manual review approves team and deduplicated pending institution atomically with exact claims',async()=>directoryRollback(async({db,ctx,provenance,suffix})=>{
 const s=createDirectoryService({db}),a=ctx('admin'),org=await s.createEntity(a,{kind:'organization',stableKey:'manual-org-'+suffix,requestKey:randomUUID()});
 const pending=await s.appendAssertion(a,org.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'待审合成机构'},provenance,requestKey:randomUUID()});
 const institution={entityId:org.id,name:'待审合成机构',type:''};
 const c=await s.createTeamWorkspace(a,{data:{name:'人工核实团队-'+suffix,verificationMethod:'administrator',organization:institution,members:[{key:'lead',name:'合成负责人',organization:institution,role:'lead'}]},requestKey:randomUUID()});
 const before=await s.previewTeamWorkspace(a,c.id,'public');assert.equal(before.jointInstitutions.length,1);assert.equal(before.jointInstitutions[0].id,org.id);
 const {result,body}=await review(s,a,c.id);assert.deepEqual(await s.reviewTeamWorkspace(a,c.id,body),result);
 const w=await s.teamWorkspace(a,c.id);assert.equal(w.verifications.length,1);assert.equal(w.data.verificationMethod,'administrator');assert.deepEqual(w.data.evidence,[]);
 const pub=await s.team({},c.id);assert.equal(pub.item.organization.id,org.id);assert.equal(pub.item.members[0].name,'合成负责人');assert(JSON.stringify(pub).includes('管理员人工核实'));assert(!JSON.stringify(pub).includes('管理员核实：仅合成测试'));
 const orgInfo=await s.adminEntity(a,org.id);assert.equal(orgInfo.facts[0].revision,2);assert.equal(orgInfo.facts[0].decision.decision,'approve');
 const p=await s.previewTeamWorkspace(a,c.id,'public');assert.equal(p.changes.length,0);assert.equal(p.canApprove,false);assert.equal((await s.teamWorkspace(a,c.id)).verifications.length,1);
 const fact=orgInfo.facts[0];await assert.rejects(()=>s.appendAssertion(a,org.id,{kind:fact.kind,assertionKey:fact.assertionKey,expectedRevision:fact.revision,payload:fact.payload,provenance:fact.provenance,requestKey:randomUUID()}),{code:'DIRECTORY_SOURCE_CHANGED'});
 await assert.rejects(()=>s.previewTeamWorkspace(ctx('owner'),c.id,'public'),{status:403});
 assert.equal((await s.adminAssertion(a,pending.id)).decision,null,'prior pending history preserved');
}));
test('real PG manual replacement does not require outgoing source, but reviewed institutions never silently recover or expand',async()=>directoryRollback(async({db,ctx,provenance,direct,rowId,suffix})=>{
 const s=createDirectoryService({db}),a=ctx('admin');
 const org=await s.createEntity(a,{kind:'organization',stableKey:'history-'+suffix,requestKey:randomUUID()});
 let fact=await s.appendAssertion(a,org.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'有历史机构'},provenance,requestKey:randomUUID()});
 await s.decide(a,fact.id,{expectedDecisionVersion:0,assertionHash:fact.hash,decision:'approve',audience:'tenant',reason:'合成租户范围',requestKey:randomUUID()});
 const draft=await s.createTeamWorkspace(a,{data:{name:'范围保护团队',verificationMethod:'administrator',organization:{entityId:org.id,name:'有历史机构',type:''},members:[{key:'p',name:'合成人员',role:'lead'}]},requestKey:randomUUID()});
 assert.equal((await s.previewTeamWorkspace(a,draft.id,'public')).canApprove,false,'tenant-approved institution cannot become public implicitly');
 fact=await s.appendAssertion(a,org.id,{kind:'profile',assertionKey:'profile',expectedRevision:1,payload:{name:'有历史机构'},provenance,requestKey:randomUUID()});
 let w=await s.teamWorkspace(a,draft.id);await s.saveTeamWorkspace(a,draft.id,{data:w.data,expectedVersion:w.version,baseRevision:w.currentRevision,requestKey:randomUUID()});
 assert.equal((await s.previewTeamWorkspace(a,draft.id,'tenant')).canApprove,false,'pending new head cannot hide prior approval');
 const fresh=await s.createEntity(a,{kind:'organization',stableKey:'independent-'+suffix,requestKey:randomUUID()});await s.appendAssertion(a,fresh.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'首次待审机构'},provenance,requestKey:randomUUID()});
 await direct(tx=>tx.$executeRaw`UPDATE rh_source.source_record SET row_sha256=${'b'.repeat(64)} WHERE tenant_id=${db.tenantId} AND id=${rowId}`);
 w=await s.teamWorkspace(a,draft.id);await s.saveTeamWorkspace(a,draft.id,{data:{...w.data,organization:{entityId:fresh.id,name:'首次待审机构',type:''},evidence:[{reference:provenance[0],targets:['team']}]},expectedVersion:w.version,baseRevision:w.currentRevision,requestKey:randomUUID()});
 await review(s,a,draft.id);assert.equal((await s.team({},draft.id)).item.organization.id,fresh.id);
}));
test('real PG mid-review failure rolls back verification, new people, facts, decisions and receipt together',async()=>directoryRollback(async({db,ctx,direct,suffix})=>{
 const s=createDirectoryService({db}),a=ctx('admin'),c=await s.createTeamWorkspace(a,{data:{name:'人工回滚-'+suffix,verificationMethod:'administrator',organization:{name:'新合成机构'},members:[{key:'p',name:'新合成人员',role:'lead'}]},requestKey:randomUUID()});
 const p=await s.previewTeamWorkspace(a,c.id,'tenant'),[n]=await direct(tx=>tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.assertion WHERE tenant_id=${db.tenantId} AND hub_key=${db.hubKey}`);
 const failing=createDirectoryService({db:{...db,budget:{assertion:n.n+1}}}),body={expectedVersion:1,planHash:p.planHash,audience:'tenant',reason:'合成回滚',requestKey:randomUUID()};
 const before=await s.adminEntities(a);await assert.rejects(()=>failing.reviewTeamWorkspace(a,c.id,body),{code:'DIRECTORY_FIXTURE_BUDGET'});
 const w=await s.teamWorkspace(a,c.id);assert.equal(w.version,1);assert.deepEqual(w.verifications,[]);assert.equal((await s.adminEntity(a,c.id)).facts.length,0);assert.deepEqual(await s.adminEntities(a),before);
 await assert.rejects(()=>s.teamWorkspaceReceipt(a,c.id,body.requestKey),{status:404});
}));
test('real PG same-name institution content changes invalidate a saved plan and require a new full-profile proposal',async()=>directoryRollback(async({db,ctx,provenance,suffix})=>{
 const s=createDirectoryService({db}),a=ctx('admin'),o=await s.createEntity(a,{kind:'organization',stableKey:'snapshot-'+suffix,requestKey:randomUUID()});
 await s.appendAssertion(a,o.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'同名合成机构',summary:'旧简介'},provenance,requestKey:randomUUID()});
 const c=await s.createTeamWorkspace(a,{data:{name:'快照团队',verificationMethod:'administrator',organization:{entityId:o.id,name:'同名合成机构',type:''},members:[{key:'p',name:'合成负责人',role:'lead'}]},requestKey:randomUUID()}),p=await s.previewTeamWorkspace(a,c.id,'tenant');assert.equal(p.jointInstitutions[0].profile.summary,'旧简介');
 await s.appendAssertion(a,o.id,{kind:'profile',assertionKey:'profile',expectedRevision:1,payload:{name:'同名合成机构',summary:'新简介'},provenance,requestKey:randomUUID()});
 await assert.rejects(()=>s.reviewTeamWorkspace(a,c.id,{expectedVersion:1,planHash:p.planHash,audience:'tenant',reason:'旧提案不得通过',requestKey:randomUUID()}),{status:409});
 const w=await s.teamWorkspace(a,c.id);await s.saveTeamWorkspace(a,c.id,{data:w.data,expectedVersion:w.version,baseRevision:w.currentRevision,requestKey:randomUUID()});const next=await s.previewTeamWorkspace(a,c.id,'tenant');assert.equal(next.jointInstitutions[0].profile.summary,'新简介');assert.notEqual(next.planHash,p.planHash);assert.deepEqual((await s.teamWorkspace(a,c.id)).verifications,[]);
}));
