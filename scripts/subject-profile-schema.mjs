import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,validateFixtureConfig,checkFixtureIdentity,readFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertMaterialDatabase,readMaterialLegacyShape,verifyMaterialLegacyShape} from './ai-session-material-schema.mjs';
import {inspectResearchDataSchema} from './ai-research-data-schema.mjs';
import {inspectResearchDataImportSchema} from './ai-research-data-import-schema.mjs';

const sql=readFileSync(new URL('../server/ai-agent/subject-profile-import-schema.sql',import.meta.url),'utf8');
export const subjectProfileSqlHash=materialDigest(sql);
export async function inspectSubjectProfileSchema(tx){
 const relations=await tx.$queryRawUnsafe("SELECT c.relname,c.relkind::text,c.relowner::regrole::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname='subject_profile_imports' OR c.oid IN (SELECT indexrelid FROM pg_index WHERE indrelid=to_regclass('rh_ai.subject_profile_imports'))) ORDER BY c.relname");
 const checks=await tx.$queryRawUnsafe("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=to_regclass('rh_ai.subject_profile_imports') ORDER BY conname");
 const columns=await tx.$queryRawUnsafe("SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='rh_ai' AND table_name='subject_profile_imports' ORDER BY ordinal_position");
 const policies=await tx.$queryRawUnsafe("SELECT * FROM pg_policies WHERE schemaname='rh_ai' AND tablename='subject_profile_imports' ORDER BY policyname");
 const triggers=await tx.$queryRawUnsafe("SELECT tgname,tgenabled::text,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid=to_regclass('rh_ai.subject_profile_imports') AND NOT tgisinternal ORDER BY tgname");
 const functions=await tx.$queryRawUnsafe("SELECT proowner::regrole::text,proacl::text,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_subject_profile_import'");
 const [table]=await tx.$queryRawUnsafe("SELECT obj_description(to_regclass('rh_ai.subject_profile_imports'),'pg_class') AS receipt");
 return{exists:relations.some(x=>x.relkind==='r'),objects:relations.length+functions.length,receipt:table?.receipt?JSON.parse(table.receipt):null,catalogHash:materialDigest({relations,checks,columns,policies,triggers,functions})};
}
export async function applySubjectProfileSchemaInTransaction(tx,env){
 assertMaterialDatabase(env);checkFixtureIdentity(validateFixtureConfig(env),'direct',await readFixtureIdentity(tx));
 await tx.$executeRawUnsafe("SET LOCAL lock_timeout='3s'");
 await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('rh-subject-profile-import-schema-v1',0))");
 const original=await readMaterialLegacyShape(tx),legacyHash=verifyMaterialLegacyShape(original);
 const staged=await inspectResearchDataSchema(tx),imports=await inspectResearchDataImportSchema(tx),before=await inspectSubjectProfileSchema(tx);
 if(before.exists){assert(before.receipt?.sqlHash===subjectProfileSqlHash&&before.receipt.catalogHash===before.catalogHash,'PROFILE_SCHEMA_CONFLICT');return{created:false,sqlHash:subjectProfileSqlHash,catalogHash:before.catalogHash};}
 assert.equal(before.objects,0,'PROFILE_SCHEMA_CONFLICT');
 for(const statement of sql.split('\n-- statement-break\n'))if(statement.trim())await tx.$executeRawUnsafe(statement);
 assert.deepEqual(await readMaterialLegacyShape(tx),original,'PROFILE_LEGACY_CHANGED');
 assert.deepEqual(await inspectResearchDataSchema(tx),staged,'PROFILE_STAGING_CHANGED');assert.deepEqual(await inspectResearchDataImportSchema(tx),imports,'PROFILE_OLD_IMPORTS_CHANGED');
 const [permissions]=await tx.$queryRawUnsafe("SELECT has_table_privilege('aisci_app','rh_ai.subject_profile_imports','SELECT') AS read,has_table_privilege('aisci_app','rh_ai.subject_profile_imports','INSERT') AS append,has_table_privilege('aisci_app','rh_ai.subject_profile_imports','UPDATE') AS revise,has_table_privilege('aisci_app','rh_ai.subject_profile_imports','DELETE') AS remove");
 assert.deepEqual(permissions,{read:true,append:true,revise:true,remove:false});
 const after=await inspectSubjectProfileSchema(tx);
 assert(after.exists,'PROFILE_SCHEMA_NOT_CREATED');
 const receipt={purpose:'researchhub-subject-profile-import',version:1,syntheticOnly:true,sqlHash:subjectProfileSqlHash,catalogHash:after.catalogHash,legacyHash};
 await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.subject_profile_imports IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
 return{created:true,...receipt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);assert(args.length===1&&['--approved-apply','--approved-rollback'].includes(args[0]));
 const {env}=loadFixtureInput(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
 const rollback=Error('PROFILE_SCHEMA_ROLLBACK');let result;
 try{await withFixtureTransaction(env,'direct',async tx=>{result=await applySubjectProfileSchemaInTransaction(tx,env);if(args[0]==='--approved-rollback')throw rollback;});}
 catch(e){if(e!==rollback)throw e;}
 console.log(JSON.stringify({...result,rolledBack:args[0]==='--approved-rollback'}));
}
