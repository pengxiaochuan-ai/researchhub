// D01/C01 opt-in real PG checks. Dry run creates the approved schema and two
// named new-parent fixtures inside ONE transaction and unconditionally rolls back.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {loadCatalogTarget,assetSchemaStatements,bindCatalogContext,readCatalogProtectedSnapshot,CATALOG_TABLES,executeCatalogSchema} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const mode=process.argv[2];assert(['--dry-run','--verify'].includes(mode),'EXPLICIT_ASSET_CATALOG_PG_MODE_REQUIRED');
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const rollback=new Error('EXPECTED_C01_ROLLBACK');
let result;
if(mode==='--verify'){
 const schema=await executeCatalogSchema();assert.equal(schema.action,'verified');
 const app=await withFixtureTransaction(env,'app',async tx=>{
  await bindCatalogContext(tx,ids,ids.owner);
  const rows=await tx.$queryRawUnsafe("SELECT c.relname,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,has_table_privilege(current_user,c.oid,'SELECT') AS read,has_table_privilege(current_user,c.oid,'DELETE') AS delete FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_asset' AND c.relkind='r' ORDER BY c.relname");
  assert.equal(rows.length,4);assert(rows.every(r=>r.rls&&r.forced&&r.read&&!r.delete));
  const counts=await tx.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM rh_asset.asset_registry) AS assets,(SELECT count(*)::int FROM rh_asset.asset_event) AS events');
  return{tables:rows,counts:counts[0]};
 },{readOnly:true});console.log(JSON.stringify({schema,app,mode,businessWrites:0},null,2));
}else{
 try{await withFixtureTransaction(env,'direct',async tx=>{
  await bindCatalogContext(tx,ids,ids.admin);
  const before=await readCatalogProtectedSnapshot(tx,ids);
  for(const sql of assetSchemaStatements(ids))await tx.$executeRawUnsafe(sql);
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  let number=0;const checks=[];
  async function rejects(label,operation,code){
   const name='asset_case_'+(++number);await tx.$executeRawUnsafe('SAVEPOINT '+name);let failed;
   try{await operation();}catch(e){failed=e;}
   await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+name);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+name);
   assert(failed,label+' MUST refuse');if(code)assert.equal(failed.meta?.code??failed.code,code,label+': '+failed.message.slice(-240));checks.push(label);
  }
  const parents=[];
  for(const actor of ['owner','admin']){
   await bindCatalogContext(tx,ids,ids[actor]);
   const title='C01原创合成方案说明 '+actor,contentMd='# '+title+'\n\n仅验证数据约束，无临床数据。';
   const metadata={title,summary:'合成材料',purpose:'专用库约束验证',limitations:'非科研结果',author:'本轮合成作者'};
   const policyHash=digest({metadata,actor}),contentHash=digest(contentMd);
   const block={type:'rh-research-asset-catalog.v2',assetKind:'protocol',versionNo:1,ownerAccountId:ids[actor],metadata,sourceBindings:[],rightsEvidence:'本轮原创合成材料、允许两账号演练引用',discoveryRecipientCeiling:[ids.owner,ids.admin],policyHash};
   const artifact=await tx.researchArtifact.create({data:{id:'rh-a01-c01-'+randomUUID(),tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:ids[actor],createdBy:ids[actor],typeKey:'research_report',title,idempotencyKey:'rh-research-asset:catalog-20261112:'+actor+':protocol',creationRequestHash:digest(block)}});
   const v=await tx.researchArtifactVersion.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,artifactId:artifact.id,versionNo:1,contentMd,contentBlocks:[block],contentHash,sourceSnapshotHash:digest('[]'),createdBy:ids[actor]}});
   await tx.$executeRawUnsafe("INSERT INTO rh_asset.asset_registry(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind) VALUES($1,$2,$3,$4,$5,'protocol')",artifact.id,ids.tenant,ids.group,ids.project,ids[actor]);
   await tx.$executeRawUnsafe('INSERT INTO rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no,artifact_version_id,metadata,source_kind,rights_evidence,discovery_recipient_ceiling,content_hash,policy_hash,created_by) VALUES($1,$2,$3,$4,1,$5,$6::jsonb,\'author\',$7,ARRAY[$8,$9],$10,$11,$12)',ids.tenant,ids.group,ids.project,artifact.id,v.id,JSON.stringify(metadata),block.rightsEvidence,ids.owner,ids.admin,contentHash,policyHash,ids[actor]);
   await tx.$executeRawUnsafe("INSERT INTO rh_asset.asset_event(tenant_id,study_group_id,research_project_id,asset_id,version_no,asset_revision,actor_account_id,event_type,request_key,request_hash) VALUES($1,$2,$3,$4,1,1,$5,'created',$6,$7)",ids.tenant,ids.group,ids.project,artifact.id,ids[actor],'c01-create-'+actor,digest(actor));
   parents.push({artifact:artifact.id,versionId:v.id,actor,metadata});
  }
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');checks.push('two true-parent registry/policy/event tuples pass actual commit constraints');
  await bindCatalogContext(tx,ids,ids.owner);
  const read=async()=>Number((await tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM rh_asset.asset_registry'))[0].n);
  assert.equal(await read(),2);checks.push('existing app role reads two new rows after current authorization context');
  for(const [key,value]of [['app.tenant_id','foreign'],['app.study_group_id','foreign'],['app.research_project_id','foreign'],['app.account_id',ids.uninvited],['app.auth_version','invalid']]){
   await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',key,value);assert.equal(await read(),0);checks.push('RLS denies '+key);await bindCatalogContext(tx,ids,ids.owner);
  }
  const own=parents[0];
  for(const table of CATALOG_TABLES)await rejects('app cannot DELETE '+table,()=>tx.$executeRawUnsafe('DELETE FROM rh_asset.'+table),'42501');
  for(const table of ['version_policy','asset_event'])await rejects('app cannot UPDATE '+table,()=>tx.$executeRawUnsafe('UPDATE rh_asset.'+table+' SET created_at=created_at'),'42501');
  await rejects('policy metadata must match its immutable content version',()=>tx.$executeRawUnsafe("INSERT INTO rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no,artifact_version_id,metadata,source_kind,rights_evidence,discovery_recipient_ceiling,content_hash,policy_hash,created_by) SELECT tenant_id,study_group_id,research_project_id,asset_id,version_no,artifact_version_id,'{\"title\":\"spoof\"}'::jsonb,source_kind,rights_evidence,discovery_recipient_ceiling,content_hash,policy_hash,created_by FROM rh_asset.version_policy WHERE asset_id=$1",own.artifact),'23514');
  const old=(await tx.researchArtifact.findFirst({where:{tenantId:ids.tenant,ownerAccountId:ids.owner,idempotencyKey:{startsWith:'rh-research-asset:local-20261112:'}},select:{id:true}})).id;
  await rejects('legacy read-only family cannot be registered',()=>tx.$executeRawUnsafe("INSERT INTO rh_asset.asset_registry(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind,working_version_no) VALUES($1,$2,$3,$4,$5,'publication',2)",old,ids.tenant,ids.group,ids.project,ids.owner),'23514');
  await rejects('registry cannot change without atomic event',async()=>{await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=revision+1 WHERE asset_id=$1',own.artifact);await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');},'23514');
  await rejects('ordinary actor cannot manufacture admin approval',async()=>{
   await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
   await tx.$executeRawUnsafe("UPDATE rh_asset.asset_registry SET revision=2,working_state='approved',approved_version_no=1 WHERE asset_id=$1",own.artifact);
   await tx.$executeRawUnsafe("INSERT INTO rh_asset.asset_event(tenant_id,study_group_id,research_project_id,asset_id,version_no,asset_revision,actor_account_id,event_type,request_key,request_hash) VALUES($1,$2,$3,$4,1,2,$5,'reviewed','c01-owner-review',$6)",ids.tenant,ids.group,ids.project,own.artifact,ids.owner,digest('review'));
   await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  },'42501');
  const access=(extra={})=>({request_id:'c01-request',initiator:ids.owner,recipient:ids.admin,requested:['read_body','cite'],approved:['cite'],decided:ids.owner,expires:'6 days',...extra});
  const writeAccess=async a=>tx.$executeRawUnsafe("INSERT INTO rh_asset.access_request(request_id,tenant_id,study_group_id,research_project_id,asset_id,version_no,initiator_account_id,recipient_account_id,requested_actions,approved_actions,purpose,state,decision_mode,decided_by,decision_reason,expires_at,event_revision) VALUES($1,$2,$3,$4,$5,1,$6,$7,$8::text[],$9::text[],'合成用途','approved','direct_share',$10,'原创材料范围已核对',now()+$11::interval,1)",a.request_id,ids.tenant,ids.group,ids.project,own.artifact,a.initiator,a.recipient,a.requested,a.approved,a.decided,a.expires);
  await rejects('unapproved purpose never becomes an asset grant',()=>writeAccess(access({approved:['ai']})),'23514');
  await rejects('grant cannot outlive seven day approved maximum',()=>writeAccess(access({expires:'8 days'})),'23514');
  await rejects('decision cannot name an unapproved third actor',()=>writeAccess(access({decided:ids.uninvited})),'23514');
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_owner');await bindCatalogContext(tx,ids,ids.admin);
  for(const table of ['version_policy','asset_event'])await rejects('append-only trigger also protects against direct owner '+table,()=>tx.$executeRawUnsafe('UPDATE rh_asset.'+table+' SET created_at=created_at'),'42501');
  const after=await readCatalogProtectedSnapshot(tx,ids);assert.deepEqual(after,before);checks.push('old public definitions, roles, ten assets and twenty versions unchanged');
  result={syntheticOnly:true,mode,checks,checksPassed:checks.length,transientParents:2,durableFixtureWrites:0,oldProtectedUnchanged:true};
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 const empty=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='rh_asset') AS exists"),{readOnly:true});assert.equal(empty[0].exists,false);result.schemaRolledBack=true;
 console.log(JSON.stringify(result,null,2));
}
