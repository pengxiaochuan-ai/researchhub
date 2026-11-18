// One deliberate new browser question. Never replays or rewrites the old failure.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:19501',rt=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json'));
const out='docs/testing/evidence/ai01-agent-live-'+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}}),writes=[],errors=[];
let evidence={passed:false,at:new Date().toISOString(),newQuestion:true,oldFailureRetried:false};
try{
 const login=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}});assert(login.ok());
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(!['http:','https:'].includes(u.protocol))return route.continue();if(u.origin!==base)return route.abort();if(!['GET','HEAD','OPTIONS'].includes(r.method())&&u.pathname!=='/api/auth/renew'){
  assert.match(u.pathname,/^\/api\/sessions\/[A-Za-z0-9_-]+\/knowledge-messages$/);writes.push(u.pathname);assert.equal(writes.length,1,'NO_AUTOMATIC_RETRY');
 }return route.continue();});
 await page.goto(base+'/pages/ai01/?articleId=pmc-PMC13539995');
 await page.waitForFunction(()=>!document.querySelector('#article-ai-question')?.disabled&&document.querySelector('#article-ai-question'));
 const question='请仅依据这篇原文选段概括研究设计与主要局限，区分原文发现和研究者需进一步核对的问题，不新增计算。';
 await page.locator('#article-ai-question').fill(question);
 const submitted=page.waitForResponse(r=>r.url().includes('/knowledge-messages')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'发送本篇问题',exact:true}).click();const response=await submitted;assert(response.ok());const task=await response.json();evidence.taskId=task.id;
 // Polling is read-only and is not another model submission.
 const deadline=Date.now()+100000;let completed=false;
 while(Date.now()<deadline){const state=await page.locator('.thread').innerText();if(state.includes('本次解读已完成')){completed=true;break;}if(state.includes(task.id)&&state.includes('本次未交付解读'))break;await page.waitForTimeout(1000);}
 await page.screenshot({path:out+'/delivered.png'});evidence={...evidence,passed:completed,taskId:task.id,recoveryUrl:page.url(),question,writes,errors,answerText:await page.locator('.hub-agent-answer').last().innerText().catch(()=>''),normalBusinessQuota:true};
 assert(completed,'NEW_TASK_NOT_DELIVERED');assert.equal(errors.length,0);assert.equal(writes.length,1);
 await page.reload();await page.waitForFunction(()=>document.querySelector('.thread')?.textContent.includes('本次解读已完成'));await page.screenshot({path:out+'/restored.png'});evidence.refreshRestored=true;
}finally{await ctx.close();await browser.close();writeFileSync(out+'/result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:evidence.passed,taskId:evidence.taskId,evidence:out}));}
