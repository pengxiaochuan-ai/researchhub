import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {agentHistoryTitle} from '../src/agent-history-timeline.js';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-history-timeline-2026-11-11';
mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');await assertFixtureTarget(env);
const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const role of ['owner','admin']){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',recordVideo:{dir:out+'/video'}});
 try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  const existing=await(await ctx.request.get(base+'/api/sessions/hub-source/history?page=1&limit=20',{headers})).json();
  assert(Array.isArray(existing.items));
  for(const row of existing.items){
   const actual=await db.session.findUnique({where:{id:row.id},include:{messages:{where:{role:'user',tenantId:ids.tenant},orderBy:[{createdAt:'asc'},{id:'asc'}],take:1}}});
   assert.equal(actual.accountId,ids[role]);assert.equal(actual.tenantId,ids.tenant);
   const first=actual.messages[0],prompt=first?.meta?.hubCommand?.originalText||first?.content;
   assert.equal(row.title,prompt||actual.title||'新对话');assert.equal(row.hasPrompt,Boolean(prompt));
  }
  const r=await ctx.request.post(base+'/api/sessions/hub-source',{headers,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:crypto.randomUUID()}});assert.equal(r.status(),201);const sid=(await r.json()).id;
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/?sessionId='+sid);await page.waitForLoadState('networkidle');
  const input=page.getByLabel('研究问题',{exact:true});await input.fill('解读报告');await input.press('Enter');
  const link=page.locator('a.conv').filter({has:page.locator('b',{hasText:'解读报告'})}).and(page.locator('[href="/pages/ai01/?sessionId='+sid+'"]'));await link.waitFor();assert.equal(await link.locator('b').innerText(),agentHistoryTitle('解读报告'));
  await page.locator('.agent-command-label span').filter({hasText:/^(需要补充|已暂停)$/}).waitFor({timeout:20000});
  await page.reload();await link.waitFor();assert.equal(await link.locator('xpath=..').getAttribute('aria-label'),'今天');
  const history=await(await ctx.request.get(base+'/api/sessions/hub-source/history?page=1&limit=20',{headers})).json(),row=history.items.find(i=>i.id===sid);assert.equal(row.title,'解读报告');
  const state=await(await ctx.request.get(base+'/api/sessions/'+sid+'/knowledge-state?limit=60',{headers})).json();assert.deepEqual(state.jobs,[]);
  const me=await db.session.findUnique({where:{id:sid},include:{messages:{where:{role:'user'},take:1}}});assert.equal(row.updatedAt,me.updatedAt.toISOString());assert.equal(me.updatedAt.getTime(),me.messages[0].createdAt.getTime());
  await page.screenshot({path:out+'/'+role+'-real-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/'+role+'-real-390.png'});
  // Cancel only this new, never-dispatched clarification through its real UI.
  await page.getByRole('button',{name:'删除',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.agent-command-queue li'));
  assert.deepEqual(errors,[]);results.push({role,sessionId:sid,existingTitlesVerified:existing.items.length,newJobs:0,pageErrors:errors});
 }finally{await ctx.close();}
}}finally{await browser.close();await db.$disconnect();}
writeFileSync(out+'/real-results.json',JSON.stringify({passed:true,results,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,accounts:2,modelCalls:0}));
