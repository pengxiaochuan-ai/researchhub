import test from 'node:test';
import assert from 'node:assert/strict';

const valid = () => ({DATABASE_URL:'postgresql://runtime:opaque@localhost:5432/research',DIRECT_URL:'postgresql://owner:opaque@localhost:5432/research',JWT_SECRET:'a'.repeat(48),DEPLOYMENT_ID:'research-runtime',DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:'tenant-one,tenant-two',DEFAULT_TENANT_ID:'tenant-one',AUTH_COOKIE_NAME:'rh_research_session',HUB_APP_ORIGIN:'http://127.0.0.1:19611',HUB_AUTH_COOKIE_SECURE:'false'});
const config = async env => (await import('./config.mjs')).readResearchRuntimeConfig(env);
test('standard product execution uses business authorization without a named acceptance manifest',async()=>{
 const value=await config({...valid(),HUB_RUNTIME_PROFILE:'full',HUB_DATABASE_NAME:'research',HUB_DATABASE_APP_ROLE:'runtime',HUB_DATABASE_OWNER_ROLE:'owner',HUB_DATABASE_MARKER_SHA256:'a'.repeat(64),HUB_EXECUTION_PROFILE:'standard',HUB_PAID_AI_ENABLED:'true',ENABLED_WORKER_KINDS:'knowledge-chat,knowledge-import'});
 assert.equal(value.executionProfile,'standard');
});

test('reads existing deployment scope and explicit Hub origin without mutating input', async()=>{
 const env=valid(),before={...env},value=await config(env);
 assert.equal(value.scope.product,'researchhub');assert.deepEqual(value.scope.allowedTenantIds,['tenant-one','tenant-two']);
 assert.equal(value.cookieName,'rh_research_session');assert.equal(value.origin,env.HUB_APP_ORIGIN);
 assert.equal(value.host,'127.0.0.1');assert.equal(value.port,19612);assert.equal(value.secureCookie,false);assert.deepEqual(env,before);
});

test('rejects absent and malformed required fields without exposing values', async()=>{
 for(const key of Object.keys(valid())){
  const env=valid();delete env[key];await assert.rejects(config(env),error=>error.message.includes(key)&&!error.message.includes('opaque'));
 }
 for(const [key,value] of [['DATABASE_URL','mysql://secret-private'],['DIRECT_URL','postgresql://'],['JWT_SECRET','short-private'],['DEPLOYMENT_PRODUCT','aisciencesys'],['DEFAULT_TENANT_ID','unlisted'],['AUTH_COOKIE_NAME','aisci_session'],['HUB_APP_ORIGIN','https://example.org/path'],['HUB_APP_ORIGIN','http://example.org:3000'],['HUB_APP_ORIGIN','https://user:secret@example.org'],['HUB_AUTH_COOKIE_SECURE','auto'],['HUB_API_PORT','0'],['HUB_API_PORT','65536'],['HUB_API_PORT','12garbage'],['HUB_API_HOST','host/path'],['CONTROL_PLANE_ENABLED','true'],['ENABLED_WORKER_KINDS','knowledge-import'],['OFFICIAL_JOB_KINDS','knowledge-import']]){
  await assert.rejects(config({...valid(),[key]:value}),error=>error.message.includes(key)&&!error.message.includes('secret-private'));
 }
});

test('requires cookie security consistent with configured origin',async()=>{
 await assert.rejects(config({...valid(),HUB_AUTH_COOKIE_SECURE:'true'}),/HUB_AUTH_COOKIE_SECURE/);
 await assert.rejects(config({...valid(),HUB_APP_ORIGIN:'https://hub.example.org'}),/HUB_AUTH_COOKIE_SECURE/);
 const value=await config({...valid(),HUB_APP_ORIGIN:'https://hub.example.org',HUB_AUTH_COOKIE_SECURE:'true',HUB_API_HOST:'0.0.0.0',HUB_API_PORT:'3100'});
 assert.equal(value.secureCookie,true);assert.equal(value.port,3100);
});
