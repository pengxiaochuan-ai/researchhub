import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const before=process.argv.includes('--before'),out=new URL('../docs/testing/evidence/p002-join-2026-11-08/'+randomUUID()+'/',import.meta.url).pathname;mkdirSync(out,{recursive:true});
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}}),p=await ctx.newPage(),checks=[],errors=[],writes=[];
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
try{
 for(const width of before?[1440]:[1920,1440,1366,768,390,320]){
  await p.setViewportSize({width,height:1000});await p.goto('http://127.0.0.1:19501/pages/p002/');await p.locator('#join-values article').last().waitFor();await p.locator('#join').scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>[...document.querySelectorAll('#join img')].every(i=>i.complete&&i.naturalWidth>0)&&document.querySelector('#join').classList.contains('entered'));
  await p.screenshot({path:out+'join-'+width+'.png'});
  const m=await p.locator('#join').evaluate(e=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overlay:getComputedStyle(e,'::before').backgroundColor,articles:[...e.querySelectorAll('article')].map(a=>({title:a.querySelector('h3').getBoundingClientRect().top,body:a.querySelector('p').getBoundingClientRect().top,font:getComputedStyle(a.querySelector('p')).fontSize,color:getComputedStyle(a.querySelector('p')).color,overflow:a.scrollWidth>a.clientWidth+1}))}));checks.push(m);
  assert(m.scroll<=width+1);assert(m.articles.every(a=>!a.overflow));
  if(width>600){assert(Math.max(...m.articles.map(a=>a.title))-Math.min(...m.articles.map(a=>a.title))<1,'three titles align');assert(Math.max(...m.articles.map(a=>a.body))-Math.min(...m.articles.map(a=>a.body))<1,'three body starts align');}
  if(!before){const bg=m.overlay.match(/[\d.]+/g).map(Number),fg=m.articles[2].color.match(/[\d.]+/g).map(Number);assert.equal(bg.length,4);const composite=bg.slice(0,3).map(c=>c*bg[3]+255*(1-bg[3]));const l=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);m.worstCaseContrast=(l(fg)+.05)/(l(composite)+.05);assert(m.worstCaseContrast>=4.5);}
  assert.equal(await p.locator('#join').getByRole('link',{name:'查看帮助中心'}).getAttribute('href'),'/pages/p008/');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await ctx.close();writeFileSync(out+'result.json',JSON.stringify({passed:true,before,checks,errors,writes},null,2));console.log(JSON.stringify({passed:true,before,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,before,message:e.message,checks,errors,writes},null,2));console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}finally{await browser.close();}
