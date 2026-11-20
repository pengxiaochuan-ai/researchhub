import {execFile} from 'node:child_process';import {existsSync,createReadStream,createWriteStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pipeline} from 'node:stream/promises';
import {inspectEeglabEnvelope} from '../server/eeglab/envelope.mjs';import {validEeglabFacts,EEGLAB_FAILURE_CODES} from '../server/ai-agent/session-eeglab-contract.mjs';
export {EEGLAB_FAILURE_CODES};
export const defaultEeglabPython=new URL('../.tmp/eeglab-ingestion-2026-11-19/venv/bin/python',import.meta.url).pathname;
const failed=code=>({classification:code==='resource_limit'?'timeout':'corrupt',hasEeg:false,hasAudio:false,hasVideo:false,hasImage:false,failureCode:code});
export function assertEeglabRuntimeReady(python=defaultEeglabPython){return new Promise((resolve,reject)=>execFile(python,['-I',new URL('../server/eeglab/inspect.py',import.meta.url).pathname,'--runtime'],{timeout:10000,maxBuffer:4096,env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'en_US.UTF-8',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',HDF5_PLUGIN_PATH:'',HDF5_PLUGIN_PRELOAD:'::'}},(error,stdout)=>{try{const r=JSON.parse(stdout);if(error||r.schema!=='eeglab-reader-runtime.v1'||JSON.stringify(r.packages)!==JSON.stringify({numpy:'2.5.1',scipy:'1.18.0',h5py:'3.16.0'}))throw Error('EEGLAB_RUNTIME_NOT_READY');resolve(r);}catch{reject(Error('EEGLAB_RUNTIME_NOT_READY'));}}));}
function runReader(python,path,members){return new Promise(resolve=>{
 let memoryExceeded=false,checking=false;
 const child=execFile(python,['-I',new URL('../server/eeglab/inspect.py',import.meta.url).pathname,path],{maxBuffer:65536,timeout:40000,killSignal:'SIGKILL',env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'en_US.UTF-8',PYTHONDONTWRITEBYTECODE:'1',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',HDF5_PLUGIN_PATH:'',HDF5_PLUGIN_PRELOAD:'::'}},(error,stdout)=>{clearInterval(timer);if(memoryExceeded||error?.killed||error?.signal)return resolve({failureCode:'resource_limit'});try{const result=JSON.parse(stdout);if(error&&result?.unavailable!==true&&!EEGLAB_FAILURE_CODES.has(result?.failureCode))return resolve({failureCode:'metadata_mismatch'});resolve(result);}catch{resolve({failureCode:'metadata_mismatch'});}});
 const timer=setInterval(()=>{if(checking||!child.pid)return;checking=true;execFile('ps',['-o','rss=','-p',String(child.pid)],{timeout:1000,maxBuffer:1024},(error,stdout)=>{checking=false;if(!error&&Number(stdout.trim())>1024*1024){memoryExceeded=true;child.kill('SIGKILL');}});},250);
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(members));
});}
export async function inspectEeglabSignature(input){try{const envelope=await inspectEeglabEnvelope(input.path);return{extension:'eeglab',canonicalMimetype:'application/zip',modality:'eeg',sha256:envelope.sha256};}catch{throw Object.assign(Error('EEGLAB_ENVELOPE_INVALID'),{name:'ChatUploadSignatureError'});}}
export function createEeglabInspection({python=defaultEeglabPython}={}){return async function inspect(path,_filename,source){
 let directory;try{
  if(!existsSync(python))return{classification:'tool_unavailable',hasEeg:false,hasAudio:false,hasVideo:false,hasImage:false};
  directory=await mkdtemp(join(tmpdir(),'rh-eeglab-'));
  if(!path){await source.validate();path=join(directory,'source.eeglab');await source.storage.downloadToFile(source.key,path);await source.validate();}
  let envelope;try{envelope=await inspectEeglabEnvelope(path);}catch{return failed('invalid_envelope');}
  const setPath=join(directory,'source.set'),entry=envelope.entries[0];await pipeline(createReadStream(path,{start:entry.offset,end:entry.offset+entry.size-1}),createWriteStream(setPath,{flags:'wx',mode:0o600}));
  const result=await runReader(python,setPath,envelope.members);
  if(result?.unavailable)return{classification:'tool_unavailable',hasEeg:false,hasAudio:false,hasVideo:false,hasImage:false};
  if(EEGLAB_FAILURE_CODES.has(result?.failureCode))return failed(result.failureCode);
  return validEeglabFacts(result)?{classification:'valid',...result}:failed('metadata_mismatch');
 }catch(error){if(error?.status)throw error;return failed('metadata_mismatch');}finally{if(directory)await rm(directory,{recursive:true,force:true});}
 };}
