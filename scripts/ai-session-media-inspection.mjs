import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mediaImageDimensions} from '../server/ai-agent/session-media.mjs';
import {mediaAudioFactsValid} from '../server/ai-agent/session-audio-contract.mjs';
import {createEeglabInspection} from './ai-session-eeglab-inspection.mjs';
const run=promisify(execFile);
// Keep native output/diagnostic contracts; restrict new untrusted inputs locally.
export function createMediaInspection({parse,classify,execute=run,inspectEeglab=createEeglabInspection()}){
 return async function inspect(path,filename,source){
  if(/\.eeglab$/.test(filename))return inspectEeglab(path,filename,source);
  let directory;
  try{
   if(!path){
    await source.validate();directory=await mkdtemp(join(tmpdir(),'rh-media-check-'));
    path=join(directory,'source');await source.storage.downloadToFile(source.key,path);await source.validate();
   }
   const extension=/\.(mp4|mov|webm|png|jpg|jpeg|wav|mp3|m4a)$/.exec(filename)?.[1];
   if(!extension)throw Object.assign(Error('MEDIA_FORMAT'),{code:1,stderr:'Invalid data found'});
   if(['wav','mp3','m4a'].includes(extension)){
    const demuxer=extension==='m4a'?'mov':extension,input=['-protocol_whitelist','file,pipe','-f',demuxer,...(extension==='m4a'?['-enable_drefs','0','-use_absolute_path','0']:[])];
    const options={maxBuffer:1024*1024,timeout:30000,killSignal:'SIGKILL',env:{PATH:process.env.PATH,LANG:'C'}};
    const {stdout}=await execute('ffprobe',['-v','error','-max_alloc','268435456',...input,'-show_entries','format=duration:stream=codec_type,codec_name,sample_rate,channels,bits_per_raw_sample,bits_per_sample,duration','-of','json',path],options);
    let probe;try{probe=JSON.parse(stdout);}catch{throw Object.assign(Error('MEDIA_AUDIO_PARSE'),{code:1,stderr:'Invalid data found'});}
    const stream=probe?.streams?.[0];
    if(!Array.isArray(probe?.streams)||probe.streams.length!==1||stream?.codec_type!=='audio')throw Object.assign(Error('MEDIA_AUDIO_INVALID'),{code:1,stderr:'Invalid data found'});
    const bitValues=[stream.bits_per_raw_sample,stream.bits_per_sample].filter(x=>x!==undefined&&x!==null&&x!=='').map(Number);
    if(bitValues.some(x=>!Number.isInteger(x)||x<0||x>64))throw Object.assign(Error('MEDIA_AUDIO_INVALID'),{code:1,stderr:'Invalid data found'});
    const facts={hasAudio:true,hasVideo:false,hasImage:false,durationSeconds:Number(probe.format?.duration??stream.duration),sampleRateHz:Number(stream.sample_rate),channels:stream.channels,codec:stream.codec_name,bitDepth:extension==='wav'?bitValues.find(x=>x>0)??null:null};
    if(!mediaAudioFactsValid(facts,extension))throw Object.assign(Error('MEDIA_AUDIO_INVALID'),{code:1,stderr:'Invalid data found'});
    await execute('ffmpeg',['-v','error','-nostdin','-xerror','-err_detect','explode','-max_alloc','268435456',...input,'-i',path,'-map','0:a:0','-f','null','-'],{...options,timeout:60000});
    return{classification:'valid',...facts};
   }
   if(['png','jpg','jpeg'].includes(extension)){
    const demuxer=extension==='png'?'png_pipe':'jpeg_pipe',codec=extension==='png'?'png':'mjpeg';
    const options={maxBuffer:1024*1024,timeout:30000,killSignal:'SIGKILL',env:{PATH:process.env.PATH,LANG:'C'}};
    const input=['-protocol_whitelist','file,pipe','-f',demuxer];
    const {stdout}=await execute('ffprobe',['-v','error','-max_alloc','268435456',...input,'-show_entries','stream=codec_type,codec_name,width,height','-of','json',path],options);
    let probe;try{probe=JSON.parse(stdout);}catch{throw Object.assign(Error('MEDIA_IMAGE_PARSE'),{code:1,stderr:'Invalid data found'});}
    const stream=probe?.streams?.[0];
    if(!Array.isArray(probe?.streams)||probe.streams.length!==1||stream?.codec_type!=='video'||stream.codec_name!==codec||!mediaImageDimensions(stream))throw Object.assign(Error('MEDIA_IMAGE_INVALID'),{code:1,stderr:'Invalid data found'});
    const counted=await execute('ffprobe',['-v','error','-max_alloc','268435456',...input,'-count_frames','-show_entries','stream=nb_read_frames','-of','json',path],options);
    let frames;try{frames=JSON.parse(counted.stdout)?.streams;}catch{}
    if(!Array.isArray(frames)||frames.length!==1||String(frames[0]?.nb_read_frames)!=='1')throw Object.assign(Error('MEDIA_IMAGE_INVALID'),{code:1,stderr:'Invalid data found'});
    // Probe alone can accept truncated headers. Decode the complete still image,
    // with fixed local demuxer/protocols; never rewrite the archived source.
    await execute('ffmpeg',['-v','error','-nostdin','-xerror','-err_detect','explode','-max_alloc','268435456',...input,'-i',path,'-frames:v','2','-f','null','-'],options);
    return{classification:'valid',hasVideo:false,hasAudio:false,hasImage:true,width:stream.width,height:stream.height};
   }
   const {stdout}=await execute('ffprobe',['-v','error','-protocol_whitelist','file,pipe',
    '-f',extension==='webm'?'matroska':'mov',...(extension==='webm'?[]:['-enable_drefs','0','-use_absolute_path','0']),
    '-show_entries','format=format_name,duration:stream=codec_type','-of','json',path],
   {maxBuffer:1024*1024,timeout:30000,killSignal:'SIGKILL',env:{PATH:process.env.PATH,LANG:'C'}});
   return parse(stdout,filename);
  }catch(e){if(typeof e.code==='string'&&e.code.startsWith('MEDIA_')&&e.status)throw e;return classify(e,filename);}
  finally{if(directory)await rm(directory,{recursive:true,force:true});}
 };
}
