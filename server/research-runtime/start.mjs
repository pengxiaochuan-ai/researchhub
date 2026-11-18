import {bootResearchRuntime} from './main.mjs';

try{
 const runtime=await bootResearchRuntime(process.env);
 let stopping=false;
 const stop=async()=>{
  if(stopping)return;stopping=true;
  try{await runtime.close();}catch{process.exitCode=1;console.error('RESEARCH_RUNTIME_SHUTDOWN_FAILED');}
 };
 process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
 console.log('RESEARCH_RUNTIME_READY');
}catch{
 process.exitCode=1;
 console.error('RESEARCH_RUNTIME_START_FAILED_CHECK_CONFIGURATION');
}
