import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';

const out='docs/testing/evidence/public-ui-standard-2026-11-19/';
const base='http://127.0.0.1:19501';
const before=JSON.parse(await fs.readFile(out+'before.json','utf8'));
const widths=[1920,1440,1366,1200,1024,901,900,768,390,320];
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
const p=await context.newPage(),rows=[],checks=[],errors=[],writes=[],requests=[];
context.on('page',page=>observe(page));
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({url:r.url(),method:r.method()});});page.on('response',r=>{if(r.url().includes('/api/'))requests.push({url:r.url(),status:r.status(),method:r.request().method()});});}
observe(p);
async function goto(url,ready){await p.goto(base+url);await p.locator(ready).first().waitFor();await p.locator('main img').evaluateAll(es=>Promise.all(es.filter(e=>e.loading!=='lazy').map(e=>e.decode().catch(()=>{}))));await p.waitForTimeout(150);}
async function measure(){return p.evaluate(()=>{
 const g=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{tag:e.tagName,cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontSize,line:s.lineHeight,color:s.color,padding:s.padding};};
 const main=document.querySelector('main');
 return{text:main.textContent.replace(/\s+/g,''),links:[...main.querySelectorAll('a')].map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})),fields:[...main.querySelectorAll('input,select,textarea')].map(e=>({tag:e.tagName,type:e.getAttribute('type'),name:e.name,placeholder:e.getAttribute('placeholder'),required:e.required})),header:[...document.querySelectorAll('.ls-public>header,.ls-account-header-inner,.ls-public>header a,.ls-public>header button')].map(g),main:g(main),footer:g(document.querySelector('.ls-public>footer')),elements:[...main.querySelectorAll('h1,h2,h3,p,input,button')].map(g),width:innerWidth,scroll:document.documentElement.scrollWidth,containers:[...main.querySelectorAll('.initiative-container')].map(g),overflow:[...main.querySelectorAll('h1,h2,h3,p,a,input,button')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent})),images:[...main.querySelectorAll('img')].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),banners:[...main.querySelectorAll('.ls-help-banner,.ls-public-academic-hero')].map(e=>({height:e.getBoundingClientRect().height,image:getComputedStyle(e,'::before').backgroundImage,position:getComputedStyle(e,'::before').backgroundPosition,size:getComputedStyle(e,'::before').backgroundSize})),form:main.querySelector('.ls-auth-card')?g(main.querySelector('.ls-auth-card')):null,article:main.querySelector('.ls-help-article,.ls-public-academic-detail,.member-accept')?g(main.querySelector('.ls-help-article,.ls-public-academic-detail,.member-accept')):null};
});}
async function snap(name){await p.screenshot({path:out+name+'.png',fullPage:true});}
try{
 if(process.argv.includes('--tasks-only')){const previous=JSON.parse(await fs.readFile(out+'result.json','utf8'));assert.equal(previous.rows.length,90);rows.push(...previous.rows);}else for(const width of widths){
  await p.setViewportSize({width,height:width>900?1000:844});
  for(const [key,url,ready] of before.cases){
   await goto(url,ready);const m=await measure(),old=before.rows.find(e=>e.key===key&&e.width===width);
   assert.equal(m.footer.font,'14px');assert.equal(m.footer.line,'22.4px');assert(Math.abs(m.footer.w-(width>900?width*.76:width-48))<1);assert(m.scroll<=width+1,`${key}/${width} root overflow`);assert.deepEqual(m.overflow,[],`${key}/${width} inner overflow`);
   if(old){assert.equal(m.text,old.text.replace(/\s+/g,''),`${key}/${width} content`);assert.deepEqual(m.links,old.links,`${key}/${width} links`);assert.deepEqual(m.fields,old.fields,`${key}/${width} fields`);
    // The baseline records header and descendants in document order.
    assert.deepEqual(m.header,old.header,`${key}/${width} navigation`);
   }
   const content=key==='p007'?m.containers:[m.main];
   for(const e of content){assert(Math.abs(e.w-(width>900?width*.76:width-48))<1,`${key}/${width} content width`);assert(Math.abs(e.x-(width>900?width*.12:24))<1,`${key}/${width} left margin`);}
   const normal=width>900?'30px':'28px',hero=width>900?'40px':width>360?'32px':'30px';
   if(key==='p007'){
    assert.equal(m.main.w,width);assert.equal(m.elements.find(e=>e.tag==='H1').font,hero);assert(m.elements.filter(e=>e.tag==='H2').every(e=>e.font===normal));assert(m.elements.filter(e=>e.tag==='H3').every(e=>e.font==='20px'));
   }else if(['p003','p004','p005'].includes(key)){
    assert.equal(m.elements.find(e=>e.tag==='H1').font,hero);assert.equal(m.elements.find(e=>e.tag==='H2').font,normal);assert(m.form.w<=520.1);
    const layout=await p.locator('.ls-auth-grid').evaluate(e=>({display:getComputedStyle(e).display,direction:getComputedStyle(e).flexDirection}));assert.equal(layout.display,width<=1200?'flex':'grid');if(width<=1200)assert.equal(layout.direction,'column-reverse');
   }else{assert(m.elements.filter(e=>e.tag==='H1').every(e=>e.font===normal));}
   if(key==='p008'||key==='p011')assert(m.elements.filter(e=>e.tag==='H2').every(e=>e.font==='20px'));
   assert(m.elements.filter(e=>e.tag==='INPUT'||e.tag==='BUTTON').every(e=>e.font==='16px'));
   if(m.article)assert(m.article.w<=Math.min(m.main.w,key==='p009'?920:key==='p010'?680:1000)+1);
   if(m.banners.length)assert.equal(m.banners[0].height,width<=600?180:220);
   assert(m.images.every(e=>e.loaded),`${key}/${width} images loaded`);
   if([1920,1440,390,320].includes(width))await snap(`${key}-${width}`);if(width===1440&&['p007','p008','p011'].includes(key))await p.screenshot({path:out+key+'-preview.png'});
   rows.push({key,url,width,...m});
  }
 }
 checks.push({kind:'responsive',cases:rows.length,widths,contentLinksFieldsAndNavigationPreserved:true});
 await p.setViewportSize({width:1440,height:1000});
 for(const prior of before.exclusions.filter(e=>e.key!=='p006')){await goto('/pages/'+prior.key+'/', 'main');await p.waitForTimeout(300);const now=await p.evaluate(()=>({text:document.querySelector('main').textContent.replace(/\s+/g,''),layout:[...document.querySelectorAll('main,main h1,main h2')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,w:r.width,font:s.fontSize,padding:s.padding};})}));assert.equal(now.text,prior.text.replace(/\s+/g,''),prior.key+' excluded content');assert.deepEqual(now.layout,prior.layout,prior.key+' excluded layout');assert.equal(await p.locator('[data-public-ui="standard"]').count(),0,prior.key+' not opted in');}
 await p.evaluate(()=>sessionStorage.setItem('lingshu-demo-mode','true'));await goto('/pages/p006/','.ls-profile-card h1');assert.equal(await p.locator('[data-public-ui="standard"]').count(),0);const profile=await p.locator('main').evaluate(e=>({width:e.getBoundingClientRect().width,padding:getComputedStyle(e).padding,font:getComputedStyle(e.querySelector('h1')).fontSize}));assert.deepEqual(profile,{width:1440,padding:'48px',font:'40px'});await snap('excluded-p006');await p.evaluate(()=>sessionStorage.removeItem('lingshu-demo-mode'));
 checks.push({kind:'exclusions',pages:['p002','p006','p00','p001'],p006:'isolated demo profile; old anonymous baseline actually followed redirect to login'});
 await goto('/pages/p008/','.ls-help-card');
 const helpLinks=await p.locator('.ls-help-card h2 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));assert.equal(helpLinks.length,26);
 await p.getByPlaceholder('搜索注册、课题、访视、文献或资产').fill('不存在的帮助关键词-XZ');await p.getByText('未找到相关帮助',{exact:true}).waitFor();await snap('help-empty');await p.getByPlaceholder('搜索注册、课题、访视、文献或资产').fill('');await p.getByRole('button',{name:'功能规划',exact:true}).click();assert.equal(await p.locator('.ls-help-card').count(),3);await snap('help-planned');
 for(const url of helpLinks){await goto(url,'.ls-help-article h1');assert.equal(await p.locator('main h1').count(),1);assert.equal(await p.locator('.ls-help-banner-title').textContent(),'帮助你顺利开展研究');assert.equal(await p.locator('.ls-help-article h1').evaluate(e=>getComputedStyle(e).fontSize),'30px');assert.equal(await p.getByRole('link',{name:'返回帮助中心',exact:true}).getAttribute('href'),'/pages/p008/');}
 await goto('/pages/p009/?article=does-not-exist','.ls-help-article h1');assert.equal(await p.locator('main h1').textContent(),'帮助文章不存在');await snap('help-invalid');await p.getByRole('link',{name:'返回帮助中心',exact:true}).click();await p.locator('.ls-help-card').first().waitFor();
 checks.push({kind:'help-task',articles:26,planned:3,emptyAndInvalidAndReturn:true});
 await goto('/pages/p011/','.ls-public-academic-list li');const all=await p.locator('.ls-public-academic-list li').count();
 await p.getByRole('button',{name:'活动',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.ls-public-academic-list li')&&!document.querySelector('.ls-public-academic [role="status"]'));assert(await p.locator('.ls-public-academic-list li').count()>0);await p.getByLabel('活动状态',{exact:true}).selectOption('past');await p.waitForFunction(()=>!document.querySelector('.ls-public-academic [role="status"]')?.textContent.includes('正在读取'));
 await p.getByRole('button',{name:'全部',exact:true}).click();await p.locator('.ls-public-academic-list li').first().waitFor();await p.getByPlaceholder('搜索学术动态').fill('不存在的动态-XZ');await p.getByRole('button',{name:'搜索',exact:true}).click();await p.getByRole('button',{name:'清空筛选',exact:true}).waitFor();await snap('academic-empty-filter');await p.getByRole('button',{name:'清空筛选',exact:true}).click();await p.locator('.ls-public-academic-list li').first().waitFor();
 const title=await p.locator('.ls-public-academic-list h2 a').first().textContent();await p.locator('.ls-public-academic-list h2 a').first().click();await p.locator('.academic-reading h1').waitFor();assert.equal(await p.locator('.academic-reading h1').textContent(),title);await p.getByRole('link',{name:'返回动态列表',exact:true}).click();await p.locator('.ls-public-academic-list li').first().waitFor();assert.equal(await p.locator('.ls-public-academic-list li').count(),all);
 checks.push({kind:'academic-real-api',items:all,filterSearchDetailReturn:true});
 for(const key of ['p004','p005']){await goto('/pages/'+key+'/', '.ls-auth-card input');await p.locator('form button[type="submit"]').click();await p.locator('[aria-invalid="true"]').waitFor();await p.waitForFunction(()=>document.querySelector('[aria-invalid="true"]')===document.activeElement);await snap(key+'-validation');}
 await goto('/pages/p003/','.ls-auth-session');await p.getByRole('button',{name:'登录',exact:true}).click();assert.equal(await p.locator('input[name="email"]').evaluate(e=>e.validity.valueMissing),true);
 await goto('/pages/p010/','.member-accept .wp02-error');assert.equal(await p.getByRole('button',{name:'接受邀请',exact:true}).count(),0);
 checks.push({kind:'account-validation',emailRequests:0,invitationAccepts:0});
 await goto('/pages/p007/','.ls-initiative');await p.waitForFunction(()=>document.querySelector('.ls-initiative').dataset.motion==='on');const t1=await p.locator('.initiative-scene-question').evaluate(e=>getComputedStyle(e).transform);await p.waitForTimeout(300);const t2=await p.locator('.initiative-scene-question').evaluate(e=>getComputedStyle(e).transform);assert.notEqual(t1,t2);await p.locator('.initiative-actions a').nth(1).click();await p.waitForFunction(()=>document.querySelector('#initiative-participate').getBoundingClientRect().top<innerHeight);assert.equal(new URL(p.url()).hash,'#initiative-participate');await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.initiative-scene-question').evaluate(e=>getComputedStyle(e).animationName),'none');await p.emulateMedia({reducedMotion:'no-preference'});
 checks.push({kind:'initiative-animation',floatProgresses:true,anchor:true,reducedMotion:true});
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,checks,apiReads:requests.length,pageErrors:errors.length,businessWrites:writes.length}));
}finally{await fs.writeFile(out+'result.json',JSON.stringify({rows,checks,errors,writes,requests},null,2));await context.close();await browser.close();}
