import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {checkFixtureIdentity,readFixtureIdentity,validateFixtureConfig,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readMaterialLegacyShape,verifyMaterialLegacyShape,assertMaterialDatabase} from './ai-session-material-schema.mjs';
const sql=readFileSync(new URL('../server/ai-agent/research-data-schema.sql',import.meta.url),'utf8'),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex'),names=['research_data_uploads','research_data_preflights'];
export async function inspectResearchDataSchema(tx){
 const relations=await tx.$queryRawUnsafe(`SELECT c.relname,c.relkind::text,c.relowner::regrole::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND (c.relname=ANY($1) OR c.oid IN (SELECT indexrelid FROM pg_index WHERE indrelid IN (SELECT oid FROM pg_class WHERE relnamespace=n.oid AND relname=ANY($1)))) ORDER BY c.relname`,names);
 const columns=await tx.$queryRawUnsafe(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='rh_ai' AND table_name=ANY($1) ORDER BY table_name,ordinal_position`,names);
 const checks=await tx.$queryRawUnsafe(`SELECT c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='rh_ai' AND t.relname=ANY($1) ORDER BY c.conname`,names);
 const policies=await tx.$queryRawUnsafe(`SELECT * FROM pg_policies WHERE schemaname='rh_ai' AND tablename=ANY($1) ORDER BY tablename,policyname`,names);
 const triggers=await tx.$queryRawUnsafe(`SELECT t.tgname,t.tgenabled::text,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1) AND NOT t.tgisinternal ORDER BY tgname`,names);
 const indexes=await tx.$queryRawUnsafe(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='rh_ai' AND tablename=ANY($1) ORDER BY indexname`,names);
 const functions=await tx.$queryRawUnsafe(`SELECT proowner::regrole::text,proacl::text,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_research_data_staging'`);
 const receipts=await tx.$queryRawUnsafe(`SELECT c.relname,obj_description(c.oid,'pg_class') AS receipt FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname=ANY($1) ORDER BY c.relname`,names);
 return{exists:relations.filter(x=>x.relkind==='r').length,receipts,catalogHash:hash({relations,columns,checks,policies,triggers,indexes,functions})};
}
export async function applyResearchDataSchemaInTransaction(tx,env){
 assertMaterialDatabase(env);checkFixtureIdentity(validateFixtureConfig(env),'direct',await readFixtureIdentity(tx));
 await tx.$queryRawUnsafe(`SELECT set_config('lock_timeout','3s',true)`);await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('rh-data-staging-schema-v1',0))`);
 const legacyHash=verifyMaterialLegacyShape(await readMaterialLegacyShape(tx)),before=await inspectResearchDataSchema(tx),sqlHash=hash(sql);
 if(before.exists){assert.equal(before.exists,2,'DATA_SCHEMA_CONFLICT');for(const r of before.receipts){const saved=JSON.parse(r.receipt??'null');assert(saved?.sqlHash===sqlHash&&saved.catalogHash===before.catalogHash&&saved.legacyHash===legacyHash,'DATA_SCHEMA_CONFLICT');}return{created:false,sqlHash,legacyHash};}
 assert.equal(before.receipts.length,0,'DATA_SCHEMA_CONFLICT');
 for(const statement of sql.split('\n-- statement-break\n'))await tx.$executeRawUnsafe(statement);
 assert.equal(verifyMaterialLegacyShape(await readMaterialLegacyShape(tx)),legacyHash,'DATA_LEGACY_CHANGED');
 const after=await inspectResearchDataSchema(tx),receipt=JSON.stringify({purpose:'researchhub-data-staging',version:1,syntheticOnly:true,sqlHash,legacyHash,catalogHash:after.catalogHash});
 for(const name of names)await tx.$executeRawUnsafe(`COMMENT ON TABLE rh_ai.${name} IS '${receipt.replaceAll("'","''")}'`);
 return{created:true,sqlHash,legacyHash};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{
 assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-data-staging']);
 const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');console.log(JSON.stringify({passed:true,...await withFixtureTransaction(env,'direct',tx=>applyResearchDataSchemaInTransaction(tx,env))}));
}catch(e){console.error(JSON.stringify({passed:false,code:e.code??e.name??'DATA_SCHEMA_UNAVAILABLE',pg:e.meta?.code}));process.exitCode=1;}}
