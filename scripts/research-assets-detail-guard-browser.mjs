// Read-only follow-up: classify development reload protection, without repeating any tag commit.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeCatalogAssetUrl} from '../src/research-assets-catalog-session.js';
assert.deepEqual(process.argv.slice(2),['--verify'],'EXPLICIT_Q02_GUARD_VERIFY_REQUIRED');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),ids=runtime.ids;
assert.equal(ids.tenant,'rh-kb-local-b0e2af9d-tenant');const origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project};
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q02/',import.meta.url).pathname,first=JSON.parse(readFileSync(out+'browser-failure.json')),fixtures=JSON.parse(readFileSync(out+'fixtures.json'));
assert.equal(first.checks.length,10);assert.equal(first.writes.length,10);assert(first.errors.length===1&&first.errors[0].dialog==='beforeunload');
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],errors=[],native=[],hmr=[],reads=[];let phase='setup';
try{
 for(const actor of ['owner','admin']){
  let vite;
  const context=await browser.newContext({viewport:{width:1910,height:1075},recordVideo:{dir:out+'guard-video',size:{width:1910,height:1075}}});contexts.push(context);
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(['data:','about:','blob:'].includes(u.protocol))return route.continue();if(u.origin!==origin)return route.abort();if(!['GET','HEAD'].includes(r.method())&&!['/api/auth/login','/api/auth/logout','/api/auth/activity','/api/auth/renew'].includes(u.pathname)){errors.push({actor,type:'business_write_blocked',path:u.pathname});return route.abort();}return route.continue();});
  await context.routeWebSocket(url=>url.hostname==='127.0.0.1',ws=>{vite=ws;const server=ws.connectToServer();server.onMessage(message=>{let m;try{m=JSON.parse(String(message));}catch{}if(['update','full-reload'].includes(m?.type)){hmr.push({actor,phase,type:m.type,path:m.path??null,at:new Date().toISOString(),suppressedInThisContextOnly:true});return;}ws.send(message);});});
  const page=await context.newPage(),video=page.video();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push({actor,message:String(e.message).replaceAll(runtime.password,'[redacted]').slice(0,240)}));page.on('dialog',async d=>{native.push({actor,phase,type:d.type(),at:new Date().toISOString()});if(phase!=='injected_dirty_vite_reload'||d.type()!=='beforeunload')errors.push({actor,phase,type:'unexpected_native',dialog:d.type()});await d.dismiss();});
  const rows=fixtures.results.filter(x=>x.actor===actor),target=rows.find(x=>x.kind==='dataset');
  phase=actor+':login';await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(makeCatalogAssetUrl(scope,target.id,3)));await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/a02/**');
  for(const row of rows){phase=actor+':read:'+row.kind;const r=await context.request.get(origin+'/api/research-assets/catalog/'+row.id,{headers:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}});assert.equal(r.status(),200);const a=await r.json();assert(a.metadata.tags.includes('界面核对'));assert.equal(a.version,first.checks.find(x=>x.id===row.id).to);await page.goto(origin+makeCatalogAssetUrl(scope,row.id,a.version));await page.locator('.hero-detail-card h2').waitFor();await page.locator('.tag-row .pill').getByText('界面核对',{exact:true}).waitFor();reads.push({actor,id:row.id,kind:row.kind,version:a.version,storedTagsVerified:true});}
  phase=actor+':clean_reload';await page.reload();await page.locator('.hero-detail-card h2').waitFor();
  if(actor==='owner'){
   await page.goto(origin+makeCatalogAssetUrl(scope,target.id,3));await page.locator('.hero-detail-card h2').waitFor();await page.getByRole('button',{name:'编辑标签',exact:true}).click();await page.getByLabel('标签',{exact:true}).fill('未保存的热更新核对');assert(vite,'VITE_SOCKET_REQUIRED');
   phase='injected_dirty_vite_reload';vite.send(JSON.stringify({type:'full-reload',path:'*'}));
   for(let i=0;i<100&&!native.some(x=>x.phase===phase);i++)await new Promise(r=>setTimeout(r,100));assert.equal(native.filter(x=>x.phase===phase).length,1);assert.equal(await page.getByLabel('标签',{exact:true}).inputValue(),'未保存的热更新核对');await page.screenshot({path:out+'hmr-dirty-input-protected.png'});
   phase='station_navigation_cancel';await page.getByRole('button',{name:'关闭，保留输入',exact:true}).click();await page.getByRole('link',{name:'返回科研资产',exact:true}).click();let leave=page.getByRole('dialog',{name:'离开未保存的标签？',exact:true});await leave.waitFor();await leave.getByRole('button',{name:'继续编辑',exact:true}).click();await page.getByRole('button',{name:'编辑标签',exact:true}).click();assert.equal(await page.getByLabel('标签',{exact:true}).inputValue(),'未保存的热更新核对');await page.getByRole('button',{name:'关闭，保留输入',exact:true}).click();
   phase='station_navigation_confirm';await page.getByRole('link',{name:'返回科研资产',exact:true}).click();leave=page.getByRole('dialog',{name:'离开未保存的标签？',exact:true});await leave.getByRole('button',{name:'离开',exact:true}).click();await page.waitForURL('**/pages/a01/**');
   phase='clean_return_reload';await page.goto(origin+makeCatalogAssetUrl(scope,target.id,3));await page.locator('.hero-detail-card h2').waitFor();await page.reload();await page.locator('.hero-detail-card h2').waitFor();
  }
  await page.screenshot({path:out+actor+'-guard-read-final.png'});phase=actor+':close';await context.close();contexts.splice(contexts.indexOf(context),1);await video.saveAs(out+actor+'-guard.webm');
 }
 assert.equal(errors.length,0);assert.equal(native.length,1);writeFileSync(out+'guard-browser.json',JSON.stringify({passed:true,at:new Date().toISOString(),phase,reads,native,hmr,errors,newBusinessWrites:0,modelCalls:0,controlledReloadOnlyInIsolatedContext:true,savedViewsReloadWithoutPrompt:true,dirtyReloadPreventsLoss:true,stationNavigationCancelAndConfirm:true,originalRunRetained:true},null,2));console.log(JSON.stringify({passed:true,readChecks:reads.length,businessWrites:0,expectedDirtyReloadPrompts:1}));
}catch(e){writeFileSync(out+'guard-browser-failure.json',JSON.stringify({passed:false,phase,message:String(e.message).replaceAll(runtime.password,'[redacted]').slice(0,1400),native,hmr,reads,errors},null,2));console.error('A02_GUARD_BROWSER_FAILED: '+phase);process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
