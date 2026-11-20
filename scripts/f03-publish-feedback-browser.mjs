import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {run} from './f03-academic-content-rollback-browser.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export async function verifyPublishFeedback({base,tenantSlug,password}){
 const {default:pw}=await import('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
 const out=root+'/docs/testing/evidence/governance-feedback-2026-11-18/f03-'+Date.now();mkdirSync(out+'/video',{recursive:true});
 const profile=mkdtempSync(root+'/.tmp/f03-feedback-chrome-');
 const context=await pw.chromium.launchPersistentContext(profile,{headless:true,viewport:null,recordVideo:{dir:out+'/video'},executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000']}),page=await context.newPage();
 const report={checks:[],errors:[],writes:[],rollback:true},management='/api/hubs/lingshu-xinyu/content-management';let stage='login',itemId;
 const request=(path,method='GET',data)=>context.request.fetch(base+path,{method,headers:{Origin:base,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},...(data?{data}:{})});
 const openItem=async()=>{await page.locator('.academic-table tbody tr').filter({hasText:'F03合成发布反馈验收'}).getByRole('button',{name:'编辑',exact:true}).click();await page.getByLabel('标题（必填）',{exact:true}).waitFor();};
 async function acknowledge(title,finishRead){
  const dialog=page.getByRole('dialog',{name:title,exact:true});await dialog.waitFor();assert.equal(await dialog.locator('.ui-confirm-dialog-body').count(),0);assert(!(await page.locator('body').innerText()).includes('已返回资讯与活动列表，按当前筛选展示。'));
  assert.equal(new URL(page.url()).searchParams.has('contentId'),false,'success has already returned to list');
  assert.equal(await page.getByLabel('标题（必填）',{exact:true}).count(),0,'editor has closed');
  assert.equal(await dialog.getByRole('button').count(),1,'one acknowledgement action');
  assert.equal(await dialog.getByRole('button',{name:'知道了',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');assert.equal(await dialog.getByRole('button').evaluate(e=>e===document.activeElement),true);
  if(!report.widths){
   report.widths=[];
   const cdp=await context.newCDPSession(page);
   const settings=await context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await page.bringToFront();
   const zoom=await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio,scale:visualViewport.scale,left:r.left,right:r.right};});report.native200=zoom;assert.equal(zoom.dpr,2);assert.equal(zoom.scale,1);assert(zoom.width>=700&&zoom.width<=730,'native 200% must use the intended 1440 desktop window');assert(zoom.left>=0&&zoom.right<=zoom.width&&zoom.scrollWidth<=zoom.width);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});writeFileSync(out+'/success-native200.png',Buffer.from(shot.data,'base64'));report.native200=zoom;
   await settings.locator('#zoomLevel').selectOption('1');await settings.close();await page.bringToFront();
   for(const width of[1440,1366,1920,390,320]){await page.setViewportSize({width,height:900});const size=await dialog.evaluate(e=>{const r=e.getBoundingClientRect(),b=e.querySelector('button');return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,buttonHeight:b.getBoundingClientRect().height,font:getComputedStyle(b).fontSize,line:getComputedStyle(b).lineHeight};});assert(size.left>=0&&size.right<=size.width&&size.scrollWidth<=size.width);assert(size.buttonHeight>=44);assert.equal(size.font,'14px');assert.equal(size.line,'22px');report.widths.push(size);await page.screenshot({path:out+'/success-'+width+'.png'});}
   await page.setViewportSize({width:1440,height:1000});
  }
  await page.screenshot({path:out+'/'+title+'.png'});await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);if(finishRead)await finishRead();
  await page.waitForFunction(()=>document.activeElement.matches('.academic-toolbar h2,.governance-section-header h2,.academic-table button'));
  assert.equal(await page.evaluate(()=>document.activeElement.matches('.academic-toolbar h2,.governance-section-header h2,.academic-table button')),true);
 }
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(r.url().includes(management)&&r.method()!=='GET')report.writes.push({method:r.method(),path:new URL(r.url()).pathname});});
 try{
  assert.equal((await request('/api/auth/login','POST',{tenantSlug,username:'admin@example.org',password})).status(),201);
  await page.goto(base+'/pages/g02/?view=academic-content&type=news&q=F03合成发布反馈验收');
  await page.getByRole('button',{name:'新建内容',exact:true}).click();
  await page.getByLabel('标题（必填）',{exact:true}).fill('F03合成发布反馈验收（虚构，不是学术资讯）');
  await page.getByLabel('正文（发布必填）',{exact:true}).fill('仅验证软件发布反馈，不含真实学术事实或活动安排。');
  await page.getByLabel('来源说明（发布必填）',{exact:true}).fill('软件验收自建合成文本');
  await page.getByLabel('内容使用依据（发布必填）',{exact:true}).fill('仅限本次软件验收，数据库事务结束后回滚。');
  stage='draft-and-cancel';await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.getByText('草稿已保存。',{exact:true}).waitFor();
  itemId=new URL(page.url()).searchParams.get('contentId');assert(itemId);
  await page.getByRole('button',{name:'发布',exact:true}).click();await page.getByRole('dialog',{name:'发布这份内容？'}).waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.getByLabel('标题（必填）',{exact:true}).count(),1);assert.equal(report.writes.filter(x=>x.path.endsWith('/publications')).length,0);
  stage='publish-feedback';await page.getByRole('button',{name:'发布',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布',exact:true}).click();
  await acknowledge('发布成功');assert.equal(new URL(page.url()).searchParams.get('type'),'news');assert.equal(new URL(page.url()).searchParams.get('q'),'F03合成发布反馈验收');
  report.checks.push('draft remains editor; cancellation writes nothing; actual publication returns filtered list with one keyboard-accessible success modal');
  stage='update-recovered';await openItem();await page.getByLabel('正文（发布必填）',{exact:true}).fill('合成软件验收第二版，不含真实学术事实。');
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.getByText('草稿已保存。',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('标题（必填）',{exact:true}).count(),1);
  await page.waitForFunction(()=>!document.querySelector('.academic-content[aria-busy="true"]'));let releaseList;const listGate=new Promise(resolve=>releaseList=resolve);await page.route('**/content-management?*',async route=>{await listGate;await route.continue();});
  let publications=0;await page.route('**/content-management/*/publications',async route=>{publications++;const response=await route.fetch();assert.equal(response.status(),200);await route.fulfill({status:503,contentType:'application/json',body:'{"message":"合成已提交丢响应"}'});});
  await page.getByRole('button',{name:'更新发布',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布',exact:true}).click();
  await acknowledge('更新发布成功',async()=>{releaseList();await page.locator('.academic-table tr[data-content-id="'+itemId+'"] button').waitFor();await page.waitForFunction(id=>document.activeElement.closest('tr')?.dataset.contentId===id,itemId);await page.unroute('**/content-management?*');});assert.equal(publications,1);await page.unroute('**/content-management/*/publications');
  report.checks.push('actual committed update with lost response recovers without replay; early modal dismissal restores original row focus after delayed list completes');
  stage='rejection-retains-editor';await openItem();await page.getByLabel('正文（发布必填）',{exact:true}).fill('合成第三版输入，应在拒绝后保留。');
  await page.route('**/content-management/*/publications',route=>route.fulfill({status:409,contentType:'application/json',body:'{"message":"合成版本冲突"}'}));
  await page.getByRole('button',{name:'更新发布',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布',exact:true}).click();await page.getByText('合成版本冲突',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('正文（发布必填）',{exact:true}).inputValue(),'合成第三版输入，应在拒绝后保留。');assert.equal(new URL(page.url()).searchParams.get('contentId'),itemId);assert.equal(await page.getByRole('dialog').count(),0);
  await page.unroute('**/content-management/*/publications');report.checks.push('definite publication rejection preserves editor and saved input; no success modal or list redirect');
  stage='post-commit-list-failure';await page.goto(base+'/pages/g02/?view=academic-content&contentId='+itemId);
  await page.getByLabel('正文（发布必填）',{exact:true}).waitFor();
  let listFailures=0;await page.route('**/content-management?*',route=>{listFailures++;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"合成列表暂不可用"}'});});
  await page.getByRole('button',{name:'更新发布',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布',exact:true}).click();await acknowledge('更新发布成功');assert(listFailures>0);await page.getByText('合成列表暂不可用',{exact:true}).waitFor();
  assert.equal((await(await request(management+'/'+itemId)).json()).status,'published');await page.unroute('**/content-management?*');
  report.checks.push('committed publication remains success when subsequent list GET fails; list error is visible and no automatic replay');
  stage='identity-change';await page.reload();await openItem();await page.getByLabel('正文（发布必填）',{exact:true}).fill('合成第四版，用于身份隔离验收。');
  await page.getByRole('button',{name:'更新发布',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布',exact:true}).click();await page.getByRole('dialog',{name:'更新发布成功'}).waitFor();
  assert.equal((await request('/api/auth/logout','POST',{})).status(),200);
  assert.equal((await request('/api/auth/login','POST',{tenantSlug,username:'owner@example.org',password})).status(),201);
  await page.evaluate(()=>window.dispatchEvent(new Event('qiyan:auth-refresh')));
  await page.getByText('当前登录身份没有管理权限。',{exact:true}).waitFor({timeout:15000}).catch(async()=>{await page.waitForFunction(()=>!document.querySelector('dialog[open]'));});
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByText('F03合成发布反馈验收（虚构，不是学术资讯）',{exact:true}).count(),0);
  report.checks.push('identity replacement removes old success dialog and private content');assert.deepEqual(report.errors,[]);report.passed=true;return report;
 }catch(e){report.passed=false;report.stage=stage;report.error=e.message;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
 finally{await context.close();rmSync(profile,{recursive:true,force:true});writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,stage,evidence:out+'/result.json'}));}
}
if(process.argv[2]==='--run')run({verifyBrowser:verifyPublishFeedback}).catch(e=>{console.error(e.message);process.exitCode=1;});
