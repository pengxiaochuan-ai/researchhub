// Synthetic response injection tests rendering only, never model capability.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-knowledge-local/',runtime=JSON.parse(readFileSync(dir+'runtime.json'));
const source=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-22-researchhub-knowledge-ai/boundary-b8bd94e1/current-answer.json')).meta.provenance.knowledgeSources[0];
const out=root+'docs/test/evidence/2026-10-22-researchhub-knowledge-ai/markdown-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const before=JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length;
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),external=[];
try{
 const base='http://127.0.0.1:19501';
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==base){external.push(r.request().url());return r.abort();}return r.continue();});
 const headers={'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
 assert.equal((await context.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}})).status(),201);
 const page=await context.newPage();
 await page.route('**/api/sessions/*/knowledge-state?*',async route=>{const response=await route.fetch(),state=await response.json();const message=state.messages.filter(m=>m.role==='assistant').at(-1);if(message)message.content='合成渲染安全样例 [1]。\n\n![不应加载的模型图片](https://example.org/researchhub-synthetic-image.png)\n\n[不可信模型链接](https://example.org/untrusted)';await route.fulfill({response,json:state});});
 await page.goto(base+'/pages/k01/');const f=page.frameLocator('iframe[title="知识资料操作区"]');await f.locator('option[value="'+source.kbId+'"]').waitFor({state:'attached'});await f.locator('select').filter({has:f.locator('option[value="'+source.kbId+'"]')}).selectOption(source.kbId);await f.getByRole('button',{name:'科研 Agent',exact:true}).click();await f.getByText('合成渲染安全样例 [1]。',{exact:true}).waitFor();
 assert.equal(await f.locator('.qa-answer img').count(),0,'model images must never create browser loads');assert.equal(await f.locator('.qa-answer a[href]').count(),0);assert.deepEqual(external,[]);assert.equal(JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length,before);
 await page.screenshot({path:out+'safe-render.png'});writeFileSync(out+'result.json',JSON.stringify({passed:true,paidCalls:0,syntheticInjection:true,externalRequests:external,checks:['no-model-images','no-model-active-links','no-browser-external-requests']},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({message:e.message,externalRequests:external,paidCalls:JSON.parse(readFileSync(dir+'ai-budget-20261022.json')).records.length-before},null,2));console.error(e.message);process.exitCode=1;}
finally{await context.close();await browser.close();}
