// Negative/replay HTTP probes only. Guard receipts and final protection prove no successful new event.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
const origin='http://127.0.0.1:19501',r=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url).pathname;
const create=JSON.parse(readFileSync(out+'live-create.json')).posts[0].body,checks=[];
async function session(actor){
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password})});assert.equal(login.status,201);
 const Cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join(';'),user=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
 const headers={Cookie,Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'asset-catalog-v1','X-ResearchHub-Actor':user.accountId,'X-ResearchHub-Auth-Version':String(user.authVersion),'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':c.projectId};
 return{async call(name,path,expected,body,overrides={}){const res=await fetch(origin+'/api/research-assets/'+path,{method:body===undefined?'GET':'POST',headers:{...headers,...overrides},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)}),value=await res.json();checks.push({actor,name,status:res.status,code:value.code});assert.equal(res.status,expected,name+': '+JSON.stringify(value));return value;},async close(){await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie,Origin:origin,'X-ResearchHub-Request':'session-v1','Content-Type':'application/json'},body:'{}'});}};
}
let admin,owner;
try{
 admin=await session('admin');owner=await session('owner');
 await owner.call('other actor cannot read source','report-context-source',403);
 await owner.call('other actor cannot read asset','catalog/'+c.assetId+'/versions/2',403);
 await admin.call('wrong source project denied','report-context-source',403,undefined,{'X-Research-Project-Id':r.ids.project});
 await admin.call('missing origin prevents writes','report-context-registrations',403,create,{Origin:'http://invalid.local'});
 const replay=await admin.call('same key replays original receipt','report-context-registrations',201,create);assert.equal(replay.assetId,c.assetId);assert.equal(replay.version,1);
 await admin.call('same key changed input conflicts','report-context-registrations',409,{...create,purpose:create.purpose+' changed'});
 await admin.call('third content version denied','report-context-revisions',409,{...create,requestKey:'context-negative-third-20261116',baseVersion:2,expectedRevision:6});
 await admin.call('generic registration unavailable in this project','',403,{});
 await admin.call('generic version route unavailable',c.assetId+'/versions',403,{});
 const options=await admin.call('current governance has no release',c.assetId+'/governance?version=2',200);assert(!JSON.stringify(options.actions??options.allowedActions).includes('release'));
 // Valid-looking complete command cannot extend this private-only family to publishing.
 const sealed=JSON.parse(readFileSync(out+'live-approve.json')).posts.find(x=>x.path.endsWith('/reviews')).body;
 await admin.call('release explicitly denied',c.assetId+'/releases',403,{action:'release',version:2,expectedRevision:6,requestKey:'context-negative-release-20261116',contentHash:sealed.contentHash,policyHash:sealed.policyHash,identityRevision:sealed.identityRevision,reason:'negative probe only',discoveryRecipients:[r.ids.owner],ttlDays:1});
 writeFileSync(out+'negative-http.json',JSON.stringify({at:new Date().toISOString(),checks,successfulNewEvents:0,passed:true},null,2));console.log('REPORT_CONTEXT_NEGATIVE_HTTP_PASSED');
}catch(e){writeFileSync(out+'negative-http-failure.json',JSON.stringify({checks,failure:e.message},null,2));throw e;}finally{await admin?.close();await owner?.close();}
