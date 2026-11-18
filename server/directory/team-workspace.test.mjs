import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDirectoryService} from './commands.mjs';import {directoryRollback} from './test-support.mjs';
test('real PG name-only team draft persists privately with CAS and immutable receipts',async()=>directoryRollback(async({db,ctx,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),input={data:{name:'草稿团队-'+suffix},requestKey:randomUUID()};
 await assert.rejects(()=>s.createTeamWorkspace(ctx('owner'),input),{status:403});
 const a=await s.createTeamWorkspace(admin,input);assert.equal(a.version,1);assert.deepEqual(await s.createTeamWorkspace(admin,input),a);
 const w=await s.teamWorkspace(admin,a.id);assert.equal(w.publishedAudience,null);assert.equal(w.data.name,input.data.name);assert.equal(w.version,1);assert.equal((await s.teams({},{q:input.data.name})).pagination.totalItems,0);
 const p=await s.previewTeamWorkspace(admin,a.id,'tenant');assert.equal(p.canApprove,false);
 const body={expectedVersion:1,baseRevision:w.currentRevision,data:{...w.data,summary:'补充说明'},requestKey:randomUUID()},b=await s.saveTeamWorkspace(admin,a.id,body);
 assert.equal(b.version,2);assert.deepEqual(await s.saveTeamWorkspace(admin,a.id,body),b);
 await assert.rejects(()=>s.saveTeamWorkspace(admin,a.id,{...body,data:{name:'不同内容'}}),{status:409});
 await assert.rejects(()=>s.saveTeamWorkspace(admin,a.id,{...body,requestKey:randomUUID()}),{status:409});
 assert.equal((await s.teamWorkspaceReceipt(admin,a.id,body.requestKey)).result.version,2);
 await assert.rejects(()=>s.teamWorkspace(ctx('owner'),a.id),{status:403});
}));
test('real PG incomplete evidence remains private draft, preview identifies the missing position/range',async()=>directoryRollback(async({db,ctx,provenance,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),ref={...provenance[0],locator:'',fieldNames:[]};
 const c=await s.createTeamWorkspace(admin,{data:{name:'未完依据-'+suffix,evidence:[{reference:ref,targets:['team']}]},requestKey:randomUUID()});
 const w=await s.teamWorkspace(admin,c.id);assert.equal(w.data.evidence[0].reference.locator,'');const p=await s.previewTeamWorkspace(admin,c.id,'public');assert(!p.canApprove);assert(p.issues.some(x=>/位置|范围/.test(x)));
 await assert.rejects(()=>s.reviewTeamWorkspace(admin,c.id,{expectedVersion:1,planHash:p.planHash,audience:'public',reason:'不应通过未完依据',requestKey:randomUUID()}),{status:409});assert.equal((await s.adminEntity(admin,c.id)).facts.length,0);
}));
test('real PG one transaction approves team, new organization/person and relationships, replay does not duplicate',async()=>directoryRollback(async({db,ctx,provenance,suffix,direct})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),data={name:'整链团队-'+suffix,organization:{name:'合成机构-'+suffix,type:'科研机构'},members:[{key:'lead',name:'合成负责人-'+suffix,role:'lead'}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead']}]};
 const created=await s.createTeamWorkspace(admin,{data,requestKey:randomUUID()}),p=await s.previewTeamWorkspace(admin,created.id,'public');assert.equal(p.canApprove,true,JSON.stringify(p.issues));
 const body={expectedVersion:created.version,planHash:p.planHash,audience:'public',reason:'核对合成资料，仅事务回滚测试',requestKey:randomUUID()};
 const r=await s.reviewTeamWorkspace(admin,created.id,body);assert.deepEqual(await s.reviewTeamWorkspace(admin,created.id,body),r);
 const team=await s.team({},created.id);assert.equal(team.item.name,data.name);assert.equal(team.item.members[0].name,data.members[0].name);assert.equal(team.item.organization.name,data.organization.name);
 const w=await s.teamWorkspace(admin,created.id);assert.equal(w.publishedAudience,'public');assert(w.data.members[0].entityId);assert.equal(w.reviewedVersion,w.version);assert.equal((await s.previewTeamWorkspace(admin,created.id,'public')).changes.length,0);
}));
test('real PG source withdrawal and mid-review failure leave no partial public facts',async()=>directoryRollback(async({db,ctx,provenance,suffix,direct,sourceId,rowId})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),data={name:'回滚团队-'+suffix,organization:{name:'回滚机构'},members:[{key:'lead',name:'回滚负责人',role:'lead'}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead']}]};
 const created=await s.createTeamWorkspace(admin,{data,requestKey:randomUUID()}),p=await s.previewTeamWorkspace(admin,created.id,'public'),body={expectedVersion:1,planHash:p.planHash,audience:'public',reason:'合成测试',requestKey:randomUUID()};
 // A real quota failure after an earlier insert exercises transaction rollback, not a UI replacement.
 const failing=createDirectoryService({db:{...db,budget:{organization:999,researcher:0,assertion:999,decision:999}}});
 await assert.rejects(()=>failing.reviewTeamWorkspace(admin,created.id,body),{status:409});
 assert.equal((await s.adminEntity(admin,created.id)).facts.length,0);assert.equal((await s.teamWorkspace(admin,created.id)).version,1);
 await direct(tx=>tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${db.tenantId},${db.hubKey},${sourceId},${rowId},'abstract','display','public','revoke','evidence://team-source-revoke',${admin.user.accountId},1)`);
 await assert.rejects(()=>s.reviewTeamWorkspace(admin,created.id,body),{status:409});assert.equal((await s.adminEntity(admin,created.id)).facts.length,0);
}));
test('review regression: replace an approved team institution twice, then narrow visibility without rewriting people',async()=>directoryRollback(async({db,ctx,provenance,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),data={name:'替换机构-'+suffix,organization:{name:'第一机构'},members:[{key:'lead',name:'合成负责人',role:'lead'}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead']}]};
 const c=await s.createTeamWorkspace(admin,{data,requestKey:randomUUID()});
 const review=async(audience)=>{const w=await s.teamWorkspace(admin,c.id),p=await s.previewTeamWorkspace(admin,c.id,audience);assert(p.canApprove,JSON.stringify(p));return s.reviewTeamWorkspace(admin,c.id,{expectedVersion:w.version,planHash:p.planHash,audience,reason:'合成回归',requestKey:randomUUID()});};
 await review('public');let w=await s.teamWorkspace(admin,c.id);const person=w.data.members[0].entityId,personFacts=(await s.adminEntity(admin,person)).facts.filter(f=>f.kind!=='team_member');
 await s.saveTeamWorkspace(admin,c.id,{expectedVersion:w.version,baseRevision:w.baseRevision,data:{...w.data,organization:{name:'第二机构'}},requestKey:randomUUID()});await review('public');assert.equal((await s.team({},c.id)).item.organization.name,'第二机构');
 await review('tenant');assert.equal((await s.teamWorkspace(admin,c.id)).publishedAudience,'tenant');await assert.rejects(()=>s.team({},c.id),{status:404});assert.equal((await s.team(ctx('owner'),c.id,'tenant')).item.organization.name,'第二机构');assert.deepEqual((await s.adminEntity(admin,person)).facts.filter(f=>f.kind!=='team_member'),personFacts);
}));
test('review regression: a source mismatch in an unrelated pending entity does not block this team',async()=>directoryRollback(async({db,ctx,provenance,suffix,direct,rowId,sourceId})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),unrelated=await s.createEntity(admin,{kind:'team',stableKey:'unrelated-'+suffix,requestKey:randomUUID()});
 await s.appendAssertion(admin,unrelated.id,{assertionKey:'profile',kind:'profile',expectedRevision:0,payload:{name:'不相关待审团队'},provenance,requestKey:randomUUID()});
 const second=rowId+'-team';await direct(async tx=>{
  await tx.$executeRaw`INSERT INTO rh_source.source_record(id,tenant_id,hub_key,batch_id,source_registry_id,row_number,row_sha256,raw_fields,title,abstract_text) SELECT ${second},tenant_id,hub_key,batch_id,source_registry_id,3,row_sha256,raw_fields,title,abstract_text FROM rh_source.source_record WHERE id=${rowId} AND tenant_id=${db.tenantId}`;
  for(const field of ['bibliographic','abstract'])await tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${db.tenantId},${db.hubKey},${sourceId},${second},${field},'display','public','approve','evidence://team-current-independent-proof',${admin.user.accountId},1)`;
  await tx.$executeRaw`UPDATE rh_source.source_record SET row_sha256=${'b'.repeat(64)} WHERE tenant_id=${db.tenantId} AND id=${rowId}`;
 });
 const alternate={...provenance[0],rowId:second,locator:'独立有效合成材料'};
 const created=await s.createTeamWorkspace(admin,{data:{name:'当前团队-'+suffix,organization:{name:'当前机构'},members:[{key:'a',name:'当前负责人',role:'lead'}],evidence:[{reference:alternate,targets:['team','organization','member:a']}]},requestKey:randomUUID()});
 const p=await s.previewTeamWorkspace(admin,created.id,'public');assert(p.canApprove,JSON.stringify(p.issues));
 await s.reviewTeamWorkspace(admin,created.id,{expectedVersion:1,planHash:p.planHash,audience:'public',reason:'无关事实不阻断',requestKey:randomUUID()});
}));
