// Test harness only: real original services on the explicit synthetic DB.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalResearchPlans} from '../../scripts/local-research-plans.mjs';
import {createLocalSyntheticEdc} from '../../scripts/local-synthetic-edc.mjs';
import {createLocalCrfMethods} from '../../scripts/local-crf-methods.mjs';
import {createCrfMethodsAi} from '../../scripts/local-crf-methods-ai.mjs';
import {createCrfMethodReports} from '../../scripts/local-crf-methods-reports.mjs';
import {LocalAiBudget} from '../../scripts/knowledge-ai-contract.mjs';
export async function crfMethodAssetsRuntime({scopePath,wrap=tx=>tx,afterTransaction}={}){
 const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-knowledge-local/',r=JSON.parse(readFileSync(dir+'runtime.json')),ids=r.ids;
 const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 await withFixtureTransaction(env,'direct',async tx=>{
  // Never let this test assembly initialize/restore old grants.
  assert(await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'local_research_plan_authorized',target:ids.role}}),'PLAN_INITIALIZER_NOT_ALLOWED');
  const role=await tx.permissionRole.findUnique({where:{id:ids.role}});
  assert(['artifact.read','artifact.create','artifact.edit','chat.use'].every(k=>role.buttonPermissions.includes(k)),'OLD_PERMISSION_MISSING');
 },{readOnly:true});
 const transact=cb=>withFixtureTransaction(env,'direct',async tx=>{const value=await cb(wrap(tx));await afterTransaction?.(tx);return value;});
 const db=new Proxy({$transaction:transact},{get:(_t,name)=>name==='$transaction'?transact:new Proxy({}, {get:(_m,method)=>(...args)=>transact(tx=>tx[name][method](...args))})});
 const prisma={elevated:db,app:db,forTenant:()=>db,withTenantTransaction:(_t,_g,_p,cb)=>transact(cb)};
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name];
 const ledger=JSON.parse(readFileSync(dir+'ai-budget-20261022.json'));assert(ledger.priceValidUntil&&ledger.records.length===79&&ledger.records.every(v=>v.status==='known'));
 const budget=new LocalAiBudget(dir+'ai-budget-20261022.json');
 const plans=await createLocalResearchPlans({root,ids,prisma,knowledge:{},storage:{},load,require,budget,own:()=>{throw Error('WP08_NO_NEW_PLAN_OR_MODEL');}});
 const edc=await createLocalSyntheticEdc({root,ids,plans,prisma,storage:{},load,require,scope:dir+'wp06-scope.json'});
 const methods=createLocalCrfMethods({root,ids,edc,load,require,scope:scopePath??dir+'wp07-scope.json',nativeFetch:()=>{throw Error('WP08_NO_WORKER_FROM_READ_ONLY_HARNESS');}});
 const Sessions=load('sessions/sessions.service','SessionsService');
 const ownInTx=async(tx,u,id,kb)=>{const s=new Sessions({forTenant:()=>tx},{},null,null,null,{}),v=await s.assertKnowledgeSession(u,id);await s.assertAgentAccess(u,v.agentId);assert.equal(v.contextKey,'kb:'+kb);return v;};
 const ai=createCrfMethodsAi({root,ids,methods,edc,prisma,budget,ownInTx,own:()=>{throw Error('WP08_NO_QUEUE_OR_PROVIDER');},require});
 const reports=createCrfMethodReports({root,ids,methods,edc,ai,storage:{},load,require});methods.setAi(ai);methods.setReports(reports);
 const users={};for(const actor of ['owner','admin']){const a=await withFixtureTransaction(env,'direct',tx=>tx.account.findUnique({where:{id:ids[actor]}}),{readOnly:true});users[actor]={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[actor],role:a.role,authVersion:a.authVersion};}
 const fixtures=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/report-fixtures.json'));
 return {root,dir,ids,env,prisma,plans,edc,methods,ai,reports,users,fixtures,transact,require,load};
}
