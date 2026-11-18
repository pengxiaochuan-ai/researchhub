import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync,mkdtempSync}from'node:fs';import{createHash}from'node:crypto';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';
import{withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
import{createDirectoryService}from'../server/directory/commands.mjs';
import{recoverReviewedTeamIds}from'./team-acceptance-guards.mjs';
const mode=process.argv[2];assert(['--baseline-lock','--loaded-ui','--native-ui'].includes(mode));
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',api='/api/hubs/lingshu-xinyu/';
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),manifest=root+'.tmp/researchhub-p1-team-20261112.json',rawManifest=readFileSync(manifest),fixture=JSON.parse(rawManifest);
const{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal(rt.ids.tenant,'rh-kb-local-b0e2af9d-tenant');assert(fixture.syntheticOnly);
const out=root+'researchhub/docs/testing/evidence/governance-directory-closeout-2026-11-16/'+mode.slice(2)+'-'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={time:new Date().toISOString(),mode,pid:rt.pid,requests:[],checks:[],pageErrors:[],businessWrites:[],out};let c,p;
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
async function get(path,status=200){const start=Date.now(),response=await c.request.get(base+path);result.requests.push({path,status:response.status(),ms:Date.now()-start});assert.equal(response.status(),status);return response.json();}
const workspace=()=>get(api+'directory-admin/team-workspaces/'+fixture.id);
try{
 c=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}});c.on('page',page=>page.on('pageerror',e=>result.pageErrors.push(e.message)));await c.route('**/api/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())&&!new URL(r.request().url()).pathname.startsWith('/api/auth/')){result.businessWrites.push(new URL(r.request().url()).pathname);return r.abort();}return r.continue();});
 assert.equal((await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}})).status(),201);
 const before=await workspace();const partial={...fixture};delete partial.organizationId;delete partial.leadId;const recovered=recoverReviewedTeamIds(partial,before);assert.equal(recovered.organizationId,fixture.organizationId);assert.equal(recovered.leadId,fixture.leadId);assert.equal(digest(readFileSync(manifest).toString()),digest(rawManifest.toString()));result.checks.push('actual original reviewed workspace recovers exact IDs into memory, private manifest unchanged, no create or review');
 if(mode==='--baseline-lock'){
  result.currentMonths=await withFixtureTransaction(env,'direct',tx=>tx.$queryRaw`SELECT a.entity_id,a.payload->>'startMonth' AS month FROM rh_directory.assertion a WHERE a.tenant_id=${rt.ids.tenant} AND a.kind='affiliation' AND a.payload->>'current'='true' AND a.payload->>'startMonth' IS NOT NULL`,{readOnly:true});
  for(let i=0;i<6;i++)await workspace();
  let acquired,release;const acquiredPromise=new Promise(r=>acquired=r),gate=new Promise(r=>release=r),sentinel=Error('LOCK_PROBE_ROLLBACK');
  const holder=withFixtureTransaction(env,'direct',async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:tenant:'+rt.ids.tenant},0))`;acquired();await gate;throw sentinel;}).catch(e=>{if(e!==sentinel)throw e;});
  await acquiredPromise;const timer=setTimeout(release,3500);
  try{
   const actor=await withFixtureTransaction(env,'direct',tx=>tx.account.findFirst({where:{id:rt.ids.admin,tenantId:rt.ids.tenant},select:{authVersion:true}}),{readOnly:true});
   const service=createDirectoryService({db:{tenantId:rt.ids.tenant,hubKey:'lingshu-xinyu',transaction:fn=>withFixtureTransaction(env,'app',fn)}});
   const [http,error]=await Promise.all([get(api+'directory-admin/team-workspaces/'+fixture.id,503),service.teamWorkspace({user:{accountId:rt.ids.admin,tenantId:rt.ids.tenant,authVersion:actor.authVersion}},fixture.id).then(()=>{throw Error('EXPECTED_LOCK_TIMEOUT');},e=>e)]);
   result.controlled503={code:http.code,pgCode:error.meta?.code,prismaCode:error.code};assert.equal(http.code,error.code);assert.equal(error.meta?.code,'55P03');
  }finally{clearTimeout(timer);release();await holder;}
  assert.deepEqual(await workspace(),before);result.checks.push('controlled synthetic tenant lock produces actual HTTP503 and same app-service PG55P03, releases by3.5s, rolled back, next GET200 identical; not proof of historical exact cause');
 }else{
  const body=await get(api+'member/researchers/'+fixture.leadId),person=body.item;assert(person.affiliations.length);assert(Object.hasOwn(person.affiliations[0],'startMonth'),'RELOADED_DTO_REQUIRED');result.realMonth=person.affiliations[0].startMonth;assert.equal(result.realMonth,null);
  const withMonth=x=>({...x,affiliations:x.affiliations.map(a=>({...a,startMonth:'2021-03',endMonth:null,current:true}))});
  if(mode==='--loaded-ui'){p=await c.newPage();
  await p.goto(base+'/pages/r01/?'+new URLSearchParams({q:person.name}));await p.locator('#researcher-'+person.id).waitFor();await p.screenshot({path:out+'actual-r01-no-invented-date.png'});
  // Only a local browser response probe supplies a clearly synthetic date;
  // target DB has no current month. This is not persistent HTTP fixture evidence.
  const listRoute=/\/member\/researchers(?:\?.*)?$/;await p.route(listRoute,async r=>{const response=await r.fetch(),json=await response.json();await r.fulfill({response,json:{...json,items:json.items.map(x=>x.id===person.id?withMonth(x):x)}});});
  await p.reload();await p.locator('#researcher-'+person.id).getByText('2021-03 至今',{exact:false}).waitFor();await p.screenshot({path:out+'controlled-month-r01-1440.png'});
  for(const width of [1366,1920,390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(350);await p.locator('#researcher-'+person.id).scrollIntoViewIfNeeded();const m=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(m.scroll<=m.width+1);await p.screenshot({path:out+'controlled-r01-'+width+'.png'});}
  await p.setViewportSize({width:1440,height:900});await p.route('**/member/researchers/'+person.id,async r=>{const response=await r.fetch(),json=await response.json();await r.fulfill({response,json:{...json,item:withMonth(json.item)}});});
  await p.goto(base+'/pages/r02/?id='+person.id);await p.locator('.profile-side').getByText('2021-03 至今',{exact:true}).waitFor();await p.screenshot({path:out+'controlled-month-r02.png'});
  for(const width of [1366,1920,390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(350);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:out+'controlled-r02-'+width+'.png'});}
  }
  const native=await(pw.chromium??pw.default.chromium).launchPersistentContext(mkdtempSync(root+'.tmp/tenure-native-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000']});
  try{native.on('page',page=>page.on('pageerror',e=>result.pageErrors.push(e.message)));await native.route('**/api/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())&&!new URL(r.request().url()).pathname.startsWith('/api/auth/')){result.businessWrites.push(new URL(r.request().url()).pathname);return r.abort();}return r.continue();});const settings=native.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');assert.equal((await native.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'owner@example.org',password:rt.password}})).status(),201);result.nativeActor='owner';const n=await native.newPage();await n.route('**/member/researchers/'+person.id,async r=>{const response=await r.fetch(),json=await response.json();await r.fulfill({response,json:{...json,item:withMonth(json.item)}});});await n.goto(base+'/pages/r02/?id='+person.id);await n.locator('.profile-side').getByText('2021-03 至今',{exact:true}).waitFor();result.native200=await n.evaluate(()=>({dpr:devicePixelRatio,scale:visualViewport.scale,width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.equal(result.native200.dpr,2);assert.equal(result.native200.scale,1);assert(result.native200.scroll<=result.native200.width+1);await n.locator('.profile-side').getByText('2021-03 至今',{exact:true}).scrollIntoViewIfNeeded();const session=await native.newCDPSession(n),metrics=await session.send('Page.getLayoutMetrics'),shot=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:metrics.layoutViewport.pageX,y:metrics.layoutViewport.pageY,width:metrics.layoutViewport.clientWidth,height:metrics.layoutViewport.clientHeight,scale:1}});writeFileSync(out+'controlled-r02-native200.png',Buffer.from(shot.data,'base64'));result.native200.dateInViewport=await n.locator('.profile-side').getByText('2021-03 至今',{exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});assert(result.native200.dateInViewport);}finally{await native.close();}
  result.checks.push(mode==='--native-ui'?'native owner context only: controlled synthetic date scrolled into viewport and CDP captured at real200; original admin workspace and manifest unchanged':'actual target DTO includes null month; isolated browser response adds synthetic month to original R01 line/R02 date slot; both pages five widths plus native200, no DB or layout write');
 }
 assert.deepEqual(await workspace(),before);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(e){result.passed=false;result.error=e.message;await p?.screenshot({path:out+'failure.png'}).catch(()=>{});process.exitCode=1;}
finally{await c?.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error,checks:result.checks,out}));}
