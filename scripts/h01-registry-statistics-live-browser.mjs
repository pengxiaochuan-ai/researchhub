// Real shared 19501/19502 HTTP acceptance. Success paths never replay business data.
// Run only after the root has arranged and completed the shared reload window.
import fs from 'node:fs';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
const{default:pw}=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
assert(process.argv.includes('--execute-shared'),'Wait for the shared runtime reload before passing --execute-shared');
const base='http://127.0.0.1:19501',zoom=process.argv.includes('--native200'),runId=randomUUID(),out='docs/testing/evidence/h01-registry-statistics-live-2026-11-21/'+runId;
fs.mkdirSync(out+'/video',{recursive:true});
const state=JSON.parse(fs.readFileSync('/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/runtime.json'));
const result={runId,at:new Date().toISOString(),kind:'live_shared_http_and_browser_no_success_path_mock',origin:base,native200:zoom,checks:[],http:[],browserHttp:[],errors:[],blockedMutations:[],simulatedFailureTests:[],businessWrites:0,modelCalls:0,stage:'start'};
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),contexts=[];
const roles=(process.argv.find(value=>value.startsWith('--roles='))?.slice(8)??'visitor,admin,owner').split(',');assert(roles.length&&roles.every(role=>['visitor','admin','owner'].includes(role)));
const sorted=values=>[...values].sort();
const href=id=>'/pages/c03/?documentId='+id;
async function read(context,path,role){const r=await context.request.get(base+path);result.http.push({role,path,status:r.status(),cacheControl:r.headers()['cache-control']});assert.equal(r.status(),200,path);assert.equal(r.headers()['cache-control'],'no-store',path);return r.json();}
async function shot(page,name){await page.screenshot({path:out+'/'+name+'.png'});}
function checkSourceInputs(payload){
 const stats=payload.registrationStatistics;assert(stats,'live overview must include registrationStatistics');assert.equal(stats.scope,'CURRENT_HUB_APPROVED_PUBLIC_INDEXED');assert.equal(stats.total,2);assert.equal(stats.records.length,2);
 assert.deepEqual(stats.dimensions.year.groups.map(g=>[g.label,g.count,g.cumulative]),[['2023',2,2]]);
 assert.deepEqual(stats.dimensions.disease.groups.map(g=>[g.label,g.count]),[['抑郁症',1],['轻度认知障碍',1]]);assert.deepEqual(stats.dimensions.design.groups.map(g=>[g.label,g.count]),[['随机平行对照',2]]);assert.equal(stats.dimensions.intervention.groups.length,6);
 const rows=payload.clinicalRegistries;assert.equal(rows.length,2);
 for(const [key,values]of [['year',r=>[r.registrationSummary.registeredOn.value.slice(0,4)]],['disease',r=>[r.sourceTargetCondition]],['design',r=>[r.statisticsFields.design.value]],['intervention',r=>[...new Set(r.statisticsFields.interventions.filter(f=>f.status==='reported'&&f.value.trim()).map(f=>f.value.trim()))]]]){
  const expected=new Map();for(const row of rows){if(key==='year')assert.equal(row.registrationSummaryStatus,'approved');if(['design','intervention'].includes(key))assert.equal(row.statisticsFields.status,'approved');for(const value of values(row)){if(!expected.has(value))expected.set(value,[]);expected.get(value).push(row.documentId);}}
  assert.deepEqual(stats.dimensions[key].groups.map(g=>({label:g.label,count:g.count,ids:sorted(g.recordIds)})),[...expected].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([label,ids])=>({label,count:ids.length,ids:sorted(ids)})),key);
  assert.equal(stats.dimensions[key].missing,0);
 }
 return stats;
}
let canonical;
try{
 for(const role of roles){
  result.stage=role+' context';const context=zoom?await pw.chromium.launchPersistentContext('.tmp/h01-registry-statistics-20261121/live-profile-'+role+'-'+runId,{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/video/'+role}}):await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video/'+role}});contexts.push(context);context.setDefaultTimeout(20000);
  if(zoom){const settings=context.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');}
  await context.route('**/api/**',route=>{const r=route.request(),path=new URL(r.url()).pathname;if(!['GET','HEAD'].includes(r.method())&&!['/api/auth/login','/api/auth/renew'].includes(path)){result.blockedMutations.push({role,path,method:r.method()});return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push({role,message:e.message}));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))result.browserHttp.push({role,path,status:r.status()});});
  if(role!=='visitor'){result.stage=role+' real login';await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill(role+'@example.org');await page.getByLabel('密码',{exact:true}).fill(state.password);const login=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/login'&&r.request().method()==='POST');await page.getByRole('button',{name:'登录',exact:true}).click();assert.equal((await login).status(),201);await page.waitForURL(url=>!url.pathname.includes('/p003/'));}
  result.stage=role+' live HTTP';const payload=await read(context,'/api/hubs/lingshu-xinyu/overview',role),stats=checkSourceInputs(payload);if(canonical)assert.deepEqual(stats,canonical,'public statistics cannot expand for signed-in roles');else canonical=stats;result.checks.push(role+' current live HTTP counts/fields/source IDs agree and same public scope');
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/hubs/lingshu-xinyu/overview');await page.goto(base+'/pages/h01/');const body=await(await response).json();assert.deepEqual(body.registrationStatistics,stats);const panel=page.locator('.hub-registry-statistics');await panel.getByText('本Hub已收录 2 项 · 非全领域总量',{exact:true}).waitFor();await panel.scrollIntoViewIfNeeded();
  await panel.getByRole('tab',{name:'研究数量',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await panel.getByRole('tab',{name:'疾病',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await panel.getByRole('tab',{name:'干预',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('Home');
  const firstBox=await panel.boundingBox();
  for(const[label,key]of [['研究数量','year'],['疾病','disease'],['研究设计','design'],['干预','intervention']]){
   result.stage=role+' '+key;await panel.getByRole('tab',{name:label,exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.hub-registry-group').length===n,stats.dimensions[key].groups.length);
   const rows=panel.locator('.hub-registry-group');assert.equal(await rows.count(),stats.dimensions[key].groups.length);
   for(let index=0;index<stats.dimensions[key].groups.length;index++){
    const group=stats.dimensions[key].groups[index],row=rows.nth(index);assert.equal(await row.locator('.hub-registry-group-label').innerText(),group.label);assert((await row.innerText()).includes(group.count+' 项'));if(key==='year')assert((await row.innerText()).includes('累计 '+group.cumulative+' 项'));
    await row.click();await panel.getByRole('region',{name:'统计来源'}).waitFor();const links=panel.locator('.hub-registry-sources a');assert.deepEqual(sorted(await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))),sorted(group.recordIds.map(href)));await links.last().focus();
   }
   await shot(page,role+'-'+key);const box=await panel.boundingBox();assert(Math.abs(box.height-firstBox.height)<2);result.checks.push(role+' '+key+' every label/count and source hyperlink equals live payload');
  }
  result.stage=role+' source details';for(const source of stats.records){const d=await read(context,'/api/hub-sources/clinical-registries/'+source.documentId,role);assert.equal(d.item.documentId,source.documentId);assert.equal(d.item.title,source.title);assert.equal(d.item.structuredDetailsStatus,'approved');const detail=await context.newPage();await detail.goto(base+href(source.documentId));await detail.getByRole('heading',{name:source.title,exact:true}).waitFor();await shot(detail,role+'-source-'+source.externalKey);await detail.close();}
  await page.goto(base+href(stats.records[0].documentId));await page.getByRole('heading',{name:stats.records[0].title,exact:true}).waitFor();await page.goBack();await panel.getByText('本Hub已收录 2 项 · 非全领域总量',{exact:true}).waitFor();await page.reload();await panel.getByText('本Hub已收录 2 项 · 非全领域总量',{exact:true}).waitFor();result.checks.push(role+' actual source detail, back navigation and fresh live reload');
  for(const width of (zoom?[720]:[1440,1024,720,390])){if(!zoom)await page.setViewportSize({width,height:1000});const geometry=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale}));if(zoom){assert.equal(geometry.dpr,2);assert.equal(geometry.scale,1);}await panel.scrollIntoViewIfNeeded();const box=await panel.boundingBox();assert(box.x>=-1&&box.x+box.width<=geometry.width+1);assert(await panel.evaluate(e=>e.scrollWidth-e.clientWidth)<=1);result.checks.push({role,width:geometry.width,native200:zoom,dpr:geometry.dpr,cardWidth:box.width});await shot(page,role+'-width-'+geometry.width);}
  if(role==='admin'&&!zoom){result.stage='isolated simulated503';const pattern='**/api/hubs/lingshu-xinyu/overview';await context.route(pattern,route=>route.fulfill({status:503,json:{message:'isolated acceptance failure'}}));await page.reload();await panel.getByRole('alert').waitFor();await shot(page,'isolated-simulated503');await context.unroute(pattern);await panel.getByRole('button',{name:'重试',exact:true}).click();await panel.getByText('本Hub已收录 2 项 · 非全领域总量',{exact:true}).waitFor();result.simulatedFailureTests.push('Only HTTP503 was injected; recovery read live unmocked overview with full statistics');}
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.blockedMutations,[]);result.passed=true;result.statistics=canonical;
}catch(error){result.passed=false;result.failure=error.message;for(let c=0;c<contexts.length;c++)for(const [index,page]of contexts[c].pages().entries())await shot(page,'failure-context-'+c+'-page-'+index).catch(()=>{});throw error;}
finally{result.finishedAt=new Date().toISOString();for(const context of contexts)await context.close();await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,stage:result.stage,kind:result.kind,evidence:out+'/result.json',errors:result.errors}));}
