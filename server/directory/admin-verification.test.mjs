import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryHash,normalizeProvenance,normalizeAssertion} from './contract.mjs';
import {directoryRollback} from './test-support.mjs';
import {createDirectoryService} from './commands.mjs';
import {resolveDirectorySource,holdDirectorySources} from './sources.mjs';
import {randomUUID} from 'node:crypto';

const ref={kind:'admin_verification',sourceId:'team-test',versionId:'verify-test',rowId:null,sourceHash:'a'.repeat(64),locator:'管理员人工核实',fieldNames:['directory_profile']};
test('manual directory proof has a distinct restricted contract, not bibliography or work evidence',()=>{
 assert.equal(normalizeProvenance([ref])[0].kind,'admin_verification');
 assert.throws(()=>normalizeProvenance([{...ref,fieldNames:['body']}]),{status:400});
 assert.throws(()=>normalizeAssertion({kind:'collaboration',assertionKey:'collaboration:test',expectedRevision:0,relatedEntityId:'other',payload:{collaborationType:'test',current:true},provenance:[ref],requestKey:'00000000-0000-4000-8000-000000000000'},'team'),{status:400});
});
test('real PG manual proof is usable only for its exact claim, scope and immutable hash',async()=>directoryRollback(async({db,ctx})=>{
 const admin=ctx('admin'),s=createDirectoryService({db}),created=await s.createTeamWorkspace(admin,{data:{name:'核实记录测试'},requestKey:randomUUID()});
 const body=normalizeAssertion({kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'核实记录测试'},provenance:[ref],requestKey:randomUUID()},'team');
 const fact={entityId:created.id,assertionKey:'profile',kind:'profile',relatedEntityId:null,payload:body.payload,revision:1};
 const record={id:'verify-test',tenantId:db.tenantId,hubKey:db.hubKey,teamId:created.id,draftVersion:1,actorId:admin.user.accountId,actorDisplayName:'合成管理员',verifiedAt:'2026-11-06T00:00:00.000Z',reason:'仅合成核实',audience:'public',claimDigests:[directoryHash(fact)]};
 const reference={...ref,sourceId:created.id,sourceHash:directoryHash(record)};
 await db.transaction(async tx=>{
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${db.tenantId},true),set_config('app.hub_key',${db.hubKey},true)`;
  await tx.$executeRaw`UPDATE rh_directory.entity SET team_draft=jsonb_set(team_draft,'{verifications}',${JSON.stringify([record])}::jsonb) WHERE tenant_id=${db.tenantId} AND id=${created.id}`;
  const scope={tenantId:db.tenantId,hubKey:db.hubKey,audience:'public'};
  const got=await resolveDirectorySource(tx,scope,reference,{fact});assert.equal(got.available,true);
  assert.equal(got.title,'管理员人工核实');assert(!JSON.stringify(got).includes('仅合成核实'));assert(!Object.hasOwn(got,'claimDigests'));
  for(const changed of [{...fact,revision:2},{...fact,entityId:'other'},{...fact,payload:{...fact.payload,name:'借用事实'}}])assert.equal((await resolveDirectorySource(tx,scope,reference,{fact:changed})).available,false);
  assert.equal((await resolveDirectorySource(tx,scope,reference)).available,false);
  assert.equal((await resolveDirectorySource(tx,scope,{...reference,sourceHash:'b'.repeat(64)},{fact})).available,false);
  await holdDirectorySources(tx,[reference]);
  await tx.$executeRaw`UPDATE rh_directory.entity SET archived_at=now() WHERE tenant_id=${db.tenantId} AND id=${created.id}`;
  assert.equal((await resolveDirectorySource(tx,scope,reference,{fact})).available,true,'historical records survive source team archival');
  await tx.$executeRaw`UPDATE rh_directory.entity SET team_draft=jsonb_set(team_draft,'{verifications,0,reason}','"篡改"'::jsonb) WHERE tenant_id=${db.tenantId} AND id=${created.id}`;
  assert.equal((await resolveDirectorySource(tx,scope,reference,{fact})).available,false);
 });
}));
