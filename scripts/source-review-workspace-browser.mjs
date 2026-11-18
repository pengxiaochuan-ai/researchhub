import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {stageBatch} from '../server/hub-sources/staging-repository.mjs';

assert.equal(process.argv[2],'--mode');assert.equal(process.argv[3],'local-synthetic');
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const {ids}=runtime,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const resume=process.argv[4]==='--resume'?process.argv[5]:null;
if(resume)assert.match(resume,/^review-ux-[a-f0-9]{8}$/);
const marker=resume||'review-ux-'+randomUUID().slice(0,8),out=root+'researchhub/docs/testing/evidence/'+marker+'/';
mkdirSync(out+'video',{recursive:true,mode:0o700});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const checks=[],errors=[],network=[],metrics=[];
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chrome=pw.chromium??pw.default.chromium;
const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let activePage,zoom;
const contexts=[];
async function login(context,actor) {assert.equal((await context.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}})).status(),201);}
async function session(actor,viewport={width:1440,height:900}) {
  const context=await browser.newContext({viewport,recordVideo:{dir:out+'video'}});contexts.push(context);
  if(actor)await login(context,actor);
  const page=await context.newPage();page.setDefaultTimeout(12000);watch(page);return {context,page};
}
function watch(page) {page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{
  if(new URL(r.url()).pathname.startsWith('/api/hub-sources/'))network.push({path:new URL(r.url()).pathname,status:r.status()});
});}
async function queue(context) {const r=await context.request.get(base+'/api/hub-sources/review-queue');assert.equal(r.status(),200);return (await r.json()).items;}
async function opened(page) {await page.goto(base+'/pages/g02/?view=source-review');await page.getByLabel('来源类型',{exact:true}).waitFor();}
async function filter(page,kind='workbook') {await page.getByLabel('处理状态',{exact:true}).selectOption('all');await page.getByLabel('来源类型',{exact:true}).selectOption(kind);await page.getByLabel('搜索题名或编号').fill(kind==='workbook'?marker:'');}
async function selectSource(page,label) {await page.getByRole('complementary',{name:'来源审核队列'}).getByRole('button',{name:new RegExp(label)}).click();
  if(label.includes(marker))await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});}
