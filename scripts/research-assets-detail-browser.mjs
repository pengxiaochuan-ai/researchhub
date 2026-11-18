import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeCatalogAssetUrl} from '../src/research-assets-catalog-session.js';
assert.deepEqual(process.argv.slice(2),['--verify'],'EXPLICIT_A02_Q02_BROWSER_REQUIRED');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),ids=runtime.ids;
assert.equal(ids.tenant,'rh-kb-local-b0e2af9d-tenant');
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q02/',import.meta.url).pathname,fixtures=JSON.parse(readFileSync(out+'fixtures.json'));
assert.equal(JSON.parse(readFileSync(out+'http.json')).passed,true);mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project},contexts=[],checks=[],errors=[],writes=[],faults=[];let stage='setup';
async function mouse(page,locator){await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();assert(b);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
try{
 for(const actor of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1910,height:1075},recordVideo:{dir:out+'video',size:{width:1910,height:1075}}});contexts.push(context);let lost=false,readFaultId=null;
  const owned=fixtures.results.filter(x=>x.actor===actor),allowed=new Set(owned.map(x=>x.id));
  await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(['data:','about:','blob:'].includes(u.protocol))return route.continue();if(u.origin!==origin)return route.abort();
   if(readFaultId&&req.method()==='GET'&&u.pathname.startsWith('/api/research-assets/catalog/'+readFaultId+'/versions/')){faults.push({actor,type:'current_read_503'});return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'当前内容暂不可读取，请稍后重试。'})});}
   if(!['GET','HEAD'].includes(req.method())&&!['/api/auth/login','/api/auth/logout','/api/auth/activity','/api/auth/renew'].includes(u.pathname)){
    const match=u.pathname.match(/^\/api\/research-assets\/([A-Za-z0-9_-]+)\/versions\/[1-4]\/tags$/);if(req.method()!=='POST'||!match||!allowed.has(match[1])){errors.push({actor,type:'unapproved_write',path:u.pathname});return route.abort();}
    writes.push({actor,id:match[1],key:req.postDataJSON().requestKey});
    if(actor==='owner'&&owned.find(x=>x.id===match[1])?.kind==='instrument'&&!lost){lost=true;const r=await route.fetch();assert.equal(r.status(),201);faults.push({actor,type:'actual_commit_response_503',id:match[1]});return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'保存响应中断，请核对原保存结果。'})});}
   }return route.continue();});
  const page=await context.newPage(),video=page.video();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push({actor,message:String(e.message).replaceAll(runtime.password,'[redacted]').slice(0,240)}));page.on('dialog',async d=>{errors.push({actor,type:'unexpected_native_dialog',dialog:d.type()});await d.dismiss();});
  stage=actor+':login';await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(makeCatalogAssetUrl(scope,owned[0].id,2)));
  await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await mouse(page,page.getByRole('button',{name:'登录',exact:true}));await page.waitForURL('**/pages/a02/**');
  for(const row of owned){
   stage=actor+':'+row.kind;
   const response=await context.request.get(origin+'/api/research-assets/catalog/'+row.id,{headers:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}});assert.equal(response.status(),200);const value=await response.json();
   assert(value.currentVersion<4,'DO_NOT_REPEAT_ALREADY_CONSUMED_BROWSER_WRITES');
   await page.goto(origin+makeCatalogAssetUrl(scope,row.id,value.currentVersion));await page.locator('.hero-detail-card h2').waitFor();
   const geometry=await page.locator('.research-assets-detail .two-col').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,gap:getComputedStyle(el).columnGap,reading:getComputedStyle(document.querySelector('.research-asset-reading p')).fontSize,line:getComputedStyle(document.querySelector('.research-asset-reading p')).lineHeight,rootOverflow:document.documentElement.scrollWidth>innerWidth}));assert.match(geometry.columns,/500px$/);assert.equal(geometry.gap,'9px');assert.equal(geometry.reading,'16px');assert.equal(geometry.line,'28px');assert.equal(geometry.rootOverflow,false);
   await mouse(page,page.getByRole('button',{name:'版本历史',exact:true}));await page.getByLabel('对比版本',{exact:true}).selectOption('1');await mouse(page,page.getByRole('button',{name:'比较版本',exact:true}));await page.getByLabel('固定版本差异',{exact:true}).waitFor();assert.match(await page.getByLabel('固定版本差异',{exact:true}).innerText(),/方法核对补充/);await page.screenshot({path:out+actor+'-'+row.kind+'-compare.png'});
   await mouse(page,page.getByRole('button',{name:'变更记录',exact:true}));await page.getByLabel('固定版本真实变更记录',{exact:true}).getByText('修订内容或标签',{exact:true}).waitFor();assert.equal(await page.getByLabel('查看固定版本').count(),0);await page.screenshot({path:out+actor+'-'+row.kind+'-activity.png'});
   await mouse(page,page.getByRole('button',{name:'编辑标签',exact:true}));let dialog=page.getByRole('dialog',{name:'编辑标签',exact:true});await dialog.waitFor();const tag='界面核对，'+row.kind;await dialog.getByLabel('标签',{exact:true}).fill(tag);await page.keyboard.press('Escape');await mouse(page,page.getByRole('button',{name:'编辑标签',exact:true}));await page.getByRole('dialog',{name:'编辑标签',exact:true}).waitFor();assert.equal(await page.getByLabel('标签',{exact:true}).inputValue(),tag);
   if(actor==='owner'&&row.kind==='analysis'){
    readFaultId=row.id;await page.getByRole('alert').filter({hasText:'资产服务暂不可用'}).waitFor();assert.equal(await page.getByRole('dialog',{name:'编辑标签',exact:true}).count(),0);await page.screenshot({path:out+'owner-read-paused.png'});readFaultId=null;await mouse(page,page.getByRole('button',{name:'重新读取',exact:true}));await page.getByRole('dialog',{name:'编辑标签',exact:true}).waitFor();assert.equal(await page.getByLabel('标签',{exact:true}).inputValue(),tag);await page.screenshot({path:out+'owner-read-restored.png'});
   }
   await mouse(page,page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'保存为新版本',exact:true}));
   if(actor==='owner'&&row.kind==='instrument'){
    await page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'核对保存结果',exact:true}).waitFor();await page.screenshot({path:out+'owner-unknown-tags.png'});await mouse(page,page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'关闭，保留输入',exact:true}));await mouse(page,page.getByRole('button',{name:'核对上次标签保存',exact:true}));await mouse(page,page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'核对保存结果',exact:true}));
   }
   await page.waitForURL(u=>u.searchParams.get('assetVersion')===String(value.currentVersion+1));await page.locator('.hero-detail-card h2').waitFor();await page.locator('.tag-row .pill').getByText('界面核对',{exact:true}).waitFor();await page.screenshot({path:out+actor+'-'+row.kind+'-saved.png'});checks.push({actor,kind:row.kind,id:row.id,from:value.currentVersion,to:value.currentVersion+1,geometry,comparison:true,activity:true,tagSaved:true,escapePreservedInput:true});
  }
  await context.close();contexts.splice(contexts.indexOf(context),1);await video.saveAs(out+actor+'-q02.webm');
 }
 assert.equal(writes.length,10);assert.equal(new Set(writes.map(x=>x.key)).size,10);assert.equal(errors.length,0);writeFileSync(out+'browser.json',JSON.stringify({passed:true,at:new Date().toISOString(),ownedPid:runtime.pid,checks,writes,faults,errors,modelCalls:0,oldProbesRearmed:false},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,tagWrites:writes.length}));
}catch(e){writeFileSync(out+'browser-failure.json',JSON.stringify({passed:false,stage,message:String(e.message).replaceAll(runtime.password,'[redacted]').slice(0,1600),checks,writes,faults,errors},null,2));console.error('A02_Q02_BROWSER_FAILED: '+stage);process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
