import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const out='docs/testing/evidence/p002-full-page-light-2026-11-19/',base='http://127.0.0.1:19501/pages/p002/';
const before=JSON.parse(await fs.readFile(out+'before.json','utf8')),widths=[1920,1440,1366,1024,901,900,768,390,320];
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
const p=await context.newPage(),checks=[],errors=[],writes=[],requests=[];
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({url:r.url(),method:r.method()});});
p.on('response',r=>{if(r.url().includes('/academic-content')&&r.request().method()==='GET')requests.push({url:r.url(),status:r.status()});});
async function ready(){await p.locator('#process-cards button').first().waitFor();await p.waitForFunction(()=>!document.querySelector('[data-academic-activities] [role="status"]'));await p.locator('img').evaluateAll(es=>Promise.all(es.filter(e=>e.loading!=='lazy').map(e=>e.decode().catch(()=>{}))));}
const compact=s=>s.replace(/\s+/g,'');
try{
  for(const width of widths){
    await p.setViewportSize({width,height:width>900?1080:844});await p.goto(base);await ready();
    const m=await p.evaluate(()=>{
      const g=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{tag:e.tagName,cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontSize,line:s.lineHeight,padding:s.padding,color:s.color,display:s.display};};
      return{width:innerWidth,scroll:document.documentElement.scrollWidth,header:[...document.querySelectorAll('body>header,body>header .header-inner,body>header a,body>header button')].map(g),sections:[...document.querySelectorAll('main>section,body>footer')].map(e=>({id:e.id||'footer',text:e.innerText,links:[...e.querySelectorAll('a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})),geom:g(e),elements:[...e.querySelectorAll('h1,h2,h3,h4,p,.wrap,.button')].map(g)})),
        content:[...document.querySelectorAll('#assets>.wrap,#community>.wrap,#growth>.wrap,#audience>.wrap,#join>.wrap,body>footer>.wrap')].map(g),
        titles:[...document.querySelectorAll('#assets h2,#community h2,#growth h2,#audience h2,#join h2')].map(g),cards:[...document.querySelectorAll('#assets .asset-heading h3,#community .community-values h3,#growth .engine h3,#audience .audience-copy h3,#join .join-values h3,.portal-academic-grid h4')].map(g),
        body:[...document.querySelectorAll('#assets .asset-card>p,#community .community-values p,#growth .engine p,#growth .engine li,#audience .audience-copy p,#join .join-copy p,#join .join-values p,.portal-academic-grid article>p:not(.portal-academic-meta)')].map(g),
        overflow:[...document.querySelectorAll('#assets h2,#assets h3,#assets p,#assets .tags,#community h2,#community h3,#community h4,#community p,#growth h2,#growth h3,#growth p,#growth li,#audience h2,#audience h3,#audience p,#join h2,#join h3,#join p,footer p')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>({cls:e.className,tag:e.tagName,text:e.textContent})),
        cropped:[...document.querySelectorAll('.audience-copy h3,.audience-copy p')].filter(e=>{const a=e.getBoundingClientRect(),b=e.closest('.audience-card').getBoundingClientRect();return a.top<b.top-1||a.bottom>b.bottom+1||a.left<b.left-1||a.right>b.right+1;}).map(e=>e.textContent),h1:document.querySelectorAll('main h1').length};
    });
    const old=before.find(x=>x.width===width);assert(m.scroll<=width+1);assert.deepEqual(m.overflow,[],JSON.stringify(m.overflow));assert.deepEqual(m.cropped,[]);assert.equal(m.h1,1);assert.deepEqual(m.header,old.header,'navigation unchanged');
    for(const section of m.sections){const prior=old.sections.find(x=>x.id===section.id);if(section.id==='join'&&width<=900)assert(compact(section.text).includes(compact(prior.text)),'motto is restored in small screen flow');else assert.equal(compact(section.text),compact(prior.text),'full content preserved '+section.id);assert.deepEqual(section.links,prior.links,'same links '+section.id);}
    for(const id of['home','process']){const now=m.sections.find(x=>x.id===id),prior=old.sections.find(x=>x.id===id);assert.deepEqual(now,prior,'approved entry section unchanged '+id);}
    if(width>900)for(const e of m.content){assert(Math.abs(e.w/width-.76)<.001);assert(Math.abs(e.x/width-.12)<.001);}
    assert(m.titles.every(x=>x.font===(width>900?'30px':'28px')));assert(m.cards.every(x=>x.font==='20px'));assert(m.body.every(x=>x.font==='16px'));
    const lines=await p.locator('#audience .audience-copy h3').evaluateAll(es=>es.map(e=>{const rows=new Map(),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode())for(let i=0;i<n.textContent.length;i++){const ch=n.textContent[i];if(!ch.trim())continue;const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const top=Math.round(r.getBoundingClientRect().top);rows.set(top,(rows.get(top)||'')+ch);}return [...rows.values()];}));
    assert(lines.flat().every(s=>s.length>1),'no orphan title characters: '+JSON.stringify(lines));m.audienceTitleLines=lines;
    assert(['医疗机构','高校','科研院所'].every(word=>lines[4].some(line=>line.includes(word))),'institution title keeps each phrase intact');
    for(const id of['assets','community','growth','audience','join']){
      await p.locator('#'+id).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
      await p.waitForFunction(id=>document.getElementById(id).classList.contains('entered'),id);
      await p.locator('#'+id).evaluate(e=>Promise.all(e.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
      await p.waitForFunction(id=>[...document.querySelectorAll('#'+id+' .asset-card,#'+id+' .engine')].every(e=>Number(getComputedStyle(e).opacity)>.99),id);
      await p.screenshot({path:out+id+'-'+width+'.png'});
    }
    await p.locator('body>footer').scrollIntoViewIfNeeded();await p.screenshot({path:out+'footer-'+width+'.png'});
    checks.push({kind:'responsive',...m,sections:m.sections.map(({text,links,...e})=>e)});
  }
  await p.setViewportSize({width:1440,height:1080});await p.goto(base);await ready();await p.locator('#community').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.waitForTimeout(1100);
  const canvas=p.locator('.network-canvas');const initial=await p.locator('#network-hotspots .auto-active').getAttribute('data-node');await p.waitForTimeout(1300);assert.notEqual(await p.locator('#network-hotspots .auto-active').getAttribute('data-node'),initial);assert.equal(await p.locator('#network-description strong').innerText(),'研究证据');
  const collaboration=p.locator('#network-hotspots button').nth(3);await collaboration.hover();assert.equal(await p.locator('#network-description strong').innerText(),'研究协作');assert(await canvas.evaluate(e=>e.classList.contains('motion-held')));await collaboration.press('Enter');assert.equal(await collaboration.getAttribute('aria-pressed'),'true');await p.locator('#network-hotspots button').nth(4).press('Space');assert.equal(await p.locator('#network-description strong').innerText(),'研究者网络');
  await p.getByRole('link',{name:'全部活动',exact:false}).focus();await p.mouse.move(5,5);await p.waitForTimeout(1400);assert.equal(await p.locator('#network-description strong').innerText(),'研究者网络');checks.push({kind:'network-seven-node-auto-hover-enter-space-manual-description-preserved'});
  await p.locator('#audience').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.locator('#audience-cards button').last().click();assert.equal(await p.locator('#audience-cards button').last().getAttribute('aria-pressed'),'true');assert((await p.locator('#role-join').innerText()).includes('机构研究'));await p.locator('#role-join').click();await p.waitForURL('**/pages/p004/');checks.push({kind:'five-role-selection-context-and-original-registration'});
  await p.goto(base);await ready();const first=p.locator('.portal-academic-grid h4 a').first(),href=await first.getAttribute('href');assert(href.includes('/pages/p011/'));await first.click();await p.waitForURL('**/pages/p011/**');await p.locator('.academic-reading h1').waitFor();await p.goto(base);await ready();await p.getByRole('link',{name:'全部活动',exact:false}).click();await p.waitForURL('**/pages/p011/**');await p.locator('.ls-public-academic-list li').first().waitFor();checks.push({kind:'actual-public-activity-detail-and-list'});
  await p.goto(base);await ready();const beian=p.locator('footer a[href="https://beian.miit.gov.cn/"]');assert.equal(await beian.innerText(),'京ICP备2026051837号');assert((await p.locator('footer p').innerText()).includes('鹏小传科技（北京）有限公司'));await p.locator('#join').getByRole('link',{name:'查看帮助中心',exact:true}).click();await p.waitForURL('**/pages/p008/');checks.push({kind:'help-company-and-registration-information'});
  await p.route('**/api/**/academic-content*',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));await p.goto(base);await p.locator('[data-academic-activities] [role="alert"]').waitFor();await p.unroute('**/api/**/academic-content*');await p.getByRole('button',{name:'重新读取',exact:true}).click();await p.locator('.portal-academic-grid article').first().waitFor();checks.push({kind:'controlled-activity-failure-and-real-retry'});
  await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base);await ready();await p.locator('#community').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await p.locator('#network-hotspots button').last().press('Enter');assert.equal(await p.locator('#network-description strong').innerText(),'研究成果');assert.equal(await p.locator('.network-pulse').first().evaluate(e=>getComputedStyle(e).display),'none');checks.push({kind:'reduced-motion-keeps-community-controls'});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert(requests.some(x=>x.status===200));
  await fs.writeFile(out+'result.json',JSON.stringify({passed:true,checks,errors,writes,requests},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){await p.screenshot({path:out+'failure.png'}).catch(()=>{});await fs.writeFile(out+'failure.json',JSON.stringify({message:e.message,stack:e.stack,checks,errors,writes},null,2));console.error(e.message.slice(0,600));process.exitCode=1;}
finally{await context.close();await browser.close();}
