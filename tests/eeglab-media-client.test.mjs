import test from 'node:test';import assert from 'node:assert/strict';
import {assertMediaPage,readPendingMedia,mediaStateLabel} from '../src/session-media-session.js';
import {assertMediaIngest} from '../src/session-media-ingests.js';
import {eegInspectionLabel} from '../src/session-media-types.js';
const facts=()=>({hasEeg:true,hasAudio:false,hasVideo:false,hasImage:false,format:'eeglab',matVersion:'v5',layout:'external-fdt',channels:2,sampleRateHz:256,samplesPerEpoch:256,epochCount:2,sampledDurationSeconds:2,members:[{name:'synthetic.set',extension:'set',size:2048,sha256:'a'.repeat(64)},{name:'synthetic.fdt',extension:'fdt',size:4096,sha256:'b'.repeat(64)}]});
const media=()=>({id:'eeg',version:3,name:'rh-media-eeg.eeglab',extension:'eeglab',modality:'eeg',byteSize:6500,archiveState:'archived',inspectionState:'complete',classification:'valid',inspection:facts(),contentUnderstood:false,createdAt:'2026-11-19T00:00:00Z'});
const page=item=>({items:[item],nextCursor:null});
test('EEG readable group retains original names and facts, without being audio/video/image',()=>{
 const item=media();assert.equal(assertMediaPage(page(item)).items[0],item);
 assert.match(eegInspectionLabel(item.inspection),/SET\+FDT配套.*2通道.*采样总时长 2秒/);
 assertMediaPage(page({...item,inspection:{...facts(),matVersion:'v7.3',layout:'embedded',members:[facts().members[0]]}}));
 for(const patch of [{modality:'video'},{extension:'wav'},{inspection:{...facts(),hasAudio:true}},{inspection:{...facts(),hasImage:true}},{inspection:{...facts(),hasVideo:true}},{inspection:{...facts(),sampleRateHz:NaN}},{inspection:{...facts(),sampledDurationSeconds:3}},{inspection:{...facts(),members:[facts().members[0]]}},{inspection:{...facts(),members:[{...facts().members[0],sha256:['a'.repeat(64)]},facts().members[1]]}},{inspection:{...facts(),members:[{...facts().members[0],name:'../x.set'},facts().members[1]]}}])assert.throws(()=>assertMediaPage(page({...item,...patch})));
});
test('EEG receipt and pending retain one source identity, with strict group facts',()=>{
 const item=media(),row={id:'reg',version:1,state:'planned',requestKey:'key',confirmationHash:'c'.repeat(64),source:{mediaId:item.id,modality:'eeg',byteSize:item.byteSize,sha256:'d'.repeat(64),inspection:item.inspection},study:{id:'study',name:'合成'},subject:{id:'subject',subjectCode:'SYN'},visit:{id:'visit',name:'V1'}};
 assert.equal(assertMediaIngest(row),row);assert.throws(()=>assertMediaIngest({...row,source:{...row.source,modality:'audio'}}));
 const pending={requestKey:'original-group',uploadId:null,phase:'initializing',extension:'eeglab',byteSize:500*1024*1024};assert.deepEqual(readPendingMedia(JSON.stringify([pending])),[pending]);assert.deepEqual(readPendingMedia(JSON.stringify([{...pending,byteSize:pending.byteSize+1}])),[]);
});
test('an incomplete EEG source clearly asks for the companion without claiming group archive success',()=>{
 const label=mediaStateLabel({...media(),inspectionState:'unavailable',classification:'corrupt',inspection:{hasEeg:false,hasAudio:false,hasVideo:false,hasImage:false,failureCode:'missing_fdt'}});
 assert.match(label,/文件组未通过检查.*缺少配套FDT/);assert.doesNotMatch(label,/已归档|检查通过/);
});
