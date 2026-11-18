import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const out='.tmp/ai-file-data-2026-11-12/p05-ui-'+Date.now();mkdirSync(out,{recursive:true});const errors=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:19501/scripts/fixtures/research-data-import-harness.html');await page.getByRole('button',{name:'确认导入',exact:true}).waitFor({timeout:6000});await page.screenshot({path:out+'/before-confirm.png',fullPage:true});
 assert.equal(await page.getByRole('button',{name:'确认导入',exact:true}).count(),1);await page.getByRole('button',{name:'确认导入',exact:true}).click();await page.getByText('已导入2名被试',{exact:false}).waitFor({timeout:6000});assert.equal(await page.getByText('尚未导入被试库',{exact:false}).count(),0);
 await page.screenshot({path:out+'/after-confirm.png',fullPage:true});const calls=await page.evaluate(()=>window.p05Harness.calls);assert.equal(calls.filter(([m,p])=>m==='POST'&&p.endsWith('confirmations')).length,1);await context.close();
 const cases=['positive'];
 for(const scenario of ['lost-response','late-identity','offline','unknown-import-status']){
  const ctx=await browser.newContext({viewport:{width:375,height:812},recordVideo:{dir:out}}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:19501/scripts/fixtures/research-data-import-harness.html');await p.getByRole('button',{name:'确认导入',exact:true}).waitFor({timeout:6000});
  if(scenario==='lost-response'){
   await p.evaluate(()=>window.p05Harness.loseReply());await p.getByRole('button',{name:'确认导入',exact:true}).click();await p.getByRole('button',{name:'核对状态',exact:true}).waitFor();await p.getByRole('button',{name:'核对状态',exact:true}).click();await p.getByText('已导入2名被试',{exact:false}).waitFor();
  }else if(scenario==='late-identity'){
   await p.evaluate(()=>window.p05Harness.hold());await p.getByRole('button',{name:'确认导入',exact:true}).click();await p.getByRole('button',{name:'切身份',exact:true}).click();await p.getByRole('button',{name:'确认导入',exact:true}).waitFor();await p.evaluate(()=>window.p05Harness.release());await p.waitForTimeout(150);assert.equal(await p.getByText('已导入2名被试',{exact:false}).count(),0);assert.equal(await p.getByRole('button',{name:'确认导入',exact:true}).count(),1);assert.equal(await p.getByText('P05-OWNER-A',{exact:true}).count(),0);
  }else if(scenario==='unknown-import-status'){
   await p.getByRole('button',{name:'确认导入',exact:true}).click();await p.getByText('已导入2名被试',{exact:false}).waitFor();await p.evaluate(async()=>{window.p05Harness.failImportReads();await window.p05Harness.refreshData();});await p.getByRole('button',{name:'核对状态',exact:true}).waitFor();assert(await p.getByRole('button',{name:'取消预检',exact:true}).isDisabled());assert(await p.getByRole('button',{name:'重新预检',exact:true}).isDisabled());await p.evaluate(()=>window.p05Harness.restoreImportReads());await p.getByRole('button',{name:'核对状态',exact:true}).click();await p.getByText('已导入2名被试',{exact:false}).waitFor();
  }else{
   await p.evaluate(()=>window.p05Harness.goOffline());await p.getByRole('button',{name:'确认导入',exact:true}).click();await p.getByRole('button',{name:'核对状态',exact:true}).waitFor();assert(await p.getByRole('button',{name:'确认导入',exact:true}).isDisabled());await p.evaluate(()=>window.p05Harness.goOnline());await p.getByRole('button',{name:'核对状态',exact:true}).click();await p.getByRole('button',{name:'确认导入',exact:true}).waitFor();assert.equal(await p.getByText('已导入2名被试',{exact:false}).count(),0);
  }
  const trace=await p.evaluate(()=>window.p05Harness.calls);assert.equal(trace.filter(([m,path])=>m==='POST'&&path.endsWith('confirmations')).length,1);await p.screenshot({path:out+'/'+scenario+'.png',fullPage:true});cases.push(scenario);await ctx.close();
 }
 assert.equal(errors.length,0);writeFileSync(out+'/result.json',JSON.stringify({passed:true,calls,errors,cases}));console.log(JSON.stringify({passed:true,evidence:out,cases}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({code:e.code??e.name,message:e.message,errors}));console.log(JSON.stringify({passed:false,evidence:out,message:e.message.split('\n')[0]}));process.exitCode=1;}finally{await browser.close();}
