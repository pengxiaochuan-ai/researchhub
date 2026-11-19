import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';

function reject(){throw new Error('REHEARSAL_SCOPE_REJECTED');}
export function validateRehearsalState(s){
 if(s?.schemaVersion!==1||s.syntheticOnly!==true||!/^rh-deploy-\d{8}-[a-f0-9]{8}$/.test(s.runId??'')||s.container!==s.runId+'-pg'||s.volume!==s.runId+'-pgdata'||s.database!=='rh_deploy_'+s.runId.slice(-8)||!Number.isInteger(s.port)||s.port<19650||s.port>19750)reject();
 return s;
}
export function assertOwnedRehearsal(state,inspect){
 validateRehearsalState(state);
 if(inspect?.Name!=='/'+state.container||inspect?.Config?.Labels?.['researchhub.rehearsal']!==state.runId)reject();
}
export function inspectRehearsal(state){
 validateRehearsalState(state);
 const value=JSON.parse(execFileSync('docker',['inspect',state.container],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
 assertOwnedRehearsal(state,value);return value;
}
export function rehearsalSql(state,sql,{database=state.database,readOnly=false}={}){
 inspectRehearsal(state);
 if(database!==state.database)reject();
 return execFileSync('docker',['exec','-i',state.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],{input:readOnly?'BEGIN READ ONLY;\n'+sql+'\nROLLBACK;\n':sql,encoding:'utf8',maxBuffer:20*1024*1024,timeout:60000,stdio:['pipe','pipe','pipe']});
}
export async function createRehearsal(directory,{port=19651}={}){
 directory=resolve(directory);const file=join(directory,'rehearsal-state.json');
 if(existsSync(file))throw new Error('REHEARSAL_ALREADY_EXISTS');
 const suffix=randomBytes(4).toString('hex'),runId='rh-deploy-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+suffix;
 const state=validateRehearsalState({schemaVersion:1,runId,container:runId+'-pg',volume:runId+'-pgdata',database:'rh_deploy_'+suffix,port,syntheticOnly:true});
 await new Promise((ok,no)=>{const socket=createServer();socket.once('error',no);socket.listen(port,'127.0.0.1',()=>socket.close(ok));});
 mkdirSync(directory,{recursive:true,mode:0o700});const password=randomBytes(32).toString('hex');
 const envFile=join(directory,'postgres.env');writeFileSync(envFile,`POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=${state.database}\n`,{mode:0o600,flag:'wx'});
 writeFileSync(file,JSON.stringify(state,null,2)+'\n',{mode:0o600,flag:'wx'});
 execFileSync('docker',['volume','create','--label','researchhub.rehearsal='+state.runId,state.volume],{stdio:'pipe'});
 execFileSync('docker',['run','--detach','--name',state.container,'--label','researchhub.rehearsal='+state.runId,'--env-file',envFile,'--publish',`127.0.0.1:${port}:5432`,'--mount',`type=volume,src=${state.volume},dst=/var/lib/postgresql/data`,'pgvector/pgvector:pg16'],{stdio:'pipe'});
 for(let n=0;n<60;n++){
  try{inspectRehearsal(state);execFileSync('docker',['exec',state.container,'pg_isready','-U','postgres','-d',state.database],{stdio:'pipe'});break;}catch{if(n===59)throw new Error('REHEARSAL_NOT_READY');await new Promise(ok=>setTimeout(ok,500));}
 }
 const marker=JSON.stringify({purpose:'researchhub-deployment-rehearsal',syntheticOnly:true,runId:state.runId});
 rehearsalSql(state,`COMMENT ON DATABASE ${state.database} IS '${marker}';`);
 return state;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [command,directory]=process.argv.slice(2);if(!directory)reject();
  const state=command==='init'?await createRehearsal(directory):validateRehearsalState(JSON.parse(readFileSync(join(directory,'rehearsal-state.json'))));
  if(command==='status')inspectRehearsal(state);else if(command!=='init')reject();
  console.log(JSON.stringify({runId:state.runId,container:state.container,port:state.port,database:state.database,syntheticOnly:true}));
 }catch(error){console.error(error.message?.startsWith('REHEARSAL_')?error.message:'REHEARSAL_OPERATION_FAILED');process.exitCode=1;}
}
