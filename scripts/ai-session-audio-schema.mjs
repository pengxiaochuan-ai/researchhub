// Explicit reviewed local synthetic upgrade. Importing performs no DDL.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {inspectMediaSchema,mediaSqlHash} from './ai-session-media-schema.mjs';
import {inspectMediaIngestSchema,mediaIngestSqlHash} from './ai-session-media-ingest-schema.mjs';
import {tongueImageGuardSql,tongueImageGuardHash,tongueImageUpgradeHash,TONGUE_IMAGE_REVISION} from './ai-session-tongue-image-schema.mjs';
export const AUDIO_SCHEMA_REVISION='audio-originals.v1';
export const audioGuardSql=readFileSync(new URL('../server/ai-agent/session-audio-guard.sql',import.meta.url),'utf8');
export const audioGuardHash=materialDigest(audioGuardSql);
const prior={media:'8c605a3a73135805865cfefedb3874c993e7574aa64f641370e6e5f4f4d71019',ingest:'d077449838eb064afa68632b687588a1f3b40b804297574c48a208108d6db446'};
const upgraded={media:'016a9b55f1e587d87686ab1b2eec8bb3a5ecea144e23b83c8df2fccba2a92180',ingest:'e58edf4f5f714873f62dd83167851fa8a21f2dd67867821817727906a586946a'};
const constraintsUp=[
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_uploads_extension_check, ADD CONSTRAINT session_media_uploads_extension_check CHECK (extension IN ('mp4','mov','webm') OR (extension IN ('png','jpg','jpeg') AND byte_size<=26214400) OR (extension IN ('wav','mp3','m4a') AND byte_size<=209715200))",
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_mime, ADD CONSTRAINT session_media_mime CHECK (content_type=CASE extension WHEN 'mp4' THEN 'video/mp4' WHEN 'mov' THEN 'video/quicktime' WHEN 'webm' THEN 'video/webm' WHEN 'png' THEN 'image/png' WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' WHEN 'wav' THEN 'audio/wav' WHEN 'mp3' THEN 'audio/mpeg' WHEN 'm4a' THEN 'audio/mp4' ELSE NULL END)",
];
const constraintsDown=[
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_uploads_extension_check, ADD CONSTRAINT session_media_uploads_extension_check CHECK (extension IN ('mp4','mov','webm') OR (extension IN ('png','jpg','jpeg') AND byte_size<=26214400))",
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_mime, ADD CONSTRAINT session_media_mime CHECK (content_type=CASE extension WHEN 'mp4' THEN 'video/mp4' WHEN 'mov' THEN 'video/quicktime' WHEN 'webm' THEN 'video/webm' WHEN 'png' THEN 'image/png' WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' ELSE NULL END)",
];
export const audioUpgradeHash=materialDigest({constraintsUp,constraintsDown,guardHash:audioGuardHash,prior});
async function state(tx){return{media:await inspectMediaSchema(tx),ingest:await inspectMediaIngestSchema(tx)};}
async function save(tx,current,{audio=false}={}){
 const common={imageRevision:TONGUE_IMAGE_REVISION,imageUpgradeHash:tongueImageUpgradeHash,...(audio?{audioRevision:AUDIO_SCHEMA_REVISION,audioUpgradeHash}:{} )};
 const receipts=[['session_media_uploads',{purpose:'ResearchHub-session-media-v1',syntheticOnly:true,sqlHash:mediaSqlHash,catalogHash:current.media.catalogHash,...common}],['session_media_ingests',{purpose:'ResearchHub-media-ingest-v1',syntheticOnly:true,sqlHash:mediaIngestSqlHash,catalogHash:current.ingest.catalogHash,guardRevision:audio?AUDIO_SCHEMA_REVISION:TONGUE_IMAGE_REVISION,guardSqlHash:audio?audioGuardHash:tongueImageGuardHash,...common}]];
 for(const [table,receipt]of receipts)await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai."+table+" IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
}
function assertPrior(s){for(const [name,sqlHash,purpose]of[['media',mediaSqlHash,'ResearchHub-session-media-v1'],['ingest',mediaIngestSqlHash,'ResearchHub-media-ingest-v1']]){const c=s[name];assert(c.receipt?.purpose===purpose&&c.receipt.syntheticOnly===true&&c.receipt.sqlHash===sqlHash&&c.catalogHash===prior[name]&&c.receipt.catalogHash===prior[name]&&c.receipt.imageRevision===TONGUE_IMAGE_REVISION&&c.receipt.imageUpgradeHash===tongueImageUpgradeHash&&!c.receipt.audioRevision,'MEDIA_AUDIO_SCHEMA_CONFLICT');}assert(s.ingest.tables===2&&s.ingest.receipt.guardRevision===TONGUE_IMAGE_REVISION&&s.ingest.receipt.guardSqlHash===tongueImageGuardHash,'MEDIA_AUDIO_SCHEMA_CONFLICT');}
export async function assertAudioSchemaReady(tx){
 const s=await state(tx),[fn]=await tx.$queryRawUnsafe("SELECT prosrc,prosecdef FROM pg_proc WHERE oid='rh_ai.check_session_media_ingest()'::regprocedure");
 if(s.media.receipt?.eeglabRevision==='eeglab-originals.v1')return(await import('./ai-session-eeglab-schema.mjs')).assertEeglabSchemaReady(tx);
 const body=audioGuardSql.match(/AS \$body\$([\s\S]*)\$body\$;/)?.[1];
 for(const [name,sqlHash,purpose]of[['media',mediaSqlHash,'ResearchHub-session-media-v1'],['ingest',mediaIngestSqlHash,'ResearchHub-media-ingest-v1']]){const c=s[name];assert(c.receipt?.purpose===purpose&&c.receipt.syntheticOnly===true&&c.receipt.sqlHash===sqlHash&&c.receipt.audioRevision===AUDIO_SCHEMA_REVISION&&c.receipt.audioUpgradeHash===audioUpgradeHash&&c.receipt.imageRevision===TONGUE_IMAGE_REVISION&&c.receipt.imageUpgradeHash===tongueImageUpgradeHash&&c.receipt.catalogHash===c.catalogHash&&c.catalogHash===upgraded[name],'MEDIA_AUDIO_SCHEMA_NOT_READY');}
 assert(s.ingest.receipt.guardRevision===AUDIO_SCHEMA_REVISION&&s.ingest.receipt.guardSqlHash===audioGuardHash&&body&&fn?.prosrc===body&&fn.prosecdef===false,'MEDIA_AUDIO_SCHEMA_NOT_READY');return s;
}
export async function upgradeAudioSchema(tx,env,{direction='up'}={}){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline','MEDIA_AUDIO_TARGET');assert.equal((await tx.$queryRawUnsafe('SELECT current_database() AS name'))[0]?.name,env.WP01_TEST_DB_NAME,'MEDIA_AUDIO_TARGET');assert(['up','down'].includes(direction),'MEDIA_AUDIO_DIRECTION');
 assert.equal(mediaSqlHash,'fe9a4fe7fa476eeb5d1401c5b71068b6d1433ebe9a71bcda6a07a9f7c54456e3','MEDIA_AUDIO_BASE_CHANGED');assert.equal(mediaIngestSqlHash,'2c31a41ddb3103fdca85b362694cd380c7954bd5f2e742b98ba839f28135b0a3','MEDIA_AUDIO_BASE_CHANGED');assert.equal(tongueImageGuardHash,'6bed268bf8b050047b2e9dd7676250df502abdb7474565fdedd7760e811fe033','MEDIA_AUDIO_BASE_CHANGED');assert.equal(tongueImageUpgradeHash,'b1014cb8afa286a513296862a2f95d6df7d864d9908c6567e7285bda5cde8a0b','MEDIA_AUDIO_BASE_CHANGED');
 await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('rh-ai-session-media-v1',0)),pg_advisory_xact_lock(hashtextextended('hub-media-ingest-v1',0))");
 const before=await state(tx),audio=before.media.receipt?.audioRevision===AUDIO_SCHEMA_REVISION;assert(!(direction==='down'&&before.media.receipt?.eeglabRevision),'MEDIA_AUDIO_EEGLAB_DOWNGRADE_REQUIRED');if(audio)await assertAudioSchemaReady(tx);else assertPrior(before);
 if(direction==='up'&&audio||direction==='down'&&!audio)return{changed:false,direction,upgradeHash:audioUpgradeHash};
 if(direction==='down')assert.equal(Number((await tx.$queryRawUnsafe("SELECT count(*)::text AS n FROM rh_ai.session_media_uploads WHERE extension IN ('wav','mp3','m4a')"))[0].n),0,'MEDIA_AUDIO_DOWN_REQUIRES_EMPTY_AUDIO');
 for(const sql of direction==='up'?constraintsUp:constraintsDown)await tx.$executeRawUnsafe(sql);await tx.$executeRawUnsafe(direction==='up'?audioGuardSql:tongueImageGuardSql);
 const after=await state(tx);assert.deepEqual(after.media.objects,before.media.objects,'MEDIA_AUDIO_OBJECTS_CHANGED');assert.deepEqual(after.ingest.objects,before.ingest.objects,'MEDIA_AUDIO_OBJECTS_CHANGED');assert.deepEqual(after.media.functions,before.media.functions,'MEDIA_AUDIO_MEDIA_GUARD_CHANGED');assert.equal(after.ingest.functions[0].proacl,before.ingest.functions[0].proacl,'MEDIA_AUDIO_ACL_CHANGED');
 await save(tx,after,{audio:direction==='up'});if(direction==='up')await assertAudioSchemaReady(tx);else assertPrior(await state(tx));
 return{changed:true,direction,upgradeHash:audioUpgradeHash,guardHash:audioGuardHash,mediaCatalogHash:after.media.catalogHash,ingestCatalogHash:after.ingest.catalogHash};
}
