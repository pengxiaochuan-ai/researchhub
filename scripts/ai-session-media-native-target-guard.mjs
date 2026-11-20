// Explicit reviewed function upgrade only. Importing this module performs no DDL.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {inspectMediaIngestSchema,mediaIngestSqlHash} from './ai-session-media-ingest-schema.mjs';
export const MEDIA_NATIVE_TARGET_GUARD_VERSION='native-authorized-targets.v1';
export const MEDIA_NATIVE_TARGET_PRIOR_CATALOG='cecf2aae1453bde83d5776c13caeb41164a7116510c2c83f12869f9f71d9d73d';
const priorSqlHash='2c31a41ddb3103fdca85b362694cd380c7954bd5f2e742b98ba839f28135b0a3';
export const mediaNativeTargetGuardSql=readFileSync(new URL('../server/ai-agent/session-media-native-target-guard.sql',import.meta.url),'utf8');
export const mediaNativeTargetGuardSqlHash=materialDigest(mediaNativeTargetGuardSql);
const body=mediaNativeTargetGuardSql.match(/AS \$body\$([\s\S]*)\$body\$;/)?.[1];
const original=readFileSync(new URL('../server/ai-agent/session-media-ingest-schema.sql',import.meta.url),'utf8').split('\n-- statement-break\n').find(x=>x.startsWith('CREATE FUNCTION rh_ai.check_session_media_ingest()'));
async function functionBody(tx){return(await tx.$queryRawUnsafe(`SELECT p.prosrc,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_ai' AND p.proname='check_session_media_ingest'`))[0];}
export async function assertNativeMediaTargetGuardReady(tx){
 const state=await inspectMediaIngestSchema(tx),fn=await functionBody(tx);
 if(state.receipt?.guardRevision==='eeglab-originals.v1')return(await import('./ai-session-eeglab-schema.mjs')).assertEeglabSchemaReady(tx).then(s=>s.ingest);
 if(state.receipt?.guardRevision==='audio-originals.v1')return(await import('./ai-session-audio-schema.mjs')).assertAudioSchemaReady(tx).then(s=>s.ingest);
 if(state.receipt?.guardRevision==='tongue-images.v1')return(await import('./ai-session-tongue-image-schema.mjs')).assertTongueImageSchemaReady(tx).then(s=>s.ingest);
 assert(state.tables===2&&state.receipt?.purpose==='ResearchHub-media-ingest-v1'&&state.receipt.syntheticOnly===true&&state.receipt.sqlHash===mediaIngestSqlHash&&state.receipt.guardRevision===MEDIA_NATIVE_TARGET_GUARD_VERSION&&state.receipt.guardSqlHash===mediaNativeTargetGuardSqlHash&&state.receipt.catalogHash===state.catalogHash&&body&&fn?.prosrc===body&&fn.prosecdef===false,'MEDIA_NATIVE_TARGET_GUARD_NOT_READY');
 return state;
}
export async function upgradeNativeMediaTargetGuard(tx,env,{direction='up'}={}){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline','MEDIA_INGEST_TARGET');
 assert.equal((await tx.$queryRawUnsafe('SELECT current_database() AS name'))[0]?.name,env.WP01_TEST_DB_NAME,'MEDIA_INGEST_TARGET');
 assert(['up','down'].includes(direction),'MEDIA_NATIVE_TARGET_DIRECTION');
 assert.equal(mediaIngestSqlHash,priorSqlHash,'MEDIA_NATIVE_TARGET_BASE_CHANGED');
 await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('hub-media-ingest-v1',0))");
 const before=await inspectMediaIngestSchema(tx);
 assert(!(direction==='down'&&['tongue-images.v1','audio-originals.v1','eeglab-originals.v1'].includes(before.receipt?.guardRevision)),'MEDIA_NATIVE_TARGET_IMAGE_DOWNGRADE_REQUIRED');
 const prior=before.tables===2&&before.receipt?.syntheticOnly===true&&before.receipt.purpose==='ResearchHub-media-ingest-v1'&&before.receipt.sqlHash===priorSqlHash&&before.receipt.catalogHash===MEDIA_NATIVE_TARGET_PRIOR_CATALOG&&before.catalogHash===MEDIA_NATIVE_TARGET_PRIOR_CATALOG&&!before.receipt.guardRevision;
 if(direction==='up'&&!prior){await assertNativeMediaTargetGuardReady(tx);return{changed:false,direction,guardSqlHash:mediaNativeTargetGuardSqlHash,catalogHash:before.catalogHash};}
 if(direction==='down'&&prior)return{changed:false,direction,catalogHash:before.catalogHash};
 if(direction==='down')await assertNativeMediaTargetGuardReady(tx);else assert(prior,'MEDIA_NATIVE_TARGET_CATALOG_CONFLICT');
 await tx.$executeRawUnsafe(direction==='up'?mediaNativeTargetGuardSql:original.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 const after=await inspectMediaIngestSchema(tx);assert.deepEqual(after.objects,before.objects);assert.equal(after.functions[0].proacl,before.functions[0].proacl);
 if(direction==='down')assert.equal(after.catalogHash,MEDIA_NATIVE_TARGET_PRIOR_CATALOG,'MEDIA_NATIVE_TARGET_ROLLBACK_CONFLICT');
 const receipt={purpose:'ResearchHub-media-ingest-v1',syntheticOnly:true,sqlHash:priorSqlHash,catalogHash:after.catalogHash,...(direction==='up'?{guardRevision:MEDIA_NATIVE_TARGET_GUARD_VERSION,guardSqlHash:mediaNativeTargetGuardSqlHash}:{} )};
 await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_media_ingests IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
 if(direction==='up')await assertNativeMediaTargetGuardReady(tx);
 return{changed:true,direction,guardSqlHash:mediaNativeTargetGuardSqlHash,catalogHash:after.catalogHash};
}
