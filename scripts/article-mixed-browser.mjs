// Read-only real history plus explicitly recorded client-side QA preview.
// The v4 preview is never stored as an assistant message or model execution.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const file=process.argv[2];assert(file?.startsWith('docs/testing/evidence/article-mixed-replay-')&&file.endsWith('/preview.json'));
const preview=JSON.parse(readFileSync(file)),rt=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json')),base='http://127.0.0.1:19501';
const out='docs/testing/evidence/article-mixed-browser-'+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}}),errors=[],writes=[];let historical,passed=false;
try{
 assert((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}})).ok());
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(!['http:','https:'].includes(u.protocol))return route.continue();if(u.origin!==base)return route.abort();if(!['GET','HEAD','OPTIONS'].includes(r.method())&&u.pathname!=='/api/auth/renew'){writes.push(u.pathname);return route.abort();}return route.continue();});
 await page.goto(base+'/pages/ai01/?articleId='+preview.recordId);await page.locator('.hub-agent-answer').last().waitFor();
 historical=await page.locator('.hub-agent-answer').last().innerText();assert(historical.includes('本段没有可交付的原文解释'));await page.screenshot({path:out+'/historical-v3-unchanged.png'});
 let injected=0;
 await page.route('**/api/sessions/'+preview.sessionId+'/knowledge-state?*',async route=>{
  const response=await route.fetch();assert(response.ok());const value=await response.json(),message=value.messages.find(m=>m.id===preview.messageId);
  assert.equal(message?.meta?.sourceStatus,'current','preview requires real currently authorized history');assert.equal(message.meta.provenance.articleEvidence.binding.recordId,preview.recordId);
  // Only rendering is substituted. No fabricated task, provenance or execution.
  message.content=preview.content;injected++;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });
 await page.reload();await page.getByText('本研究为单中心随机对照试验（RCT）。',{exact:true}).waitFor();
 assert(injected>0);await page.screenshot({path:out+'/qa-preview-v4-design.png'});
 const limitation=page.getByText('原文明确局限：所有结局均为主观量表，缺乏客观或生物标志物终点。',{exact:true});await limitation.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/qa-preview-v4-limitations.png'});
 assert.equal(await page.locator('.workspace>.conversationList').count(),1);assert.equal(await page.locator('.workspace>.chat').count(),1);assert.equal(await page.locator('.workspace>.contextRail').count(),1);
 assert.equal(errors.length,0);assert.equal(writes.length,0);passed=true;
}finally{
 await ctx.close();await browser.close();writeFileSync(out+'/result.json',JSON.stringify({passed,at:new Date().toISOString(),testInjection:true,previewSource:file,realHistoricalV3Loaded:!!historical,notNewModelOrPersistedAnswer:true,realProviderCalls:0,businessWrites:writes,errors},null,2));console.log(JSON.stringify({passed,evidence:out}));
}
