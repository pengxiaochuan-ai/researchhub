import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=promisify(execFile);
// Keep native output/diagnostic contracts; restrict new untrusted inputs locally.
export function createMediaInspection({parse,classify,execute=run}){
 return async function inspect(path,filename,source){
  let directory;
  try{
   if(!path){
    await source.validate();directory=await mkdtemp(join(tmpdir(),'rh-media-check-'));
    path=join(directory,'source');await source.storage.downloadToFile(source.key,path);await source.validate();
   }
   const extension=/\.(mp4|mov|webm)$/.exec(filename)?.[1];
   if(!extension)throw Object.assign(Error('MEDIA_FORMAT'),{code:1,stderr:'Invalid data found'});
   const {stdout}=await execute('ffprobe',['-v','error','-protocol_whitelist','file,pipe',
    '-f',extension==='webm'?'matroska':'mov',...(extension==='webm'?[]:['-enable_drefs','0','-use_absolute_path','0']),
    '-show_entries','format=format_name,duration:stream=codec_type','-of','json',path],
   {maxBuffer:1024*1024,timeout:30000,killSignal:'SIGKILL',env:{PATH:process.env.PATH,LANG:'C'}});
   return parse(stdout,filename);
  }catch(e){if(typeof e.code==='string'&&e.code.startsWith('MEDIA_')&&e.status)throw e;return classify(e,filename);}
  finally{if(directory)await rm(directory,{recursive:true,force:true});}
 };
}
