// Actual app-role current source/target reads. No job, opinion, grant or provider.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {createAssetCatalogReader,loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {createAssetReuse,assertAssetArtifactSources} from './research-assets-reuse.mjs';
import {createAssetDetailAiBasis,assetDetailAiMessages} from './research-assets-detail-ai.mjs';
import {createAssetDetailAiCurrent} from './research-assets-detail-ai-current.mjs';
import {q03Snapshot} from './research-assets-detail-q03-http.mjs';
assert.deepEqual(process.argv.slice(2),['--readonly']);
const root='/Users/mac/aisciencesys/',out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q07/',import.meta.url).pathname;
const {env,ids}=loadCatalogTarget();await assertFixtureTarget(env);const before=await q03Snapshot(),cases=JSON.parse(readFileSync(new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q06/browser.json',import.meta.url))).cases;
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
const rows=await withFixtureTransaction(env,'app',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});
 const users={};for(const actor of ['owner','admin'])users[actor]={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[actor],...await tx.account.findFirst({where:{id:ids[actor]},select:{role:true,authVersion:true}})};
 const transaction=(_u,run)=>run(tx),withAccess=createCatalogAccess({ids,transaction}),withTargetAccess=createCatalogAccess({ids:{...ids,project:'rh-asset-detail-20261113-study-b'},transaction});
 const assertSources=(t,p,s)=>s.sourceKind==='author'?Promise.resolve(s.sourceBindings.length===0):assertAssetArtifactSources(t,p,s,ids);
 const reader=createAssetCatalogReader({withAccess,assertSources}),reuse=createAssetReuse({ids,withAccess,withTargetAccess,assertSources,artifacts:()=>{throw Error('NO_WRITE_FROM_READONLY');}}),checks=[];
 for(const [actor,kind] of [['owner','protocol'],['admin','protocol'],['admin','analysis']]){
  const c=cases.find(x=>x.actor===actor&&x.mode==='copy'&&x.sourceKind===kind),targetCase=kind==='protocol'?cases.find(x=>x.caseKey===actor+'-apply-protocol-1'):null;
  const source=await reader.detail(users[actor],c.targetArtifactId,1);assert.equal(source.bodyAccess,'allowed');
  let target=null;if(targetCase)target=await reuse.readTarget({...users[actor],researchProjectId:reuse.targetStudyId},targetCase.targetArtifactId);
  await withAccess(users[actor],'chat.use',async(tx,p)=>{
   const records=await loadCatalogRecords(tx,p,assertSources),record=records.find(r=>r.registry.assetId===source.id),policy=record.policies.find(x=>x.version===1);
   const [r]=await tx.$queryRawUnsafe("SELECT rh_asset.detail_actor_can_use($1,$2::integer,'ai') AS allowed",source.id,1);assert.equal(r.allowed,true);
   const basis=createAssetDetailAiBasis({source:{...source,policyHash:policy.policyHash},target,principal:p}),messages=assetDetailAiMessages(basis,target?'compare':'explain'),bytes=Buffer.byteLength(JSON.stringify(messages));assert(bytes<=8192);assert(basis.rules.items.every(g=>g.subitems.every(x=>x.state==='not_checked')));
   checks.push({actor,sourceId:source.id,sourceVersion:1,targetId:target?.id??null,targetVersion:target?.version??null,actualSourceAiAllowed:r.allowed,basisHash:basis.basisHash,messageBytes:bytes,groups:6,scope:'fixed_asset_version_only'});
  });
 }
 await assert.rejects(()=>reader.detail({...users.owner,authVersion:4},cases[0].targetArtifactId,1),e=>e.status===401);
 const other=cases.find(x=>x.caseKey==='admin-apply-protocol-1');await assert.rejects(()=>reuse.readTarget({...users.owner,researchProjectId:reuse.targetStudyId},other.targetArtifactId),e=>e.status===404);
 const current=createAssetDetailAiCurrent({ids,transaction:(_user,run)=>run(tx),assertSources,assertLiveClaim:()=>{throw Error('NO_REAL_JOB_IN_READONLY_TEST');}});
 for(const key of ['owner-compare','admin-compare','general-explain']){const who=key==='owner-compare'?'owner':'admin',b=await current.readBasis(users[who],key);assert.equal(b.rules.items.length,6);}
 await assert.rejects(()=>current.readBasis(users.owner,'admin-compare'),/A02_AI_NAMED_CASE_REQUIRED/);
 await assert.rejects(()=>current.withCurrent(users.owner,'nonexistent',{},()=>{throw Error('NEVER_PUBLISH');}),/A02_AI_JOB_CHANGED/);
 return checks;
},{readOnly:true});
assert.deepEqual(await q03Snapshot(),before);writeFileSync(out+'current-pg.json',JSON.stringify({passed:true,at:new Date().toISOString(),actualAppRole:true,newBusinessWrites:0,jobsCreated:0,providerCalls:0,checks:rows,currentStaleAuthDenied:true,otherOwnerTargetDenied:true,oldProtectedUnchanged:true},null,2));console.log(JSON.stringify({passed:true,checks:rows,modelCalls:0},null,2));
