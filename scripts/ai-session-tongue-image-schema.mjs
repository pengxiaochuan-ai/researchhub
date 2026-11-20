// Explicit reviewed local synthetic upgrade. Importing performs no DDL.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {inspectMediaSchema,mediaSqlHash} from './ai-session-media-schema.mjs';
import {inspectMediaIngestSchema,mediaIngestSqlHash} from './ai-session-media-ingest-schema.mjs';
import {mediaNativeTargetGuardSql,mediaNativeTargetGuardSqlHash,MEDIA_NATIVE_TARGET_GUARD_VERSION} from './ai-session-media-native-target-guard.mjs';
export const TONGUE_IMAGE_REVISION='tongue-images.v1';
export const tongueImageGuardSql=readFileSync(new URL('../server/ai-agent/session-tongue-image-guard.sql',import.meta.url),'utf8');
export const tongueImageGuardHash=materialDigest(tongueImageGuardSql);
const prior={media:'c53622068defacf7b5b8ebb0e4901d1aaeb745a944b678fc2df52334d916cc5a',ingest:'92c50181c40780d10c6807b7203c0ee9ff52da03569383905d7db98c75669004'};
const upgraded={media:'8c605a3a73135805865cfefedb3874c993e7574aa64f641370e6e5f4f4d71019',ingest:'d077449838eb064afa68632b687588a1f3b40b804297574c48a208108d6db446'};
const constraintsUp=[
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_uploads_extension_check, ADD CONSTRAINT session_media_uploads_extension_check CHECK (extension IN ('mp4','mov','webm') OR (extension IN ('png','jpg','jpeg') AND byte_size<=26214400))",
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_mime, ADD CONSTRAINT session_media_mime CHECK (content_type=CASE extension WHEN 'mp4' THEN 'video/mp4' WHEN 'mov' THEN 'video/quicktime' WHEN 'webm' THEN 'video/webm' WHEN 'png' THEN 'image/png' WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' ELSE NULL END)",
];
const constraintsDown=[
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_uploads_extension_check, ADD CONSTRAINT session_media_uploads_extension_check CHECK (extension IN ('mp4','mov','webm'))",
 "ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_mime, ADD CONSTRAINT session_media_mime CHECK (content_type=CASE extension WHEN 'mp4' THEN 'video/mp4' WHEN 'mov' THEN 'video/quicktime' ELSE 'video/webm' END)",
];
export const tongueImageUpgradeHash=materialDigest({constraintsUp,constraintsDown,guardHash:tongueImageGuardHash,prior});
async function state(tx){return{media:await inspectMediaSchema(tx),ingest:await inspectMediaIngestSchema(tx)};}
async function save(tx,current,{image=false}={}){
 const common=image?{imageRevision:TONGUE_IMAGE_REVISION,imageUpgradeHash:tongueImageUpgradeHash}:{};
 const receipts=[['session_media_uploads',{purpose:'ResearchHub-session-media-v1',syntheticOnly:true,sqlHash:mediaSqlHash,catalogHash:current.media.catalogHash,...common}],['session_media_ingests',{purpose:'ResearchHub-media-ingest-v1',syntheticOnly:true,sqlHash:mediaIngestSqlHash,catalogHash:current.ingest.catalogHash,guardRevision:image?TONGUE_IMAGE_REVISION:MEDIA_NATIVE_TARGET_GUARD_VERSION,guardSqlHash:image?tongueImageGuardHash:mediaNativeTargetGuardSqlHash,...common}]];
 for(const [table,receipt]of receipts)await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai."+table+" IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
}
function assertPrior(s){assert(s.media.exists&&s.media.receipt?.purpose==='ResearchHub-session-media-v1'&&s.media.receipt.syntheticOnly===true&&s.media.receipt.sqlHash===mediaSqlHash&&s.media.catalogHash===prior.media&&s.media.receipt.catalogHash===prior.media&&!s.media.receipt.imageRevision&&s.ingest.tables===2&&s.ingest.receipt?.purpose==='ResearchHub-media-ingest-v1'&&s.ingest.receipt.syntheticOnly===true&&s.ingest.receipt.sqlHash===mediaIngestSqlHash&&s.ingest.catalogHash===prior.ingest&&s.ingest.receipt.catalogHash===prior.ingest&&s.ingest.receipt.guardRevision===MEDIA_NATIVE_TARGET_GUARD_VERSION&&s.ingest.receipt.guardSqlHash===mediaNativeTargetGuardSqlHash&&!s.ingest.receipt.imageRevision,'MEDIA_TONGUE_SCHEMA_CONFLICT');}
export async function assertTongueImageSchemaReady(tx){
 const s=await state(tx),[fn]=await tx.$queryRawUnsafe("SELECT prosrc,prosecdef FROM pg_proc WHERE oid='rh_ai.check_session_media_ingest()'::regprocedure");
 if(s.media.receipt?.audioRevision==='audio-originals.v1')return(await import('./ai-session-audio-schema.mjs')).assertAudioSchemaReady(tx);
 const body=tongueImageGuardSql.match(/AS \$body\$([\s\S]*)\$body\$;/)?.[1];
 for(const [name,baseHash,purpose]of[['media',mediaSqlHash,'ResearchHub-session-media-v1'],['ingest',mediaIngestSqlHash,'ResearchHub-media-ingest-v1']]){
  const c=s[name];assert(c.receipt?.purpose===purpose&&c.receipt.syntheticOnly===true&&c.receipt.sqlHash===baseHash&&c.receipt.imageRevision===TONGUE_IMAGE_REVISION&&c.receipt.imageUpgradeHash===tongueImageUpgradeHash&&c.receipt.catalogHash===c.catalogHash&&c.catalogHash===upgraded[name],'MEDIA_TONGUE_SCHEMA_NOT_READY');
 }
 assert(s.ingest.receipt.guardRevision===TONGUE_IMAGE_REVISION&&s.ingest.receipt.guardSqlHash===tongueImageGuardHash&&body&&fn?.prosrc===body&&fn.prosecdef===false,'MEDIA_TONGUE_SCHEMA_NOT_READY');
 return s;
}
export async function upgradeTongueImageSchema(tx,env,{direction='up'}={}){
 assert.equal(env?.WP01_TEST_DB_NAME,'wp01_test_full_baseline','MEDIA_TONGUE_TARGET');
 assert.equal((await tx.$queryRawUnsafe('SELECT current_database() AS name'))[0]?.name,env.WP01_TEST_DB_NAME,'MEDIA_TONGUE_TARGET');
 assert(['up','down'].includes(direction),'MEDIA_TONGUE_DIRECTION');
 assert.equal(mediaSqlHash,'fe9a4fe7fa476eeb5d1401c5b71068b6d1433ebe9a71bcda6a07a9f7c54456e3','MEDIA_TONGUE_BASE_CHANGED');
 assert.equal(mediaIngestSqlHash,'2c31a41ddb3103fdca85b362694cd380c7954bd5f2e742b98ba839f28135b0a3','MEDIA_TONGUE_BASE_CHANGED');
 assert.equal(mediaNativeTargetGuardSqlHash,'d2c3e45756b1b0f53764b3a08969e7e44f140edf5c1e3ee665ea19afe05c68bd','MEDIA_TONGUE_BASE_CHANGED');
 await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('rh-ai-session-media-v1',0)),pg_advisory_xact_lock(hashtextextended('hub-media-ingest-v1',0))");
 const before=await state(tx),image=before.media.receipt?.imageRevision===TONGUE_IMAGE_REVISION;
 assert(!(direction==='down'&&before.media.receipt?.audioRevision),'MEDIA_TONGUE_AUDIO_DOWNGRADE_REQUIRED');
 if(image)await assertTongueImageSchemaReady(tx);else assertPrior(before);
 if(direction==='up'&&image||direction==='down'&&!image)return{changed:false,direction,upgradeHash:tongueImageUpgradeHash};
 if(direction==='down')assert.equal(Number((await tx.$queryRawUnsafe("SELECT count(*)::text AS n FROM rh_ai.session_media_uploads WHERE extension IN ('png','jpg','jpeg')"))[0].n),0,'MEDIA_TONGUE_DOWN_REQUIRES_EMPTY_IMAGES');
 for(const sql of direction==='up'?constraintsUp:constraintsDown)await tx.$executeRawUnsafe(sql);
 await tx.$executeRawUnsafe(direction==='up'?tongueImageGuardSql:mediaNativeTargetGuardSql);
 const after=await state(tx);
 assert.deepEqual(after.media.objects,before.media.objects,'MEDIA_TONGUE_OBJECTS_CHANGED');assert.deepEqual(after.ingest.objects,before.ingest.objects,'MEDIA_TONGUE_OBJECTS_CHANGED');
 assert.deepEqual(after.media.functions,before.media.functions,'MEDIA_TONGUE_MEDIA_GUARD_CHANGED');assert.equal(after.ingest.functions[0].proacl,before.ingest.functions[0].proacl,'MEDIA_TONGUE_ACL_CHANGED');
 await save(tx,after,{image:direction==='up'});
 if(direction==='up')await assertTongueImageSchemaReady(tx);else assertPrior(await state(tx));
 return{changed:true,direction,upgradeHash:tongueImageUpgradeHash,guardHash:tongueImageGuardHash,mediaCatalogHash:after.media.catalogHash,ingestCatalogHash:after.ingest.catalogHash};
}
