import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readAssetDetailProtectedSnapshot} from './research-assets-detail-schema.mjs';
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q02/',import.meta.url).pathname;
async function main(){
 assert.deepEqual(process.argv.slice(2),['--verify'],'EXPLICIT_A02_HTTP_VERIFY_REQUIRED');
 const root=fileURLToPath(new URL('../../',import.meta.url)),{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const fixtures=JSON.parse(readFileSync(out+'fixtures.json'));assert.equal(fixtures.baseAssets,10);
 const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),origin='http://127.0.0.1:19501',checks=[],sessions=[];
 const snapshot=()=>withFixtureTransaction(env,'direct',tx=>readAssetDetailProtectedSnapshot(tx,ids),{readOnly:true}),before=await snapshot();
 try{
  for(const actor of ['owner','admin']){
   const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password})});assert.equal(login.status,201);
   const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join(';'),me=await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}});assert.equal(me.status,200);const user=await me.json();assert.equal(user.accountId,ids[actor]);sessions.push({actor,cookie});
   const headers={Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'asset-catalog-v1','X-ResearchHub-Actor':user.accountId,'X-ResearchHub-Auth-Version':String(user.authVersion),'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
   async function request(path,body,extra={}){const r=await fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...headers,...extra},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return{status:r.status,value:await r.json()};}
   for(const row of fixtures.results.filter(x=>x.actor===actor)){
    const a=await request('/research-assets/'+row.id+'/versions/2/compare?withVersion=1');assert.equal(a.status,200);assert.equal(a.value.text.changed,true);assert(a.value.text.added.some(x=>x.includes('结局操作定义')));
    const b=await request('/research-assets/'+row.id+'/versions/2/activity');assert.equal(b.status,200);assert(b.value.items.some(x=>x.type==='revised'));assert(!JSON.stringify(b.value).includes('request_hash'));checks.push({actor,kind:row.kind,compare:200,activity:200});
   }
   if(actor==='owner'){
    const row=fixtures.results.find(x=>x.actor==='owner'&&x.kind==='protocol'),path='/research-assets/'+row.id+'/versions/2/tags';
    const inputs=[{baseVersion:2,expectedRevision:2,tags:['并发核对甲'],requestKey:'a02-q02-race-owner-one'},{baseVersion:2,expectedRevision:2,tags:['并发核对乙'],requestKey:'a02-q02-race-owner-two'}];
    const race=await Promise.all(inputs.map(v=>request(path,v)));assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);const winner=race.findIndex(x=>x.status===201);assert.equal(race[winner].value.version,3);
    assert.equal((await request(path,inputs[winner])).status,201);assert.equal((await request(path,{...inputs[winner],tags:['改变同键输入']})).status,409);
    const foreign=fixtures.results.find(x=>x.actor==='admin'&&x.kind==='dataset');assert.equal((await request('/research-assets/'+foreign.id+'/versions/2/compare?withVersion=1')).status,404);
    assert.equal((await request('/research-assets/'+foreign.id+'/versions/2/tags',{baseVersion:2,expectedRevision:2,tags:[],requestKey:'a02-q02-forbidden-other'})).status,403);
    assert.equal((await request(path,{...inputs[0],requestKey:'a02-q02-wrong-actor'},{'X-ResearchHub-Actor':ids.admin})).status,409);
    assert.equal((await request(path,{...inputs[0],requestKey:'a02-q02-old-token'},{'X-ResearchHub-Auth-Version':String(user.authVersion-1)})).status,409);
    assert.equal((await request(path,{...inputs[0],baseVersion:1,requestKey:'a02-q02-path-body'})).status,400);
    assert.equal((await request('/research-assets/'+row.id+'/versions/2/compare?withVersion=1&withVersion=2')).status,400);
    checks.push({actor,concurrentOneCommit:true,idempotentReplay:true,sameKeyChangedRejected:true,otherPrivateRejected:true,staleIdentityRejected:true});
   }
  }
  const rls=await withFixtureTransaction(env,'app',async tx=>{await bindCatalogContext(tx,ids,ids.owner);const rows=await tx.$queryRawUnsafe("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,has_table_privilege(current_user,c.oid,'DELETE') AS can_delete FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_asset' AND c.relname IN ('asset_comment_event','asset_reuse_record') ORDER BY c.relname");assert.equal(rows.length,2);assert(rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity&&!x.can_update&&!x.can_delete));await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id','not-granted',true)");const [r]=await tx.$queryRawUnsafe('SELECT (SELECT count(*) FROM rh_asset.asset_registry)::int AS registry,(SELECT count(*) FROM rh_asset.asset_comment_event)::int AS comments,(SELECT count(*) FROM rh_asset.asset_reuse_record)::int AS reuse');assert.deepEqual(r,{registry:0,comments:0,reuse:0});return{newTablesForcedRls:true,noUpdateDeleteGrants:true,foreignContextEmpty:true};},{readOnly:true});
  const after=await snapshot();assert.deepEqual(after,before);writeFileSync(out+'http.json',JSON.stringify({passed:true,at:new Date().toISOString(),ownedPid:runtime.pid,checks,rls,oldProtectedUnchanged:true,newSuccessfulTagOperations:1,paidCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,newSuccessfulTagOperations:1,oldProtectedUnchanged:true}));
 }finally{for(const s of sessions)await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:s.cookie,Origin:origin,'X-ResearchHub-Request':'session-v1'}});}
}
main().catch(e=>{writeFileSync(out+'http-failure.json',JSON.stringify({passed:false,code:e.code??e.name,message:String(e.message).trim().slice(0,1200)},null,2));process.stderr.write('A02_HTTP_FAILED; inspect evidence\n');process.exitCode=1;});
