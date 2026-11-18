// Synthetic acceptance harness only. Never imported by a product runtime.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {longHttpFetch} from './full-study-long-http.mjs';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export const base='http://127.0.0.1:19501',purpose='real-study-full-simulation-2026-11-13';
export const privateDir=workspaceRoot+'.tmp/'+purpose+'/',evidenceDir=workspaceRoot+'researchhub/docs/testing/evidence/'+purpose+'/';
export const key=()=>randomUUID(),sha=value=>createHash('sha256').update(value).digest('hex');
export const json=path=>JSON.parse(readFileSync(path,'utf8'));
export const save=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
export async function openHarness({privateOutputDir=privateDir}={}){
 assert(typeof privateOutputDir==='string'&&privateOutputDir.startsWith(workspaceRoot+'.tmp/')&&privateOutputDir.endsWith('/')&&!privateOutputDir.includes('/../'),'PRIVATE_OUTPUT_DIRECTORY_REQUIRED');
 const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const runtime=json(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json');
 assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
 const command=execFileSync('ps',['-p',String(runtime.pid),'-o','command='],{encoding:'utf8'});
 assert(command.includes('local-knowledge.mjs serve '+runtime.key),'STANDING_RUNTIME_IDENTITY_CHANGED');
 const direct=fn=>withFixtureTransaction(env,'direct',fn),read=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true});
 const state=await read(async tx=>{
  const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runtime.key}`;
  assert.equal(marker?.manifest?.syntheticOnly,true);assert.equal(marker.manifest.ids.tenant,runtime.ids.tenant);
  const actor=await tx.account.findUnique({where:{id:runtime.ids.admin},select:{id:true,tenantId:true,username:true,role:true,status:true,authVersion:true}});
  assert.equal(actor.tenantId,runtime.ids.tenant);assert.equal(actor.status,'active');assert.equal(actor.role,'tenant_admin');
  const feature=await tx.tenantFeatureEntitlement.findUnique({where:{tenantId_featureKey:{tenantId:runtime.ids.tenant,featureKey:'participant_h5'}}});
  assert.equal(feature?.enabled,true,'PARTICIPANT_H5_NOT_ENABLED_STOP_NO_FEATURE_MUTATION');
  return {actor};
 });
 mkdirSync(privateOutputDir,{recursive:true,mode:0o700});
 if(privateOutputDir===privateDir)mkdirSync(evidenceDir,{recursive:true,mode:0o700});
 const network=[];let cookie='';
 async function request(path,{method='GET',body,status=200,h5Cookie,timeoutMs=90000}={}){
  const entry={at:new Date().toISOString(),method,path,status:null,code:null,...(body?.requestKey?{requestKey:body.requestKey}:{})};
  network.push(entry);save(privateOutputDir+'latest-request-ledger.json',network);
  const transport=timeoutMs>300000?longHttpFetch:fetch;
  const started=performance.now(),response=await transport(base+'/api'+path,{method,headers:{Cookie:h5Cookie??cookie,Origin:base,Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(timeoutMs),...(timeoutMs>300000?{timeoutMs}:{})});
  const value=await response.json().catch(()=>null);entry.status=response.status;entry.code=value?.code??null;entry.elapsedMs=Math.round(performance.now()-started);save(privateOutputDir+'latest-request-ledger.json',network);
  assert((Array.isArray(status)?status:[status]).includes(response.status),JSON.stringify({path,status:response.status,code:value?.code}));
  return {value,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 const login=await request('/auth/login',{method:'POST',status:201,body:{tenantSlug:runtime.ids.tenant,username:state.actor.username,password:runtime.password}});cookie=login.cookie;assert(cookie);
 save(privateOutputDir+'admin-session.json',{cookie,at:new Date().toISOString(),runtimeKey:runtime.key});
 const get=async p=>(await request(p)).value,post=async(p,b,status)=>(await request(p,{method:'POST',body:b,status:status??200})).value;
 return {env,runtime,direct,read,network,get,post,request,actor:state.actor,loginActor:async actor=>{const value=await request('/auth/login',{method:'POST',status:201,body:{tenantSlug:runtime.ids.tenant,username:actor.username,password:actor.password}});cookie=value.cookie;assert(cookie);return value.value;}};
}
