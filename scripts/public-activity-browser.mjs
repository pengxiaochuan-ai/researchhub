// Shared-runtime acceptance only. No successful business response is mocked.
// Prepare the approved migration/reload window before passing --execute-shared.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validatePublicActivity} from '../src/public-activity.js';

assert(process.argv.includes('--execute-shared'),'Shared runtime activation is required; pass --execute-shared only in the agreed window.');
const args=process.argv.slice(2);
assert(args.every(arg=>arg==='--execute-shared'||arg==='--native200'||arg.startsWith('--roles=')),'Unknown acceptance option');
const roles=(args.find(value=>value.startsWith('--roles='))?.slice(8)??'visitor,admin,owner').split(',');
assert(roles.length&&new Set(roles).size===roles.length&&roles.every(role=>['visitor','admin','owner'].includes(role)),'Invalid roles');
const{default:pw}=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const base='http://127.0.0.1:19501',native200=args.includes('--native200'),runId=randomUUID();
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const out=`docs/testing/evidence/public-activity-live-${day}/${runId}`;
const state=roles.some(role=>role!=='visitor')?JSON.parse(fs.readFileSync('/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/runtime.json','utf8')):null;
fs.mkdirSync(out+'/video',{recursive:true});
const result={runId,startedAt:new Date().toISOString(),origin:base,kind:'real_shared_public_activity_http_and_chrome',native200,successDataMocked:false,checks:[],http:[],browserHttp:[],errors:[],blockedMutations:[],businessWrites:0,modelCalls:0,passed:false,stage:'setup'};
const contexts=[];
const browser=native200?null:await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const endpoint=limit=>`/api/hubs/lingshu-xinyu/public-activity?limit=${limit}`;
const comparable=data=>({status:data.status,categoryStatuses:data.categoryStatuses,items:data.items});
async function read(context,role,limit){
 const response=await context.request.get(base+endpoint(limit));
 result.http.push({role,path:endpoint(limit),status:response.status(),cacheControl:response.headers()['cache-control']});
 assert.equal(response.status(),200,'Live activity HTTP');assert.equal(response.headers()['cache-control'],'no-store');
 return validatePublicActivity(await response.json(),{limit});
}
async function shot(page,name){await page.screenshot({path:out+'/'+name+'.png'});}
async function observe(page,selector,payload){
 const region=page.locator(selector),list=region.locator('.public-activity-list');
 await region.waitFor();await region.locator('.public-activity').waitFor();
 await page.waitForFunction(selector=>!document.querySelector(selector)?.textContent.includes('正在读取领域动态'),selector);
 assert.equal(await region.getByText('领域动态暂时无法读取。',{exact:true}).count(),0,'No activity loading failure');
 assert.equal(await region.locator('.public-activity-list > li').count(),payload.items.length);
 for(let i=0;i<payload.items.length;i++){
  const row=list.locator(':scope > li').nth(i),item=payload.items[i];
  assert((await row.innerText()).includes(item.title));assert.equal(await row.locator('time').getAttribute('datetime'),item.day);
  if(item.summary)assert((await row.innerText()).includes(item.summary));
  if(item.kind==='aggregate')assert.equal(await row.locator('a').count(),0,'No invented exact-date detail list');
  else if(item.href)assert.equal(await row.locator('a').getAttribute('href'),item.href);
 }
 if(payload.status==='partial')await region.getByText('部分动态暂时无法读取。',{exact:true}).waitFor();
 if(!payload.items.length)await region.getByText(payload.status==='partial'?'暂无可展示的新增动态。':'暂无公开领域动态。',{exact:true}).waitFor();
 return region;
}
let canonical;
try{
 for(const role of roles){
  result.stage=role+' context';
  const context=native200?await pw.chromium.launchPersistentContext(`.tmp/public-activity-native200-${role}-${runId}`,{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/video/'+role}}):await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video/'+role}});
  contexts.push(context);context.setDefaultTimeout(20000);
  if(native200){const settings=context.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');}
  await context.route('**/api/**',route=>{const request=route.request(),path=new URL(request.url()).pathname;if(!['GET','HEAD'].includes(request.method())&&!['/api/auth/login','/api/auth/renew'].includes(path)){result.blockedMutations.push({role,path,method:request.method()});return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>result.errors.push({role,message:error.message}));page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/'))result.browserHttp.push({role,path,status:response.status()});});
  if(role!=='visitor'){
   result.stage=role+' login';await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill(role+'@example.org');await page.getByLabel('密码',{exact:true}).fill(state.password);
   const login=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/login'&&response.request().method()==='POST');await page.getByRole('button',{name:'登录',exact:true}).click();assert.equal((await login).status(),201);await page.waitForURL(url=>!url.pathname.includes('/p003/'));
  }
  result.stage=role+' public HTTP';const payload6=await read(context,role,6);if(canonical)assert.deepEqual(comparable(payload6),comparable(canonical),'Public feed cannot expand for signed-in roles');else canonical=payload6;
  fs.writeFileSync(out+'/'+role+'-public-http.json',JSON.stringify(payload6,null,2));
  if(role!=='visitor'){
   result.stage=role+' P01';const payload4=await read(context,role,4);assert.deepEqual(payload4.items,payload6.items.slice(0,4));
   const live=page.waitForResponse(response=>response.url()===base+endpoint(4));await page.goto(base+'/pages/p01/');assert.equal((await live).status(),200);
   await observe(page,'.hubNews',payload4);const all=page.locator('.hubNews > a');assert.equal(await all.getAttribute('href'),'/pages/h01/');await shot(page,role+'-p01');
   for(const width of native200?[720]:[1440,1024,720,390]){
    if(!native200)await page.setViewportSize({width,height:1000});const panel=await observe(page,'.hubNews',payload4);await panel.scrollIntoViewIfNeeded();const geometry=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale})),box=await panel.boundingBox();assert(box.x>=-1&&box.x+box.width<=geometry.width+1);assert(await panel.evaluate(node=>node.scrollWidth-node.clientWidth)<=1);if(native200){assert.equal(geometry.dpr,2);assert.equal(geometry.scale,1);}await shot(page,role+'-p01-width-'+geometry.width);result.checks.push({role,page:'P01',...geometry,native200});
   }
   await all.click();await page.waitForURL(url=>url.pathname==='/pages/h01/'&&!url.search);result.checks.push(role+' P01 all action directly opens H01');
  }else await page.goto(base+'/pages/h01/');
  result.stage=role+' H01';await observe(page,'.real-hub-publications',payload6);
  assert.equal(await page.locator('.real-hub-publications header a').getAttribute('href'),'/pages/e01/');
  for(const width of native200?[720]:[1440,1024,720,390]){
   if(!native200)await page.setViewportSize({width,height:1000});const panel=await observe(page,'.real-hub-publications',payload6);await panel.scrollIntoViewIfNeeded();const geometry=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale})),box=await panel.boundingBox();assert(box.x>=-1&&box.x+box.width<=geometry.width+1);assert(await panel.evaluate(node=>node.scrollWidth-node.clientWidth)<=1);if(native200){assert.equal(geometry.dpr,2);assert.equal(geometry.scale,1);}if(payload6.items.length)await panel.locator('.public-activity-list').focus();await shot(page,role+'-h01-width-'+geometry.width);result.checks.push({role,page:'H01',...geometry,native200});
  }
  await page.locator('.real-hub-publications header a').click();await page.waitForURL(url=>url.pathname==='/pages/e01/');result.checks.push(role+' original E01 catalog navigation remains reachable');
  await page.goBack();await observe(page,'.real-hub-publications',payload6);await page.reload();await observe(page,'.real-hub-publications',await read(context,role,6));result.checks.push(role+' H01 back and fresh reload passed');
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.blockedMutations,[]);result.passed=true;
}catch(error){result.failure=error.message;for(let c=0;c<contexts.length;c++)for(const[index,page]of contexts[c].pages().entries())await shot(page,`failure-context-${c}-page-${index}`).catch(()=>{});process.exitCode=1;}
finally{result.finishedAt=new Date().toISOString();for(const context of contexts)await context.close();await browser?.close();fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,stage:result.stage,evidence:out+'/result.json',successDataMocked:false}));}
