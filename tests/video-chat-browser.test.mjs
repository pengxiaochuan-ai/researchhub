import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync,readFileSync} from 'node:fs';import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_VIDEO_CHAT_TEST_BASE??'http://127.0.0.1:19619',out='.tmp/ai-video-chat-2026-11-17/component';mkdirSync(out,{recursive:true});
test('real Chrome video chat sources: responsive layout, current seek, offline, version and late identity/session responses',async t=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{for(const width of [1440,1024,768,600,390])await t.test('layout '+width,async()=>{
  const c=await browser.newContext({viewport:{width,height:950},recordVideo:{dir:out}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await c.route('**/api/**',r=>r.abort());try{await p.goto(base+'/scripts/fixtures/video-chat-harness.html');await p.getByText('核对视频来源与时间',{exact:false}).click();await p.getByText('绿色背景和合成文字。',{exact:true}).waitFor();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('.video-chat-sources').evaluate(e=>getComputedStyle(e).fontSize),'14px');await p.screenshot({path:out+'/width-'+width+'.png'});assert.deepEqual(errors,[]);}finally{await c.close();}
 });
 for(const mode of ['offline','changed','gone','delayed-identity','delayed-session'])await t.test(mode,async()=>{
  const c=await browser.newContext({recordVideo:{dir:out}}),p=await c.newPage();await c.route('**/api/**',r=>r.abort());try{await p.goto(base+'/scripts/fixtures/video-chat-harness.html');await p.locator('.video-chat-sources summary').click();await p.evaluate(m=>window.videoChatHarness.setMode(m.startsWith('delayed')?'delayed':m),mode);await p.getByRole('button',{name:'回放来源V2 0:06',exact:true}).click();
   if(mode.startsWith('delayed')){await p.waitForFunction(()=>window.videoChatHarness.calls.length===1);await p.evaluate(m=>m.endsWith('identity')?window.videoChatHarness.setIdentity('admin'):window.videoChatHarness.setSid('other'),mode);await p.waitForFunction(()=>!document.querySelector('.video-chat-sources'));await p.evaluate(()=>window.videoChatHarness.release());await p.waitForTimeout(50);assert.equal(await p.locator('video').count(),0);}else{await p.getByRole('alert').waitFor();assert.equal(await p.locator('video').count(),0);assert.equal(await p.getByText('绿色背景和合成文字。',{exact:true}).count(),mode==='offline'?1:0);await p.screenshot({path:out+'/'+mode+'.png'});}
  }finally{await c.close();}
 });
 await t.test('source time opens the existing original player and seeks to the checked timestamp',async()=>{
  const c=await browser.newContext({recordVideo:{dir:out}}),p=await c.newPage();const bytes=readFileSync('.tmp/ai-media-content-2026-11-17/synthetic.mp4');
  await c.route('**/api/**',r=>r.abort());await c.route('**/api/sessions/fixture-session/media/fixture-media/content',r=>r.fulfill({status:200,contentType:'video/mp4',body:bytes}));
  try{await p.goto(base+'/scripts/fixtures/video-chat-harness.html');await p.locator('.video-chat-sources summary').click();await p.getByRole('button',{name:'回放来源V2 0:06',exact:true}).click();await p.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>=6&&v.currentTime<9&&!v.paused;});await p.screenshot({path:out+'/playback.png'});assert.equal((await p.evaluate(()=>window.videoChatHarness.calls)).length,1);await p.evaluate(()=>window.videoChatHarness.setMode('gone'));await p.getByRole('button',{name:'回放来源V1 0:01',exact:false}).click();await p.getByRole('alert').waitFor();assert.equal(await p.locator('video').count(),0);assert.equal(await p.locator('.video-chat-sources').count(),0);assert.equal(await p.getByText('口播说明研究关注点，不能据此证明疗效。',{exact:false}).count(),0);}finally{await c.close();}
 });
 }finally{await browser.close();}
});
