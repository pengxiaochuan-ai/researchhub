import {isIP} from 'node:net';
import {runtimeDependencies} from './dependencies.mjs';

const invalid=key=>{throw new Error('Invalid research runtime configuration: '+key);};
function databaseUrl(env,key){
 const value=env[key];let parsed;
 try{parsed=new URL(value);}catch{invalid(key);}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname||parsed.pathname.length<2||parsed.hash)invalid(key);
 return value;
}
export function readResearchRuntimeConfig(env=process.env){
 const database=databaseUrl(env,'DATABASE_URL'),direct=databaseUrl(env,'DIRECT_URL');
 if(typeof env.JWT_SECRET!=='string'||Buffer.byteLength(env.JWT_SECRET,'utf8')<32||env.JWT_SECRET.trim()!==env.JWT_SECRET)invalid('JWT_SECRET');
 const core=Object.freeze({coreRoot:env.HUB_CORE_DIR,digest:env.HUB_CORE_MANIFEST_SHA256,requirePrivate:env.NODE_ENV==='production'||env.HUB_REQUIRE_PRIVATE_CORE==='true'});
 const {load}=runtimeDependencies(core);
 const parseDeploymentScope=load('common/deployment-scope','parseDeploymentScope');
 const resolveAuthCookieName=load('common/deployment-scope','resolveAuthCookieName');
 if(env.DEPLOYMENT_PRODUCT!=='researchhub')invalid('DEPLOYMENT_PRODUCT');
 const scope=parseDeploymentScope(env),cookieName=resolveAuthCookieName(scope,env);
 const profile=env.HUB_RUNTIME_PROFILE??'minimal';
 const executionProfile=env.HUB_EXECUTION_PROFILE??'disabled';
 if(!['disabled','bounded-hub-chat-v1'].includes(executionProfile)||env.HUB_PAID_AI_ENABLED==='true'&&executionProfile!=='bounded-hub-chat-v1'||executionProfile==='bounded-hub-chat-v1'&&(env.HUB_PAID_AI_ENABLED!=='true'||scope.enabledWorkerKinds.length!==1||scope.enabledWorkerKinds[0]!=='knowledge-chat'))invalid('HUB_EXECUTION_PROFILE');
 if(executionProfile==='bounded-hub-chat-v1'&&(env.HUB_CHAT_ADMISSION_FILE!=='/run/researchhub-admission/admission.json'||env.HUB_CHAT_LEDGER_DIR!=='/run/researchhub-ai-ledger'||!/^[a-f0-9]{64}$/.test(env.HUB_CHAT_ADMISSION_SHA256??'')))invalid('HUB_CHAT_ADMISSION_FILE');
 const assetMarkdownExport=env.HUB_ASSET_MARKDOWN_EXPORT_ENABLED??'false';if(!['true','false'].includes(assetMarkdownExport))invalid('HUB_ASSET_MARKDOWN_EXPORT_ENABLED');
 if(!['minimal','full'].includes(profile)||env.NODE_ENV==='production'&&profile!=='full')invalid('HUB_RUNTIME_PROFILE');
 if(profile==='minimal'&&scope.enabledWorkerKinds.length)invalid('ENABLED_WORKER_KINDS');
 if(scope.officialJobKinds.length)invalid('OFFICIAL_JOB_KINDS');
 let parsed;
 try{parsed=new URL(env.HUB_APP_ORIGIN);}catch{invalid('HUB_APP_ORIGIN');}
 if(parsed.origin!==env.HUB_APP_ORIGIN||parsed.username||parsed.password||
  !(parsed.protocol==='https:'||/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(env.HUB_APP_ORIGIN)))invalid('HUB_APP_ORIGIN');
 if(!['true','false'].includes(env.HUB_AUTH_COOKIE_SECURE)||(env.HUB_AUTH_COOKIE_SECURE==='true')!==(parsed.protocol==='https:'))invalid('HUB_AUTH_COOKIE_SECURE');
 const host=env.HUB_API_HOST??'127.0.0.1';
 if(!isIP(host)&&!(typeof host==='string'&&host.length<=253&&/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host)))invalid('HUB_API_HOST');
 const portValue=env.HUB_API_PORT??'19612';
 if(!/^\d+$/.test(portValue)||Number(portValue)<1||Number(portValue)>65535)invalid('HUB_API_PORT');
 let identity;
 if(profile==='full'){
  for(const key of ['HUB_DATABASE_NAME','HUB_DATABASE_APP_ROLE','HUB_DATABASE_OWNER_ROLE'])if(!/^[a-zA-Z0-9_-]{1,160}$/.test(env[key]??''))invalid(key);
  if(!/^[a-f0-9]{64}$/.test(env.HUB_DATABASE_MARKER_SHA256??''))invalid('HUB_DATABASE_MARKER_SHA256');
  for(const [url,role]of [[database,env.HUB_DATABASE_APP_ROLE],[direct,env.HUB_DATABASE_OWNER_ROLE]]){const u=new URL(url);if(decodeURIComponent(u.pathname.slice(1))!==env.HUB_DATABASE_NAME||decodeURIComponent(u.username)!==role)invalid('HUB_DATABASE_NAME');}
  identity=Object.freeze({database:env.HUB_DATABASE_NAME,appRole:env.HUB_DATABASE_APP_ROLE,directRole:env.HUB_DATABASE_OWNER_ROLE,markerDigest:env.HUB_DATABASE_MARKER_SHA256,deploymentId:scope.deploymentId,tenantId:scope.defaultTenantId});
 }
 return Object.freeze({databaseUrl:database,directUrl:direct,jwtSecret:env.JWT_SECRET,scope,cookieName,origin:parsed.origin,secureCookie:env.HUB_AUTH_COOKIE_SECURE==='true',host,port:Number(portValue),core,profile,executionProfile,identity,assetMarkdownExportEnabled:assetMarkdownExport==='true'});
}
