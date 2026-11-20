import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeMediaInput,projectMedia,assertMediaQuestionReadableInTx} from './session-media.mjs';import {mediaInspectionRef,mediaIngestSnapshot} from './session-media-ingest-contract.mjs';
import {createSessionMediaContent} from './session-media-content.mjs';
const api=await import('../eeglab/envelope.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const facts=()=>({hasEeg:true,hasAudio:false,hasVideo:false,hasImage:false,format:'eeglab',matVersion:'v5',layout:'embedded',channels:2,sampleRateHz:256,samplesPerEpoch:512,epochCount:1,sampledDurationSeconds:2,members:[{name:'original.set',extension:'set',size:200,sha256:'a'.repeat(64)}]});
const row=()=>({id:'eeglab',session_id:'session',account_id:'owner',study_group_id:'g',research_project_id:'p',extension:'eeglab',content_type:'application/zip',safe_filename:'eeglab.eeglab',byte_size:1000,source_sha256:'b'.repeat(64),version:5,archive_state:'archived',inspection_state:'complete',inspection_classification:'valid',inspection_attempt_id:'attempt',inspection:facts(),created_at:new Date('2026-11-19T00:00:00Z')});
test('internal EEGLAB envelope is accepted at 500MiB; raw zip/SET/FDT and arbitrary fields rejected',()=>{
 assert.equal(normalizeMediaInput({requestKey:'eeglab',filename:'eeglab-originals.eeglab',mimeType:'application/zip',size:500*1024*1024}).extension,'eeglab');
 for(const filename of['raw.zip','raw.set','raw.fdt','script.m'])assert.throws(()=>normalizeMediaInput({requestKey:'eeglab',filename,mimeType:'application/zip',size:20}),/MEDIA_INPUT/);
});
test('EEGLAB frozen DTO carries explicit member originals and finite deterministic facts only',()=>{
 assert.equal(projectMedia(row()).modality,'eeg');assert.deepEqual(projectMedia(row()).inspection,facts());assert.equal(mediaIngestSnapshot(row(),{studyId:'study'},{kind:'native',id:'owner',version:1}).source.modality,'eeg');
 for(const patch of[{hasAudio:true},{hasVideo:true},{hasImage:true},{hasEeg:false},{channels:4097},{sampleRateHz:Infinity},{samplesPerEpoch:0},{epochCount:1.5},{sampledDurationSeconds:3},{members:[]},{members:[{...facts().members[0],name:'../x.set'}]}])assert.throws(()=>mediaInspectionRef({...row(),inspection:{...facts(),...patch}}),/MEDIA_INGEST_SOURCE_UNAVAILABLE/);
 assert.throws(()=>mediaInspectionRef({...row(),inspection:{...facts(),members:[{...facts().members[0],sha256:['a'.repeat(64)]}]}}),/MEDIA_INGEST_SOURCE_UNAVAILABLE/);
});
test('EEGLAB envelope name and CRC rules reject path ambiguity and keep original case',()=>{
 assert(api,'EEGLAB envelope parser missing');assert.equal(api.validEeglabName('资料.SET'),true);assert.equal(api.crc32(Buffer.from('123456789')),0xcbf43926);
 for(const name of['../x.set','x/other.set','x\\other.set','x..set',' x.set','x.set.','C:x.set','CON.set','x\u0000.set','x'.repeat(201)+'.set'])assert.equal(api.validEeglabName(name),false,name);
});
test('EEG questions and direct video content API cannot trigger a model or processing work',async()=>{
 const u={tenantId:'t',accountId:'owner',studyGroupId:'g',researchProjectId:'p'},tx={$queryRawUnsafe:async sql=>sql.includes(' AS media')?[{media:true,eeg:true,other:true}]:sql.startsWith('SELECT set_config')?[]:[row()]};
 await assert.rejects(assertMediaQuestionReadableInTx(tx,u,'session','分析这份EEGLAB脑电数据'),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE'&&e.publicMessage.includes('EEG'));
 const content=createSessionMediaContent({access:{transaction:(_u,_s,fn)=>fn(tx,u)},storage:{},configHash:'a'.repeat(64),authorizeStudy:()=>{throw Error('must not authorize video execution');},onQueued:()=>{throw Error('must not queue a model');}});
 await assert.rejects(content.create(u,'session','eeglab',{requestKey:'forbidden',expectedMediaVersion:5}),e=>e.code==='MEDIA_CONTENT_SOURCE');
});
