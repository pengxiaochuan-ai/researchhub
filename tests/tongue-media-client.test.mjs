import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMediaPage,readPendingMedia} from '../src/session-media-session.js';
import {assertMediaIngest} from '../src/session-media-ingests.js';

const image=()=>({id:'image',version:3,name:'image.png',extension:'png',modality:'tongue',byteSize:512,archiveState:'archived',inspectionState:'complete',classification:'valid',inspection:{hasImage:true,hasVideo:false,hasAudio:false,width:800,height:600},contentUnderstood:false,createdAt:'2026-11-19T00:00:00.000Z'});
const page=item=>({items:[item],nextCursor:null});

test('checked tongue image is a readable original, with no AI understanding claim',()=>{
 const item=image();assert.equal(assertMediaPage(page(item)).items[0],item);
 for(const extension of ['png','jpg','jpeg'])assertMediaPage(page({...item,extension}));
 const legacy={...item,extension:'mp4',inspection:{hasVideo:true,hasAudio:false}};delete legacy.modality;
 assertMediaPage(page(legacy));
});

test('image DTO rejects wrong modality, size, media kind and missing image dimensions',()=>{
 for(const patch of [{modality:'video'},{byteSize:25*1024*1024+1},{contentUnderstood:true},{inspection:{hasImage:true,hasVideo:true,hasAudio:false,width:800,height:600}},{inspection:{hasImage:true,hasVideo:false,hasAudio:false,width:0,height:600}},{inspection:{hasImage:true,hasVideo:false,hasAudio:false,width:800}},{inspection:{hasImage:false,hasVideo:false,hasAudio:false,width:800,height:600}}])assert.throws(()=>assertMediaPage(page({...image(),...patch})));
});

test('pending image can be recovered by the original key, with its image limit preserved',()=>{
 const record={requestKey:'original-image',uploadId:null,phase:'initializing',byteSize:512,extension:'jpeg'};
 assert.deepEqual(readPendingMedia(JSON.stringify([record])),[record]);
 assert.deepEqual(readPendingMedia(JSON.stringify([{...record,byteSize:25*1024*1024+1}])),[]);
});

test('tongue receipt accepts its image source and denies a mixed video declaration',()=>{
 const row={id:'ingest',version:1,state:'planned',requestKey:'key',confirmationHash:'a'.repeat(64),source:{mediaId:'image',sha256:'b'.repeat(64),byteSize:512,modality:'tongue',inspection:image().inspection},study:{id:'study',name:'合成研究'},subject:{id:'subject',subjectCode:'SYN-001'},visit:{id:'visit',name:'V1'}};
 assert.equal(assertMediaIngest(row,'image'),row);
 assert.throws(()=>assertMediaIngest({...row,source:{...row.source,inspection:{...row.source.inspection,hasVideo:true}}},'image'));
});
