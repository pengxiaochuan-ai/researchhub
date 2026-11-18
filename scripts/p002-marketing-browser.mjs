import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:19501',out=new URL('../docs/testing/evidence/p002-marketing-2026-11-08/'+randomUUID()+'/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});
const p=await ctx.newPage(),errors=[],writes=[],checks=[];let stage='hero';
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),url:r.url()});});
try{
 await p.goto(base+'/pages/p002/');
 const hero=p.locator('#home');
 assert.equal(await hero.getByRole('link',{name:'免费注册',exact:true}).getAttribute('href'),'/pages/p004/');
 const heights=await hero.locator('.actions a').evaluateAll(elements=>elements.map(e=>Math.round(e.getBoundingClientRect().height)));assert.equal(heights[0],heights[1],'paired hero actions have a consistent target height');
 assert.equal(await p.getByRole('search').count(),0,'no section-jumping control pretending to be content search');
 assert.equal(await p.getByRole('button',{name:'预约演示',exact:true}).count(),0);
 assert.equal(await p.getByRole('dialog').count(),0,'no dormant fake booking or local intention form');
 await hero.getByRole('link',{name:'了解科研流程',exact:true}).click();await p.waitForFunction(()=>Math.abs(document.querySelector('#process').getBoundingClientRect().top)<40);
 assert((await p.locator('#process-cards').innerText()).includes('查看中'));
 assert(!(await p.locator('#process-cards').innerText()).includes('当前步骤'));
 await p.screenshot({path:out+'process.png',fullPage:false});
 const first=p.locator('#process-cards button').first();await first.focus();await first.press('Enter');assert.equal(await first.getAttribute('aria-pressed'),'true');
 checks.push('real flow anchor and keyboard selection do not claim personal research progress');
 stage='responsive';
 for(const width of [1920,1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/pages/p002/');await p.locator('.hero-wheel img').waitFor({state:'visible'});await p.waitForFunction(()=>{const img=document.querySelector('.hero-wheel img');return img.complete&&img.naturalWidth>0&&[img,img.parentElement].every(e=>Number(getComputedStyle(e).opacity)>.99);});
  const m=await hero.evaluate(e=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:getComputedStyle(e.querySelector('h1')).fontSize,summary:getComputedStyle(e.querySelector('.hero-summary')).fontSize,body:getComputedStyle(e.querySelector('.hero-description')).fontSize,h2:getComputedStyle(document.querySelector('#process h2')).fontSize,primary:e.querySelector('.actions a').getBoundingClientRect().toJSON(),overflow:[...document.querySelectorAll('.actions,.process-card,.engine,.audience-card,.diagram-detail,.support-bar')].filter(x=>x.clientWidth&&[...x.children].filter(c=>!c.matches('.step-arrow,.asset-arrow,[aria-hidden="true"]')).some(c=>{const a=x.getBoundingClientRect(),b=c.getBoundingClientRect();return b.width>0&&b.height>0&&(b.left<a.left-2||b.right>a.right+2);})).map(x=>x.className)}));
  const titleLines=await hero.locator('h1').evaluate(e=>{const lines=new Map(),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode())for(let i=0;i<n.textContent.length;i++){const c=n.textContent[i];if(!c.trim())continue;const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const box=r.getBoundingClientRect(),key=Math.round(box.top);lines.set(key,(lines.get(key)??'')+c);}return [...lines.values()];});m.titleLines=titleLines;
  assert(titleLines.every(line=>line.length>1),'no orphan single-character heading lines: '+JSON.stringify(titleLines));assert(m.scroll<=width+1,JSON.stringify(m));assert.deepEqual(m.overflow,[],JSON.stringify(m));assert.equal(m.h1,width<=360?'30px':width<=900?'32px':'48px');assert.equal(m.h2,width<=900?'28px':'36px');assert.equal(m.body,width<=900?'16px':'18px');assert.equal(m.summary,width<=900?'18px':'20px');assert(m.primary.bottom<900);assert(m.primary.height>=44);
  await p.screenshot({path:out+'hero-'+width+'.png',fullPage:false});
  if(width<=900){const toggle=p.getByRole('button',{name:'菜单',exact:true});await toggle.click();const nav=p.getByRole('navigation',{name:'主导航',exact:true});assert(await nav.getByRole('link',{name:'登录',exact:true}).isVisible());assert(await nav.getByRole('link',{name:'免费注册',exact:true}).isVisible());await p.screenshot({path:out+'menu-'+width+'.png',fullPage:false});await nav.getByRole('link',{name:'登录',exact:true}).focus();await nav.getByRole('link',{name:'登录',exact:true}).press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await toggle.evaluate(e=>document.activeElement===e),'Escape from inside the menu restores visible trigger focus');}
  checks.push(m);
 }
 stage='real-entry';await hero.getByRole('link',{name:'免费注册',exact:true}).click();await p.waitForURL('**/pages/p004/');assert(await p.getByRole('textbox',{name:'邮箱',exact:true}).isVisible());checks.push('real existing registration page reached without sending email');
 await p.goto(base+'/pages/p002/');await p.getByRole('button',{name:'菜单',exact:true}).click();await p.getByRole('navigation',{name:'主导航',exact:true}).getByRole('link',{name:'登录',exact:true}).click();await p.waitForURL('**/pages/p003/');checks.push('mobile login reaches original sign-in');
 await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/pages/p002/');await hero.getByRole('link',{name:'了解科研流程',exact:true}).click();await p.waitForFunction(()=>Math.abs(document.querySelector('#process').getBoundingClientRect().top)<40);checks.push('reduced motion keeps anchor and content usable');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await ctx.close();writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,errors,writes},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
}catch(e){await p.screenshot({path:out+'failure.png',fullPage:false}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,message:e.message,checks,errors,writes},null,2));console.error(JSON.stringify({passed:false,stage,message:e.message,evidence:out}));process.exitCode=1;}finally{await browser.close();}
