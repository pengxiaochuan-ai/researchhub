import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMediaInput,projectMedia,assertMediaQuestionReadableInTx} from './session-media.mjs';
import {mediaInspectionRef,mediaIngestSnapshot} from './session-media-ingest-contract.mjs';
import {createMediaInspection} from '../../scripts/ai-session-media-inspection.mjs';
const image=()=>({id:'image',session_id:'session',account_id:'owner',study_group_id:'g',research_project_id:'p',extension:'png',content_type:'image/png',safe_filename:'image.png',byte_size:1024,source_sha256:'a'.repeat(64),version:5,archive_state:'archived',inspection_state:'complete',inspection_classification:'valid',inspection_attempt_id:'attempt',inspection:{hasVideo:false,hasAudio:false,hasImage:true,width:640,height:480},created_at:new Date('2026-11-19T00:00:00Z')});
test('tongue JPEG/PNG metadata is bounded and canonical without changing video input',()=>{
 for(const [extension,mime]of[['png','image/png'],['jpg','image/jpeg'],['jpeg','image/jpeg']]){
  assert.deepEqual(normalizeMediaInput({requestKey:'image',filename:'original.'+extension,mimeType:mime,size:25*1024*1024}),{requestKey:'image',extension,contentType:mime,byteSize:25*1024*1024});
  assert.throws(()=>normalizeMediaInput({requestKey:'image',filename:'original.'+extension,mimeType:mime,size:25*1024*1024+1}),/MEDIA_INPUT/);
 }
 for(const filename of['wrong.svg','wrong.gif','wrong.webp','wrong.tiff'])assert.throws(()=>normalizeMediaInput({requestKey:'image',filename,mimeType:'',size:5}),/MEDIA_INPUT/);
 assert.throws(()=>normalizeMediaInput({requestKey:'image',filename:'original.png',mimeType:'image/jpeg',size:5}),/MEDIA_INPUT/);
});
test('tongue projection and confirmation identify an image; malformed image cannot impersonate video',()=>{
 const value=projectMedia(image());assert.equal(value.modality,'tongue');assert.deepEqual(value.inspection,{hasVideo:false,hasAudio:false,hasImage:true,width:640,height:480});assert.equal(value.contentUnderstood,false);
 const ref=mediaInspectionRef(image());assert.equal(ref.hasImage,true);assert.equal(ref.hasVideo,false);
 assert.equal(mediaIngestSnapshot(image(),{studyId:'study'},{kind:'native',id:'owner',version:1}).source.modality,'tongue');
 for(const patch of[{hasImage:false},{width:0},{width:1.5},{height:null},{hasAudio:true},{hasVideo:true}])assert.throws(()=>mediaInspectionRef({...image(),inspection:{...image().inspection,...patch}}),/MEDIA_INGEST_SOURCE_UNAVAILABLE/);
 const video={...image(),extension:'mp4',inspection:{hasVideo:true,hasAudio:false}};assert.equal(Object.hasOwn(projectMedia(video),'modality'),false);assert.equal(Object.hasOwn(mediaInspectionRef(video),'hasImage'),false);
});
test('image inspection pins still-image decoder, bounds dimensions, fully decodes, and rejects animation',async()=>{
 const calls=[],probe={streams:[{codec_type:'video',codec_name:'png',width:640,height:480,nb_read_frames:'1'}]};
 const inspect=createMediaInspection({parse:JSON.parse,classify:()=>({classification:'corrupt'}),execute:async(...args)=>{calls.push(args);return{stdout:args[0]==='ffprobe'?JSON.stringify(probe):''};}});
 assert.deepEqual(await inspect('/private/image.png','image.png'),{classification:'valid',hasVideo:false,hasAudio:false,hasImage:true,width:640,height:480});
 assert.equal(calls[0][0],'ffprobe');assert(calls[0][1].includes('png_pipe'));assert.equal(calls[2][0],'ffmpeg');assert(calls[2][1].includes('-xerror'));assert(calls[2][1].includes('explode'));
 for(const patch of[{width:200000},{width:0},{nb_read_frames:'2'},{codec_name:'h264'}]){calls.length=0;probe.streams[0]={codec_type:'video',codec_name:'png',width:640,height:480,nb_read_frames:'1',...patch};assert.equal((await inspect('/private/image.png','image.png')).classification,'corrupt');assert.equal(calls.length,patch.nb_read_frames?2:1);}
});
test('raw tongue questions stop before model execution while explicit literature questions keep their path',async()=>{
 let calls=0;const tx={$queryRawUnsafe:async()=>{calls++;return[{media:true,image:true,other:true}];}},u={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a'};
 for(const text of['看看这张舌图','这张图片是什么证型','提取上传舌象的RGB指标','describe this image'])await assert.rejects(assertMediaQuestionReadableInTx(tx,u,'session',text),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE'&&e.publicMessage.includes('尚不能解读舌象'));
 const before=calls;await assertMediaQuestionReadableInTx(tx,u,'session','只根据Hub论文总结舌象研究');assert.equal(calls,before);
});
