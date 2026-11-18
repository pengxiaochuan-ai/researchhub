// Extend only the existing synthetic researcher's project membership; no role changes.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const b=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/benchmark-current.json')).acceptedFile)),r=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-researcher-session.json'));
await withFixtureTransaction(env,'direct',async tx=>{
 const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${b.runId}`;assert(marker?.manifest?.syntheticOnly&&marker.manifest.studyId===b.study.id);
 const account=await tx.account.findUnique({where:{id:r.accountId}});assert(account?.tenantId===b.scope.tenantId&&account.role==='researcher'&&!account.isTenantAdmin);
 const member=await tx.studyGroupMembership.findFirst({where:{tenantId:b.scope.tenantId,studyGroupId:b.scope.studyGroupId,accountId:r.accountId,status:'active'},include:{role:true}});assert(member);assert(member.role.buttonPermissions.includes('form.fill'));assert(!member.role.buttonPermissions.includes('study.review'));
 const existing=await tx.researchProjectMembership.findFirst({where:{...b.scope,accountId:r.accountId}});
 if(!existing){await tx.researchProjectMembership.create({data:{...b.scope,accountId:r.accountId,roleKey:'researcher',isDefault:false}});await tx.auditLog.create({data:{...b.scope,accountId:r.accountId,action:'synthetic_fixture.project_membership',target:b.study.id,meta:{syntheticOnly:true,runId:b.runId,roleChanged:false}}});}
});
const root='http://127.0.0.1:19501/api/research-studies/'+b.study.id;
for(const path of ['', '/visits?subjectId='+b.cases.H5.subject.id])assert.equal((await fetch(root+path,{headers:{Cookie:r.cookie}})).status,200);
writeFileSync(workspaceRoot+'researchhub/docs/testing/evidence/research-t12-2026-11-12/benchmark-researcher.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,studyId:b.study.id,accountId:r.accountId,roleChanged:false,defaultProjectChanged:false,actualReadStatus:200},null,2));console.log(JSON.stringify({passed:true,syntheticOnly:true,roleChanged:false}));
