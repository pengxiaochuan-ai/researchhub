import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-knowledge-local/';
const runtime=JSON.parse(readFileSync(dir+'runtime.json')),base='http://127.0.0.1:19501',headers={'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
const out=root+'docs/test/evidence/2026-10-22-researchhub-knowledge-ai/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');const checks=[],contexts=[];
const before=JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length;
try{
 for(const actor of ['owner','admin','viewer','uninvited']){
  const context=await(pw.request??pw.default.request).newContext({baseURL:base,extraHTTPHeaders:headers});contexts.push(context);
  assert.equal((await context.post('/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}})).status(),201);
  const agents=await context.get('/api/agents');assert.equal(agents.status(),['owner','admin'].includes(actor)?200:403);
  if(actor==='owner'){
   const agent=(await agents.json())[0];assert.ok(agent?.id);const created=await context.post('/api/knowledge/bases',{data:{name:'AI免费边界验证（合成空库）',visibility:'private'}});assert.equal(created.status(),201);const kb=await created.json();
   const response=await context.post('/api/sessions/knowledge',{data:{agentId:agent.id,kbId:kb.id,kbName:kb.name}});assert.equal(response.status(),201,await response.text());const session=await response.json();
   const requestKey='empty-'+Date.now();const input={text:'本合成资料说明什么研究限制？',requestKey,kbIds:[kb.id]};
   const sent=await context.post('/api/sessions/'+session.id+'/knowledge-messages',{data:input});assert.equal(sent.status(),201,await sent.text());const job=await sent.json();
   const repeat=await context.post('/api/sessions/'+session.id+'/knowledge-messages',{data:input});assert.equal((await repeat.json()).id,job.id);
   let state;for(let n=0;n<100;n++){state=await(await context.get('/api/sessions/'+session.id+'/knowledge-state')).json();if(state.jobs.some(j=>j.status==='failed'))break;await new Promise(ok=>setTimeout(ok,200));}
   assert.ok(state.jobs.some(j=>j.id===job.id&&j.status==='failed'),JSON.stringify(state.jobs));assert.equal(state.messages.filter(m=>m.role==='user').length,1);assert.equal(state.messages.filter(m=>m.role==='assistant').length,0);
   assert.equal((await context.post('/api/sessions/'+session.id+'/knowledge-messages',{data:{...input,kbIds:['foreign']}})).status(),403);
   checks.push('original-session-queue-idempotency-empty-reviewed-evidence-blocked-no-model');
  }
  checks.push(actor+'-original-chat-permission');
 }
 assert.equal(JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length,before);
 writeFileSync(out+'preflight.json',JSON.stringify({passed:true,checks,paidCalls:0,syntheticOnly:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,paidCalls:0}));
}finally{for(const c of contexts)await c.dispose();}
