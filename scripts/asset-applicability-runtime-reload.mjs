// Restart ONLY the owned seven-port local host; never recover or mutate old jobs.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-knowledge-local/',runtime=JSON.parse(readFileSync(dir+'runtime.json')),baseline=JSON.parse(readFileSync(root+'.tmp/researchhub-wp09-asset-applicability/preservation.json')),out=root+'docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/reload-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const state=await withFixtureTransaction(env,'direct',async tx=>({jobs:await tx.knowledgeChatJob.count({where:{tenantId:runtime.ids.tenant,status:{in:['queued','processing']}}}),runs:await tx.$queryRaw`SELECT id AS key,md5(row_to_json(t)::text) AS digest FROM research_method_run t WHERE "tenantId"=${runtime.ids.tenant} AND status IN ('queued','validating','running')`}),{readOnly:true});
assert.equal(state.jobs,0,'OWN_LOCAL_CHAT_IN_FLIGHT');
for(const r of state.runs)assert(baseline.rows.research_method_run.some(b=>b.key===r.key&&b.digest===r.digest),'NEW_LOCAL_METHOD_IN_FLIGHT');
const before=readFileSync(dir+'ai-budget-20261022.json');
for(const action of ['stop','start']){const r=spawnSync(process.execPath,[root+'researchhub/scripts/local-knowledge.mjs',action],{cwd:root,encoding:'utf8',timeout:120000});writeFileSync(out+action+'.log',(r.stdout??'')+(r.stderr??''));assert.equal(r.status,0,'OWN_RUNTIME_RELOAD_FAILED');}
const after=JSON.parse(readFileSync(dir+'runtime.json'));assert.deepEqual(after.ids,runtime.ids);assert.notEqual(after.pid,runtime.pid);assert.deepEqual(readFileSync(dir+'ai-budget-20261022.json'),before);
writeFileSync(out+'result.json',JSON.stringify({passed:true,previousPid:runtime.pid,pid:after.pid,activeChatJobs:0,unchangedHistoricalMethodRowsIgnored:state.runs.length,historicalTasksRecovered:false,oldServicesTouched:false,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,pid:after.pid,evidence:out}));
