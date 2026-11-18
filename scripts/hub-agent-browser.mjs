import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

const root='/Users/mac/aisciencesys/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const out=root+'docs/test/evidence/2026-10-30-hub-agent/browser-'+randomUUID().slice(0,8)+'/';
mkdirSync(out+'video',{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501',checks=[],network=[],errors=[];
try{
  for(const actor of ['owner','admin']){
    const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push({actor,message:error.message}));
    page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/sessions/')||path==='/api/agents'||path==='/api/knowledge/ai-status')network.push({actor,path,status:response.status()});});
    const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});
    assert.equal(login.status(),201);
    await page.goto(base+'/pages/ai01/');
    await page.getByRole('heading',{name:'Hub 已审核来源问答'}).waitFor();
    const start=page.getByRole('button',{name:'建立独立 Hub 会话'});
    if(!await start.isVisible())throw new Error('HUB_UI_STATE: '+await page.locator('.hub-agent-panel').innerText());
    const stateLoaded=page.waitForResponse(response=>
      /\/api\/sessions\/[^/]+\/knowledge-state/.test(new URL(response.url()).pathname)&&response.status()===200);
    await start.click();
    await stateLoaded;
    await page.getByText('会话已建立。模型任务会在调用前重新核验来源和费用').waitFor();
    await page.getByText('暂不发起付费问答').waitFor();
    assert.equal(await page.getByRole('button',{name:'发送问题'}).count(),0);
    const sizes=await page.locator('.hub-agent-panel').evaluate(element=>({title:getComputedStyle(element.querySelector('h2')).fontSize,body:getComputedStyle(element.querySelector('p')).fontSize,overflow:document.documentElement.scrollWidth>innerWidth+1}));
    assert.deepEqual(sizes,{title:'20px',body:'14px',overflow:false});
    await page.screenshot({path:out+actor+'-desktop.png',fullPage:true});
    checks.push(actor+'-distinct-hub-session-and-paid-gate');
    await context.close();
  }
  const anonymous=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:out+'video'}});
  const page=await anonymous.newPage();
  await page.goto(base+'/pages/ai01/');
  await page.getByText('请先登录；这里不会显示演示账号').waitFor();
  assert.equal(await page.getByRole('heading',{name:'Hub 已审核来源问答'}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:out+'anonymous-mobile.png',fullPage:true});
  checks.push('anonymous-no-agent-content-mobile');
  await anonymous.close();
  assert.deepEqual(errors,[]);
  assert.equal(network.filter(item=>item.path==='/api/sessions/hub-source'&&item.status===201).length,2);
  assert.equal(network.filter(item=>/\/api\/sessions\/[^/]+\/knowledge-state/.test(item.path)&&item.status===200).length,2);
  writeFileSync(out+'result.json',JSON.stringify({checks,network,errors},null,2));
  console.log(JSON.stringify({evidence:out,checks,network,errors}));
}finally{await browser.close();}
