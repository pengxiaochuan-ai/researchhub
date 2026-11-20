import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeMediaInput,projectMedia,assertMediaQuestionReadableInTx} from './session-media.mjs';
import {mediaInspectionRef,mediaIngestSnapshot} from './session-media-ingest-contract.mjs';
import {createMediaInspection} from '../../scripts/ai-session-media-inspection.mjs';
import {createSessionMediaContent} from './session-media-content.mjs';
const facts=()=>({hasAudio:true,hasVideo:false,hasImage:false,durationSeconds:1.25,sampleRateHz:44100,channels:1,codec:'pcm_s24le',bitDepth:24});
const audio=()=>({id:'media',session_id:'session',account_id:'owner',study_group_id:'g',research_project_id:'p',extension:'wav',content_type:'audio/wav',safe_filename:'media.wav',byte_size:1024,source_sha256:'a'.repeat(64),version:5,archive_state:'archived',inspection_state:'complete',inspection_classification:'valid',inspection_attempt_id:'attempt',inspection:facts(),created_at:new Date('2026-11-19T00:00:00Z')});
test('audio initialization canonicalizes selector MIME aliases and enforces 200MiB without weakening formats',()=>{
 for(const [ext,mimes,type]of[['wav',['audio/wav','audio/x-wav','audio/wave'],'audio/wav'],['mp3',['audio/mpeg','audio/mp3'],'audio/mpeg'],['m4a',['audio/mp4','audio/x-m4a','audio/m4a'],'audio/mp4']])for(const mimeType of mimes){assert.equal(normalizeMediaInput({requestKey:'audio',filename:'recording.'+ext,mimeType,size:200*1024*1024}).contentType,type);assert.throws(()=>normalizeMediaInput({requestKey:'audio',filename:'recording.'+ext,mimeType,size:200*1024*1024+1}),/MEDIA_INPUT/);}
 for(const filename of['file.aac','file.flac','file.ogg'])assert.throws(()=>normalizeMediaInput({requestKey:'audio',filename,mimeType:'',size:100}),/MEDIA_INPUT/);
 assert.throws(()=>normalizeMediaInput({requestKey:'audio',filename:'file.wav',mimeType:'video/mp4',size:100}),/MEDIA_INPUT/);
});
test('audio projection and fixed source carry actual facts with no invented bit depth',()=>{
 const a=audio(),value=projectMedia(a);assert.equal(value.modality,'audio');assert.deepEqual(value.inspection,facts());assert.equal(value.contentUnderstood,false);
 assert.deepEqual(mediaInspectionRef(a),{version:5,attemptId:'attempt',classification:'valid',...facts()});assert.equal(mediaIngestSnapshot(a,{studyId:'study'},{kind:'native',id:'owner',version:1}).source.modality,'audio');
 for(const patch of[{hasVideo:true},{hasImage:true},{hasAudio:false},{durationSeconds:0},{durationSeconds:NaN},{sampleRateHz:0},{sampleRateHz:768001},{channels:33},{codec:'h264'},{bitDepth:65},{bitDepth:16}])assert.throws(()=>mediaInspectionRef({...a,inspection:{...facts(),...patch}}),/MEDIA_INGEST_SOURCE_UNAVAILABLE/);
 assert.throws(()=>mediaInspectionRef({...a,inspection:{...facts(),bitDepth:null}}),/MEDIA_INGEST_SOURCE_UNAVAILABLE/);
 assert.equal(mediaInspectionRef({...a,extension:'mp3',inspection:{...facts(),codec:'mp3',bitDepth:null}}).bitDepth,null);
});
test('audio inspection validates exact audio-only codec and fully decodes with bounded local processes',async()=>{
 const calls=[],probe={streams:[{codec_type:'audio',codec_name:'pcm_s24le',sample_rate:'44100',channels:1,bits_per_raw_sample:'24',bits_per_sample:0,sample_fmt:'s32'}],format:{duration:'1.25'}};
 const inspect=createMediaInspection({parse:JSON.parse,classify:()=>({classification:'corrupt'}),execute:async(...args)=>{calls.push(args);return{stdout:args[0]==='ffprobe'?JSON.stringify(probe):''};}});
 assert.deepEqual(await inspect('/private/recording.wav','recording.wav'),{classification:'valid',...facts()});assert.equal(calls[0][2].timeout,30000);assert.equal(calls[1][2].timeout,60000);assert(calls[0][1].includes('wav'));assert(calls[1][1].includes('-xerror'));
 probe.streams[0].bits_per_raw_sample='0';assert.equal((await inspect('/private/recording.wav','recording.wav')).classification,'corrupt');
 probe.streams.push({codec_type:'video',codec_name:'mjpeg'});assert.equal((await inspect('/private/recording.wav','recording.wav')).classification,'corrupt');
 probe.streams=[{codec_type:'audio',codec_name:'mp3',sample_rate:'16000',channels:1}];assert.equal((await inspect('/private/recording.m4a','recording.m4a')).classification,'corrupt');
});
test('raw audio questions stop before provider execution, including attached wording and transcription',async()=>{
 const tx={$queryRawUnsafe:async()=>[{media:true,audio:true,other:true}]},u={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a'};
 for(const text of['这段录音说了什么','转写上传的语音','提取这份音频的F0','transcribe this audio'])await assert.rejects(assertMediaQuestionReadableInTx(tx,u,'s',text),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE'&&e.publicMessage.includes('语音'));
});
test('raw audio is rejected at video content service before grant or queued model work',async()=>{
 const media=audio(),tx={$queryRawUnsafe:async sql=>{assert(sql.includes('session_media_uploads'));return[media];}},u={tenantId:'t',accountId:'owner'};
 const content=createSessionMediaContent({access:{transaction:(_u,_s,fn)=>fn(tx,u)},storage:{},configHash:'a'.repeat(64),authorizeStudy:()=>{throw Error('must not be invoked');},onQueued:()=>{throw Error('must not queue');}});
 await assert.rejects(content.create(u,'session','media',{requestKey:'run',expectedMediaVersion:5}),e=>e.code==='MEDIA_CONTENT_SOURCE');
});
