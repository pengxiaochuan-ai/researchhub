import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const result=await withFixtureTransaction(env,'direct',async db=>{
 const rows=await db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`;assert.equal(rows.length,1);const m=rows[0].manifest,{plan}=m;assert(m.syntheticOnly);
 const sources={};
 for(const model of ['researchArtifact','researchArtifactVersion','researchArtifactSource']){
  const values=await db[model].findMany({where:plan.scope,orderBy:{id:'asc'}});
  assert.equal(values.length,m.baseline[model].count,'S08_SOURCE_COUNT_CHANGED:'+model);assert.equal(hash(values),m.baseline[model].sha256,'S08_SOURCE_HASH_CHANGED:'+model);sources[model]={count:values.length,unchanged:true};
 }
 const created=await db.$queryRaw`SELECT task_id,research_project_id FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId}
  AND study_group_id=${plan.scope.studyGroupId} AND research_project_id=ANY(${[plan.scope.researchProjectId,plan.project.id]}::text[]) AND action='create'`;
 assert(created.length>=2&&created.length<=8);assert.equal(new Set(created.map(r=>r.task_id)).size,created.length);
 const old=await db.studyTask.findMany({where:{...plan.scope,id:{notIn:created.map(r=>r.task_id)}},orderBy:{id:'asc'}});
 assert.equal(old.length,m.baseline.studyTask.count);assert.equal(hash(old),m.baseline.studyTask.sha256,'S08_HISTORICAL_TASK_CHANGED');
 const original=await db.permissionRole.findUnique({where:{id:plan.originalRoleId}});assert.equal(hash(original),m.originalRoleHash,'S08_SHARED_ROLE_CHANGED');
 const member=await db.studyGroupMembership.findUnique({where:{id:plan.ownerGroupMemberId}});assert.equal(member.roleId,plan.roles[1].id);
 const projectMember=await db.researchProjectMembership.findUnique({where:{id:plan.ownerProjectMemberId}});assert.equal(projectMember.roleKey,'project_manager');
 const admin=await db.account.findFirst({where:{id:plan.ids.admin,tenantId:plan.scope.tenantId,status:'active',role:'tenant_admin',isTenantAdmin:true},select:{authVersion:true}});assert(admin);
 const owner=await db.account.findFirst({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId,status:'active',role:'researcher',isTenantAdmin:false},select:{authVersion:true}});assert(owner);
 const unjoined=await db.researchProjectMembership.count({where:{...plan.scope,researchProjectId:plan.project.id,accountId:{in:[plan.ids.owner,plan.ids.admin]}}});assert.equal(unjoined,0);
 assert.equal(hash(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json','utf8')),m.baseline.aiBudgetSha256,'S08_BUDGET_LEDGER_CHANGED');
 return {runId:plan.runId,sources,historicalTasks:{count:old.length,unchanged:true},sharedRoleUnchanged:true,newTasks:created.length,maxTasks:8,unjoinedMemberships:unjoined,ownerAuthVersion:owner.authVersion,adminAuthVersion:admin.authVersion,budgetLedgerUnchanged:true};
},{readOnly:true});
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+result.runId+'/';mkdirSync(out,{recursive:true});const evidence=out+'preservation-'+randomUUID()+'.json';
writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),readOnly:true,syntheticOnly:true,...result},null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({passed:true,...result,evidence}));
