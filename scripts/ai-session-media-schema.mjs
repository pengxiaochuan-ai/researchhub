import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const sql=readFileSync(new URL('../server/ai-agent/session-media-schema.sql',import.meta.url),'utf8');
export const mediaSqlHash=materialDigest(sql);
export async function inspectMediaSchema(tx){
 const objects=await tx.$queryRawUnsafe(`SELECT c.relname,c.relkind::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname='session_media_uploads' OR c.oid IN(SELECT indexrelid FROM pg_index WHERE indrelid=to_regclass('rh_ai.session_media_uploads'))) ORDER BY c.relname`);
 const columns=await tx.$queryRawUnsafe(`SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS def FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('rh_ai.session_media_uploads') AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`);
 const constraints=await tx.$queryRawUnsafe(`SELECT conname,pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid=to_regclass('rh_ai.session_media_uploads') ORDER BY conname`);
 const policies=await tx.$queryRawUnsafe(`SELECT * FROM pg_policies WHERE schemaname='rh_ai' AND tablename='session_media_uploads' ORDER BY policyname`);
 const triggers=await tx.$queryRawUnsafe(`SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid=to_regclass('rh_ai.session_media_uploads') AND NOT tgisinternal ORDER BY tgname`);
 const functions=await tx.$queryRawUnsafe(`SELECT pg_get_functiondef(p.oid) AS def,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_session_media'`);
 const [comment]=await tx.$queryRawUnsafe(`SELECT obj_description(to_regclass('rh_ai.session_media_uploads'),'pg_class') AS receipt`);
 let receipt=null;try{receipt=JSON.parse(comment?.receipt??'null');}catch{}
 return{exists:objects.some(x=>x.relname==='session_media_uploads'),objects,functions,receipt,catalogHash:materialDigest({objects,columns,constraints,policies,triggers,functions})};
}
export async function applyMediaSchemaInTransaction(tx,env){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline','MEDIA_TARGET_REJECTED');
 const [db]=await tx.$queryRawUnsafe('SELECT current_database() AS name');assert.equal(db.name,env.WP01_TEST_DB_NAME,'MEDIA_TARGET_REJECTED');
 await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('rh-ai-session-media-v1',0))`);
 const before=await inspectMediaSchema(tx);
 if(before.exists){
  if(before.receipt?.purpose!=='ResearchHub-session-media-v1'||before.receipt.sqlHash!==mediaSqlHash||before.receipt.catalogHash!==before.catalogHash)throw Error('MEDIA_SCHEMA_CONFLICT');
  return{created:false,sqlHash:mediaSqlHash,catalogHash:before.catalogHash};
 }
 if(before.objects.length||before.functions.length||before.receipt)throw Error('MEDIA_SCHEMA_CONFLICT');
 const [dependency]=await tx.$queryRawUnsafe(`SELECT to_regclass('public.session') IS NOT NULL AND to_regclass('rh_ai.session_materials') IS NOT NULL AND has_schema_privilege('aisci_app','rh_ai','USAGE') AS ready`);
 assert.equal(dependency.ready,true,'MEDIA_DEPENDENCY_MISSING');
 for(const statement of sql.split('\n-- statement-break\n'))await tx.$executeRawUnsafe(statement);
 const after=await inspectMediaSchema(tx);
 const receipt={purpose:'ResearchHub-session-media-v1',syntheticOnly:true,sqlHash:mediaSqlHash,catalogHash:after.catalogHash};
 await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_media_uploads IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
 return{created:true,sqlHash:mediaSqlHash,catalogHash:after.catalogHash};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mv01-mv02']);
  const {env}=loadFixtureInput(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
  console.log(JSON.stringify({passed:true,...await withFixtureTransaction(env,'direct',tx=>applyMediaSchemaInTransaction(tx,env))}));
 }catch(e){console.error(JSON.stringify({passed:false,code:/^MEDIA_/.test(e.message)?e.message:'MEDIA_SCHEMA_UNAVAILABLE'}));process.exitCode=1;}
}
