import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';
import{materialDigest}from'../server/ai-agent/session-material-contract.mjs';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';import{withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
const names=['session_media_ingest_access','session_media_ingests'],sql=readFileSync(new URL('../server/ai-agent/session-media-ingest-schema.sql',import.meta.url),'utf8');
export const mediaIngestSqlHash=materialDigest(sql);
const initialRevision={sqlHash:'414940d344760d03e3116abd8a6cacd32a1d424153a9e299491e8a292d3ea03e',catalogHash:'7c1d19ad0b7f683fc44cd73ec7cb29841212dd547cc66319d76c71a0fb677889'};
async function guardTarget(tx,env){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline','MEDIA_INGEST_TARGET');
 const[db]=await tx.$queryRawUnsafe('SELECT current_database() AS name');assert.equal(db.name,env.WP01_TEST_DB_NAME,'MEDIA_INGEST_TARGET');
 await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('hub-media-ingest-v1',0))`);
}
async function saveReceipt(tx,catalogHash){
 const receipt={purpose:'ResearchHub-media-ingest-v1',syntheticOnly:true,sqlHash:mediaIngestSqlHash,catalogHash};
 await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_media_ingests IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
}
export async function inspectMediaIngestSchema(tx){
 const objects=await tx.$queryRawUnsafe(`SELECT c.relname,c.relkind::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname=ANY($1::text[]) OR c.oid IN(SELECT i.indexrelid FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace s ON s.oid=t.relnamespace WHERE s.nspname='rh_ai' AND t.relname=ANY($1::text[]))) ORDER BY c.relname`,names);
 const columns=await tx.$queryRawUnsafe(`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS def FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='rh_ai' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,names);
 const constraints=await tx.$queryRawUnsafe(`SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS def FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1::text[]) ORDER BY c.relname,k.conname`,names);
 const policies=await tx.$queryRawUnsafe(`SELECT * FROM pg_policies WHERE schemaname='rh_ai' AND tablename=ANY($1::text[]) ORDER BY tablename,policyname`,names);
 const triggers=await tx.$queryRawUnsafe(`SELECT c.relname,pg_get_triggerdef(t.oid) AS def FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,names);
 const functions=await tx.$queryRawUnsafe(`SELECT pg_get_functiondef(p.oid) AS def,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_session_media_ingest'`);
 const [r]=await tx.$queryRawUnsafe(`SELECT obj_description(to_regclass('rh_ai.session_media_ingests'),'pg_class') AS receipt`);let receipt;try{receipt=JSON.parse(r?.receipt??'null');}catch{}
 return{tables:objects.filter(x=>x.relkind==='r').length,objects,functions,receipt,catalogHash:materialDigest({objects,columns,constraints,policies,triggers,functions})};
}
export async function applyMediaIngestSchema(tx,env){
 await guardTarget(tx,env);
 const before=await inspectMediaIngestSchema(tx);
 if(before.tables){if(before.tables!==2||before.receipt?.sqlHash!==mediaIngestSqlHash||before.receipt?.catalogHash!==before.catalogHash)throw Error('MEDIA_INGEST_SCHEMA_CONFLICT');return{created:false,sqlHash:mediaIngestSqlHash,catalogHash:before.catalogHash};}
 if(before.objects.length||before.functions.length)throw Error('MEDIA_INGEST_SCHEMA_CONFLICT');
 for(const statement of sql.split('\n-- statement-break\n'))await tx.$executeRawUnsafe(statement);
 const after=await inspectMediaIngestSchema(tx);await saveReceipt(tx,after.catalogHash);
 return{created:true,sqlHash:mediaIngestSqlHash,catalogHash:after.catalogHash};
}
// Explicit, pinned correction of this slice's own guard; never a boot migration.
export async function correctMediaIngestGuard(tx,env){
 await guardTarget(tx,env);const before=await inspectMediaIngestSchema(tx);
 if(before.tables===2&&before.receipt?.sqlHash===mediaIngestSqlHash&&before.receipt.catalogHash===before.catalogHash)return{corrected:false,sqlHash:mediaIngestSqlHash,catalogHash:before.catalogHash};
 assert(before.tables===2&&before.receipt?.syntheticOnly===true&&before.receipt.purpose==='ResearchHub-media-ingest-v1'&&before.receipt.sqlHash===initialRevision.sqlHash&&before.receipt.catalogHash===initialRevision.catalogHash&&before.catalogHash===initialRevision.catalogHash,'MEDIA_INGEST_SCHEMA_CONFLICT');
 const definition=sql.split('\n-- statement-break\n').find(x=>x.startsWith('CREATE FUNCTION rh_ai.check_session_media_ingest()'));
 assert(definition,'MEDIA_INGEST_GUARD_MISSING');
 await tx.$executeRawUnsafe(definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 const after=await inspectMediaIngestSchema(tx);assert.deepEqual(after.objects,before.objects);assert.equal(after.functions.length,1);assert.equal(after.functions[0].proacl,before.functions[0].proacl);
 await saveReceipt(tx,after.catalogHash);
 return{corrected:true,priorSqlHash:initialRevision.sqlHash,sqlHash:mediaIngestSqlHash,catalogHash:after.catalogHash};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const correction=process.argv[2]==='--correct-registration-guard';
 assert.deepEqual(process.argv.slice(correction?3:2),['--synthetic-staging','--approved-mvb01-mvb03']);
 const{env}=loadFixtureInput(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
 console.log(JSON.stringify(await withFixtureTransaction(env,'direct',tx=>(correction?correctMediaIngestGuard:applyMediaIngestSchema)(tx,env))));
}
