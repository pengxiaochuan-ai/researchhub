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
 const {load}=runtimeDependencies();
 const parseDeploymentScope=load('common/deployment-scope','parseDeploymentScope');
 const resolveAuthCookieName=load('common/deployment-scope','resolveAuthCookieName');
 if(env.DEPLOYMENT_PRODUCT!=='researchhub')invalid('DEPLOYMENT_PRODUCT');
 const scope=parseDeploymentScope(env),cookieName=resolveAuthCookieName(scope,env);
 if(scope.enabledWorkerKinds.length)invalid('ENABLED_WORKER_KINDS');
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
 return Object.freeze({databaseUrl:database,directUrl:direct,jwtSecret:env.JWT_SECRET,scope,cookieName,origin:parsed.origin,secureCookie:env.HUB_AUTH_COOKIE_SECURE==='true',host,port:Number(portValue)});
}
