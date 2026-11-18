import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-guidance-citations/fixture.json'));
const mode=process.argv[2];assert.ok(['flow','visual','viewport-flow','experience','unknown','unknown-remove','read-fail','auth'].includes(mode));
const out=root+'docs/test/evidence/2026-10-31-guidance-plan-citations/'+mode+'-'+randomUUID().slice(0,8)+'/';mkdirSync(out+'video',{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const options={headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'};
const browser=await chromium.launch(options),checks=[],network=[],errors=[],warnings=[],expectedFaults=[],metrics=[],contexts=[];let activeFault=false,zoom;
const scopeHeaders={'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
async function login(c,actor){assert.equal((await c.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}})).status(),201);}
async function context(actor,viewport={width:1440,height:1000}){const c=await browser.newContext({viewport,extraHTTPHeaders:scopeHeaders,recordVideo:{dir:out+'video'}});contexts.push(c);await login(c,actor);return c;}
function watch(p,name){p.on('pageerror',e=>errors.push({name,message:e.message}));p.on('console',m=>{if(m.type()==='warning')warnings.push({name,message:m.text()});if(m.type()==='error')(activeFault?expectedFaults:errors).push({name,message:m.text()});});p.on('response',r=>{const path=new URL(r.url()).pathname;if(path.includes('research-plan-drafts'))network.push({name,path,method:r.request().method(),status:r.status()});});}
const path=f=>'/api/research-plan-drafts/'+f.planId+'/guidance-citations';
async function current(c,f,version=''){const r=await c.request.get(base+path(f)+(version?'?versionNo='+version:''));assert.equal(r.status(),200,await r.text());assert.equal(r.headers()['cache-control'],'no-store');return r.json();}
async function open(p,f){await p.goto(base+f.url);await p.getByText(f.actor+'@example.org',{exact:false}).first().waitFor();const panel=p.locator('.citation-panel');await panel.getByText('核对并管理方案条款引用',{exact:true}).click();await panel.getByLabel('已保存方案段落',{exact:true}).waitFor();return panel;}
async function select(panel,v,clauseIndex=0,paragraphIndex=0){const s=v.sources[0],cl=s.clauseDetails.clauses[clauseIndex];await panel.getByLabel('已保存方案段落',{exact:true}).selectOption(String(paragraphIndex));await panel.getByLabel('指南或研究标准',{exact:true}).selectOption(s.documentId);await panel.getByLabel('关键条款',{exact:true}).selectOption(cl.id);await panel.getByRole('checkbox').check();return{s,cl};}
async function post(p,f,button){const response=p.waitForResponse(r=>new URL(r.url()).pathname===path(f)&&r.request().method()==='POST');await button.click();const r=await response;assert.equal(r.status(),201,await r.text());return r.json();}
async function measure(p,name){
 const m=await p.evaluate(()=>{
  const main=document.querySelector('.platform-main'),q=document.querySelector('.citation-panel .guidance-clauses__quote'),t=document.querySelector('.citation-panel .citation-reading'),s=document.querySelector('.citation-panel select');
  return{width:innerWidth,docWidth:document.documentElement.scrollWidth,mainWidth:main.clientWidth,mainScroll:main.scrollWidth,
   quote:q&&[getComputedStyle(q).fontSize,getComputedStyle(q).lineHeight],target:t&&[getComputedStyle(t).fontSize,getComputedStyle(t).lineHeight],
   input:s&&{font:getComputedStyle(s).fontSize,line:getComputedStyle(s).lineHeight,appearance:getComputedStyle(s).appearance,height:s.getBoundingClientRect().height,labelLine:getComputedStyle(s.closest('label')).lineHeight},
   clips:[...document.querySelectorAll('.citation-panel p,.citation-panel blockquote,.citation-panel h3,.citation-panel h4')].filter(e=>e.checkVisibility()).flatMap(e=>{const range=document.createRange();range.selectNodeContents(e);const a=range.getBoundingClientRect(),b=e.getBoundingClientRect();return a.width&&(a.left<b.left-1||a.right>b.right+1)?[e.textContent.slice(0,80)]:[];})};
 });
 metrics.push({name,...m});assert.ok(m.docWidth<=m.width+1&&m.mainScroll<=m.mainWidth+1,JSON.stringify(m));
 assert.equal(m.input.font,'14px');assert.equal(m.input.labelLine,'22px');assert.ok(m.input.height>=44);
 // Chromium native select computes line-height:normal despite the declared 22px.
 assert.ok(m.input.line==='22px'||m.input.appearance==='auto'&&m.input.line==='normal');
 if(m.quote)assert.deepEqual(m.quote,['16px','28px']);if(m.target)assert.deepEqual(m.target,['16px','28px']);assert.deepEqual(m.clips,[]);
}
async function shot(p,name,native=false){if(native){const cd=await p.context().newCDPSession(p),r=await cd.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+name+'.png',Buffer.from(r.data,'base64'));await cd.detach();}else await p.screenshot({path:out+name+'.png'});}
async function viewportFlow(c,p,f,name,native=false,keep=false){
 watch(p,name);const panel=await open(p,f),v=await current(c,f);
 const target=v.paragraphs.findIndex(x=>x.text.length>100&&x.text.includes('数据来源')&&x.text.includes('质控'));assert.ok(target>=0,'Use a substantive design paragraph, not a heading');
 const s=v.sources[0],ci=s.clauseDetails.clauses.findIndex(cl=>!v.citations.some(ref=>ref.documentId===s.documentId&&ref.details?.clauses[0].id===cl.id&&ref.target?.start===v.paragraphs[target].start));assert.ok(ci>=0);
 await select(panel,v,ci,target);await measure(p,name+'-preview');
 let r=await post(p,f,panel.getByRole('button',{name:'保存人工引用（不调用AI）',exact:true}));assert.equal(r.appliedVersionNo,v.version+1);const id=r.view.citations.at(-1).citationId;
 await p.getByText('已保存到服务端版本 '+r.appliedVersionNo+'。',{exact:true}).waitFor();const item=panel.locator('.citation-list >li').last();await item.locator('details >summary').first().click();await item.locator('.guidance-clauses__quote').scrollIntoViewIfNeeded();await measure(p,name+'-saved');await shot(p,name+'-saved',native);
 const old=p.waitForResponse(x=>x.url().endsWith('/guidance-citations?versionNo='+v.version));await panel.getByLabel('引用记录版本',{exact:true}).selectOption(String(v.version));assert.equal((await(await old).json()).version,v.version);await panel.getByText('固定历史，只读。',{exact:false}).waitFor();assert.equal(await panel.getByRole('button',{name:'解除本条引用',exact:true}).count(),0);
 await panel.getByLabel('引用记录版本',{exact:true}).selectOption('');await panel.getByRole('button',{name:'解除本条引用',exact:true}).last().waitFor();assert.equal((await current(c,f)).citations.at(-1).citationId,id);
 if(!keep){r=await post(p,f,panel.getByRole('button',{name:'解除本条引用',exact:true}).last());assert.equal(r.appliedVersionNo,v.version+2);assert.equal(r.view.citations.length,v.citations.length);await p.getByText('已保存到服务端版本 '+r.appliedVersionNo+'。',{exact:true}).waitFor();}
 checks.push(name+': actual save, exact old history, '+(keep?'meaningful reference retained':'remove')+' with no clipping');
}
try{
 if(mode==='flow'){
  for(const f of fixture.fixtures){const c=await context(f.actor),p=await c.newPage();watch(p,f.actor);let v=await current(c,f),panel=await open(p,f);const before=v.version,count=v.citations.length;
   await panel.getByRole('button',{name:'保存人工引用（不调用AI）',exact:true}).click();await panel.getByRole('alert').waitFor();assert.equal((await current(c,f)).version,before);checks.push(f.actor+': incomplete confirmation does not write');
   const {s,cl}=await select(panel,v);await measure(p,f.actor+'-preview');await shot(p,f.actor+'-preview');
   let r=await post(p,f,panel.getByRole('button',{name:'保存人工引用（不调用AI）',exact:true}));assert.equal(r.appliedVersionNo,before+1);const ref=r.view.citations.at(-1);assert.equal(ref.details.clauses[0].quote,cl.quote);assert.equal(ref.details.clauses[0].pdfPage,cl.pdfPage);assert.equal(ref.details.clauses[0].printedPage,cl.printedPage);
   await p.getByText('已保存到服务端版本 '+r.appliedVersionNo+'。',{exact:true}).waitFor();await panel.getByRole('button',{name:'解除本条引用',exact:true}).last().waitFor();
   await p.reload();panel=await open(p,f);v=await current(c,f);assert.equal(v.citations.length,count+1);assert.equal(v.citations.at(-1).citationId,ref.citationId);checks.push(f.actor+': real saved version survives reload with exact approved quote and two page numbers');
   const old=p.waitForResponse(r=>r.url().endsWith('/guidance-citations?versionNo='+before));await panel.getByLabel('引用记录版本',{exact:true}).selectOption(String(before));assert.equal((await(await old).json()).version,before);await panel.getByText('固定历史，只读。',{exact:false}).waitFor();assert.equal(await panel.getByRole('button',{name:'解除本条引用',exact:true}).count(),0);checks.push(f.actor+': fixed history never substitutes current references');
   await panel.getByLabel('引用记录版本',{exact:true}).selectOption('');await panel.getByRole('button',{name:'解除本条引用',exact:true}).last().waitFor();r=await post(p,f,panel.getByRole('button',{name:'解除本条引用',exact:true}).last());assert.equal(r.view.citations.length,count);assert.equal(r.appliedVersionNo,before+2);await p.getByText('已保存到服务端版本 '+r.appliedVersionNo+'。',{exact:true}).waitFor();checks.push(f.actor+': remove appends without altering history');
   await panel.getByLabel('已保存方案段落',{exact:true}).waitFor();v=await current(c,f);await select(panel,v);r=await post(p,f,panel.getByRole('button',{name:'保存人工引用（不调用AI）',exact:true}));await p.getByText('已保存到服务端版本 '+r.appliedVersionNo+'。',{exact:true}).waitFor();await panel.locator('.citation-list >li').last().locator('details >summary').first().click();await measure(p,f.actor+'-saved');await shot(p,f.actor+'-saved');
   const other=fixture.fixtures.find(x=>x.actor!==f.actor);assert.equal((await c.request.get(base+path(other))).status(),403);assert.equal((await c.request.post(base+path(f),{data:{baseVersionNo:r.appliedVersionNo,requestKey:'deny-extra-'+randomUUID(),action:'approve'}})).status(),400);checks.push(f.actor+': other owner and governance/unknown fields refused');await c.close();
  }
 }else if(mode==='visual'){
  for(const f of fixture.fixtures)for(const [name,width,height]of [['desktop',1440,1000],['mobile390',390,844],['mobile320',320,700]]){
   const c=await context(f.actor,{width,height}),p=await c.newPage();watch(p,name+'-'+f.actor);const panel=await open(p,f),first=panel.locator('.citation-list >li').first();await first.locator('details >summary').first().click();await first.locator('.guidance-clauses__quote').scrollIntoViewIfNeeded();await measure(p,name+'-'+f.actor);await shot(p,name+'-'+f.actor);const summary=first.locator('.guidance-clauses__list li details > summary').last();await summary.scrollIntoViewIfNeeded();await summary.focus();await p.keyboard.press('Enter');assert.ok(await summary.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);}));await shot(p,name+'-'+f.actor+'-locator');checks.push(name+'/'+f.actor+': real reference, keyboard locator, typography and no clipping');await c.close();
  }
  zoom=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/guidance-citation-zoom-'),{...options,viewport:null,args:['--window-size=1440,1000'],extraHTTPHeaders:scopeHeaders,recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});await zoom.pages()[0].goto('chrome://settings/appearance');await zoom.pages()[0].locator('#zoomLevel').selectOption('2');
  for(const f of fixture.fixtures){await login(zoom,f.actor);const p=await zoom.newPage();watch(p,'native200-'+f.actor);const panel=await open(p,f);await panel.locator('.citation-list >li').first().locator('details >summary').first().click();await panel.locator('.guidance-clauses__quote').first().scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>devicePixelRatio),2);await measure(p,'native200-'+f.actor);await shot(p,'native200-'+f.actor,true);checks.push(f.actor+': actual Chrome zoom=2 with real cited text');await p.close();}await zoom.close();zoom=null;
 }else if(mode==='viewport-flow'||mode==='experience'){
  for(const f of fixture.fixtures)for(const [name,width,height]of (mode==='experience'?[['experience',1440,1000]]:[['desktop',1440,1000],['mobile390',390,844],['mobile320',320,700]])){
   const c=await context(f.actor,{width,height}),p=await c.newPage();await viewportFlow(c,p,f,name+'-'+f.actor,false,mode==='experience');await c.close();
  }
  if(mode==='viewport-flow'){
   zoom=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/guidance-citation-zoom-'),{...options,viewport:null,args:['--window-size=1440,1000'],extraHTTPHeaders:scopeHeaders,recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});await zoom.pages()[0].goto('chrome://settings/appearance');await zoom.pages()[0].locator('#zoomLevel').selectOption('2');
   for(const f of fixture.fixtures){await login(zoom,f.actor);const p=await zoom.newPage();assert.equal(await p.evaluate(()=>devicePixelRatio),2);await viewportFlow(zoom,p,f,'native200-'+f.actor,true);await p.close();}await zoom.close();zoom=null;
  }
 }else if(mode==='unknown'||mode==='unknown-remove'){
  const f=fixture.fixtures[0],c=await context(f.actor),p=await c.newPage();watch(p,'unknown-submit');const v=await current(c,f),panel=await open(p,f);
  if(mode==='unknown'){const index=v.sources[0].clauseDetails.clauses.findIndex(cl=>!v.citations.some(ref=>ref.documentId===v.sources[0].documentId&&ref.details?.clauses[0].id===cl.id));assert.ok(index>=0,'Use a new allowed relationship, never overwrite the failed receipt');await select(panel,v,index);}else assert.ok(v.citations.length>1,'Only remove this round supplementary own reference');
  let dropped=false,committed;
  await c.route('**'+path(f),async route=>{if(route.request().method()!=='POST'||dropped)return route.continue();dropped=true;activeFault=true;const r=await route.fetch();assert.equal(r.status(),201);committed=await r.json();writeFileSync(out+'committed-before-loss.json',JSON.stringify(committed,null,2));await route.abort('failed');});
  await panel.getByRole('button',{name:mode==='unknown'?'保存人工引用（不调用AI）':'解除本条引用',exact:true}).last().click();await p.getByRole('alert').filter({hasText:'连接失败或超时'}).waitFor();assert.equal((await current(c,f)).version,v.version+1);
  if(mode==='unknown-remove')await p.waitForResponse(r=>new URL(r.url()).pathname==='/api/research-plan-drafts/'+f.planId+'/design'&&r.request().method()==='GET');
  const retry=panel.getByRole('button',{name:'重试上次未确认提交',exact:false});await retry.waitFor({timeout:8000});activeFault=false;const r=await post(p,f,retry);assert.equal(r.replayed,true);assert.equal(r.appliedVersionNo,committed.appliedVersionNo);assert.equal((await current(c,f)).version,v.version+1);checks.push(mode+': real committed response loss retries exact original key without a second version');await shot(p,'replayed');await c.close();
 }else if(mode==='read-fail'){
  const f=fixture.fixtures[0],c=await context(f.actor,{width:390,height:844}),p=await c.newPage();watch(p,'read-failure');let broken=true;
  await c.route('**'+path(f),route=>route.request().method()==='GET'&&broken?(activeFault=true,route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'本轮引用读取故障夹具'})})):route.continue());
  await p.goto(base+f.url);const panel=p.locator('.citation-panel');await panel.getByText('核对并管理方案条款引用',{exact:true}).click();await panel.getByRole('alert').waitFor();assert.equal(await panel.locator('.guidance-clauses__quote').count(),0);broken=false;activeFault=false;await panel.getByRole('button',{name:'重试读取引用',exact:true}).click();await panel.getByLabel('已保存方案段落',{exact:true}).waitFor();checks.push('UI-only 503 removes cached excerpts, explicit retry reads actual backend');await shot(p,'recovered');await c.close();
 }else{
  const f=fixture.fixtures[0],c=await context(f.actor),p=await c.newPage();watch(p,'auth-switch');let panel=await open(p,f);await panel.locator('.citation-list >li').first().locator('details >summary').first().click();await panel.locator('.guidance-clauses__quote').first().waitFor();activeFault=true;await login(c,'admin');await p.bringToFront();await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.getByRole('alert').filter({hasText:'权限'}).first().waitFor();assert.equal(await p.locator('.guidance-clauses__quote').count(),0);assert.equal(await p.locator('.citation-form').count(),0);checks.push('actual Cookie switch cannot read other owner and removes excerpt/form');await shot(p,'auth-closed');await c.close();activeFault=false;
 }
 assert.deepEqual(errors,[]);assert.ok(!network.some(n=>n.method==='POST'&&/\/(jobs|knowledge-messages)$/.test(n.path)),'No AI route may be called');
 writeFileSync(out+'result.json',JSON.stringify({mode,checks,network,errors,warnings,expectedFaults,metrics},null,2));console.log(JSON.stringify({passed:true,mode,checks:checks.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({mode,message:e.message,stack:e.stack,checks,network,errors,warnings,expectedFaults,metrics},null,2));console.error(JSON.stringify({passed:false,evidence:out,message:e.message}));throw e;}
finally{await zoom?.close().catch(()=>{});for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
