// Read-only product baseline. Login/renew are the only permitted POSTs.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {waitForKnowledgeReady} from './ai-file-material-readiness.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const out='.tmp/ai-file-data-2026-11-12/baseline-'+Date.now();
mkdirSync(out+'/video',{recursive:true,mode:0o700});
const {ids,password,pid}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[],errors=[],blockedWrites=[],blockedExternal=[];
let passed=false;
try {
  for (const actor of ['owner','admin']) {
    const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});
    try {
      const response=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}});
      assert.equal(response.status(),201,'existing synthetic account login');
      await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if (url.origin!==base) {blockedExternal.push({actor,origin:url.origin});return route.abort();}
        if (url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method())&&url.pathname!=='/api/auth/renew') {
          blockedWrites.push({actor,path:url.pathname});return route.abort();
        }
        return route.continue();
      });
      const page=await context.newPage();page.on('pageerror',error=>errors.push({actor,message:error.message}));
      const historyReady=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname==='/api/sessions/hub-source/history');
      await page.goto(base+'/pages/ai01/');
      const question=page.locator('#hub-agent-question');await question.waitFor();
      await page.waitForFunction(()=>!document.querySelector('#hub-agent-question')?.disabled);
      const upload=page.getByRole('button',{name:'上传文件',exact:true});
      assert(await upload.isDisabled(),'baseline: upload not yet connected');
      const metrics=await question.evaluate(element=>({fontSize:getComputedStyle(element).fontSize,lineHeight:getComputedStyle(element).lineHeight,
        rect:{x:element.getBoundingClientRect().x,y:element.getBoundingClientRect().y,width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}}));
      assert.equal(metrics.fontSize,'14px');assert.equal(metrics.lineHeight,'22px');
      assert.equal(await page.getByRole('button',{name:'智能搜索',exact:true}).getAttribute('aria-pressed'),'false');
      assert.equal((await historyReady).status(),200);
      await page.getByText('正在读取会话…',{exact:true}).waitFor({state:'hidden'});
      await page.screenshot({path:out+'/'+actor+'-ai01.png'});
      const basesReady=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname==='/api/knowledge/bases');
      const treeReady=page.waitForResponse(response=>response.request().method()==='GET'&&/^\/api\/knowledge\/bases\/[A-Za-z0-9_-]+\/tree$/.test(new URL(response.url()).pathname));
      await page.goto(base+'/pages/k01/');await page.locator('iframe').waitFor();
      const knowledgeReady=await waitForKnowledgeReady(page.frameLocator('iframe'),basesReady,treeReady);
      await page.screenshot({path:out+'/'+actor+'-k01.png'});
      results.push({actor,viewport:{width:1440,height:900},uploadDisabled:true,networkOff:true,metrics,knowledgeReady,
        aiScreenshot:out+'/'+actor+'-ai01.png',knowledgeScreenshot:out+'/'+actor+'-k01.png'});
    } finally {await context.close();}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);passed=true;
} finally {
  await browser.close();
  writeFileSync(out+'/result.json',JSON.stringify({passed,runtimePid:pid,results,errors,blockedWrites,blockedExternal,newUploads:0,newModelCalls:0,productWrites:0},null,2),{mode:0o600});
  console.log(JSON.stringify({passed,evidence:out,actors:results.map(r=>r.actor),errors:errors.length,blockedWrites:blockedWrites.length,newUploads:0,newModelCalls:0}));
}
