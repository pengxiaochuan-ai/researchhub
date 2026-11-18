import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {checkFixtureIdentity,readFixtureIdentity,validateFixtureConfig,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readMaterialLegacyShape,verifyMaterialLegacyShape,assertMaterialDatabase} from './ai-session-material-schema.mjs';import {inspectResearchDataSchema} from './ai-research-data-schema.mjs';
const sql=readFileSync(new URL('../server/ai-agent/research-data-import-schema.sql',import.meta.url),'utf8'),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex'),names=['research_data_import_access','research_data_imports'];
// Bounded v2 of our new guard: explicit admin restoration keeps the original
// identity/capabilities/expiry and a new audit/CAS; it is not automatic renewal.
const originalGuard=sql.split('\n-- statement-break\n').find(s=>s.startsWith('CREATE FUNCTION rh_ai.check_research_data_import()'));
assert(originalGuard?.includes("OR OLD.status='revoked' OR NEW.audit_id=OLD.audit_id"));
const currentGuard=originalGuard.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace("OR OLD.status='revoked' OR NEW.audit_id=OLD.audit_id","OR NEW.audit_id=OLD.audit_id").replace(" END IF;\n IF TG_OP='UPDATE' AND NEW.version", " END IF;\n IF TG_TABLE_NAME='research_data_import_access' THEN IF NEW.status='active' AND NEW.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'DATA_IMPORT_GRANT_EXPIRED'; END IF; END IF;\n IF TG_OP='UPDATE' AND NEW.version"),guardHash=hash(currentGuard);
export async function inspectResearchDataImportSchema(tx){
 const relations=await tx.$queryRawUnsafe(`SELECT c.relname,c.relkind::text,c.relowner::regrole::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname=ANY($1) OR c.oid IN (SELECT indexrelid FROM pg_index WHERE indrelid IN (SELECT oid FROM pg_class WHERE relnamespace=n.oid AND relname=ANY($1)))) ORDER BY c.relname`,names);
 const columns=await tx.$queryRawUnsafe(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='rh_ai' AND table_name=ANY($1) ORDER BY table_name,ordinal_position`,names);
 const checks=await tx.$queryRawUnsafe(`SELECT c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='rh_ai' AND t.relname=ANY($1) ORDER BY c.conname`,names);
 const policies=await tx.$queryRawUnsafe(`SELECT * FROM pg_policies WHERE schemaname='rh_ai' AND tablename=ANY($1) ORDER BY tablename,policyname`,names);
 const triggers=await tx.$queryRawUnsafe(`SELECT t.tgname,t.tgenabled::text,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1) AND NOT t.tgisinternal ORDER BY tgname`,names);
 const indexes=await tx.$queryRawUnsafe(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='rh_ai' AND tablename=ANY($1) ORDER BY indexname`,names);
 const functions=await tx.$queryRawUnsafe(`SELECT proowner::regrole::text,proacl::text,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_research_data_import'`);
 const receipts=await tx.$queryRawUnsafe(`SELECT c.relname,obj_description(c.oid,'pg_class') AS receipt FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1) ORDER BY c.relname`,names);
 return{exists:relations.filter(x=>x.relkind==='r').length,receipts,catalogHash:hash({relations,columns,checks,policies,triggers,indexes,functions})};
}
export async function applyResearchDataImportSchemaInTransaction(tx,env){
 assertMaterialDatabase(env);checkFixtureIdentity(validateFixtureConfig(env),'direct',await readFixtureIdentity(tx));
 await tx.$queryRawUnsafe(`SELECT set_config('lock_timeout','3s',true)`);await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('rh-data-import-schema-v1',0))`);
 const legacyHash=verifyMaterialLegacyShape(await readMaterialLegacyShape(tx)),staging=await inspectResearchDataSchema(tx),stagingHash=hash(staging),before=await inspectResearchDataImportSchema(tx),sqlHash=hash(sql);
 assert.equal(staging.exists,2,'DATA_STAGING_SCHEMA_REQUIRED');
 let upgraded=false;
 if(before.exists){
  assert.equal(before.exists,2,'DATA_IMPORT_SCHEMA_CONFLICT');const saved=before.receipts.map(r=>JSON.parse(r.receipt??'null'));
  for(const r of saved)assert(r?.sqlHash===sqlHash&&r.catalogHash===before.catalogHash&&r.legacyHash===legacyHash&&r.stagingHash===stagingHash,'DATA_IMPORT_SCHEMA_CONFLICT');
  if(saved.every(r=>r.guardHash===guardHash))return{created:false,upgraded:false,sqlHash,guardHash,legacyHash,stagingHash};
  assert(saved.every(r=>r.version===1&&r.guardHash===undefined),'DATA_IMPORT_SCHEMA_CONFLICT');upgraded=true;
 }else{
  assert.equal(before.receipts.length,0,'DATA_IMPORT_SCHEMA_CONFLICT');
  for(const statement of sql.split('\n-- statement-break\n'))await tx.$executeRawUnsafe(statement);
 }
 await tx.$executeRawUnsafe(currentGuard);
 assert.equal(verifyMaterialLegacyShape(await readMaterialLegacyShape(tx)),legacyHash,'DATA_IMPORT_LEGACY_CHANGED');assert.deepEqual(await inspectResearchDataSchema(tx),staging,'DATA_IMPORT_STAGING_CHANGED');
 const after=await inspectResearchDataImportSchema(tx),receipt=JSON.stringify({purpose:'researchhub-data-import',version:2,syntheticOnly:true,sqlHash,guardHash,legacyHash,stagingHash,catalogHash:after.catalogHash});
 for(const name of names)await tx.$executeRawUnsafe(`COMMENT ON TABLE rh_ai.${name} IS '${receipt.replaceAll("'","''")}'`);
 return{created:!before.exists,upgraded,sqlHash,guardHash,legacyHash,stagingHash};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{
 assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-p05-import']);
 const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');console.log(JSON.stringify({passed:true,...await withFixtureTransaction(env,'direct',tx=>applyResearchDataImportSchemaInTransaction(tx,env))}));
}catch(e){console.error(JSON.stringify({passed:false,code:e.code??e.name??'DATA_IMPORT_SCHEMA_UNAVAILABLE',pg:e.meta?.code}));process.exitCode=1;}}
