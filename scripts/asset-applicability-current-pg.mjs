import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createApplicabilityCurrentAccess} from './asset-applicability-current-access.mjs';
import {readAssetApplicabilityScope} from './asset-applicability-scope.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-knowledge-local/',rt=JSON.parse(readFileSync(dir+'runtime.json')),ids=rt.ids,legacy=readFileSync(dir+'wp09-scope.json'),old=JSON.parse(legacy),access=createApplicabilityCurrentAccess(ids),out=root+'researchhub/docs/testing/evidence/applicability-current-2026-11-10/pg-'+Date.now()+'/';mkdirSync(out,{recursive:true});
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const lock=require(root+'app/server/src/common/worker-publication.ts').lockAuthorizationMutation,checks=[],rollback=Error('ROLLBACK_CURRENT_ACCESS_TEST');
const snapshot=tx=>Promise.all([
 tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:{in:[ids.owner,ids.admin]},status:'active'},include:{role:true},orderBy:{id:'asc'}}),
 tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]}},select:{id:true,authVersion:true},orderBy:{id:'asc'}}),
 tx.researchProjectMembership.findMany({where:{tenantId:ids.tenant,researchProjectId:ids.project,accountId:{in:[ids.owner,ids.admin]}},orderBy:{id:'asc'}}),
]);
const before=await withFixtureTransaction(env,'direct',snapshot,{readOnly:true});
for(const actor of ['owner','admin']){
 try{await withFixtureTransaction(env,'direct',async tx=>{
  await lock(tx,ids.tenant,{includeOfficial:true});const accountId=ids[actor],a=before[1].find(a=>a.id===accountId),members=before[0].filter(m=>m.accountId===accountId),user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId,authVersion:a.authVersion},pair=old.pairs.find(p=>p.accountId===accountId);
  assert.equal(members.length,1,'exactly one current group membership');const role=members[0].role;
  for(const op of ['U01','U02','U03'])assert((await access.authorized(tx,user,op,pair)).operations.includes(op));checks.push(actor+'-normal-live-read-edit-AI-authority');
  assert.throws(()=>readAssetApplicabilityScope(dir+'wp09-scope.json',ids,user,'U01',pair));checks.push(actor+'-legacy-still-expired-normal-not-time-limited');
  const original=role.buttonPermissions;
  await tx.permissionRole.update({where:{id:role.id},data:{buttonPermissions:original.filter(p=>p!=='artifact.edit')}});
  assert.deepEqual((await access.authorized(tx,user,'U01',pair)).operations,['U01']);for(const op of ['U02','U03'])await assert.rejects(access.authorized(tx,user,op,pair));
  await tx.permissionRole.update({where:{id:role.id},data:{buttonPermissions:original.filter(p=>p!=='chat.use')}});await assert.rejects(access.authorized(tx,user,'U01',pair));
  await tx.permissionRole.update({where:{id:role.id},data:{buttonPermissions:original}});
  await tx.account.update({where:{id:accountId},data:{authVersion:a.authVersion+1}});await assert.rejects(access.authorized(tx,user,'U01',pair));await tx.account.update({where:{id:accountId},data:{authVersion:a.authVersion}});
  await tx.researchProjectMembership.updateMany({where:{tenantId:ids.tenant,researchProjectId:ids.project,accountId},data:{status:'disabled'}});await assert.rejects(access.authorized(tx,user,'U01',pair));
  checks.push(actor+'-edit-chat-authVersion-membership-revocations-observed-in-same-PG-transaction');throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
}
const after=await withFixtureTransaction(env,'direct',snapshot,{readOnly:true});assert.deepEqual(after,before);assert.deepEqual(readFileSync(dir+'wp09-scope.json'),legacy);
writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,roleAndAccountChangesRolledBack:true,legacyUnchanged:true,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks,evidence:out}));
