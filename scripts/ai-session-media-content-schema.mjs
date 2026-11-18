import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{materialDigest}from'../server/ai-agent/session-material-contract.mjs';
const names=['session_media_content_runs','session_media_content_evidence'],sql=readFileSync(new URL('../server/ai-agent/session-media-content-schema.sql',import.meta.url),'utf8');
export const mediaContentSqlHash=materialDigest(sql);
export async function inspectMediaContentSchema(tx){
 const objects=await tx.$queryRawUnsafe(`SELECT c.relname,c.relkind::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname=ANY($1::text[]) OR c.oid IN(SELECT i.indexrelid FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace s ON s.oid=t.relnamespace WHERE s.nspname='rh_ai' AND t.relname=ANY($1::text[]))) ORDER BY c.relname`,names);
 const columns=await tx.$queryRawUnsafe(`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS def FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='rh_ai' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,names);
 const constraints=await tx.$queryRawUnsafe(`SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS def FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1::text[]) ORDER BY c.relname,k.conname`,names);
 const policies=await tx.$queryRawUnsafe(`SELECT * FROM pg_policies WHERE schemaname='rh_ai' AND tablename=ANY($1::text[]) ORDER BY tablename,policyname`,names);
 const triggers=await tx.$queryRawUnsafe(`SELECT c.relname,pg_get_triggerdef(t.oid) AS def FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,names);
 const functions=await tx.$queryRawUnsafe(`SELECT pg_get_functiondef(p.oid) AS def,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_session_media_content'`);
 const [r]=await tx.$queryRawUnsafe(`SELECT obj_description(to_regclass('rh_ai.session_media_content_runs'),'pg_class') AS receipt`);let receipt;try{receipt=JSON.parse(r?.receipt??'null');}catch{}
 return{tables:objects.filter(x=>x.relkind==='r').length,objects,functions,receipt,catalogHash:materialDigest({objects,columns,constraints,policies,triggers,functions})};
}
export async function applyMediaContentSchema(tx,env){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline','MEDIA_CONTENT_TARGET');const[db]=await tx.$queryRawUnsafe('SELECT current_database() AS name');assert.equal(db.name,env.WP01_TEST_DB_NAME,'MEDIA_CONTENT_TARGET');
 await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('hub-media-content-v1',0))`);
 const before=await inspectMediaContentSchema(tx);
 if(before.tables){if(before.tables!==2||before.receipt?.sqlHash!==mediaContentSqlHash||before.receipt.catalogHash!==before.catalogHash)throw Error('MEDIA_CONTENT_SCHEMA_CONFLICT');return{created:false,sqlHash:mediaContentSqlHash,catalogHash:before.catalogHash};}
 if(before.objects.length||before.functions.length)throw Error('MEDIA_CONTENT_SCHEMA_CONFLICT');
 for(const statement of sql.split('\n-- statement-break\n'))await tx.$executeRawUnsafe(statement);
 const after=await inspectMediaContentSchema(tx),receipt={purpose:'ResearchHub-media-content-v1',syntheticOnly:true,sqlHash:mediaContentSqlHash,catalogHash:after.catalogHash};
 await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_media_content_runs IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
 return{created:true,sqlHash:mediaContentSqlHash,catalogHash:after.catalogHash};
}
// Explicit, receipt-pinned correction of this slice's own trigger only.
export async function correctMediaContentGuard(tx,env,expectedSqlHash){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline');const[db]=await tx.$queryRawUnsafe('SELECT current_database() AS name');assert.equal(db.name,env.WP01_TEST_DB_NAME);
 await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('hub-media-content-v1',0))`);const before=await inspectMediaContentSchema(tx);
 if(before.receipt?.sqlHash===mediaContentSqlHash)return applyMediaContentSchema(tx,env);
 assert.equal(before.tables,2);assert.equal(before.receipt?.sqlHash,expectedSqlHash,'MEDIA_CONTENT_CORRECTION_RECEIPT');assert.equal(before.receipt.catalogHash,before.catalogHash,'MEDIA_CONTENT_CORRECTION_DRIFT');
 const statement=sql.split('\n-- statement-break\n').find(x=>x.startsWith('CREATE FUNCTION rh_ai.check_session_media_content()'));assert(statement);
 await tx.$executeRawUnsafe(statement.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 const after=await inspectMediaContentSchema(tx),receipt={purpose:'ResearchHub-media-content-v1',syntheticOnly:true,sqlHash:mediaContentSqlHash,catalogHash:after.catalogHash};
 await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_media_content_runs IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");return{corrected:true,previousSqlHash:expectedSqlHash,...receipt};
}
