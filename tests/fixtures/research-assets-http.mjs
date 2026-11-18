// Real localhost HTTP contract checks, existing two synthetic accounts only. Never logs credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const fixtures=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(fixtures.fixtureCount,10);assert.equal(fixtures.syntheticOnly,true);
const origin='http://127.0.0.1:19501',scope={'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
const call=(path,init={})=>fetch(origin+'/api'+path,{redirect:'error',signal:AbortSignal.timeout(15000),...init,headers:{Accept:'application/json',Origin:origin,...scope,...init.headers}});
const checks=[];
for(const actor of ['owner','admin']){
 const login=await call('/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password})});
 assert.equal(login.status,201);const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join(';');assert(cookie);
 const own=fixtures.items.filter(i=>i.actor===actor),other=fixtures.items.filter(i=>i.actor!==actor);
 for(const item of own)for(const suffix of ['', '/versions/1']){
  const response=await call('/research-assets/'+item.id+suffix,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const value=await response.json();assert.equal(value.ownerAccountId,runtime.ids[actor]);assert.equal(value.kind,item.kind);assert.equal(value.version,suffix?1:2);assert.equal(value.currentVersion,2);assert.equal(value.isHistorical,Boolean(suffix));assert.equal(value.status,'draft');assert.equal(value.readOnly,true);assert.equal(value.source.kind,'author_declared_synthetic');
  assert.equal(value.title,suffix?item.title.replace(/ · 说明修订$/,' · 初稿'):item.title);assert.equal(value.versions.length,2);assert.equal('idempotencyKey' in value,false);
  checks.push({actor,kind:item.kind,version:value.version,status:response.status});
 }
 for(const item of other){const denied=await call('/research-assets/'+item.id,{headers:{Cookie:cookie}});assert.equal(denied.status,404);assert.equal((await denied.json()).code,'RESEARCH_ASSET_NOT_FOUND');}
 for(const [path,status]of [['/research-assets/unknown-asset',404],['/research-assets/'+own[0].id+'/versions/3',404],['/research-assets/'+own[0].id+'/versions/01',400],['/research-assets/'+own[0].id+'?owner=foreign',400]])assert.equal((await call(path,{headers:{Cookie:cookie}})).status,status);
 assert.equal((await call('/research-assets/'+own[0].id,{headers:{Cookie:cookie,'X-Research-Project-Id':'foreign-study'}})).status,403);
 const overview=await call('/my-research/overview',{headers:{Cookie:cookie}});assert.equal(overview.status,200);const p01=await overview.json(),assetIds=new Set(fixtures.items.map(i=>i.id));assert(p01.drafts.every(d=>!assetIds.has(d.id)));assert(p01.activity.every(d=>!assetIds.has(d.id)));
 checks.push({actor,crossOwnerDenied:5,invalidReadsDenied:4,foreignStudyDenied:true,p01DraftCount:p01.summary.ownDraftCount});
 const logout=await call('/auth/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:'{}'});assert.equal(logout.status,200);
 assert.equal((await call('/research-assets/'+own[0].id,{headers:{Cookie:cookie}})).status,401);
}
assert.equal((await call('/research-assets/'+fixtures.items[0].id)).status,401);
console.log(JSON.stringify({realHttp:true,syntheticOnly:true,checks,modelCalls:0,permissionChanges:0},null,2));
