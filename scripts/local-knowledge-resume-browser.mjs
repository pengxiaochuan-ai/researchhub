import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out=root+'docs/test/evidence/2026-10-22-researchhub-local-knowledge-runtime/resume/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),base='http://127.0.0.1:19501',network=[],errors=[];
await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({path:u.pathname,status:r.status()});});
page.setDefaultTimeout(20000);
try{
  await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill('owner@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByText('合成科研人员',{exact:false}).first().waitFor();
  await page.goto(base+'/pages/k01/');const f=page.frameLocator('iframe[title="知识资料操作区"]');
  await f.getByText('合成针灸方案',{exact:true}).first().click();
  if(await f.getByRole('button',{name:'编辑',exact:true}).isVisible())await f.getByRole('button',{name:'编辑',exact:true}).click();
  await f.getByRole('button',{name:'抽取预览',exact:true}).click();await f.getByText('仅供本机软件体验',{exact:false}).first().waitFor();
  await f.getByText('已审核·可检索',{exact:true}).waitFor();
  await page.screenshot({path:out+'persisted-document.png'});
  const source=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/source'));
  await f.getByRole('button',{name:'原件',exact:true}).click();assert.equal((await source).status(),200);
  await f.getByText('原始 HTML 文献已保留',{exact:true}).waitFor();await page.screenshot({path:out+'persisted-source.png'});
  if(await f.getByRole('button',{name:'文档树',exact:true}).isVisible())await f.getByRole('button',{name:'文档树',exact:true}).click();
  const search=f.getByPlaceholder('搜索当前知识库内容…');await search.fill('针灸辅助抑郁障碍');const response=page.waitForResponse(r=>r.url().endsWith('/api/knowledge/search'));await search.press('Enter');assert.ok((await(await response).json()).some(x=>x.via==='vector'));await page.screenshot({path:out+'persisted-search.png'});
  assert.deepEqual(errors,[]);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks:['same-account-login-after-restart','edited-reviewed-document-preserved','original-file-200-after-fresh-load','vector-index-preserved'],network,pageErrors:errors,runtimePid:runtime.pid},null,2));console.log(JSON.stringify({passed:true,checks:4,evidence:out}));
}catch(e){await page.screenshot({path:out+'failure.png'}).catch(()=>{});console.error(e.message);process.exitCode=1;}finally{await context.close();await browser.close();}
