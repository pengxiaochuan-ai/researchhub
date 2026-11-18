import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out=process.env.RH_AI_EVIDENCE_DIR??'.tmp/ai-first-entry-2026-11-11';assert.match(out,/^\.tmp\/ai-(first-entry|send-status)-2026-11-11$/);mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');await assertFixtureTarget(env);const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const role of ['owner','admin']){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}}),headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  const page=await ctx.newPage(),errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/sessions/'))posts.push(new URL(r.url()).pathname);});
  await page.goto(base+'/pages/ai01/');await page.waitForLoadState('networkidle');const input=page.getByLabel('研究问题',{exact:true});assert.equal(await input.isEnabled(),true);
  await input.fill('解读报告');assert.equal(posts.length,0);await page.screenshot({path:out+'/'+role+'-first-entry.png'});await input.press('Enter');await page.waitForURL('**sessionId=*');
  const sid=new URL(page.url()).searchParams.get('sessionId');assert(sid);await page.locator('.agent-command-label span').filter({hasText:/^(需要补充|已暂停)$/}).waitFor({timeout:20000});
  assert.equal(posts.filter(p=>p==='/api/sessions/hub-source').length,1);assert.equal(posts.filter(p=>p==='/api/sessions/'+sid+'/commands').length,1);
  const stored=await db.session.findUnique({where:{id:sid},include:{messages:{where:{role:'user'},take:2}}});assert.equal(stored.tenantId,ids.tenant);assert.equal(stored.accountId,ids[role]);assert.equal(stored.messages.length,1);assert.equal(stored.messages[0].content,'解读报告');
  assert.equal(await db.knowledgeChatJob.count({where:{sessionId:sid}}),0);assert.equal(await db.usageRecord.count({where:{tenantId:ids.tenant,sessionId:sid}}),0);
  await page.reload();await page.locator('a.conv[href="/pages/ai01/?sessionId='+sid+'"]').filter({hasText:'解读报告'}).waitFor();await page.getByRole('button',{name:'删除',exact:true}).waitFor();
  assert.equal(await input.inputValue(),'');assert.equal(await input.isEnabled(),true);await page.screenshot({path:out+'/'+role+'-refreshed.png'});await page.setViewportSize({width:390,height:844});await page.locator('.composer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-390.png'});
  await page.getByRole('button',{name:'删除',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.agent-command-queue li'));assert.deepEqual(errors,[]);
  results.push({role,sessionId:sid,creates:1,commands:1,newJobs:0,modelCalls:0,pageErrors:errors});
 }finally{await ctx.close();}
}}finally{await browser.close();await db.$disconnect();}
writeFileSync(out+'/real-results.json',JSON.stringify({passed:true,results,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,accounts:2,modelCalls:0}));
