import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const out=root+'docs/test/evidence/2026-10-28-researchhub-real-entry/';
mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501',checks=[],errors=[],requests=[];
async function check(name,run){try{await run();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.message).slice(0,300)});}}
async function session(actor,{mobile=false,returnTo=''}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},recordVideo:{dir:out+actor+'-video',size:mobile?{width:390,height:844}:{width:1440,height:900}}});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push({actor,message:error.message.slice(0,180)}));
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push({actor,path:new URL(request.url()).pathname,method:request.method()});});
 await page.goto(base+'/pages/p003/'+(returnTo?'?returnTo='+encodeURIComponent(returnTo):''));
 await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');
 await page.getByLabel('密码',{exact:true}).fill(runtime.password);
 await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/pages/p01/',{timeout:15000});
 await page.locator('.project').first().waitFor();
 return {context,page};
}
try{
 await check('owner-login-redirect-and-real-entry',async()=>{const {context,page}=await session('owner');try{
  assert.equal(new URL(page.url()).pathname,'/pages/p01/');
  await page.screenshot({path:out+'owner-p01.png',fullPage:true});
  await page.goto(base+'/pages/q02/');
  await page.getByRole('link',{name:/进入研究设计草稿：/}).first().waitFor();
  assert.equal(await page.getByText('王教授').count(),0);
  assert.equal(await page.getByText('查看当前浏览器保存的演示课题').count(),0);
  await page.getByRole('button',{name:'打开全局搜索'}).click();
  await page.getByRole('heading',{name:'全局搜索尚未接入'}).waitFor();
  assert.equal(await page.getByRole('searchbox',{name:'搜索本机演示与页面'}).count(),0);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'通知中心'}).click();
  await page.getByRole('heading',{name:'服务端通知尚未接入'}).waitFor();
  assert.equal(await page.getByText('本机操作与提醒').count(),0);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.screenshot({path:out+'owner-q02.png',fullPage:true});
  await page.goto(base+'/pages/a01/');
  await page.getByRole('link',{name:/查看本人方法资产候选：/}).first().waitFor();
  await page.screenshot({path:out+'owner-a01.png',fullPage:true});
  await page.goto(base+'/pages/ai01/');
  await page.getByRole('link',{name:/基于已审核资料问答：/}).waitFor();
  assert.equal(await page.getByText('中心 03 近两周入组速度下降').count(),0);
  await page.screenshot({path:out+'owner-ai01.png',fullPage:true});
  await page.evaluate(()=>sessionStorage.setItem('lingshu-demo-mode','true'));
  await page.goto(base+'/pages/k01/');
  await page.locator('[data-user-name]').filter({hasText:'合成科研人员'}).waitFor();
  assert.equal(await page.getByText('王教授').count(),0);
  await page.getByRole('button',{name:'打开全局搜索'}).click();
  await page.getByRole('heading',{name:'全局搜索尚未接入'}).waitFor();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.evaluate(()=>sessionStorage.removeItem('lingshu-demo-mode'));
  await page.goto(base+'/pages/g02/');
  await page.getByRole('heading',{name:'此页面的真实数据尚未接通'}).waitFor();
  assert.equal(await page.getByText('针刺抑郁多中心研究',{exact:false}).count(),0);
  await page.screenshot({path:out+'owner-g02-gated.png',fullPage:true});
 }finally{const video=page.video();await context.close();await video?.saveAs(out+'owner.webm');}});
 await check('admin-unsafe-return-and-real-entry-mobile',async()=>{const {context,page}=await session('admin',{mobile:true,returnTo:'https://example.com/steal'});try{
  assert.equal(new URL(page.url()).pathname,'/pages/p01/');
  await page.goto(base+'/pages/q02/');
  await page.getByRole('link',{name:/进入研究设计草稿：/}).first().waitFor();
  assert.equal(await page.getByText('合成租户管理员',{exact:false}).count()>0,true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.locator('.real-entry-card').first().evaluate(element=>element.getBoundingClientRect().width>=300),true,'mobile entry card has readable width');
  await page.screenshot({path:out+'admin-q02-mobile.png',fullPage:true});
  await page.getByRole('link',{name:/进入研究设计草稿：/}).last().scrollIntoViewIfNeeded();
  await page.screenshot({path:out+'admin-q02-mobile-bottom.png'});
 }finally{const video=page.video();await context.close();await video?.saveAs(out+'admin-mobile.webm');}});
 await check('anonymous-entry-has-no-private-study',async()=>{const context=await browser.newContext();try{const page=await context.newPage();await page.goto(base+'/pages/q02/');await page.getByText('请先登录；这里不会显示演示账号').waitFor();assert.equal(await page.getByRole('link',{name:/进入研究设计草稿：/}).count(),0);await page.screenshot({path:out+'anonymous-q02.png',fullPage:true});}finally{await context.close();}});
 const modelRequests=requests.filter(item=>item.method==='POST'&&/(agent|ai|inference|completion)/i.test(item.path));
 const result={at:new Date().toISOString(),environment:'local-synthetic-only',checks,errors,modelRequests,passed:checks.every(item=>item.passed)&&errors.length===0&&modelRequests.length===0};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 assert(result.passed,'REAL_ENTRY_BROWSER_FAILED');
}finally{await browser.close();}
