// Explicit D01 migration only. Importing this module does not connect or mutate.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

export const CATALOG_TABLES=Object.freeze(['asset_registry','version_policy','access_request','asset_event']);
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const error=code=>{throw new Error(code);};
export function assertCatalogIds(ids){
 if(!ids||!['tenant','group','project','owner','admin'].every(k=>typeof ids[k]==='string'&&/^rh-kb-local-[A-Za-z0-9_-]{1,140}$/.test(ids[k]))||new Set(['tenant','group','project','owner','admin'].map(k=>ids[k])).size!==5)error('ASSET_CATALOG_SCOPE_REJECTED');
 return ids;
}
export function assetSchemaStatements(ids,sql=readFileSync(new URL('../server/research-assets/schema.sql',import.meta.url),'utf8')){
 assertCatalogIds(ids);
 const tokens={TENANT_ID:ids.tenant,GROUP_ID:ids.group,PROJECT_ID:ids.project,OWNER_ID:ids.owner,ADMIN_ID:ids.admin};
 const bound=sql.replace(/\{\{([A-Z_]+)\}\}/g,(_m,k)=>tokens[k]??error('ASSET_CATALOG_SCHEMA_REJECTED'));
 if(/\{\{|\b(?:DROP|TRUNCATE|SECURITY\s+DEFINER|ALTER\s+ROLE|GRANT\s+ALL|CREATE\s+OR\s+REPLACE)\b/i.test(bound))error('ASSET_CATALOG_SCHEMA_REJECTED');
 const statements=bound.split(/^-- statement\s*$/m).map(x=>x.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n').trim()).filter(Boolean);
 const heads=[/^CREATE SCHEMA rh_asset$/i,/^CREATE FUNCTION rh_asset\.[a-z_]+\(/i,/^CREATE TABLE rh_asset\.(asset_registry|version_policy|access_request|asset_event)\s*\(/i,/^ALTER TABLE rh_asset\.(asset_registry|version_policy|access_request|asset_event)\s+(ENABLE|FORCE|ADD CONSTRAINT)\b/i,/^CREATE (?:CONSTRAINT )?TRIGGER [a-z_]+\s+[\s\S]+\bON rh_asset\.(asset_registry|version_policy|access_request|asset_event)\b/i,/^CREATE POLICY [a-z_]+ ON rh_asset\.(asset_registry|version_policy|access_request|asset_event)\b/i,/^CREATE INDEX [a-z_]+ ON rh_asset\.(asset_registry|version_policy|access_request|asset_event)\b/i,/^REVOKE ALL ON (SCHEMA rh_asset|ALL (TABLES|FUNCTIONS) IN SCHEMA rh_asset) FROM PUBLIC$/i,/^GRANT USAGE ON SCHEMA rh_asset TO aisci_app$/i,/^GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rh_asset TO aisci_app$/i,/^GRANT SELECT,INSERT(?:,UPDATE)? ON rh_asset\.(?:asset_registry|version_policy|access_request|asset_event)(?:,rh_asset\.(?:asset_registry|version_policy|access_request|asset_event))* TO aisci_app$/i];
 if(!statements.length||statements.some(s=>!heads.some(p=>p.test(s))||/\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO|ALTER\s+TABLE|GRANT[^;]+ON)\s+public\./i.test(s)))error('ASSET_CATALOG_SCHEMA_REJECTED');
 return statements;
}
export function catalogSchemaDisposition(state,hash,{detailExtensionVerified=false}={}){
 if(!state.exists&&state.tables.length===0)return'create';
 const tables=detailExtensionVerified?[...CATALOG_TABLES,'asset_comment_event','asset_reuse_record']:CATALOG_TABLES;
 if(!state.exists||JSON.stringify([...state.tables].sort())!==JSON.stringify([...tables].sort())||state.comment!=='rh_asset_schema.v1:'+hash)error('ASSET_CATALOG_SCHEMA_DRIFT');
 return'verified';
}
export async function catalogSchemaState(tx){
 const [s]=await tx.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='rh_asset') AS exists, (SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='rh_asset') AS comment");
 const rows=await tx.$queryRawUnsafe("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_asset' AND c.relkind IN ('r','p') ORDER BY c.relname");
 return{...s,tables:rows.map(r=>r.relname)};
}
export async function readCatalogDefinitionRows(tx,schema='rh_asset',{fullNames=false}={}){
 if(!['rh_asset','public'].includes(schema))error('ASSET_CATALOG_SCOPE_REJECTED');
 const sql=`
 SELECT 'table' AS kind,c.relname AS name,jsonb_build_object('rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','p')
 UNION ALL SELECT 'column',c.relname||'.'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint',c.relname||'.'||x.conname,to_jsonb(pg_get_constraintdef(x.oid)) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
 UNION ALL SELECT 'function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_object('sql',pg_get_functiondef(p.oid),'acl',p.proacl::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.prokind='f'
 UNION ALL SELECT 'policy',tablename||'.'||policyname,jsonb_build_object('roles',roles,'cmd',cmd,'qual',qual,'check',with_check) FROM pg_policies WHERE schemaname=$1
 UNION ALL SELECT 'index',indexname,to_jsonb(indexdef) FROM pg_indexes WHERE schemaname=$1
 UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,to_jsonb(pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal
 ORDER BY kind,name`;
 // PostgreSQL UNION resolves NAME operands to the 63-byte identifier type unless explicitly cast.
 const statement=fullNames?sql.replace(/\b(c\.relname|a\.attname|x\.conname|p\.proname|tablename|policyname|indexname|t\.tgname)\b/g,'$1::text'):sql;
 return tx.$queryRawUnsafe(statement,schema);
}
export async function catalogDefinitionFingerprint(tx,schema='rh_asset'){return sha(await readCatalogDefinitionRows(tx,schema));}
export async function readCatalogProtectedSnapshot(tx,ids){
 const assets=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:local-20261112:'}},select:{id:true,ownerAccountId:true,status:true,deletedAt:true,currentVersionNo:true,versions:{select:{versionNo:true,contentHash:true,contentBlocks:true},orderBy:{versionNo:'asc'}}},orderBy:{id:'asc'}});
 if(assets.length!==10||assets.some(a=>a.status!=='draft'||a.deletedAt||a.currentVersionNo!==2||a.versions.length!==2))error('ASSET_CATALOG_OLD_FIXTURES_CHANGED');
 const roles=await tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:{in:[ids.owner,ids.admin]}},select:{accountId:true,status:true,roleId:true,role:{select:{status:true,menuPermissions:true,buttonPermissions:true}}},orderBy:{accountId:'asc'}});
 return{publicDefinitionHash:await catalogDefinitionFingerprint(tx,'public'),oldAssetsHash:sha(assets),oldAssetCount:10,oldVersionCount:20,roleHash:sha(roles)};
}
export async function bindCatalogContext(tx,ids,actor){
 assertCatalogIds(ids);if(![ids.owner,ids.admin].includes(actor))error('ASSET_CATALOG_SCOPE_REJECTED');
 for(const [key,value]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project],['app.account_id',actor]])await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',key,value);
 const account=await tx.account.findFirst({where:{id:actor,tenantId:ids.tenant,status:'active'},select:{authVersion:true,role:true}});
 if(!account)error('ASSET_CATALOG_SCOPE_REJECTED');
 await tx.$queryRawUnsafe("SELECT set_config('app.auth_version',$1,true)",String(account.authVersion));
 return account;
}
export function loadCatalogTarget(){
 const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
 const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));assertCatalogIds(ids);
 return{env,ids};
}
export async function executeCatalogSchema({apply=false}={}){
 const {env,ids}=loadCatalogTarget(),target=await assertFixtureTarget(env);
 if(target.databaseName!=='wp01_test_full_baseline')error('ASSET_CATALOG_TARGET_REJECTED');
 const statements=assetSchemaStatements(ids),hash=sha(statements.join('\n'));
 return withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('researchhub:a01:catalog-schema',0))");
  const actor=await bindCatalogContext(tx,ids,ids.admin);if(actor.role!=='tenant_admin')error('ASSET_CATALOG_ADMIN_REQUIRED');
  const before=await readCatalogProtectedSnapshot(tx,ids),state=await catalogSchemaState(tx);
  let detailExtensionVerified=false;if(state.tables.includes('asset_comment_event')||state.tables.includes('asset_reuse_record')){const{verifyDetailSchemaReceipt}=await import('./research-assets-detail-schema.mjs');detailExtensionVerified=await verifyDetailSchemaReceipt(tx,ids,await catalogDefinitionFingerprint(tx));if(!detailExtensionVerified)error('ASSET_CATALOG_SCHEMA_DRIFT');}
  const disposition=catalogSchemaDisposition(state,hash,{detailExtensionVerified});
  if(disposition==='create'&&!apply)return{syntheticOnly:true,action:'not_applied',tables:[],schemaHash:hash,protectedSnapshot:before};
  if(disposition==='create'){
   for(const s of statements)await tx.$executeRawUnsafe(s);
   await tx.$executeRawUnsafe("COMMENT ON SCHEMA rh_asset IS 'rh_asset_schema.v1:"+hash+"'");
  }
  const fingerprint=await catalogDefinitionFingerprint(tx),after=await readCatalogProtectedSnapshot(tx,ids);
  if(JSON.stringify(before)!==JSON.stringify(after))error('ASSET_CATALOG_PROTECTED_STATE_CHANGED');
  const action='research_assets_catalog_schema_20261112';
  if(disposition==='create')await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action,target:'rh_asset',meta:{schemaHash:hash,fingerprint,protectedSnapshot:before,approval:'D01/A-W/F/I confirmed 2026-11-12',syntheticOnly:true}}});
  else{
   const receipt=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action,target:'rh_asset'},orderBy:{createdAt:'desc'},select:{meta:true}});
   if(receipt?.meta?.schemaHash!==hash)error('ASSET_CATALOG_SCHEMA_DRIFT');
   if(receipt.meta.fingerprint!==fingerprint){
    const {verifyAccessGuardReceipt}=await import('./research-assets-access-schema.mjs');
    if(!await verifyAccessGuardReceipt(tx,ids,receipt.meta.fingerprint,fingerprint)&&!detailExtensionVerified)error('ASSET_CATALOG_SCHEMA_DRIFT');
   }
  }
  return{syntheticOnly:true,action:disposition==='create'?'created':'verified',tables:detailExtensionVerified?[...CATALOG_TABLES,'asset_comment_event','asset_reuse_record']:[...CATALOG_TABLES],schemaHash:hash,fingerprint,protectedUnchanged:true,protectedSnapshot:after,modelsCalled:0,rolesChanged:false};
 },{readOnly:!apply});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv.length!==3||!['--check','--apply'].includes(process.argv[2])){process.stderr.write('Usage: node scripts/research-assets-catalog-schema.mjs --check|--apply\n');process.exitCode=2;}
 else executeCatalogSchema({apply:process.argv[2]==='--apply'}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{process.stderr.write((e.code??e.message)+'\n');process.exitCode=1;});
}
