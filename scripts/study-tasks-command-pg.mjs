// Fault injection into the SAME real application-role transaction. Always rollback.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createTaskAuthorization} from '../server/study-tasks/authorization.mjs';
import {createTaskCommands} from '../server/study-tasks/commands.mjs';
import {parseTaskCommand} from '../server/study-tasks/contract.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});
assert(row?.manifest?.syntheticOnly);const {plan}=row.manifest;
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {assertStudyTaskAuthority}=require(root+'app/server/src/study-operations/study-task-authority.ts');
const {StudyOperationsService}=require(root+'app/server/src/study-operations/study-operations.service.ts');
const core=new StudyOperationsService({withTenantTransaction(){throw new Error('S08_UNEXPECTED_NESTED_TX');}});
const principal=await withFixtureTransaction(env,'direct',db=>db.account.findFirst({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId,status:'active'},select:{id:true,role:true,authVersion:true,username:true,isTenantAdmin:true}}),{readOnly:true});
const user={...principal,accountId:principal.id,tenantId:plan.scope.tenantId};
let ephemeralTaskId;const injected=new Error('S08_INJECTED_RECEIPT_FAILURE');
const execute=createTaskCommands({boundary:plan,authorize:createTaskAuthorization({boundary:plan,assertAuthority:assertStudyTaskAuthority}),
 transact:(scope,fn)=>withFixtureTransaction(env,'app',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${scope.tenantId},true),set_config('app.study_group_id',${scope.studyGroupId},true),set_config('app.research_project_id',${scope.researchProjectId},true)`;return fn(db);}),
 studyOperations:{async executeHubTaskCommandInTransaction(...args){const result=await core.executeHubTaskCommandInTransaction(...args);ephemeralTaskId=result.id;throw injected;}}});
await assert.rejects(()=>execute(user,plan.scope,parseTaskCommand('create',{requestKey:plan.runId+'-rollback-before-receipt',name:plan.runId+'-事务回滚探针',assigneeAccountId:plan.ids.owner,dueDate:'2026-11-13',collaboratorAccountIds:[plan.ids.admin]})),error=>error===injected);
assert(ephemeralTaskId);
const counts=await withFixtureTransaction(env,'direct',async db=>({tasks:await db.studyTask.count({where:{...plan.scope,id:ephemeralTaskId}}),collaborators:await db.studyTaskCollaborator.count({where:{...plan.scope,studyTaskId:ephemeralTaskId}}),audits:await db.auditLog.count({where:{tenantId:plan.scope.tenantId,target:ephemeralTaskId}}),operations:Number((await db.$queryRaw`SELECT count(*) n FROM rh_study_tasks.operation WHERE task_id=${ephemeralTaskId}`)[0].n)}),{readOnly:true});
assert(Object.values(counts).every(n=>n===0));
const evidence=root+'researchhub/.superpowers/sdd/implementation-plan-study-tasks-s08-2026-11-02/command-pg-'+randomUUID()+'.json';
writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,injected:'after_task_and_audit_before_receipt',rolledBack:counts,committedProbeTasks:0,modelCalls:0},null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({passed:true,rolledBack:counts,committedProbeTasks:0,modelCalls:0,evidence}));
