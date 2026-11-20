// Explicit, owned F06 synthetic storage/API/frontend. No old env/DB/process reuse.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateRehearsalState,inspectRehearsal,rehearsalSql} from '../deploy/rehearsal.mjs';
import {catalogFingerprintSql} from '../deploy/migration-plan.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),image='researchhub-backend:rehearsal-full-v33-0fbba918';
const fail=()=>{throw Error('F06_RUNTIME_SCOPE_REJECTED');};
const run=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,...options});
function owned(directory){directory=path.resolve(directory);if(!directory.startsWith(path.join(root,'.tmp/f06-hub-assets-')))fail();const state=validateRehearsalState(JSON.parse(fs.readFileSync(path.join(directory,'rehearsal-state.json')))),prepared=JSON.parse(fs.readFileSync(path.join(directory,'prepared.json')));if(prepared.runId!==state.runId||prepared.syntheticOnly!==true)fail();inspectRehearsal(state);return{directory,state,prepared};}
const writeEnv=(file,values)=>fs.writeFileSync(file,Object.entries(values).map(([k,v])=>{if(/[\r\n\0]/.test(v))fail();return k+'='+v;}).join('\n')+'\n',{mode:0o600,flag:'wx'});
async function free(port){await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
export async function storageF06(directory){
 const o=owned(directory),{state,prepared}=o;directory=o.directory;
 const file=path.join(directory,'storage.private.json');if(fs.existsSync(file))throw Error('F06_STORAGE_ALREADY_PREPARED');
 const settings={container:state.runId+'-f06-minio',volume:state.runId+'-f06-miniodata',bucket:'f06-'+state.runId.slice(-8),accessKey:'f06'+randomBytes(10).toString('hex'),secretKey:randomBytes(30).toString('hex'),region:'us-east-1'};
 const minioEnv=path.join(directory,'minio.env');writeEnv(minioEnv,{MINIO_ROOT_USER:settings.accessKey,MINIO_ROOT_PASSWORD:settings.secretKey});
 run(['volume','create','--label','researchhub.rehearsal='+state.runId,settings.volume]);
 run(['run','--detach','--name',settings.container,'--label','researchhub.rehearsal='+state.runId,'--network',prepared.network,'--network-alias','f06-minio','--env-file',minioEnv,'--mount',`type=volume,src=${settings.volume},dst=/data`,'minio/minio:RELEASE.2024-08-17T01-24-54Z','server','/data','--address',':9000']);
 const storageEnv=path.join(directory,'storage.env');writeEnv(storageEnv,{S3_ENDPOINT:'http://f06-minio:9000',S3_BUCKET:settings.bucket,S3_ACCESS_KEY:settings.accessKey,S3_SECRET_KEY:settings.secretKey,S3_REGION:settings.region});
 const script="const {Client}=require('/opt/researchhub/core/node_modules/minio');(async()=>{for(let i=0;i<40;i++){try{if((await fetch('http://f06-minio:9000/minio/health/live')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}const c=new Client({endPoint:'f06-minio',port:9000,useSSL:false,accessKey:process.env.S3_ACCESS_KEY,secretKey:process.env.S3_SECRET_KEY});await c.makeBucket(process.env.S3_BUCKET,process.env.S3_REGION);if(!await c.bucketExists(process.env.S3_BUCKET))throw Error('not ready');console.log('F06_OWNED_BUCKET_READY')})().catch(()=>{console.error('F06_BUCKET_INITIALIZATION_FAILED');process.exitCode=1})";
 run(['run','--rm','--network',prepared.network,'--env-file',storageEnv,'--entrypoint','node',image,'-e',script]);
 fs.writeFileSync(file,JSON.stringify(settings,null,2),{mode:0o600,flag:'wx'});return{storageReady:true,container:settings.container,bucket:settings.bucket,hostPortsPublished:false};
}
export async function apiF06(directory){
 const o=owned(directory),{state,prepared}=o;directory=o.directory;await free(19662);
 const settings=JSON.parse(fs.readFileSync(path.join(directory,'storage.private.json'))),urls=JSON.parse(fs.readFileSync(path.join(directory,'runtime-database.json'))),release=JSON.parse(fs.readFileSync(path.join(root,'.tmp/deployment-delivery-20261118/backend-context-v33/release.json')));
 const schemas=JSON.parse(fs.readFileSync(path.join(root,'deploy/migrations/researchhub-production-equivalence-v1/manifest.json'))).managedSchemas.concat('rh_hub_asset');
 const markerSql="SELECT encode(sha256(convert_to(shobj_description(oid,'pg_database'),'UTF8')),'hex') FROM pg_database WHERE datname=current_database();";
 const marker=rehearsalSql(state,markerSql,{readOnly:true}).trim(),fingerprint=rehearsalSql(state,'SET LOCAL search_path=pg_catalog; SELECT ('+catalogFingerprintSql(schemas)+');',{readOnly:true}).trim();
 if(!/^[a-f0-9]{64}$/.test(marker)||!/^[a-f0-9]{32}$/.test(fingerprint))fail();
 const rewrite=value=>{const u=new URL(value);u.hostname='f06-pg';u.port='5432';return u.toString();};
 const env={NODE_ENV:'production',DEPLOYMENT_PRODUCT:'researchhub',HUB_RUNTIME_PROFILE:'full',HUB_REQUIRE_PRIVATE_CORE:'true',HUB_CORE_DIR:'/opt/researchhub/core',HUB_CORE_MANIFEST_SHA256:release.coreDigest,DEPLOYMENT_ID:state.runId,ALLOWED_TENANT_IDS:prepared.ids.tenant,DEFAULT_TENANT_ID:prepared.ids.tenant,DATABASE_URL:rewrite(urls.databaseUrl),DIRECT_URL:rewrite(urls.directUrl),HUB_DATABASE_NAME:state.database,HUB_DATABASE_APP_ROLE:'aisci_app',HUB_DATABASE_OWNER_ROLE:'aisci_owner',HUB_DATABASE_MARKER_SHA256:marker,HUB_MANAGED_SCHEMAS:schemas.join(','),HUB_SCHEMA_FINGERPRINT:fingerprint,JWT_SECRET:randomBytes(40).toString('hex'),AUTH_COOKIE_NAME:'f06_session_'+state.runId.slice(-8),HUB_APP_ORIGIN:'http://127.0.0.1:19663',HUB_AUTH_COOKIE_SECURE:'false',HUB_API_HOST:'0.0.0.0',HUB_API_PORT:'19662',HUB_API_AUTHORITY:'127.0.0.1:19662',HUB_SOURCE_REVIEWER_ACCOUNT_ID:prepared.ids.admin,CONTROL_PLANE_ENABLED:'false',ENABLED_WORKER_KINDS:'',OFFICIAL_JOB_KINDS:'',HUB_PAID_AI_ENABLED:'false',HUB_EXECUTION_PROFILE:'disabled',HUB_EMBEDDING_MODE:'keyword-only',HUB_MAIL_MODE:'disabled',HUB_ASSET_MARKDOWN_EXPORT_ENABLED:'false',S3_ENDPOINT:'http://f06-minio:9000',S3_BUCKET:settings.bucket,S3_ACCESS_KEY:settings.accessKey,S3_SECRET_KEY:settings.secretKey,S3_REGION:settings.region};
 const file=path.join(directory,'runtime.env');writeEnv(file,env);const container=state.runId+'-f06-api';
 run(['run','--detach','--name',container,'--label','researchhub.rehearsal='+state.runId,'--network',prepared.network,'--env-file',file,'--publish','127.0.0.1:19662:19662','--mount',`type=bind,src=${root},dst=/opt/researchhub/hub,readonly`,'--entrypoint','node',image,'server/research-runtime/start.mjs']);
 let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:19662/api/auth/me',{headers:{Host:'127.0.0.1:19662'}});if(r.status===401){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 if(!ready)throw Error('F06_RUNTIME_NOT_READY');
 const receipt={ready:true,container,origin:env.HUB_APP_ORIGIN,apiPort:19662,schemaFingerprint:fingerprint,schemas,paidAi:false,workers:[],mail:'disabled',sourceMount:root,developmentMount:true};fs.writeFileSync(path.join(directory,'runtime-ready.json'),JSON.stringify(receipt,null,2),{mode:0o600,flag:'wx'});return receipt;
}
export async function frontendF06(directory){const {prepared}=owned(directory);await free(19663);const {createServer}=await import('vite');const server=await createServer({root,configFile:path.join(root,'vite.config.js'),cacheDir:path.join(path.resolve(directory),'vite-cache'),define:{'import.meta.env.VITE_AUTH_TENANT_SLUG':JSON.stringify(prepared.tenantSlug)},server:{host:'127.0.0.1',port:19663,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:19662',changeOrigin:true}}},logLevel:'error'});await server.listen();for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>void server.close());return{ready:true,origin:'http://127.0.0.1:19663',api:'http://127.0.0.1:19662'};}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const [command,directory,approval]=process.argv.slice(2);if(command==='api'&&approval!=='--start-approved-current-schema')fail();const result=command==='storage'?await storageF06(directory):command==='api'?await apiF06(directory):command==='frontend'?await frontendF06(directory):fail();console.log(JSON.stringify(result));}catch(error){console.error(error.message?.startsWith('F06_')?error.message:'F06_RUNTIME_PREPARATION_FAILED');process.exitCode=1;}}
