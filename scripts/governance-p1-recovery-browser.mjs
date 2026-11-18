import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {stageBatch} from '../server/hub-sources/staging-repository.mjs';
import {retrieveForAi} from '../server/hub-sources/visible-repository.mjs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',marker='p1-recovery-'+randomUUID().slice(0,8);
const out=root+'researchhub/docs/testing/evidence/'+marker+'/';mkdirSync(out+'video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const admin=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}}),owner=await browser.newContext(),anonymous=await browser.newContext();
const result={marker,checks:[],errors:[],network:[],posts:[]};let fixture,page,baseline;
const scope={tenantId:ids.tenant,hubKey:'lingshu-xinyu'};
const queue=async()=>{const r=await admin.request.get(base+'/api/hub-sources/review-queue');assert.equal(r.status(),200);return(await r.json()).items;};
const range=()=>page.getByLabel('本次可见范围',{exact:true}),confirm=()=>page.getByRole('button',{name:'确认保存',exact:true});
const ready=async()=>{await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});await range().waitFor();};
async function open(item){await page.goto(base+'/pages/g02/?'+new URLSearchParams({view:'source-review',reviewKey:item.key}));await ready();await page.getByLabel('搜索题名或编号').fill(marker);}
async function visible(ctx,id,member=false){return(await ctx.request.get(base+'/api/hub-sources/'+(member?'member/':'')+'publications/'+id)).status();}
async function aiRows(){return withFixtureTransaction(env,'app',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;const a=await db.account.findFirst({where:{id:ids.owner},select:{authVersion:true}});return retrieveForAi({db,...scope,principal:{tenantId:ids.tenant,accountId:ids.owner,authVersion:a.authVersion},query:marker});});}
try{
 for(const [ctx,username]of[[admin,'admin@example.org'],[owner,'owner@example.org']])assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username,password}})).status(),201);
 baseline=await queue();writeFileSync(out+'original-queue.json',JSON.stringify(baseline,null,2));
 const rows=[{rowNumber:2,sourceName:marker+' 来源A',title:marker+' 合成研究A',raw:{'Summary-摘要':marker+' 合成摘要A'},errors:[]},{rowNumber:3,sourceName:marker+' 来源A',title:null,raw:{},errors:['缺题名']},{rowNumber:4,sourceName:marker+' 来源B',title:marker+' 合成研究B',raw:{'Summary-摘要':marker+' 合成摘要B'},errors:[]}].map(r=>({...r,rowSha256:hash(r)}));
 const preview={filePath:marker+'.json',sheetName:'P1原操作恢复合成验收',mapperVersion:'p1-recovery-v1',sourceKey:marker,rows};
 const snapshot=JSON.stringify(preview);writeFileSync(out+'synthetic-source.json',snapshot);preview.fileSha256=createHash('sha256').update(snapshot).digest('hex');
 fixture=await withFixtureTransaction(env,'direct',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;const batch=await stageBatch({db,...scope,preview,source:{createdBy:ids.admin,snapshotPath:out+'synthetic-source.json',snapshotSha256:preview.fileSha256}});return{...batch,rows:await db.$queryRaw`SELECT id,row_number AS number,title FROM rh_source.source_record WHERE batch_id=${batch.batchId} ORDER BY row_number`};});
 result.fixture=fixture;writeFileSync(out+'fixture.json',JSON.stringify(fixture,null,2));
 const items=(await queue()).filter(x=>x.detail?.batchId===fixture.batchId),a=items.find(x=>x.title.endsWith('来源A')),b=items.find(x=>x.title.endsWith('来源B'));assert(a&&b);
 assert.equal(await visible(anonymous,fixture.rows[0].id),404);assert.equal((await aiRows()).length,0);
 page=await admin.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>result.errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/hub-sources/object-reviews'&&r.method()==='POST')result.posts.push(r.postDataJSON());});
 page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/hub-sources/'))result.network.push({path,status:r.status(),method:r.request().method()});});
 await open(a);await page.screenshot({path:out+'before.png'});
 await page.route('**/api/hub-sources/object-reviews',async route=>{const committed=await route.fetch();assert.equal(committed.status(),201);await route.abort('connectionreset');},{times:1});
 await range().selectOption('public');await confirm().click();await page.getByRole('alert').filter({hasText:'保存结果尚未确认'}).waitFor();assert.equal(result.posts.length,1);assert(await confirm().isDisabled());
 await page.screenshot({path:out+'lost-response.png'});await page.reload();
 await page.getByRole('status').filter({hasText:'上次审核保存成功'}).waitFor();await ready();assert.equal(result.posts.length,1);
 const receiptA=await admin.request.get(base+'/api/hub-sources/review-receipts/'+result.posts[0].operationId);assert.equal(receiptA.status(),200);
 assert.equal((await receiptA.json()).receipt.input.operationId,result.posts[0].operationId);
 assert.equal(await visible(anonymous,fixture.rows[0].id),200);assert.equal((await aiRows()).length,1);
 result.checks.push('real POST201 committed then transport response dropped; refresh resolves exact receipt with no second POST; public page and AI retrieval use reviewed row only');
 await page.screenshot({path:out+'recovered.png'});
 await open(b);await page.route('**/api/hub-sources/object-reviews',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'合成连接故障'})}),{times:1});
 await range().selectOption('tenant');await confirm().click();await page.getByRole('alert').filter({hasText:'保存结果尚未确认'}).waitFor();const attempted=result.posts.at(-1);
 await page.getByRole('button',{name:'重新核对',exact:true}).click();await page.getByRole('button',{name:'重试上次保存',exact:true}).waitFor();assert(await confirm().isDisabled());
 await page.getByRole('complementary',{name:'来源审核队列'}).getByRole('button',{name:new RegExp(marker+' 来源A')}).click();
 await page.getByRole('alert').filter({hasText:marker+' 来源B'}).waitFor();
 await page.getByRole('button',{name:'重试上次保存',exact:true}).click();await page.getByRole('status').filter({hasText:'已保存为'}).waitFor();assert.deepEqual(result.posts.at(-1),attempted);
 assert.equal(await visible(anonymous,fixture.rows[2].id),404);assert.equal(await visible(owner,fixture.rows[2].id,true),200);assert.equal((await aiRows()).length,2);
 result.checks.push('503 without server write stays unknown; exact receipt404 allows one explicit original-key/original-content retry; tenant page/AI stay tenant scoped');
 await open(b);await range().selectOption('public');
 const current=(await queue()).find(x=>x.key===b.key);const conflict=await admin.request.post(base+'/api/hub-sources/object-reviews',{headers:{Origin:base},data:{kind:'workbook',batchId:fixture.batchId,sourceRegistryId:b.detail.sourceRegistryId,expectedFingerprint:current.fingerprint,operationId:randomUUID(),visibility:'withheld'}});assert.equal(conflict.status(),201);
 await confirm().click();await page.getByRole('alert').filter({hasText:'内容或审核状态已变化'}).waitFor();await ready();assert.equal(await range().inputValue(),'withheld');
 result.checks.push('real competing decision causes409; current scope reread, no automatic overwrite');
 assert.equal((await owner.request.get(base+'/api/hub-sources/review-receipts/'+attempted.operationId)).status(),403);assert.equal((await anonymous.request.get(base+'/api/hub-sources/review-receipts/'+attempted.operationId)).status(),401);
 for(const width of[1440,1366,1920,390,320]){await page.setViewportSize({width,height:900});if(!await range().isVisible())await page.getByRole('complementary',{name:'来源审核队列'}).getByRole('button',{name:new RegExp(marker+' 来源B')}).click();await range().scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'layout-'+width+'.png'});}
 assert.equal(await visible(owner,fixture.rows[1].id,true),404);assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1;await page?.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{
 try{if(fixture){for(const item of(await queue()).filter(x=>x.detail?.batchId===fixture.batchId&&x.state.status!=='withheld')){const r=await admin.request.post(base+'/api/hub-sources/object-reviews',{headers:{Origin:base},data:{kind:'workbook',batchId:fixture.batchId,sourceRegistryId:item.detail.sourceRegistryId,expectedFingerprint:item.fingerprint,operationId:randomUUID(),visibility:'withheld'}});assert.equal(r.status(),201);}const current=new Map((await queue()).map(x=>[x.key,x]));for(const old of baseline)assert.equal(hash(current.get(old.key)),hash(old),'pre-existing source changed: '+old.key);result.originalUnchanged=true;}}
 catch(e){result.passed=false;result.cleanupFailure=e.message;process.exitCode=1;}
 await admin.close();await owner.close();await anonymous.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,failure:result.failure,cleanupFailure:result.cleanupFailure,checks:result.checks.length,posts:result.posts.length,evidence:out,originalUnchanged:result.originalUnchanged}));
}
