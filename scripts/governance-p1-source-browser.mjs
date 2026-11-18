// P1 read-only browser admission. Login only; no source/directory business writes.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const out=root+'researchhub/docs/testing/evidence/governance-p1-source-2026-11-12/';
const phase=process.argv[2]||'green';assert(/^(red|green)(-(workbook|pmc))?$/.test(phase));
mkdirSync(out+'video',{recursive:true});
if(existsSync(out+phase+'-result.json'))copyFileSync(out+phase+'-result.json',out+phase+'-prior-'+Date.now()+'.json');
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={checks:[],errors:[],writes:[],responses:[]};let context,page;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
try{
 context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});
 const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}});assert.equal(login.status(),201);
 context.on('request',req=>{const p=new URL(req.url()).pathname;if(p.startsWith('/api/')&&!p.startsWith('/api/auth/')&&req.method()!=='GET')result.writes.push({path:p,method:req.method()});});
 const read=await context.request.get(base+'/api/hub-sources/review-queue');assert.equal(read.status(),200);const before=await read.json();
 result.baseline={count:before.items.length,kinds:[...new Set(before.items.map(x=>x.kind))],hash:hash(before)};
 const kind=phase.endsWith('workbook')?'workbook':phase.endsWith('pmc')?'pmc':'external';
 const target=before.items.filter(x=>x.kind===kind&&x.state.status!=='unavailable'&&(kind!=='workbook'||x.detail.eligibleBibliographic>0)).sort((a,b)=>(a.detail.eligibleBibliographic??0)-(b.detail.eligibleBibliographic??0))[0];assert(target);
 page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 page.on('response',r=>{const p=new URL(r.url()).pathname;if(p.startsWith('/api/hub-sources/'))result.responses.push({path:p,status:r.status()});});
 await page.goto(base+'/pages/g02/?'+new URLSearchParams({view:'source-review',reviewKey:target.key}));
 const region=page.getByRole('region',{name:'本次审核决定'}),select=region.getByLabel('本次可见范围',{exact:true});
 await select.waitFor();await page.getByRole('button',{name:'重新核对',exact:true}).waitFor();
 await page.waitForFunction(()=>{const b=[...document.querySelectorAll('.hub-review-toolbar button')][0];return b&&!b.disabled&&!document.querySelector('.hub-review-workspace')?.textContent.includes('正在读取当前审核队列…');});
 if(kind==='workbook')await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
 await page.screenshot({path:out+phase+'-before-1440.png'});
 const saved=await select.inputValue(),choice=saved==='tenant'?'withheld':'tenant';await select.selectOption(choice);assert.equal(await select.inputValue(),choice);
 let authReads=0;page.on('response',r=>{if(new URL(r.url()).pathname==='/api/auth/me')authReads++;});
 const renewed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await renewed;
 await page.waitForFunction(()=>!document.querySelector('.hub-review-workspace')?.textContent.includes('正在读取当前审核队列…'));
 if(kind==='workbook')await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
 result.focus={before:choice,after:await select.inputValue(),authReads};
 await page.screenshot({path:out+phase+'-focus-1440.png'});
 const afterResponse=await context.request.get(base+'/api/hub-sources/review-queue');assert.equal(afterResponse.status(),200);assert.equal(hash(await afterResponse.json()),result.baseline.hash);
 assert.deepEqual(result.writes,[]);assert.deepEqual(result.errors,[]);result.checks.push('real queue and original layout captured; no business writes; original source state unchanged');
 assert.equal(result.focus.after,choice,'unsaved review selection must survive same-account focus refresh');
 result.checks.push('same-account focus retains unsubmitted selection');
 if(phase.startsWith('green')){
  result.geometry=[];
  for(const width of [1440,1366,1920,390,320]){
   await page.setViewportSize({width,height:900});await select.scrollIntoViewIfNeeded();
   const m=await select.evaluate(n=>{const b=n.parentElement.querySelector('button');return{width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(n).fontSize,line:getComputedStyle(n).lineHeight,buttonFont:getComputedStyle(b).fontSize,buttonLine:getComputedStyle(b).lineHeight,rect:n.getBoundingClientRect().toJSON()};});
   assert(m.scroll<=m.width+1);assert.equal(m.font,'14px');assert(m.rect.height>=32);assert.equal(m.buttonFont,'14px');assert.equal(m.buttonLine,'22px');assert.equal(await select.inputValue(),choice);result.geometry.push(m);
   await page.screenshot({path:out+phase+'-'+width+'.png'});
  }
  result.checks.push('five widths retain native select 14px/min32px and shared button 14/22, without horizontal overflow; native select line-height is recorded, not equated to button text');
  if(kind==='workbook'){
   await page.setViewportSize({width:1440,height:900});
   const rowRead=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/hub-sources/review-workbook'&&new URL(r.url()).searchParams.has('sourceRecordId')&&r.status()===200);
   await page.getByRole('button',{name:'单独审核此行',exact:true}).first().click();
   const rowPayload=await (await rowRead).json();
   await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
   const rowExpected=['public','tenant','withheld'].includes(rowPayload.scope.state.status)?rowPayload.scope.state.status:'';
   await page.waitForFunction(value=>document.querySelector('.hub-review-decision select')?.value===value,rowExpected);
   assert.equal(await select.inputValue(),rowExpected,'row starts with server state, not batch draft');
   const rowSaved=await select.inputValue(),rowChoice=rowSaved==='tenant'?'withheld':'tenant';await select.selectOption(rowChoice);
   const rowRefresh=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200);
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await rowRefresh;
   await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
   assert.equal(await select.inputValue(),rowChoice,'same-row focus must retain draft');
   const batchRead=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/hub-sources/review-workbook'&&!new URL(r.url()).searchParams.has('sourceRecordId')&&r.status()===200);
   await page.getByRole('button',{name:/返回审核本来源的/}).click();
   await batchRead;
   await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});
   await page.waitForFunction(value=>document.querySelector('.hub-review-decision select')?.value===value,saved);
   assert.equal(await select.inputValue(),saved,'returning to batch restores saved state, not row/batch draft');
   result.checks.push('workbook batch-to-row and row-to-batch clear scope drafts; same-row focus retains choice');
  }
  // Switch the actual authenticated session, not a synthetic role event.
  const owner=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}});assert.equal(owner.status(),201);
  const changed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await changed;
  await page.getByRole('alert').filter({hasText:/来源审核授权/}).waitFor();assert.equal(await page.locator('.hub-review-detail-heading').count(),0);assert.equal(await select.count(),0);
  assert.equal((await context.request.get(base+'/api/hub-sources/review-queue')).status(),403);
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/hub-sources/review-queue')).status(),401);await anonymous.close();
  result.checks.push('actual owner login clears admin content and choice; owner 403 and anonymous 401 remain');
  const admin=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}});assert.equal(admin.status(),201);
  const final=await context.request.get(base+'/api/hub-sources/review-queue');assert.equal(final.status(),200);assert.equal(hash(await final.json()),result.baseline.hash);
 }
 result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;if(page)await page.screenshot({path:out+phase+'-failure.png'}).catch(()=>{});process.exitCode=1;}
finally{await context?.close();await browser.close();writeFileSync(out+phase+'-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({phase,passed:result.passed,focus:result.focus,failure:result.failure,evidence:out,businessWrites:result.writes.length,baseline:result.baseline}));}
