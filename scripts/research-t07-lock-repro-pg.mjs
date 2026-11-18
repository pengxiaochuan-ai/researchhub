// Deliberate two-transaction deadlock, isolated new synthetic project only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fixtureEnvironment,createCreationFixture,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const {ids,runId}=await createCreationFixture(env),direct=fn=>withFixtureTransaction(env,'direct',fn),id={project:runId+'-lock-project',subject:runId+'-lock-subject',task:runId+'-lock-task'},scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:id.project};
const outdir=workspaceRoot+'researchhub/docs/testing/evidence/research-t07-2026-11-12/';mkdirSync(outdir,{recursive:true});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
try {
 await direct(async tx=>{await tx.researchProject.create({data:{id:id.project,tenantId:ids.tenant,studyGroupId:ids.group,code:'synthetic',name:'Synthetic lock'}});await tx.subject.create({data:{id:id.subject,...scope,subjectId:'SYNTHETIC'}});});
 const aLocked=defer(),bLocked=defer(),insert=defer(),bTry=defer();let aPid,bPid;
 const a=direct(async tx=>{aPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;aLocked.resolve();await insert.promise;await tx.studyTask.create({data:{id:id.task,...scope,subjectId:id.subject,source:'manual',taskType:'custom'}});throw Error('rollback');});a.catch(()=>{});
 await aLocked.promise;
 const b=direct(async tx=>{bPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${id.project} FOR UPDATE`;bLocked.resolve();await bTry.promise;await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;throw Error('rollback');});b.catch(()=>{});
 await bLocked.promise;bTry.resolve();let bWait=false;
 for(let i=0;i<80&&!bWait;i++){bWait=await direct(async tx=>((await tx.$queryRaw`SELECT pg_blocking_pids(${bPid}::int) AS pids`)[0].pids).includes(aPid));if(!bWait)await new Promise(r=>setTimeout(r,10));}
 assert.ok(bWait,'migration-like project holder must wait for subject writer');insert.resolve();let cycle=false;
 for(let i=0;i<70&&!cycle;i++){cycle=await direct(async tx=>{const rows=await tx.$queryRaw`SELECT pg_blocking_pids(${aPid}::int) AS a, pg_blocking_pids(${bPid}::int) AS b`;return rows[0].a.includes(bPid)&&rows[0].b.includes(aPid)});if(!cycle)await new Promise(r=>setTimeout(r,10));}
 const settled=await Promise.allSettled([a,b]);if(!cycle)throw Error('expected FK cycle; outcomes '+settled.map(x=>String(x.reason?.message??'success').replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(-1100)).join(' | '));assert.ok(settled.every(x=>x.status==='rejected'));assert.equal(await direct(tx=>tx.studyTask.count({where:{id:id.task}})),0);
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,observedBothBlockingPids:true,realTaskForeignKeyInsert:true,failedTransactions:2,noTaskPersisted:true,errors:settled.map(x=>String(x.reason?.message??'').includes('deadlock detected')?'deadlock detected':'rolled back')};writeFileSync(outdir+'lock-repro.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){const result={passed:false,runId,message:String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,2200)};writeFileSync(outdir+'lock-repro-failure.json',JSON.stringify(result,null,2));console.error(JSON.stringify(result));process.exitCode=1;}
