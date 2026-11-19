import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';

const out='docs/testing/evidence/p002-entry-light-2026-11-19/';
const base='http://127.0.0.1:19501/pages/p002/';
const before=JSON.parse(await fs.readFile(out+'before.json','utf8'));
await fs.mkdir(out,{recursive:true});
await fs.copyFile('/Users/mac/.codex/generated_images/01a1e765-0f63-7be2-a0bd-9de7b0eed6e6/exec-25ffc998-9577-4f24-bde3-a99cdea5aa6d.png',out+'selected-first.png');
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1920,height:1500},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
const page=await context.newPage(),checks=[],errors=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),url:r.url()});});
async function ready(){await page.locator('#process-cards button').first().waitFor();await page.waitForFunction(()=>!document.querySelector('[data-academic-activities] [role="status"]'));await page.locator('img').evaluateAll(es=>Promise.all(es.filter(e=>e.loading!=='lazy').map(e=>e.decode().catch(()=>{}))));await page.waitForTimeout(850);}
async function measure(){return page.evaluate(()=>{
  const m=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontSize,line:s.lineHeight,padding:s.padding,display:s.display,background:s.backgroundImage};};
  const all=s=>[...document.querySelectorAll(s)].map(m);
  return{width:innerWidth,scroll:document.documentElement.scrollWidth,heroText:document.querySelector('#home').innerText,
    header:all('body>header,body>header .header-inner,body>header a,body>header button'),
    content:all('#home .wrap,#process>.wrap'),
    roles:all('#home h1,#home .hero-summary,#home .hero-description,#process h2,#process .process-card h3,#process .process-card p,#process .ai-tools strong'),
    sections:[...document.querySelectorAll('main>section')].map(e=>({id:e.id,text:e.innerText,html:e.innerHTML,geometry:m(e),children:[...e.querySelectorAll('h1,h2,h3,.wrap,.button')].map(m)})),
    overflow:[...document.querySelectorAll('#home p,#home h1,#home .support-project,#home .support-values,#home .diagram-detail,#process h2,#process .process-card,#process .process-card h3,#process .process-card p,#process .ai-tools>div')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent})),
    cards:all('#process .process-card'),h1s:document.querySelectorAll('main h1').length};
});}
try{
  for(const width of[1920,1536,1440,1419,1366,1200,1024,901,900,768,390,320]){
    await page.setViewportSize({width,height:width<=900?844:1500});await page.goto(base);await ready();
    const m=await measure(),old=before.find(x=>x.width===width);
    assert(m.scroll<=width+1,JSON.stringify({width,scroll:m.scroll}));assert.deepEqual(m.overflow,[],JSON.stringify(m.overflow));assert.equal(m.h1s,1);
    assert.equal(m.roles[0].font,width>900?'40px':width<=360?'30px':'32px');
    assert.equal(m.roles[1].font,'16px');assert.equal(m.roles[2].font,'16px');assert.equal(m.roles[3].font,width>900?'30px':'28px');
    assert([4,6,8,10,12].every(i=>m.roles[i].font==='20px'));assert([5,7,9,11,13,14,15,16,17].every(i=>m.roles[i].font==='16px'));
    if(width>900)for(const c of m.content){assert(Math.abs(c.w/width-.76)<.001);assert(Math.abs(c.x/width-.12)<.001);}
    if(width>=1201){assert.equal(new Set(m.cards.map(x=>Math.round(x.y))).size,1);assert(m.cards.every(x=>x.h<310));}
    if(old){
      assert.equal(m.heroText,old.heroText,'hero copy remains verbatim');
      assert.deepEqual(m.header.map(({background,...x})=>x),old.header.map(({tag,background,...x})=>x),'navigation geometry and typography remain unchanged');
      for(const e of m.sections.slice(2)){
        const prior=old.sections.find(x=>x.id===e.id);
        const same=await page.evaluate(({a,b})=>{
          const normalize=html=>{const root=new DOMParser().parseFromString(html,'text/html').body;root.querySelectorAll('[data-academic-activities]').forEach(e=>e.replaceChildren());root.querySelectorAll('[data-image-state]').forEach(e=>{e.removeAttribute('data-image-state');e.removeAttribute('aria-busy');});root.querySelectorAll('.crop-status').forEach(e=>e.remove());return root.innerHTML;};
          return normalize(a)===normalize(b);
        },{a:e.html,b:prior.html});
        assert(same,'later section static DOM unchanged (async activity/image state excluded): '+e.id);
        for(const key of['w','h','font','line','padding','background'])assert.deepEqual(e.geometry[key],prior.geometry[key],e.id+' '+key);
        assert.deepEqual(e.children.map(({y,...x})=>x),prior.children.map(({tag,y,...x})=>x),'later section styles unchanged: '+e.id);
      }
    }
    await page.screenshot({path:out+'hero-'+width+'.png'});
    await page.locator('#process').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'process-'+width+'.png'});
    if(width<=900){
      assert(await page.getByRole('link',{name:'了解参与方式',exact:false}).isVisible(),'participation link remains available on small screens');
      await page.goto(base);await ready();const menu=page.getByRole('button',{name:'菜单',exact:true});await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');
      const nav=page.getByRole('navigation',{name:'主导航',exact:true});assert(await nav.getByRole('link',{name:'登录',exact:true}).isVisible());await nav.getByRole('link',{name:'登录',exact:true}).press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
    }
    checks.push({kind:'responsive',...m,sections:m.sections.map(({html,text,...s})=>s),heroText:undefined});
  }
  await page.setViewportSize({width:1920,height:1080});await page.goto(base);await ready();
  const orbit=page.locator('.wheel-orbit-light');const phase=()=>orbit.evaluate(e=>getComputedStyle(e).strokeDashoffset);
  const firstPhase=await phase();await page.waitForTimeout(350);assert.notEqual(await phase(),firstPhase);checks.push({kind:'orbit-progresses'});
  const cycle=page.locator('.hero-wheel'),auto=()=>page.locator('#wheel-hotspots .auto-active').getAttribute('data-node');
  const autoBefore=await auto();await page.waitForTimeout(2600);assert.notEqual(await auto(),autoBefore);assert.equal(await page.locator('#wheel-detail strong').innerText(),'研究证据');
  const design=page.getByRole('button',{name:'研究设计',exact:true}).first();await design.hover();assert.equal(await page.locator('#wheel-detail strong').innerText(),'研究设计');assert(await cycle.evaluate(e=>e.classList.contains('motion-held')));
  const heldPhase=await phase();await page.waitForTimeout(350);assert.equal(await phase(),heldPhase);
  await design.focus();await design.press('Space');assert.equal(await design.getAttribute('aria-pressed'),'true');
  await page.getByRole('link',{name:'免费注册',exact:true}).first().focus();await page.mouse.move(10,110);await page.waitForTimeout(1500);const resume=await phase();await page.waitForTimeout(350);assert.notEqual(await phase(),resume);
  assert.equal(await page.locator('#wheel-detail strong').innerText(),'研究设计');checks.push({kind:'auto-highlight-hover-keyboard-pause-resume-preserves-description'});
  await page.locator('#process').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(400);assert(await cycle.evaluate(e=>e.classList.contains('motion-off')));
  const cards=page.locator('#process-cards button');await cards.nth(0).hover();assert.equal(await cards.nth(0).getAttribute('aria-pressed'),'true');await cards.nth(1).focus();await cards.nth(1).press('Enter');assert.equal(await cards.nth(1).getAttribute('aria-pressed'),'true');await cards.nth(2).press('Space');assert.equal(await cards.nth(2).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#process-cards .current-step,#process-cards .process-tags,.process-hub').count(),0);checks.push({kind:'offscreen-pause-and-five-stage-mouse-enter-space'});
  await page.goto(base);await ready();await page.getByRole('link',{name:'了解科研流程',exact:true}).click();await page.waitForFunction(()=>Math.abs(document.querySelector('#process').getBoundingClientRect().top)<40);
  await page.getByRole('link',{name:'了解参与方式',exact:false}).click();await page.waitForFunction(()=>Math.abs(document.querySelector('#audience').getBoundingClientRect().top)<40);
  await page.goto(base);await ready();await page.locator('#home .actions').getByRole('link',{name:'免费注册',exact:true}).click();await page.waitForURL('**/pages/p004/');checks.push({kind:'existing-process-audience-registration-paths'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);await ready();assert.equal(await orbit.evaluate(e=>getComputedStyle(e.closest('svg')).display),'none');await design.press('Enter');assert.equal(await page.locator('#wheel-detail strong').innerText(),'研究设计');checks.push({kind:'reduced-motion-static-keyboard-readable'});
  await page.route('**/assets/hero-wheel-transparent.png',r=>r.abort());await page.goto(base);await page.locator('#wheel-hotspots button').first().waitFor();assert(await page.locator('#home h1').isVisible());await page.getByRole('button',{name:'研究成果',exact:true}).first().click();assert.equal(await page.locator('#wheel-detail strong').innerText(),'研究成果');
  await page.unroute('**/assets/hero-wheel-transparent.png');await page.reload();await ready();assert(await page.locator('.hero-wheel img').evaluate(e=>e.complete&&e.naturalWidth>0));checks.push({kind:'image-failure-text-and-description-refresh-recovery'});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await fs.writeFile(out+'result.json',JSON.stringify({passed:true,checks,errors,writes},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){await page.screenshot({path:out+'failure.png'}).catch(()=>{});await fs.writeFile(out+'failure.json',JSON.stringify({message:e.message,stack:e.stack,checks,errors,writes},null,2));console.error(e.message.slice(0,600));process.exitCode=1;}
finally{await context.close();await browser.close();}
