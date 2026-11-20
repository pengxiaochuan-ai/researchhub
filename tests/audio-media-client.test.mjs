import test from'node:test';
import assert from'node:assert/strict';
import{assertMediaPage,readPendingMedia,uploadMediaFile}from'../src/session-media-session.js';
import{assertMediaIngest}from'../src/session-media-ingests.js';
const inspection=()=>({hasAudio:true,hasVideo:false,hasImage:false,durationSeconds:1.25,sampleRateHz:44100,channels:1,codec:'pcm_s24le',bitDepth:24});
const audio=()=>({id:'audio',version:3,name:'audio.wav',extension:'wav',modality:'audio',byteSize:1000,archiveState:'archived',inspectionState:'complete',classification:'valid',inspection:inspection(),contentUnderstood:false,createdAt:'2026-11-19T00:00:00.000Z'});
const page=item=>({items:[item],nextCursor:null});
test('readable voice originals retain actual protocol facts without claiming understanding',()=>{
 assert.equal(assertMediaPage(page(audio())).items[0].inspection.bitDepth,24);
 for(const[extension,codec]of[['mp3','mp3'],['m4a','aac']]){const item={...audio(),extension,inspection:{...inspection(),codec,bitDepth:null}};assert.equal(assertMediaPage(page(item)).items[0].inspection.bitDepth,null);}
 const pending={...audio(),archiveState:'pending',inspectionState:'pending',classification:null,inspection:{hasAudio:false,hasVideo:false,hasImage:false}};assertMediaPage(page(pending));
});
test('voice response rejects video/image masquerading, invalid facts, wrong format and oversized originals',()=>{
 for(const patch of[{modality:'video'},{byteSize:200*1024*1024+1},{extension:'png'},{inspection:{...inspection(),hasVideo:true}},{inspection:{...inspection(),hasImage:true}},{inspection:{...inspection(),hasAudio:false}},{inspection:{...inspection(),durationSeconds:0}},{inspection:{...inspection(),durationSeconds:Infinity}},{inspection:{...inspection(),sampleRateHz:0}},{inspection:{...inspection(),channels:0}},{inspection:{...inspection(),bitDepth:128}},{inspection:{...inspection(),codec:'h264'}}])assert.throws(()=>assertMediaPage(page({...audio(),...patch})));
});
test('an original audio operation survives recovery with its key and 200MiB boundary',()=>{
 const record={requestKey:'original-voice',uploadId:null,phase:'initializing',byteSize:200*1024*1024,extension:'m4a'};assert.deepEqual(readPendingMedia(JSON.stringify([record])),[record]);assert.deepEqual(readPendingMedia(JSON.stringify([{...record,byteSize:record.byteSize+1}])),[]);
});
test('voice receipt validates the same actual inspection facts and no fabricated bit depth',()=>{
 const row={id:'registration',version:1,state:'planned',requestKey:'key',confirmationHash:'a'.repeat(64),source:{mediaId:'audio',sha256:'b'.repeat(64),byteSize:1000,modality:'audio',inspection:inspection()},study:{id:'study',name:'合成研究'},subject:{id:'subject',subjectCode:'SYN-001'},visit:{id:'visit',name:'V1'}};assert.equal(assertMediaIngest(row,'audio'),row);
 assert.throws(()=>assertMediaIngest({...row,source:{...row.source,inspection:{...inspection(),hasVideo:true}}},'audio'));
});
test('client rejects over-limit voice selection before creating a request or upload identity',async()=>{
 let writes=0;await assert.rejects(uploadMediaFile({client:{post:async()=>{writes++;}},sid:'session',file:{name:'voice.wav',size:200*1024*1024+1},requestKey:'original'}));assert.equal(writes,0);
});
