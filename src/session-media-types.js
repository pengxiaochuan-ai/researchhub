export const TONGUE_IMAGE_MAX_BYTES=25*1024*1024;
export const AUDIO_MAX_BYTES=200*1024*1024;
export const isTongueExtension=extension=>['png','jpg','jpeg'].includes(extension);
export const isAudioExtension=extension=>['wav','mp3','m4a'].includes(extension);
export const isEegExtension=extension=>extension==='eeglab';
export const mediaMaxBytes=extension=>isTongueExtension(extension)?TONGUE_IMAGE_MAX_BYTES:isAudioExtension(extension)?AUDIO_MAX_BYTES:500*1024*1024;
export const mediaFileExtension=name=>/\.(mp4|mov|webm|png|jpg|jpeg|wav|mp3|m4a|eeglab)$/i.exec(name??'')?.[1].toLowerCase();
export const isTongueMedia=item=>item?.modality==='tongue'&&isTongueExtension(item.extension);
export const isAudioMedia=item=>item?.modality==='audio'&&isAudioExtension(item.extension);
export const isEegMedia=item=>item?.modality==='eeg'&&isEegExtension(item.extension);
export const mediaExtensionLabel=extension=>isTongueExtension(extension)?'舌图':isAudioExtension(extension)?'语音':isEegExtension(extension)?'EEG文件组':'视频';
export function validEegInspection(i){
 if(i?.hasEeg!==true||i.hasAudio!==false||i.hasVideo!==false||i.hasImage!==false||i.format!=='eeglab'||!['v5','v7.3'].includes(i.matVersion)||!['embedded','external-fdt'].includes(i.layout)||!Number.isSafeInteger(i.channels)||i.channels<1||i.channels>4096||!Number.isFinite(i.sampleRateHz)||i.sampleRateHz<=0||i.sampleRateHz>1000000||![i.samplesPerEpoch,i.epochCount].every(x=>Number.isSafeInteger(x)&&x>0)||!Number.isSafeInteger(i.samplesPerEpoch*i.epochCount)||!Number.isFinite(i.sampledDurationSeconds)||i.sampledDurationSeconds<=0||Math.abs(i.sampledDurationSeconds-i.samplesPerEpoch*i.epochCount/i.sampleRateHz)>1e-8)return false;
 if(!Array.isArray(i.members)||i.members.length!==(i.layout==='embedded'?1:2))return false;
 return i.members.every((m,n)=>m&&Object.keys(m).sort().join(',')==='extension,name,sha256,size'&&validEeglabName(m.name)&&m.extension===(n?'fdt':'set')&&m.name.toLowerCase().endsWith('.'+m.extension)&&Number.isSafeInteger(m.size)&&m.size>0&&m.size<=(n?500:100)*1024*1024&&typeof m.sha256==='string'&&/^[a-f0-9]{64}$/.test(m.sha256))&&i.members.reduce((n,m)=>n+m.size,0)<=500*1024*1024&&(i.layout==='embedded'||i.channels*i.samplesPerEpoch*i.epochCount*4===i.members[1].size);
}
export const eegInspectionLabel=i=>`EEGLAB · ${i.layout==='embedded'?'SET内嵌':'SET+FDT配套'} · ${i.channels}通道 · ${i.sampleRateHz} Hz · ${i.epochCount}段 · 采样总时长 ${i.sampledDurationSeconds}秒`;
export function validAudioInspection(i,extension){
 if(i?.hasAudio!==true||i.hasVideo!==false||i.hasImage!==false||!Number.isFinite(i.durationSeconds)||i.durationSeconds<=0||!Number.isSafeInteger(i.sampleRateHz)||i.sampleRateHz<1||i.sampleRateHz>768000||!Number.isSafeInteger(i.channels)||i.channels<1||i.channels>32)return false;
 const depth={pcm_s16le:16,pcm_s24le:24,mp3:null,aac:null};
 if(!Object.hasOwn(depth,i.codec)||i.bitDepth!==depth[i.codec])return false;
 return !extension||(extension==='wav'?['pcm_s16le','pcm_s24le'].includes(i.codec):extension==='mp3'?i.codec==='mp3':extension==='m4a'&&i.codec==='aac');
}
export const validImageInspection=inspection=>inspection?.hasImage===true&&inspection.hasVideo===false&&inspection.hasAudio===false&&Number.isSafeInteger(inspection.width)&&inspection.width>0&&inspection.width<=20000&&Number.isSafeInteger(inspection.height)&&inspection.height>0&&inspection.height<=20000&&inspection.width*inspection.height<=40000000;
export const mediaTypeLabel=item=>isTongueMedia(item)?'舌图':isAudioMedia(item)?'语音':isEegMedia(item)?'EEG原件':'视频';
import {validEeglabName} from './eeglab-envelope.js';
