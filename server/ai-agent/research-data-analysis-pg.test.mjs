import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';import {createLocalResearchDataImports} from '../../scripts/local-research-data-imports.mjs';
import {createConversationCommands} from './conversation-commands.mjs';import {createResearchDataSession} from './research-data-session.mjs';import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';
const root='/Users/mac/aisciencesys/',{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),cfg=JSON.parse(readFileSync(new URL('../../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url),'utf8')),visits=JSON.parse(readFileSync(new URL('../../.tmp/ai-file-data-2026-11-12/p05-browser-visits-1794557573418/result.json',import.meta.url),'utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k],rollback=Symbol('rollback');
const bytes=new Map(),keys=new Map();for(const name of ['p05-browser-profiles-1794557432477','p05-browser-visits-1794557573418']){const m=JSON.parse(readFileSync(new URL('../../.tmp/ai-file-data-2026-11-12/'+name+'/result.json',import.meta.url),'utf8'));for(const a of Object.values(m.actors))bytes.set(a.uploads[0].id,readFileSync(new URL('../../'+a.fixture,import.meta.url)));}
// Original fixture bytes are still checked against persisted SHA by the real
// source service. Actual local object storage is checked separately via HTTP.
const storage={getBuffer:async key=>{assert(keys.has(key)&&bytes.has(keys.get(key)));return bytes.get(keys.get(key));}};
test('admission initializes the account RLS context instead of mistaking owned uploads for an empty session',async()=>{
 const reader=createLocalResearchDataImports({env,ids,load,require,storage}),user={tenantId:ids.tenant,accountId:ids.owner,studyGroupId:ids.group,researchProjectId:ids.project,authVersion:5,role:'researcher',isTenantAdmin:false};
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,user.accountId);for(const r of await tx.$queryRawUnsafe('SELECT id,storage_key FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3',ids.tenant,user.accountId,cfg.sessions[user.accountId]))keys.set(r.storage_key,r.id);
  await tx.$queryRawUnsafe(`SELECT set_config('app.account_id','',true)`);const data=createResearchDataSession({root,tenantId:ids.tenant,reader,routing:{},transaction:fn=>fn(tx)}),s=await data.captureInTx(tx,user,cfg.sessions[user.accountId]);assert.equal(s?.importId,visits.actors.owner.confirmed.id);throw rollback;
 }),e=>e===rollback);
});
test('real queue admission preserves the exact data selection through message, stage and job; all new chat writes roll back, no Provider dispatch',async()=>{
 const reader=createLocalResearchDataImports({env,ids,load,require,storage}),access=createLocalMaterialAccess({env,ids,load}),user={tenantId:ids.tenant,accountId:ids.owner,studyGroupId:ids.group,researchProjectId:ids.project,authVersion:5,role:'researcher',isTenantAdmin:false};let calls=0;
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await access.inTransaction(tx,user,cfg.sessions[user.accountId],async()=>{});for(const r of await tx.$queryRawUnsafe('SELECT id,storage_key FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3',ids.tenant,user.accountId,cfg.sessions[user.accountId]))keys.set(r.storage_key,r.id);
  const data=createResearchDataSession({root,tenantId:ids.tenant,reader,routing:{},transaction:fn=>fn(tx)}),command=createConversationCommands({tenantId:ids.tenant,consumerKey:'p06-rollback-contract',transaction:fn=>fn(tx),authorize:(_tx,u,sid)=>access.inTransaction(tx,u,sid,async(_t,current)=>current),admit:async(_tx,u,sid)=>({hubResearchDataSelection:await data.captureInTx(tx,u,sid)}),stage:async(_tx,u,job)=>({...job.payload,hubResearchDataEvidence:await data.prepareInTx(tx,u,job.sessionId,job.payload.hubResearchDataSelection)}),schedule:async()=>{calls++;}});
  const sid=cfg.sessions[user.accountId],item=await command.submit(user,sid,{requestKey:'p06-rollback-selection-check',text:'解释本批数据的缺失和质控局限',kbIds:[],networkIntent:{schema:'hub-network-intent.v1',enabled:false}});await command.tick(user,sid);
  const message=await tx.message.findFirst({where:{id:item.id,tenantId:ids.tenant,sessionId:sid}}),job=await tx.knowledgeChatJob.findFirst({where:{userMessageId:item.id,tenantId:ids.tenant,sessionId:sid}});assert(job);assert.deepEqual(job.payload.hubResearchDataSelection,message.meta.hubCommand.hubResearchDataSelection);assert.equal(job.payload.hubResearchDataEvidence.packHash,job.payload.hubResearchDataSelection.packHash);assert.equal(calls,1);throw rollback;
 }),e=>e===rollback);
});
test('P06 reads fixed native CRF only within its existing transaction, restores source GUC, and never writes business data',async()=>{
 const imports=createLocalResearchDataImports({env,ids,load,require,storage});assert.equal(typeof imports.analysisInTransaction,'function');
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  for(const actor of ['owner','admin']){
   const user={tenantId:ids.tenant,accountId:ids[actor],studyGroupId:ids.group,researchProjectId:ids.project,authVersion:5,role:actor==='owner'?'researcher':'tenant_admin',isTenantAdmin:actor==='admin'};
   await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,user.accountId);for(const r of await tx.$queryRawUnsafe('SELECT id,storage_key FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3',ids.tenant,user.accountId,cfg.sessions[user.accountId]))keys.set(r.storage_key,r.id);
   const p=await imports.analysisInTransaction(tx,user,cfg.sessions[user.accountId],visits.actors[actor].confirmed.id);assert.equal(p.counts.subjects,2);assert.equal(p.counts.visits,2);assert.equal(p.counts.completedVisits,0);assert.equal(p.fields.find(f=>f.key==='value').numeric.mean,2);assert.equal(p.fields.find(f=>f.key==='completed').boolean.falseCount,1);assert.equal(p.quality.status,'checks-passed');
   const [guc]=await tx.$queryRawUnsafe(`SELECT current_setting('app.research_project_id') AS project`);assert.equal(guc.project,ids.project);
   await assert.rejects(imports.analysisInTransaction(tx,user,cfg.sessions[user.accountId],visits.actors[actor==='owner'?'admin':'owner'].confirmed.id),e=>[403,404].includes(e.status??e.getStatus?.()));
  }
  throw rollback;
 }),e=>e===rollback);
});