async function save(page,visibility) {
  const labels={public:'公开页面与AI',tenant:'仅租户内页面与AI',withheld:'暂不放行'};
  await page.getByRole('region',{name:'本次审核决定'}).getByRole('button',{name:labels[visibility],exact:true}).click();
  await page.getByRole('status').filter({hasText:'已保存为'}).waitFor();
  await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
}
async function geometry(page,label) {
  const value=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,document:document.documentElement.scrollWidth,
    root:document.querySelector('.hub-review-workspace')?.getBoundingClientRect().toJSON(),
    detail:document.querySelector('.hub-review-detail')?.getBoundingClientRect().toJSON(),
    fonts:[...document.querySelectorAll('.hub-review-filters input,.hub-review-decision-actions button')].map(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight})),
    reading:[...document.querySelectorAll('.hub-pmc-reading p')].filter(e=>e.getClientRects().length).slice(0,1).map(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}))}));
  assert.ok(value.document<=value.width+1,JSON.stringify(value));
  assert.ok(value.fonts.every(x=>x.size==='14px'&&x.line==='22px'),JSON.stringify(value.fonts));
  if(value.reading.length)assert.deepEqual(value.reading,[{size:'16px',line:'28px'}]);metrics.push({label,...value});
}
try {
  await assertFixtureTarget(env);
  const admin=await session('admin');activePage=admin.page;
  const prior=resume?JSON.parse(readFileSync(out+'fixture.json','utf8')):null;
  const original=(await queue(admin.context)).filter(x=>!prior||x.detail?.batchId!==prior.batchId);const originalHash=hash(original);
  const preview={filePath:marker+'.json',sheetName:'具名合成审核样例',mapperVersion:'synthetic-review-v1',sourceKey:marker,
    rows:[{rowNumber:2,sourceName:marker+' 来源A',title:marker+' 合成针灸研究A',raw:{'Summary-摘要':marker+' 合成摘要A，仅供审核路径技术测试'},errors:[]},
      {rowNumber:3,sourceName:marker+' 来源A',title:marker+' 合成针灸研究B',raw:{},errors:[]},
      {rowNumber:4,sourceName:marker+' 来源A',title:null,raw:{},errors:['TITLE_MISSING']},
      {rowNumber:5,sourceName:marker+' 来源B',title:marker+' 合成针灸研究C',raw:{},errors:[]}].map(x=>({...x,rowSha256:hash(x)}))};
  const snapshot=JSON.stringify(preview,null,2);writeFileSync(out+'synthetic-source.json',snapshot);preview.fileSha256=createHash('sha256').update(snapshot).digest('hex');
  const fixture=prior||await withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    const staged=await stageBatch({db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',preview,
      source:{createdBy:ids.admin,snapshotPath:out+'synthetic-source.json',snapshotSha256:preview.fileSha256}});
    const rows=await db.$queryRaw`SELECT id,title,source_registry_id AS "sourceRegistryId" FROM rh_source.source_record WHERE batch_id=${staged.batchId} ORDER BY row_number`;
    return {...staged,rows};
  });
  writeFileSync(out+'fixture.json',JSON.stringify({marker,...fixture},null,2));
  await admin.page.goto(base+'/pages/g02/');await admin.page.locator('.g02-stat').first().waitFor();
  assert.deepEqual(await admin.page.locator('.g02-stat strong').allTextContents(),Array(6).fill('—'));
  await admin.page.getByRole('navigation',{name:'管理与治理上下文导航'}).getByRole('button',{name:'数据治理',exact:true}).click();
  await admin.page.getByLabel('来源类型',{exact:true}).waitFor();
  assert.equal(await admin.page.getByLabel('选择候选文章').count(),0);
  await filter(admin.page,'pmc');assert.equal(await admin.page.locator('.hub-review-queue li').count(),20);
  await selectSource(admin.page,'PMC13691533');await admin.page.locator('.hub-pmc-reading').first().waitFor();
  assert.equal(await admin.page.getByRole('region',{name:'本次审核决定'}).getByRole('button').count(),4);
  await admin.page.getByRole('button',{name:'下一项待审 →',exact:true}).focus();await admin.page.keyboard.press('Enter');
  await admin.page.locator('.hub-review-detail-heading').filter({hasNotText:'PMC13691533'}).waitFor();
  assert.ok(!(await admin.page.locator('.hub-review-detail-heading').innerText()).includes('PMC13691533'));
  await geometry(admin.page,'desktop1440-pmc');await admin.page.locator('.hub-review-toolbar').scrollIntoViewIfNeeded();
  await admin.page.screenshot({path:out+'desktop-queue-and-pmc.png'});checks.push('G02总览保持；20篇PMC有状态队列、原文核对和键盘下一项');
  await filter(admin.page,'external');await selectSource(admin.page,'ZJ/T E003-2014');
  assert.equal(await admin.page.getByLabel('核验字段',{exact:true}).count(),0);await admin.page.locator('.guidance-clauses').first().waitFor();
  await admin.page.screenshot({path:out+'external-detail.png'});checks.push('外部来源仅显示当前详情与共用三动作，原文摘录可核对');
  await filter(admin.page);await selectSource(admin.page,marker+' 来源A');
  await save(admin.page,'public');
  let response=await admin.context.request.get(base+'/api/hub-sources/publications/'+fixture.rows[0].id);assert.equal(response.status(),200);
  assert.match((await response.json()).item.abstract,/合成摘要A/);
  await admin.page.getByRole('button',{name:'下一项待审 →',exact:true}).click();await admin.page.locator('.hub-review-detail-heading').filter({hasText:'来源B'}).waitFor();
  assert.match(await admin.page.locator('.hub-review-detail-heading').innerText(),/来源B/);
  await selectSource(admin.page,marker+' 来源A');await save(admin.page,'tenant');
  const anonymous=await session(null),owner=await session('owner');
  assert.equal((await anonymous.context.request.get(base+'/api/hub-sources/publications/'+fixture.rows[0].id)).status(),404);
  assert.equal((await anonymous.context.request.get(base+'/api/hub-sources/member/publications/'+fixture.rows[0].id)).status(),401);
  assert.equal((await owner.context.request.get(base+'/api/hub-sources/member/publications/'+fixture.rows[0].id)).status(),200);
  await owner.page.goto(base+'/pages/e01/');await owner.page.getByLabel('检索标题、作者、期刊或 DOI').fill(marker);
  await owner.page.getByRole('button',{name:'应用筛选',exact:true}).click();await owner.page.getByRole('button',{name:fixture.rows[0].title,exact:true}).waitFor();
  await owner.page.screenshot({path:out+'owner-tenant-e01.png'});
  await admin.page.getByRole('button',{name:'单独审核此行',exact:true}).first().click();await admin.page.getByText('当前单行：第 2 行',{exact:true}).waitFor();
  await save(admin.page,'withheld');await admin.page.getByText('当前单行：第 2 行',{exact:true}).waitFor();
  assert.equal((await owner.context.request.get(base+'/api/hub-sources/member/publications/'+fixture.rows[0].id)).status(),404);
  assert.equal((await owner.context.request.get(base+'/api/hub-sources/member/publications/'+fixture.rows[1].id)).status(),200);
  checks.push('具名合成来源：公开→仅租户→单行暂不放行，摘要同步、匿名关闭、同租户可读、兄弟行不受影响、保存后保留单行');
  await admin.page.getByRole('button',{name:'返回审核本来源的 2 条合格记录',exact:true}).click();
  await admin.page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
  await admin.page.route('**/api/hub-sources/object-reviews',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'合成网络故障'})}),{times:1});
  await admin.page.getByRole('button',{name:'公开页面与AI',exact:true}).click();await admin.page.getByRole('alert').filter({hasText:'保存结果尚未确认'}).waitFor();
  assert.match(await admin.page.locator('.hub-review-detail-heading').innerText(),/来源A/);
  await admin.page.getByRole('button',{name:'重新核对',exact:true}).click();await admin.page.getByText('正在读取当前审核队列…',{exact:true}).waitFor({state:'hidden'});
  await admin.page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});await save(admin.page,'withheld');
  await selectSource(admin.page,marker+' 来源B');
  const beta=(await queue(admin.context)).find(x=>x.detail?.batchId===fixture.batchId&&x.title.endsWith('来源B'));
  assert.equal((await admin.context.request.post(base+'/api/hub-sources/object-reviews',{data:{kind:'workbook',batchId:fixture.batchId,
    sourceRegistryId:beta.detail.sourceRegistryId,expectedFingerprint:beta.fingerprint,operationId:randomUUID(),visibility:'withheld'}})).status(),201);
  await admin.page.getByRole('button',{name:'公开页面与AI',exact:true}).click();await admin.page.getByRole('alert').filter({hasText:'内容或审核状态已变化'}).waitFor();
  checks.push('503不假成功且保留对象；重新核对可恢复；真实并发决定409不覆盖');
  await owner.page.goto(base+'/pages/g02/?view=source-review');await owner.page.getByRole('alert').filter({hasText:'当前账号没有此 Hub'}).waitFor();
  assert.equal(await owner.page.getByRole('button',{name:'公开页面与AI',exact:true}).count(),0);checks.push('科研账号审核受限且无操作');
  for(const viewport of [{width:1366,height:768},{width:1920,height:1200},{width:390,height:844},{width:320,height:740}]) {
    const s=await session('admin',viewport);activePage=s.page;await opened(s.page);await filter(s.page,'pmc');await selectSource(s.page,'PMC13691533');
    await geometry(s.page,'viewport'+viewport.width);await s.page.locator('.hub-review-detail-heading').scrollIntoViewIfNeeded();
    await s.page.screenshot({path:out+'detail-'+viewport.width+'.png'});
    if(viewport.width<960){await s.page.getByRole('button',{name:'返回审核队列',exact:true}).click();assert.equal(await s.page.getByRole('complementary',{name:'来源审核队列'}).isVisible(),true);
      await s.page.screenshot({path:out+'queue-'+viewport.width+'.png'});}
    checks.push('视口'+viewport.width+'：字号、折行、队列/详情/返回与横向溢出通过');
  }
  zoom=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/review-ux-zoom-'),{headless:true,viewport:null,
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'video'}});
  await zoom.pages()[0].goto('chrome://settings/appearance');await zoom.pages()[0].locator('#zoomLevel').selectOption('2');await login(zoom,'admin');
  const zp=await zoom.newPage();watch(zp);activePage=zp;await opened(zp);await filter(zp,'pmc');await selectSource(zp,'PMC13691533');
  const zoomMetrics=await zp.evaluate(()=>({inner:innerWidth,outer:outerWidth,dpr:devicePixelRatio}));assert.equal(zoomMetrics.dpr,2);assert.ok(zoomMetrics.inner<zoomMetrics.outer/2+20);
  await geometry(zp,'native200');await zp.locator('.hub-review-detail-heading').scrollIntoViewIfNeeded();await zp.screenshot({path:out+'native200.png'});checks.push('原生Chrome200%与键盘路径通过');
  const after=(await queue(admin.context)).filter(x=>x.detail?.batchId!==fixture.batchId);assert.equal(hash(after),originalHash);
  assert.deepEqual(errors,[]);checks.push('前序五份来源、用户PMC决定及原工作簿对象摘要完全不变；仅本轮新具名合成数据新增');
  writeFileSync(out+'result.json',JSON.stringify({passed:true,marker,checks,errors,network,metrics,zoomMetrics,modelCalls:0,fixture,originalHash},null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(error){const failureName='failure-'+Date.now();await activePage?.screenshot({path:out+failureName+'.png'}).catch(()=>{});writeFileSync(out+failureName+'.json',JSON.stringify({passed:false,error:error.message,checks,errors,network},null,2));
  console.error(JSON.stringify({passed:false,error:error.message,evidence:out}));process.exitCode=1;
}finally {await zoom?.close().catch(()=>{});for(const context of contexts)await context.close().catch(()=>{});await browser.close();}
