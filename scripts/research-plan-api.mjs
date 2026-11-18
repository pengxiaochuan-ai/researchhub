// Free API integration: never enqueue a valid model job.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-knowledge-local/',r=JSON.parse(readFileSync(dir+'runtime.json')),base='http://127.0.0.1:19501';
const out=root+'docs/test/evidence/2026-10-22-researchhub-research-plan/api-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,contexts=[],checks=[];
const before=JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length;
async function login(actor){const c=await request.newContext({baseURL:base,extraHTTPHeaders:{'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project}});contexts.push(c);assert.equal((await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}})).status(),201);return c;}
try{
 const c=await login('owner'),kbId=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-22-researchhub-knowledge-ai/boundary-b8bd94e1/current-answer.json')).meta.provenance.knowledgeSources[0].kbId;
 const agent=(await(await c.get('/api/agents')).json())[0],session=await(await c.post('/api/sessions/knowledge',{data:{agentId:agent.id,kbId}})).json(),requestKey='free-'+randomUUID();
 const response=await c.post('/api/research-plan-drafts',{data:{sessionId:session.id,requestKey}});assert.equal(response.status(),201,await response.text());const plan=await response.json();assert.equal(plan.stage,'awaiting_pico');assert.ok(plan.sources.length);checks.push('create-real-original-artifact-candidate');
 const repeat=await(await c.post('/api/research-plan-drafts',{data:{sessionId:session.id,requestKey}})).json();assert.equal(repeat.id,plan.id);checks.push('create-idempotent');
 assert.equal((await c.post('/api/research-plan-drafts/'+plan.id+'/jobs',{data:{baseVersionNo:plan.version,stage:'protocol',requestKey:'premature-'+randomUUID()}})).status(),409);checks.push('protocol-requires-confirmation-no-model');
 assert.equal((await c.post('/api/research-plan-drafts/'+plan.id+'/jobs',{data:{baseVersionNo:plan.version,stage:'release',requestKey:'forged-'+randomUUID()}})).status(),400);checks.push('no-release-stage');
 assert.equal((await c.post('/api/research-plan-drafts/'+plan.id+'/pico-confirmations',{data:{baseVersionNo:plan.version,requestKey:'missing-'+randomUUID(),pico:{question:'缺失？',p:'',i:'',c:'',o:''}}})).status(),400);checks.push('incomplete-pico-blocked');
 assert.equal((await c.post('/api/research-plan-drafts',{data:{sessionId:session.id,requestKey:'owner-'+randomUUID(),ownerAccountId:r.ids.admin}})).status(),400);checks.push('forged-owner-rejected');
 const admin=await login('admin');assert.equal((await admin.get('/api/research-plan-drafts/'+plan.id)).status(),403);checks.push('admin-cannot-read-another-account-candidate');
 for(const actor of ['viewer','uninvited']){const other=await login(actor);assert.equal((await other.get('/api/research-plan-drafts/'+plan.id)).status(),403);checks.push(actor+'-denied');}
 assert.equal((await c.get('/api/research-plan-drafts/'+plan.id,{headers:{'X-Research-Project-Id':'foreign'}})).status(),403);checks.push('forged-project-denied');
 for(const path of ['/api/research-artifacts','/api/research-plan-drafts/'+plan.id+'/review','/api/research-plan-drafts/'+plan.id+'/export'])assert.equal((await c.post(path,{data:{}})).status(),404);checks.push('no-generic-artifact-or-review-export-endpoint');
 assert.equal(JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length,before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,paidCalls:0,planId:plan.id},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({message:e.message,checks,paidCalls:JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length-before},null,2));console.error(e.message);process.exitCode=1;}
finally{for(const c of contexts)await c.dispose();}
