// Read-only real Chrome check of the newly named WP09 AI acceptance record.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',privateDir=root+'.tmp/researchhub-wp09-asset-applicability/',registry=JSON.parse(readFileSync(privateDir+'ai-live-acceptance-admin-fixture.json','utf8')),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
assert.equal(registry.scenario,'acceptance-admin-fixture');assert.equal(registry.status,'completed');assert(registry.recordId&&registry.jobId);
const out=root+'docs/test/evidence/2026-10-28-researchhub-wp09-acceptance/browser-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),checks=[],errors=[],network=[];
const headers={'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project},url=base+'/pages/a02/?'+new URLSearchParams({assetApplicability:'1',studyGroupId:runtime.ids.group,researchProjectId:runtime.ids.project,applicabilityId:registry.recordId});
try{
 for(const actor of ['admin','owner']){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+actor+'-video',size:{width:1440,height:900}}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push({actor,error:e.message}));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({actor,path,status:r.status()});});
  await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();if(req.method()==='POST'&&(/\/jobs$|\/knowledge-messages$/.test(u.pathname)))return route.abort();return route.continue();});
  try{
   const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(login.status(),201);
   const detail=await context.request.get(base+'/api/asset-applicability-drafts/'+registry.recordId,{headers});
   if(actor==='admin'){
    assert.equal(detail.status(),200);const record=await detail.json();assert.equal(record.ai?.status,'current');assert.equal(record.ai?.result?.resultMessageId!==undefined,true);assert(record.ai.result.items.length>0);
    await page.goto(url);await page.getByRole('heading',{name:'本人资产复用条件核对',exact:true}).waitFor();await page.getByRole('heading',{name:'AI定性核对草稿',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{level:1}).count(),1);
    const font=await page.locator('.applicability-ai-reading p').first().evaluate(el=>({size:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight}));assert.deepEqual(font,{size:'16px',line:'28px'});checks.push('admin-new-real-ai-result-16px-28px');
    await page.getByRole('button',{name:/核对来源 \[/}).first().click();await page.getByRole('region',{name:'当前引用来源'}).waitFor();checks.push('admin-cited-reviewed-source');
    for(const width of [1440,390]){await page.setViewportSize({width,height:900});if(width<700)await page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'admin-'+width+'.png',animations:'disabled'});await page.getByRole('heading',{name:'AI定性核对草稿',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'admin-ai-'+width+'.png',animations:'disabled'});checks.push('admin-no-overflow-'+width);}
   }else{
    assert([403,404].includes(detail.status()));await page.goto(url);await page.waitForLoadState('networkidle');assert.equal(await page.getByRole('region',{name:'本人资产核对内容',exact:true}).count(),0);await page.screenshot({path:out+'owner-denied.png'});checks.push('owner-real-browser-private-record-denied');
   }
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,errors,network,recordId:registry.recordId,jobId:registry.jobId,modelCalls:0,professionalAcceptance:false},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,error:e.message,checks,errors,network},null,2));console.error(JSON.stringify({passed:false,error:e.message,evidence:out}));process.exitCode=1;}finally{await browser.close();}
