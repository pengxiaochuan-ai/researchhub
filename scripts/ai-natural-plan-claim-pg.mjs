// Free integration: temporarily mutate THIS ROUND's own completed row in a rollback transaction.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLiteratureSession} from '../server/ai-agent/literature-session.mjs';import {routeDigest} from '../server/ai-agent/skill-routing.mjs';
const root='/Users/mac/aisciencesys/',out='.tmp/ai-natural-task-2026-11-11',state=JSON.parse(readFileSync(out+'/live-state.json')),rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert(state.passed);
const jobId=state.cases.find(c=>c.role==='owner').jobId,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const {assertLiveClaim}=require(root+'app/server/src/common/worker-claim.ts');
const scope={allowedTenantIds:[rt.ids.tenant],enabledWorkerKinds:['knowledge-chat'],officialJobKinds:[],product:'researchhub'},read=()=>withFixtureTransaction(env,'direct',tx=>tx.knowledgeChatJob.findUnique({where:{id:jobId}}),{readOnly:true});
const before=await read();assert.equal(before.status,'completed');assert.equal(before.accountId,rt.ids.owner);const rollback=Error('ROLLBACK_OWN_ACCEPTANCE'),usage=[];let searches=0,checked=false;
try{await withFixtureTransaction(env,'direct',async tx=>{
 const claim={kind:'knowledge-chat',taskId:jobId,tenantId:rt.ids.tenant,executionToken:'natural-plan-old-generation',workerOwner:'natural-plan-rollback-check'},route=before.payload.hubSkillRoute,{hubNaturalPlan,hubLiteratureEvidence,...payload}=before.payload;
 await tx.knowledgeChatJob.update({where:{id:jobId},data:{status:'processing',executionToken:claim.executionToken,workerOwner:claim.workerOwner,leaseExpiresAt:new Date(Date.now()+60000),payload}});
 const user={tenantId:rt.ids.tenant,accountId:rt.ids.owner,studyGroupId:rt.ids.group,researchProjectId:rt.ids.project},turn={user,sessionId:before.sessionId,jobId,skillRoute:route};
 const service=createLiteratureSession({root:root+'researchhub/',tenantId:rt.ids.tenant,transaction:fn=>fn(tx),routing:{validate:async()=>{},validateInTx:async()=>{}},executionCurrent:async()=>assertLiveClaim(tx,scope,claim),hubSearch:async()=>{searches++;throw Error('must not search');},runSynthesis:async options=>{
  await options.authorize();const result=await options.providerCall([]);await tx.knowledgeChatJob.update({where:{id:jobId},data:{executionToken:'natural-plan-new-generation'}});return{...result,runtimeEvidence:{runtime:'hub-opencode'}};
 }});
 await assert.rejects(service.plan(turn,async()=>({text:hubNaturalPlan.proposal,usage:{totalTokens:123}}),r=>usage.push(r.usage.totalTokens)),/WORKER_CLAIM_LOST/);
 const row=await tx.knowledgeChatJob.findUnique({where:{id:jobId}});assert(!row.payload.hubNaturalPlan);assert(!row.payload.hubLiteratureEvidence);assert.equal(searches,0);assert.deepEqual(usage,[123]);checked=true;throw rollback;
});}catch(e){if(e!==rollback)throw e;}
assert(checked);assert.equal(routeDigest(await read()),routeDigest(before));writeFileSync(out+'/claim-pg.json',JSON.stringify({passed:true,jobId,rollback:true,claimReplacementRejected:true,planningUsageObservedOnce:usage.length,subsequentSearches:searches,realProviderCalls:0,rowUnchanged:true},null,2));console.log(JSON.stringify({passed:true,rollback:true,realProviderCalls:0}));
