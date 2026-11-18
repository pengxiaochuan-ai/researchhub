// Actual resident API, no paid dispatch and no new business rows.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root='/Users/mac/aisciencesys/',out=root+'docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/runtime-preflight-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});const checks=[],contexts=[];let restore;
try{
 const rt=await assetApplicabilityRuntime(),runtime=JSON.parse(readFileSync(rt.dir+'runtime.json')),pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),scopePath=rt.dir+'wp09-scope.json',scopeBytes=readFileSync(scopePath),ledger=readFileSync(rt.dir+'ai-budget-20261022.json');assert.equal(JSON.parse(scopeBytes).paidAiApproved,false);
 const counts=()=>rt.transact(async tx=>({jobs:await tx.knowledgeChatJob.count({where:{tenantId:rt.ids.tenant}}),messages:await tx.message.count({where:{tenantId:rt.ids.tenant}}),versions:await tx.researchArtifactVersion.count({where:{tenantId:rt.ids.tenant}})})),before=await counts();
 const get=async(c,url,status)=>{const r=await c.get(url);assert.equal(r.status(),status,url);return r.json();};
 for(const actor of ['owner','admin']){
  const c=await(pw.request??pw.default.request).newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':rt.ids.group,'X-Research-Project-Id':rt.ids.project}});contexts.push(c);assert.equal((await c.post('/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:actor+'@example.org',password:runtime.password}})).status(),201);
  const recordId=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/create-read-0adaaf7a/'+actor+'.json')).recordId,r=await get(c,'/api/asset-applicability-drafts/'+recordId,200);assert.equal(r.canAi,false);assert.equal(r.ai.status,'not_requested');
  const state='/api/sessions/'+r.executionSessionId+'/knowledge-state';await get(c,state,200);await get(c,'/api/sessions/'+r.executionSessionId+'/knowledge-sources/nonexistent/A1',404);
  assert.equal((await c.post('/api/sessions/'+r.executionSessionId+'/knowledge-messages',{data:{text:'禁止通用聊天',requestKey:'wp09-preflight-'+randomUUID(),kbIds:[r.kbId]}})).status(),403);
  const request={baseVersionNo:r.version,basisHash:r.basisHash,requestKey:'wp09-preflight-fee-'+randomUUID()},reply=await c.post('/api/asset-applicability-drafts/'+r.id+'/jobs',{data:request});assert.equal(reply.status(),403);assert.equal((await reply.json()).code,'APPLICABILITY_AI_NOT_APPROVED');
  for(const family of ['researchPlan','researchDesign','researchExecutionPreparation','researchSyntheticEdc','researchCrfMethods','researchAssetApplicability'])assert.equal((await c.post('/api/asset-applicability-drafts/'+r.id+'/jobs',{data:{...request,[family]:{}}})).status(),400);
  checks.push(actor+'-actual-purpose-state-source-generic-send-F01-and-six-intent-body-boundaries');
  restore=()=>writeFileSync(scopePath,scopeBytes,{mode:0o600});writeFileSync(scopePath,JSON.stringify({...JSON.parse(scopeBytes),operations:['U01','U02','U04']}),{mode:0o600});
  try{await get(c,state,403);await get(c,'/api/sessions/'+r.executionSessionId+'/knowledge-sources/nonexistent/A1',403);const rules=await get(c,'/api/asset-applicability-drafts/'+r.id,200);assert.equal(rules.ai.status,'unavailable');assert.equal(rules.rules.items.length,6);}finally{restore();restore=null;}
  checks.push(actor+'-U03-revocation-hides-purpose-messages-but-preserves-free-rules');
 }
 assert.deepEqual(await counts(),before);assert.deepEqual(readFileSync(scopePath),scopeBytes);assert.deepEqual(readFileSync(rt.dir+'ai-budget-20261022.json'),ledger);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,realHttp:true,jobMessageVersionWrites:0,providerCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:e.message,frames:e.stack?.split('\n').filter(l=>/^\s+at /.test(l)).slice(0,5)},null,2));console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}finally{restore?.();for(const c of contexts)await c.dispose();}
