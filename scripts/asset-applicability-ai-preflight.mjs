// No paid approval: actual API must reject BEFORE job/message/version or provider work.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';import {createAssetApplicability} from './local-asset-applicability.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/ai-preflight-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});const checks=[];
try{
 const rt=await assetApplicabilityRuntime(),scope=rt.dir+'wp09-scope.json',api=createAssetApplicability({...rt,assets:rt.assets,storage:{},scope});assert.equal(typeof api.run,'function','paid gate producer missing');
 const pw=await import(rt.root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,runtime=JSON.parse(readFileSync(rt.dir+'runtime.json')),records=JSON.parse(readFileSync(rt.root+'docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/create-read-0adaaf7a/owner.json'));
 const u=rt.users.owner,r=await api.read(u,records.recordId),before=await rt.transact(async tx=>({jobs:await tx.knowledgeChatJob.count({where:{tenantId:u.tenantId}}),messages:await tx.message.count({where:{tenantId:u.tenantId}}),versions:await tx.researchArtifactVersion.count({where:{artifactId:r.id}})}));assert.equal(r.sourceStatus,'current');assert.equal(JSON.parse(readFileSync(scope)).paidAiApproved,false);
 const c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':u.studyGroupId,'X-Research-Project-Id':u.researchProjectId}});
 try{
  assert.equal((await c.post('/api/auth/login',{data:{tenantSlug:u.tenantId,username:'owner@example.org',password:runtime.password}})).status(),201);
  const body={baseVersionNo:r.version,basisHash:r.basisHash,requestKey:'wp09-preflight-'+randomUUID()},url='/api/asset-applicability-drafts/'+r.id+'/jobs',response=await c.post(url,{data:body});assert.equal(response.status(),403);assert.equal((await response.json()).code,'APPLICABILITY_AI_NOT_APPROVED');checks.push('actual-new-purpose-paid-gate403-no-job');
  for(const suffix of ['knowledge-state','knowledge-sources/nonexistent/1'])assert.equal((await c.get('/api/sessions/'+r.executionSessionId+'/'+suffix)).status(),403);checks.push('generic-state-and-source-remain-closed-before-K05-message-projection');
 }finally{await c.dispose();}
 const after=await rt.transact(async tx=>({jobs:await tx.knowledgeChatJob.count({where:{tenantId:u.tenantId}}),messages:await tx.message.count({where:{tenantId:u.tenantId}}),versions:await tx.researchArtifactVersion.count({where:{artifactId:r.id}})}));assert.deepEqual(after,before);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,realHttp:true,modelCalls:0,jobMessageVersionWrites:0,fullQueueAdapterNotYetVerified:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){const v={passed:false,error:e.message?.includes('producer missing')?e.message:e.getResponse?.()?.code??e.code??e.name,frames:e.stack?.split('\n').filter(l=>/^\s+at /.test(l)).slice(0,6)};writeFileSync(out+'failure.json',JSON.stringify(v,null,2));console.error(JSON.stringify({...v,evidence:out}));process.exitCode=1;}
