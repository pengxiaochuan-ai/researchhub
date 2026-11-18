import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {checkFixtureIdentity,readFixtureIdentity,validateFixtureConfig,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

const sql=readFileSync(new URL('../server/ai-agent/session-material-schema.sql',import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const materialSchemaSqlHash=hash(sql);
const dependencies={
  tenant:{id:'text!',status:'TenantStatus!'},
  account:{id:'text!',tenantId:'text!',status:'AccountStatus!'},
  study_group:{id:'text!',tenantId:'text!',status:'StudyGroupStatus!'},
  research_project:{id:'text!',tenantId:'text!',studyGroupId:'text!',status:'text!'},
  session:{id:'text!',tenantId:'text!',studyGroupId:'text!',researchProjectId:'text!',accountId:'text!',status:'text!',deletedAt:'timestamp'},
  knowledge_base:{id:'text!',tenantId:'text',studyGroupId:'text',researchProjectId:'text',ownerAccountId:'text',visibility:'text!'},
  knowledge_source_file:{id:'text!',tenantId:'text',studyGroupId:'text',kbId:'text!',docId:'text',sha256:'text!',createdBy:'text'},
  knowledge_import_task:{id:'text!',tenantId:'text',studyGroupId:'text',kbId:'text!',sourceFileId:'text!',docId:'text',status:'text!',stage:'text!',safetyLevel:'text',createdBy:'text'},
  knowledge_doc:{id:'text!',tenantId:'text',studyGroupId:'text',kbId:'text!',contentMd:'text!',version:'int4!',status:'text!',safetyLevel:'text!',trashedAt:'timestamp'},
};
export async function readMaterialLegacyShape(tx){
  const tables=Object.keys(dependencies);
  const columns=await tx.$queryRawUnsafe(`SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,column_name`,tables);
  const keys=await tx.$queryRawUnsafe(`SELECT c.relname AS table_name,i.indisprimary AS primary_key,ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(num,position) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num ORDER BY k.position) AS columns FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1) AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL ORDER BY c.relname,i.indexrelid`,tables);
  const relations=await tx.$queryRawUnsafe(`SELECT c.relname AS table_name,p.relname AS parent_table,ARRAY(SELECT a.attname::text FROM unnest(f.conkey) WITH ORDINALITY k(num,position) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num ORDER BY k.position) AS columns,ARRAY(SELECT a.attname::text FROM unnest(f.confkey) WITH ORDINALITY k(num,position) JOIN pg_attribute a ON a.attrelid=p.oid AND a.attnum=k.num ORDER BY k.position) AS parent_columns,f.confdeltype::text AS on_delete FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_class p ON p.oid=f.confrelid WHERE f.contype='f' AND c.relnamespace='public'::regnamespace AND p.relnamespace='public'::regnamespace AND c.relname=ANY($1) ORDER BY c.relname,f.conname`,tables);
  return {columns,keys,relations};
}
export function verifyMaterialLegacyShape(state){
  const selected=[];
  const conflict=()=>{throw Error('MATERIAL_LEGACY_SCHEMA_CONFLICT');};
  for(const [table,columns] of Object.entries(dependencies)){
    for(const [column,type] of Object.entries(columns)){
      const actual=state.columns.find(c=>c.table_name===table&&c.column_name===column);
      if(!actual || actual.udt_name+(actual.is_nullable==='NO'?'!':'')!==type)conflict();
      selected.push([table,column,type]);
    }
    if(!state.keys.some(k=>k.table_name===table&&k.primary_key&&JSON.stringify(k.columns)==='["id"]'))conflict();
  }
  for(const [table,column] of [['knowledge_source_file','storageKey'],['knowledge_import_task','sourceFileId']]){
    if(!state.keys.some(k=>k.table_name===table&&JSON.stringify(k.columns)===JSON.stringify([column])))conflict();
    selected.push([table,'unique',column]);
  }
  for(const [table,column,parent] of [['knowledge_doc','kbId','knowledge_base'],['knowledge_source_file','kbId','knowledge_base'],['knowledge_import_task','kbId','knowledge_base'],['knowledge_import_task','sourceFileId','knowledge_source_file']]){
    if(!state.relations.some(r=>r.table_name===table&&r.parent_table===parent&&JSON.stringify(r.columns)===JSON.stringify([column])&&JSON.stringify(r.parent_columns)==='["id"]'&&r.on_delete==='c'))conflict();
    selected.push([table,column,parent,'cascade']);
  }
  return hash(selected);
}
export function assertMaterialDatabase(env){
  if(env?.WP01_TEST_DB_NAME!=='wp01_test_full_baseline')throw Error('MATERIAL_TARGET_REJECTED');
}
export function materialSchemaMode(state,sqlHash){
  if(!state.exists && state.objects.length===0 && !state.receipt)return 'new';
  if(state.exists && state.receipt?.version===1 && state.receipt.sqlHash===sqlHash &&
     state.receipt.catalogHash===state.catalogHash)return 'existing';
  throw Error('MATERIAL_SCHEMA_CONFLICT');
}

export async function inspectMaterialSchema(tx){
  const tables=await tx.$queryRawUnsafe(`SELECT c.relname,c.relkind::text,c.relowner::regrole::text AS owner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname='session_materials' OR c.oid IN (SELECT indexrelid FROM pg_index WHERE indrelid IN (SELECT oid FROM pg_class WHERE relnamespace=n.oid AND relname='session_materials'))) ORDER BY c.relname`);
  const columns=await tx.$queryRawUnsafe(`SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='rh_ai' AND c.relname='session_materials' AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`);
  const constraints=await tx.$queryRawUnsafe(`SELECT conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='rh_ai' AND t.relname='session_materials' ORDER BY conname`);
  const indexes=await tx.$queryRawUnsafe(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='rh_ai' AND tablename='session_materials' ORDER BY indexname`);
  const policies=await tx.$queryRawUnsafe(`SELECT policyname,cmd,roles::text,permissive,qual,with_check FROM pg_policies WHERE schemaname='rh_ai' AND tablename='session_materials' ORDER BY policyname`);
  const triggers=await tx.$queryRawUnsafe(`SELECT tgname,tgenabled::text,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname='session_materials' AND NOT t.tgisinternal ORDER BY tgname`);
  const functions=await tx.$queryRawUnsafe(`SELECT p.proname,p.proowner::regrole::text AS owner,p.proacl::text,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_session_material' ORDER BY p.proname`);
  const namespace=await tx.$queryRawUnsafe(`SELECT nspowner::regrole::text AS owner,nspacl::text FROM pg_namespace WHERE nspname='rh_ai'`);
  const comments=await tx.$queryRawUnsafe(`SELECT obj_description(c.oid,'pg_class') AS receipt FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname='session_materials'`);
  let receipt=null;
  try{receipt=JSON.parse(comments[0]?.receipt??'null');}catch{}
  return {exists:tables.some(t=>t.relname==='session_materials'&&t.relkind==='r'),objects:[...tables.map(t=>t.relname),...functions.map(f=>f.proname)],receipt,
    catalogHash:hash({tables,columns,constraints,indexes,policies,triggers,functions,namespace})};
}

// Reentrant only when the complete recorded catalog still matches. No repairs,
// grants, account changes, Agent config changes or startup-time migrations.
export async function applyMaterialSchemaInTransaction(tx,env){
  assertMaterialDatabase(env);
  checkFixtureIdentity(validateFixtureConfig(env),'direct',await readFixtureIdentity(tx));
  await tx.$queryRawUnsafe(`SELECT set_config('lock_timeout','3s',true)`);
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('rh-ai-session-material-schema-v1',0))`);
  const legacyHash=verifyMaterialLegacyShape(await readMaterialLegacyShape(tx));
  const state=await inspectMaterialSchema(tx),mode=materialSchemaMode(state,materialSchemaSqlHash);
  if(mode==='existing'){
    if(state.receipt.legacyHash!==legacyHash)throw Error('MATERIAL_LEGACY_SCHEMA_CONFLICT');
    return {created:false,sqlHash:materialSchemaSqlHash,legacyHash};
  }
  // Fixed source controlled statements; never interpolate HTTP/request text.
  for(const statement of sql.split('\n-- statement-break\n'))await tx.$executeRawUnsafe(statement);
  const after=await inspectMaterialSchema(tx);
  const rights=(await tx.$queryRawUnsafe(`SELECT has_table_privilege('aisci_app','rh_ai.session_materials','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS app_access,has_schema_privilege('public','rh_ai','USAGE') AS public_usage,has_function_privilege('public','rh_ai.check_session_material()','EXECUTE') AS public_execute`))[0];
  assert.equal(rights.app_access,false,'MATERIAL_UNEXPECTED_APP_GRANT');
  assert.equal(rights.public_usage,false,'MATERIAL_UNEXPECTED_PUBLIC_GRANT');
  assert.equal(rights.public_execute,false,'MATERIAL_UNEXPECTED_PUBLIC_GRANT');
  assert.equal(verifyMaterialLegacyShape(await readMaterialLegacyShape(tx)),legacyHash,'MATERIAL_LEGACY_SCHEMA_CHANGED');
  const receipt={purpose:'ResearchHub-session-materials',syntheticOnly:true,version:1,sqlHash:materialSchemaSqlHash,legacyHash,catalogHash:after.catalogHash};
  // JSON has no SQL quotes; quote defensively. COMMENT does not support binds.
  await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_materials IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
  materialSchemaMode(await inspectMaterialSchema(tx),materialSchemaSqlHash);
  return {created:true,sqlHash:materialSchemaSqlHash,legacyHash};
}
export async function applyMaterialSchema(env){
  assertMaterialDatabase(env);
  return withFixtureTransaction(env,'direct',tx=>applyMaterialSchemaInTransaction(tx,env));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-material-table']);
    const {env}=loadFixtureInput(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
    console.log(JSON.stringify({passed:true,...await applyMaterialSchema(env)}));
  }catch(error){
    console.error(JSON.stringify({passed:false,code:/^(MATERIAL_|WP01_)/.test(error.message)?error.message:'MATERIAL_SCHEMA_UNAVAILABLE'}));
    process.exitCode=1;
  }
}
