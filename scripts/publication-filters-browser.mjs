// Real local Chrome/API/data. No approvals, source writes, model calls or demo responses.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {normalizePublicationFilters,matchesPublicationFilters} from '../src/publication-filters.js';
const base='http://127.0.0.1:19501',root='/Users/mac/aisciencesys/',{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out=root+'researchhub/docs/testing/evidence/publication-filters-browser-'+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium,browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],checks=[],network=[],warnings=[],errors=[],metrics=[],mutations=[];let stage='setup',page;
try{
 for(const role of ['owner','admin','anonymous']){
  stage=role+' setup';const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(context);
  if(role!=='anonymous')assert.equal((await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);
  const collection=role==='anonymous'?'publications':'member/publications',api=base+'/api/hub-sources/'+collection;
  const initial=await(await context.request.get(api+'?limit=20')).json();assert(initial.items?.length>0);const all=initial.items;
  // Inventory is 13; reduce the REAL outgoing page size to 2 so the unchanged
  // load-more control is exercised. No JSON response or database row is fabricated.
  await context.route('**/api/**',route=>{
   if(!['GET','HEAD'].includes(route.request().method())){mutations.push(route.request().method()+' '+new URL(route.request().url()).pathname);return route.abort();}
   const url=new URL(route.request().url());if(/\/hub-sources\/(?:member\/)?publications$/.test(url.pathname)){url.searchParams.set('limit','2');return route.continue({url:url.href});}return route.continue();
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push({role,message:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push({role,type:m.type(),message:m.text().slice(0,220)});});
  page.on('response',r=>{const url=new URL(r.url());if(url.pathname.startsWith('/api/hub-sources'))network.push({role,path:url.pathname,query:url.search,status:r.status()});});
  const ready=()=>page.waitForFunction(()=>/^已加载/.test(document.querySelector('#real-evidence-title')?.textContent??''));
  await page.goto(base+'/pages/e01/');await ready();
  await page.screenshot({path:out+'/'+role+'-initial.png'});
  const form=page.getByRole('form',{name:'筛选条件'}),applyButton=page.getByRole('button',{name:'应用筛选',exact:true}),clear=page.getByRole('button',{name:'清空全部',exact:true});
  const expectedResponse=()=>page.waitForResponse(r=>new URL(r.url()).pathname===new URL(api).pathname&&r.status()===200);
  const apply=async()=>{const waiting=expectedResponse();await applyButton.click();const d=await(await waiting).json();await ready();return d;};
  const reset=async()=>{const waiting=expectedResponse();await clear.click();await waiting;await ready();};
  stage=role+' draft and AND';const before=network.length;await form.getByRole('checkbox',{name:'原创研究',exact:true}).check();await form.getByRole('checkbox',{name:'抑郁障碍',exact:true}).check();await page.getByText('有未应用的筛选修改',{exact:true}).waitFor();assert.equal(network.length,before);
  const combined=await apply(),f=normalizePublicationFilters({types:['original'],diseases:['depression']});assert.equal(combined.counts.matchedRecords,all.filter(x=>matchesPublicationFilters(x,f)).length);assert(combined.counts.matchedRecords>0);
  await page.screenshot({path:out+'/'+role+'-combined.png'});
  const selected=combined.items[0];await page.getByRole('button',{name:selected.title,exact:true}).click();await page.getByRole('button',{name:'研究设计',exact:true}).click();
  await page.locator('.paper-classification-evidence summary').first().click();await page.locator('.paper-detail-body').getByText(selected.classification.claims[0].quote,{exact:true}).waitFor();await page.screenshot({path:out+'/'+role+'-classification-evidence.png'});
  await page.locator('.paper-detail-actions').getByRole('link',{name:'查看完整详情'}).click();await page.getByRole('heading',{name:selected.title,exact:true}).waitFor();await page.goBack();await ready();assert(await form.getByRole('checkbox',{name:'原创研究',exact:true}).isChecked());assert(await form.getByRole('checkbox',{name:'抑郁障碍',exact:true}).isChecked());
  checks.push({role,check:'draft_apply_AND_traceable_labels_and_detail_return',matched:combined.counts.matchedRecords});
  stage=role+' OR remove and clear';await form.getByRole('checkbox',{name:'系统综述 / Meta分析',exact:true}).check();const or=await apply();assert.equal(or.counts.matchedRecords,all.filter(x=>matchesPublicationFilters(x,normalizePublicationFilters({types:['original','systematic'],diseases:['depression']}))).length);
  const removed=expectedResponse();await page.getByRole('button',{name:'移除筛选：抑郁障碍',exact:true}).click();const removedPage=await(await removed).json();await ready();assert.equal(removedPage.appliedFilters.diseases.length,0);await reset();assert.equal(await form.getByRole('checkbox',{name:'原创研究',exact:true}).isChecked(),false);
  stage=role+' pages';const seen=[];while(true){const ids=await page.locator('.paper-rows article h2 button').allTextContents();seen.splice(0,seen.length,...ids);const more=page.getByRole('button',{name:'加载更多获准文献',exact:true});if(await more.count()===0)break;const waiting=expectedResponse();await more.click();await waiting;await ready();assert(seen.length<100);}
  assert.equal(seen.length,all.length);assert.equal(new Set(seen).size,all.length);checks.push({role,check:'OR_remove_clear_and_real_HTTP_2_per_page_load_more',count:seen.length});
  stage=role+' extras';await form.getByRole('button',{name:'更多筛选',exact:true}).click();await form.getByRole('checkbox',{name:'英文',exact:true}).check();await form.getByRole('radio',{name:'当前正文可读',exact:true}).check();const lang=await apply();assert.equal(lang.counts.matchedRecords,all.filter(x=>matchesPublicationFilters(x,normalizePublicationFilters({languages:['en'],fulltext:'readable'}))).length);
  await reset();await form.getByRole('radio',{name:'自定义范围',exact:true}).check();await form.getByLabel('开始日期',{exact:true}).fill('2026-01-01');await form.getByLabel('结束日期',{exact:true}).fill('2026-12-31');const dated=await apply();assert.equal(dated.counts.matchedRecords,all.filter(x=>matchesPublicationFilters(x,normalizePublicationFilters({year:'custom',from:'2026-01-01',to:'2026-12-31'}))).length);await reset();
  const design=form.locator('section').filter({has:page.getByRole('heading',{name:'研究设计',exact:true})});await design.getByRole('checkbox',{name:'未识别',exact:true}).check();const unknown=await apply();assert.equal(unknown.counts.matchedRecords,all.filter(x=>!x.classification.values.designs.length).length);await reset();
  await form.getByRole('checkbox',{name:'RCT',exact:true}).check();await form.getByRole('checkbox',{name:'综述',exact:true}).check();const empty=await apply();assert.equal(empty.items.length,0);await page.getByRole('heading',{name:'当前筛选无匹配论文'}).waitFor();await reset();checks.push({role,check:'date_language_fulltext_unknown_and_empty_states'});
  stage=role+' visual';for(const width of [1440,1280,390,320]){await page.setViewportSize({width,height:1000});await page.locator('.paper-filter-scroll').evaluate(el=>el.scrollTo(0,0));await page.screenshot({path:out+'/'+role+'-'+width+'.png'});metrics.push({role,...await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,regions:[...document.querySelector('.paper-work').children].map(x=>x.className),optionFont:getComputedStyle(document.querySelector('.paper-option')).fontSize,optionLine:getComputedStyle(document.querySelector('.paper-option')).lineHeight}))});}
  await page.setViewportSize({width:1440,height:1000});
  if(role!=='anonymous'){
   stage=role+' late response';let release,heldResolve,settledResolve,heldOnce=false;
   const gate=new Promise(ok=>{release=ok;}),held=new Promise(ok=>{heldResolve=ok;}),settled=new Promise(ok=>{settledResolve=ok;});
   const holdHandler=async route=>{const url=new URL(route.request().url()),f=JSON.parse(url.searchParams.get('filters')||'{}');url.searchParams.set('limit','2');
    if(!heldOnce&&f.types?.length===1&&f.types[0]==='original'){heldOnce=true;const real=await route.fetch({url:url.href});heldResolve();await gate;await route.fulfill({response:real});settledResolve();return;}return route.continue({url:url.href});};
   await page.route('**/api/hub-sources/member/publications?**',holdHandler);await form.getByRole('checkbox',{name:'原创研究',exact:true}).check();await applyButton.click();await held;
   await form.getByRole('checkbox',{name:'原创研究',exact:true}).uncheck();await form.getByRole('checkbox',{name:'系统综述 / Meta分析',exact:true}).check();const latest=await apply();release();await settled;await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
   assert((await page.locator('#real-evidence-title').innerText()).includes('/ '+latest.counts.matchedRecords+' 篇'));assert.equal(await page.getByRole('button',{name:'移除筛选：原创研究',exact:true}).count(),0);
   await page.unroute('**/api/hub-sources/member/publications?**',holdHandler);await reset();checks.push({role,check:'held_real_HTTP_old_filter_response_does_not_overwrite_new_filter'});
   stage=role+' fail recover';let failed=false;await page.route('**/api/hub-sources/member/publications?**',route=>{if(!failed){failed=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'PUBLICATION_UI_ONLY_503',message:'本机只读恢复演练'})});}const url=new URL(route.request().url());url.searchParams.set('limit','2');return route.continue({url:url.href});});
   await form.getByRole('checkbox',{name:'原创研究',exact:true}).check();await applyButton.click();await page.getByRole('alert').waitFor();assert(await form.getByRole('checkbox',{name:'原创研究',exact:true}).isChecked());const wait=expectedResponse();await page.getByRole('button',{name:'重试',exact:true}).click();await wait;await ready();await page.screenshot({path:out+'/'+role+'-recovered.png'});await page.unroute('**/api/hub-sources/member/publications?**');await reset();checks.push({role,check:'UI_only_503_keeps_inputs_and_real_server_retry'});
  }
  await page.screenshot({path:out+'/'+role+'-final.png'});
 }
 for(const role of ['owner','admin']){
  stage=role+' native200';const context=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/paper-filter-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/video'}});contexts.push(context);
  const settings=context.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');
  assert.equal((await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);
  page=await context.newPage();await page.goto(base+'/pages/e01/');await page.waitForFunction(()=>/^已加载/.test(document.querySelector('#real-evidence-title')?.textContent??''));
  const form=page.getByRole('form',{name:'筛选条件'});await form.getByRole('checkbox',{name:'原创研究',exact:true}).focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'应用筛选',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.paper-chips')?.textContent.includes('原创研究')&&/^已加载/.test(document.querySelector('#real-evidence-title')?.textContent??''));
  const measure=await page.evaluate(()=>({width:innerWidth,outerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.querySelector('.paper-option')).fontSize}));assert.equal(measure.dpr,2);assert.equal(measure.scale,1);assert(measure.width<measure.outerWidth/2+20);assert(measure.scrollWidth<=measure.width+1);assert.equal(measure.font,'14px');
  metrics.push({role,nativeZoom:200,...measure});await page.screenshot({path:out+'/'+role+'-native200-viewport.png'});
  const cdp=await context.newCDPSession(page),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'/'+role+'-native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();checks.push({role,check:'native_Chrome_200_keyboard_checkbox_apply'});
 }
 assert.equal(errors.length,0);assert.equal(mutations.length,0);
 writeFileSync(out+'/result.json',JSON.stringify({passed:true,checks,network,warnings,errors,metrics,mutations,modelCalls:0,realOutgoingPageSize:2},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){if(page)await page.screenshot({path:out+'/FAILED.png'}).catch(()=>{});writeFileSync(out+'/result.json',JSON.stringify({passed:false,stage,error:e.message,checks,network,warnings,errors,metrics},null,2));console.error(JSON.stringify({stage,error:e.message,evidence:out}));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
