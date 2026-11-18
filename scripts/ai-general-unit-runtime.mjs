// This harness is confined to the explicitly approved synthetic target.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export const root='/Users/mac/aisciencesys/',dir=root+'researchhub/.tmp/ai-file-data-2026-11-12/general-unit/',configFile=root+'researchhub/.tmp/ai-file-data-2026-11-12/general-unit-authorized-scope.json';
export const json=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2),{mode:0o600});
export async function openGeneralUnitHarness(){
 const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const runtime=json(root+'.tmp/researchhub-knowledge-local/runtime.json');assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
 assert(execFileSync('ps',['-p',String(runtime.pid),'-o','command='],{encoding:'utf8'}).includes('local-knowledge.mjs serve '+runtime.key));
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k];
 mkdirSync(dir,{recursive:true,mode:0o700});const network=existsSync(dir+'network.json')?json(dir+'network.json'):[];let cookie='';const base='http://127.0.0.1:19501';
 async function request(path,{method='GET',body,status=200}={}){
  assert(/^\/(auth\/(login|me)|research-projects(?:\/|$)|research-studies(?:\/|$))/.test(path));
  const entry={method,path,status:null,requestKey:body?.requestKey};network.push(entry);save(dir+'network.json',network);
  const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,Origin:base,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'}),v=await r.json();entry.status=r.status;save(dir+'network.json',network);assert.equal(r.status,status,JSON.stringify({path,status:r.status,code:v?.code}));if(path==='/auth/login'){cookie=r.headers.get('set-cookie')?.split(';')[0];assert(cookie);}return v;
 }
 async function login(actor){await request('/auth/login',{method:'POST',status:201,body:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});const me=await request('/auth/me');return me;}
 return{env,runtime,ids:runtime.ids,require,load,network,request,login,read:fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true}),app:fn=>withFixtureTransaction(env,'app',fn),direct:fn=>withFixtureTransaction(env,'direct',fn)};
}
