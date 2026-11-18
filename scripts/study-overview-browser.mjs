import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=root+'docs/test/evidence/2026-10-29-researchhub-s01/';
mkdirSync(out,{recursive:true});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501';
const scope=`studyGroupId=${runtime.ids.group}&researchProjectId=${runtime.ids.project}`;
const checks=[],errors=[];

async function check(name,run){try{await run();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.message).slice(0,350)});}}
async function signed(username,width=1440,video=false){
  const context=await browser.newContext({viewport:{width,height:900},recordVideo:video?{dir:out,size:{width,height:900}}:undefined});
  const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username,password:runtime.password}});
  assert.equal(login.status(),201);
  const page=await context.newPage(),network=[];
  page.on('pageerror',error=>errors.push(username+':'+error.message.slice(0,180)));
  page.on('response',response=>{if(response.url().includes('/api/my-research/overview'))network.push(response.status());});
  return{context,page,network};
}

try{
  await check('owner-p01-to-scoped-s01-desktop',async()=>{
    const{context,page,network}=await signed('owner@example.org',1440,true);
    try{
      await page.goto(base+'/pages/p01/');
      await page.getByRole('link',{name:/Study概览/}).first().click();
      assert.match(page.url(),/\/pages\/s01\/\?studyGroupId=/);
      await page.getByRole('heading',{name:'合成针灸研究',exact:true}).waitFor();
      assert.ok(network.includes(200));
      assert.equal(await page.getByText('王教授',{exact:false}).count(),0);
      assert.equal(await page.getByText('入组趋势',{exact:false}).count(),0);
      const contextText=await page.locator('.qiyan-page-context').innerText();
      assert.match(contextText,/Study概览/);
      assert.doesNotMatch(contextText,/针刺抑郁多中心研究|分享|编辑/);
      assert.equal(await page.getByRole('link',{name:'进入本人研究设计草稿'}).count(),1);
      await page.locator('.rs-primary').waitFor({state:'visible'});
      await page.waitForTimeout(500);
      await page.screenshot({path:out+'owner-desktop.png',fullPage:true});
    }finally{const video=page.video();await context.close();await video?.saveAs(out+'owner-desktop.webm');}
  });
  await check('admin-current-membership-mobile',async()=>{
    const{context,page,network}=await signed('admin@example.org',390);
    try{
      await page.goto(base+'/pages/s01/?'+scope);
      await page.getByRole('heading',{name:'合成针灸研究',exact:true}).waitFor();
      assert.ok(network.includes(200));
      const overflow=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(element=>element.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(element=>({tag:element.tagName,className:String(element.className).slice(0,100),right:Math.round(element.getBoundingClientRect().right)}))}));
      assert.equal(overflow.scrollWidth>overflow.viewport+1,false,JSON.stringify(overflow));
      await page.locator('.rs-primary').waitFor({state:'visible'});
      await page.waitForTimeout(500);
      await page.screenshot({path:out+'admin-mobile.png',fullPage:true});
    }finally{await context.close();}
  });
  await check('uninvited-cannot-read-private-study',async()=>{
    const{context,page}=await signed('uninvited@example.org',390);
    try{
      await page.goto(base+'/pages/s01/?'+scope);
      await page.getByRole('heading',{name:'无权查看此 Study'}).waitFor();
      assert.equal(await page.getByText('合成针灸研究',{exact:false}).count(),0);
      await page.screenshot({path:out+'uninvited-mobile.png',fullPage:true});
    }finally{await context.close();}
  });
  await check('invalid-and-unscoped-never-show-demo',async()=>{
    const context=await browser.newContext();
    try{
      const page=await context.newPage();
      await page.goto(base+'/pages/s01/?studyGroupId='+runtime.ids.group);
      await page.getByRole('heading',{name:'无法打开 Study 概览'}).waitFor();
      assert.equal(await page.getByText('王教授',{exact:false}).count(),0);
      await page.screenshot({path:out+'invalid-scope.png',fullPage:true});
      await page.goto(base+'/pages/s01/');
      await page.getByRole('heading',{name:'此页面的真实数据尚未接通'}).waitFor();
      assert.doesNotMatch(await page.locator('body').innerText(),/王教授/);
      await page.screenshot({path:out+'unscoped-gate.png',fullPage:true});
    }finally{await context.close();}
  });
  await check('failed-read-and-focus-recheck-clear-private-data',async()=>{
    const{context,page}=await signed('owner@example.org');
    try{
      await page.goto(base+'/pages/s01/?'+scope);
      await page.getByRole('heading',{name:'合成针灸研究',exact:true}).waitFor();
      await page.route('**/api/my-research/overview',route=>route.fulfill({status:403,json:{code:'SYNTHETIC_REVOKED_READ'}}));
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await page.getByRole('heading',{name:'Study 数据暂时不可用'}).waitFor();
      assert.equal(await page.getByText('合成针灸研究',{exact:true}).count(),0);
      await page.screenshot({path:out+'revoked-read.png',fullPage:true});
    }finally{await context.close();}
  });
  const result={at:new Date().toISOString(),environment:'local-synthetic-only',newModelCalls:0,checks,errors,passed:checks.every(item=>item.passed)&&errors.length===0};
  writeFileSync(out+'result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  assert(result.passed,'S01_BROWSER_FAILED');
}finally{await browser.close();}
