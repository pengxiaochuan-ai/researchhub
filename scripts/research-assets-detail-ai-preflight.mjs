// Explicitly read-only: no approval creation, queue operation, provider or token grant.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--readonly']);
const root='/Users/mac/aisciencesys/',out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q07/',import.meta.url).pathname;
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const ledgerPath=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledgerBytes=readFileSync(ledgerPath),ledger=JSON.parse(ledgerBytes);
const approvalPath=root+'.tmp/researchhub-wp09-asset-applicability/fee-approval.json',approval=JSON.parse(readFileSync(approvalPath)),attempts=JSON.parse(readFileSync(approvalPath+'.attempts.json')).records;
assert.equal(ledger.limitMicroCny,5000000);assert(ledger.records.every(x=>x.status==='known'));assert.equal(attempts.length,10);
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {BillingService}=require(root+'app/server/src/billing/billing.service.ts');
const {SessionsService}=require(root+'app/server/src/sessions/sessions.service.ts');
const {estimateRunTokenBudget}=require(root+'app/server/src/billing/token-quota-policy.ts');
const sql=await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);
 const billing=new BillingService({elevated:tx},{}),quotas={};
 for(const actor of ['owner','admin'])quotas[actor]=await billing.myTokenQuota({tenantId:ids.tenant,accountId:ids[actor],role:actor==='admin'?'tenant_admin':'researcher'});
 const agentId=ids.tenant+'-kb-research',agent=await tx.agent.findFirst({where:{id:agentId,tenantId:ids.tenant,status:'active'},select:{id:true}}),config=await tx.agentConfig.findFirst({where:{agentId,tenantId:ids.tenant,active:true,archivedAt:null},select:{model:true,version:true}});
 assert(agent&&config?.model?.provider==='deepseek'&&config.model.model==='deepseek-v4-pro'&&config.model.maxTokens===1536);
 const sessions=new SessionsService({forTenant:()=>tx},{},null,null,null,{});
 for(const actor of ['owner','admin'])await sessions.assertAgentAccess({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[actor],role:actor==='admin'?'tenant_admin':'researcher'},agentId);
 const jobs=await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,requestKey:{startsWith:'rh-applicability-ai-'}},select:{id:true,accountId:true,status:true},orderBy:{id:'asc'}});
 assert.equal(jobs.filter(x=>!approval.excludedFreeJobs.includes(x.id)).length,11);
 const targets=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,researchProjectId:'rh-asset-detail-20261113-study-b',idempotencyKey:{startsWith:'rh-research-asset:detail-20261113:application:'}},select:{id:true,currentVersionNo:true,ownerAccountId:true,status:true},orderBy:{id:'asc'}});
 const a02Jobs=await tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,requestKey:{startsWith:'rh-asset-detail-ai-'}}});assert.equal(a02Jobs,0);
 return{quotas,agent:{id:agentId,model:'deepseek-v4-pro',configVersion:config.version,oldAccessBothPassed:true},legacyTasks:jobs.length,approvedWindowTasks:11,legacyStatus:jobs.reduce((s,j)=>({...s,[j.status]:(s[j.status]??0)+1}),{}),requiredTokenReservation:estimateRunTokenBudget(1536).toString(),targets,a02Jobs};
},{readOnly:true});
assert.equal(assetDigest(readFileSync(ledgerPath)),assetDigest(ledgerBytes),'SHARED_LEDGER_CHANGED_DURING_READ');
const spent=ledger.records.reduce((n,r)=>n+r.costMicroCny,0),perRequest=(4*8192+8192)*9+1536*27;
const result={passed:true,at:new Date().toISOString(),scope:'readonly_preparation_not_execution',providerCalls:0,newBusinessWrites:0,newTokenGrants:0,approvalCreated:false,
 ledger:{records:ledger.records.length,known:ledger.records.length,knownMicroCny:spent,reserved:0,unknown:0,limitMicroCny:ledger.limitMicroCny,priceValidUntil:ledger.priceValidUntil,sha256:assetDigest(ledgerBytes),accounting:'existing conservative local accounting; not provider cash balance'},
 oldWindow:{tasks:sql.approvedWindowTasks,taskLimit:20,requests:attempts.length,requestLimit:12},sql,
 proposal:{newJobs:4,newRequests:4,totalTasks:sql.approvedWindowTasks+4,requestedRequestLimit:14,perRequestMaxMicroCny:perRequest,additionalMaxMicroCny:4*perRequest,accountingTotalUpperMicroCny:spent+4*perRequest,inputBytes:8192,maxOutputTokens:1536},
 blockers:['No A02 paid approval. Do not renew old WP09 scope or quote.','Queue/service/UI real execution and professional results are not verified by this preflight.']};
writeFileSync(out+'admission.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,ledger:result.ledger,oldWindow:result.oldWindow,quota:sql.quotas,requiredTokenReservation:sql.requiredTokenReservation,proposal:result.proposal,modelCalls:0},null,2));
