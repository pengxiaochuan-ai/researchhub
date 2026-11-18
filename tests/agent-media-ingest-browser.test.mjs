import test from'node:test';import assert from'node:assert/strict';import{mkdirSync}from'node:fs';import pw from'/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-video-binding-2026-11-16/browser-'+Date.now();mkdirSync(out,{recursive:true});
test('existing video area offers one confirmation, recovers unknown writes and isolates identities',async t=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  await t.test('silent video registers once without a visit and restores without another write',async()=>{
   const c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}}),p=await c.newPage();await c.route('**/api/**',r=>r.abort());
   try{await p.goto(base+'/scripts/fixtures/agent-media-ingest-harness.html');await p.getByRole('button',{name:'确认关联并登记',exact:true}).waitFor({timeout:3000});await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.getByText('登记成功',{exact:true}).waitFor();
    const posts=await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'));assert.equal(posts.length,2);assert.equal(posts[0][3].subjectVisitId,null);await p.screenshot({path:out+'/one-confirm.png'});await p.reload();await p.getByText('登记成功',{exact:true}).waitFor();assert.equal((await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'))).length,2);
    await p.evaluate(()=>window.ingestHarness.refresh());await p.locator('.registered-media-list').getByRole('button',{name:'查看回执',exact:true}).click();await p.locator('.registered-media-list .media-ingest-receipt').filter({hasText:'未关联访视'}).waitFor();
    await p.setViewportSize({width:390,height:900});await p.screenshot({path:out+'/receipt-390.png'});
   }finally{await c.close();}
  });
  await t.test('lost confirmation response is read back by the original key with no automatic retry',async()=>{
   const c=await browser.newContext({recordVideo:{dir:out}}),p=await c.newPage();await c.route('**/api/**',r=>r.abort());
   try{await p.goto(base+'/scripts/fixtures/agent-media-ingest-harness.html');await p.getByRole('button',{name:'确认关联并登记',exact:true}).waitFor({timeout:3000});await p.evaluate(()=>window.ingestHarness.loseConfirm=true);await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.getByRole('button',{name:'核对登记',exact:true}).waitFor();await p.getByRole('button',{name:'核对登记',exact:true}).click();await p.getByText('登记成功',{exact:true}).waitFor();assert.equal((await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'))).length,2);await p.screenshot({path:out+'/unknown-recovered.png'});
   }finally{await c.close();}
  });
  await t.test('late preparation cannot auto-confirm after identity change',async()=>{
   const c=await browser.newContext(),p=await c.newPage();await c.route('**/api/**',r=>r.abort());
   try{await p.goto(base+'/scripts/fixtures/agent-media-ingest-harness.html');await p.getByRole('button',{name:'确认关联并登记',exact:true}).waitFor({timeout:3000});await p.evaluate(()=>window.ingestHarness.delayPrepare=true);await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.waitForFunction(()=>window.ingestHarness.releasePrepare);await p.evaluate(()=>window.ingestHarness.identity('admin'));await p.locator('#actor').filter({hasText:'admin'}).waitFor();await p.evaluate(()=>window.ingestHarness.releasePrepare());await p.waitForTimeout(80);assert.equal((await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'&&x[1].endsWith('/confirm')))).length,0);assert.equal(await p.getByText('登记成功',{exact:true}).count(),0);
   }finally{await c.close();}
  });
  await t.test('losing result.read clears an opened receipt and player instead of exposing cached metadata',async()=>{
   const c=await browser.newContext(),p=await c.newPage();await c.route('**/api/**',r=>r.abort());
   try{await p.goto(base+'/scripts/fixtures/agent-media-ingest-harness.html');await p.getByRole('button',{name:'确认关联并登记',exact:true}).waitFor({timeout:3000});await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.getByText('登记成功',{exact:true}).waitFor();await p.evaluate(()=>window.ingestHarness.refresh());const list=p.locator('.registered-media-list');await list.getByRole('button',{name:'查看回执',exact:true}).click();await p.evaluate(()=>{window.ingestHarness.listDenied=true;window.dispatchEvent(new Event('focus'));});await list.getByRole('alert').waitFor();assert.equal(await list.getByRole('button',{name:'查看回执',exact:true}).count(),0);assert.equal(await list.locator('video').count(),0);
   }finally{await c.close();}
  });
 }finally{await browser.close();}
});
