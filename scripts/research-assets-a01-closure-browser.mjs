// Explicit A01 close-out. Existing Playwright/Chrome only, isolated contexts.
// All non-auth writes are blocked before transmission, including the named failure.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
assert.equal(process.argv[2],'--verify','EXPLICIT_A01_CLOSURE_REQUIRED');
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{ids}=runtime;
assert.equal(ids.tenant,'rh-kb-local-b0e2af9d-tenant');assert.equal(ids.project,'rh-kb-local-b0e2af9d-project');
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a01-close/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const origin='http://127.0.0.1:19501',scope=new URLSearchParams({studyGroupId:ids.group,researchProjectId:ids.project}),start='/pages/a01/?'+scope;
const results=[],contexts=[],expectedFaults=[],unexpectedWrites=[],errors=[],pointerEvents=[];let stage='setup';
const safeError=e=>String(e?.message??e).replaceAll(runtime.password,'[redacted]');
async function pointer(page,locator,label){await locator.scrollIntoViewIfNeeded();await locator.waitFor({state:'visible'});const b=await locator.boundingBox();assert(b,label+' is not visible');await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);pointerEvents.push({label,method:'page.mouse.click',x:b.x+b.width/2,y:b.y+b.height/2});}
async function verify(actor){
 stage=actor+':setup';let collaborationFault=false,abortTrash=false;
 const context=await browser.newContext({viewport:{width:1910,height:1075},recordVideo:{dir:out+'video',size:{width:1910,height:1075}}});contexts.push(context);
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.protocol==='data:'||url.protocol==='about:')return route.continue();
  if(url.origin!==origin){expectedFaults.push({type:'external_request_blocked',origin:url.origin});return route.abort();}
  if(collaborationFault&&req.method()==='GET'&&url.pathname==='/api/research-assets/collaborations'){
   expectedFaults.push({actor,type:'context_only_collaboration_503'});return route.fulfill({status:503,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({message:'用途记录暂不可用，请重新读取。'})});
  }
  if(!['GET','HEAD'].includes(req.method())&&!['/api/auth/login','/api/auth/logout','/api/auth/activity','/api/auth/renew'].includes(url.pathname)){
   if(abortTrash&&req.method()==='POST'&&url.pathname==='/api/research-assets/cmwdt2tof002ilu3f7iggrn77/trash'){expectedFaults.push({actor,type:'trash_request_aborted_before_transmission'});return route.abort('connectionfailed');}
   unexpectedWrites.push({actor,method:req.method(),path:url.pathname});return route.abort();
  }
  return route.continue();
 });
 const page=await context.newPage(),video=page.video(),apiReads=[];page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push({actor,stage,message:safeError(e)}));
 page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&u.pathname.startsWith('/api/research-assets/'))apiReads.push({method:r.request().method(),path:u.pathname,status:r.status()});});
 page.on('dialog',async d=>{errors.push({actor,stage,message:'unexpected native dialog '+d.type()});await d.dismiss();});
 stage=actor+':login';await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(start));
 await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);
 await pointer(page,page.getByRole('button',{name:'登录',exact:true}),'login');
 await page.waitForURL('**/pages/a01/**');await page.getByRole('button',{name:'原创合成量表结构说明 · A01 '+actor+' 20261113',exact:true}).waitFor();
 stage=actor+':catalog';await pointer(page,page.getByRole('button',{name:'原创合成量表结构说明 · A01 '+actor+' 20261113',exact:true}),'select owned instrument');
 await page.locator('.detail-list').waitFor();
 const layout=await page.locator('.real-assets-grid').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,gap:getComputedStyle(el).columnGap,width:innerWidth,height:innerHeight,rootOverflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(el).fontSize,lineHeight:getComputedStyle(el).lineHeight,stats:document.querySelectorAll('.research-asset-catalog .stat-card').length}));
 assert.match(layout.columns,/350px$/);assert.equal(layout.gap,'16px');assert.equal(layout.rootOverflow,false);assert.equal(layout.font,'14px');assert.equal(layout.lineHeight,'22px');
 const mainTabs=['资产列表','资产图谱','我的贡献','共享与协作','回收站'];
 for(const name of mainTabs){stage=actor+':'+name;await pointer(page,page.getByRole('button',{name,exact:true}),name);
  if(name==='资产图谱')await page.getByRole('list',{name:'真实来源与引用关系'}).waitFor();
  else if(name==='共享与协作')await page.getByLabel('用途申请与许可，可横向滚动').waitFor();
  else if(name==='回收站')await page.getByLabel('资产回收站，可横向滚动').waitFor();
  else if(name==='我的贡献')await page.getByLabel('本人贡献记录，可横向滚动').waitFor();
  await page.screenshot({path:out+actor+'-'+({'资产列表':'list','资产图谱':'graph','我的贡献':'contributions','共享与协作':'collaborations','回收站':'trash'})[name]+'.png'});
 }
 stage=actor+':preview';await pointer(page,page.getByRole('button',{name:'资产列表',exact:true}),'return list');await page.getByRole('button',{name:'原创合成量表结构说明 · A01 '+actor+' 20261113',exact:true}).waitFor();
 for(const tab of ['基本信息','版本历史','关联资产','引用情况']){await pointer(page,page.getByRole('button',{name:tab,exact:true}),tab);await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='更多操作');return b&&!b.disabled;});await page.screenshot({path:out+actor+'-preview-'+({'基本信息':'basic','版本历史':'versions','关联资产':'relations','引用情况':'citations'})[tab]+'.png'});}
 if(actor==='owner'){
  stage='owner:collaboration-failure';await pointer(page,page.getByRole('button',{name:'共享与协作',exact:true}),'open collaboration');await page.getByLabel('用途申请与许可，可横向滚动').waitFor();
  collaborationFault=true;await pointer(page,page.getByRole('button',{name:'我的申请（2）',exact:true}),'read failing collaboration');
  await page.getByRole('button',{name:'重新读取',exact:true}).waitFor();
  assert.equal(await page.getByText('正在核对当前用途申请…',{exact:true}).count(),0);assert.equal(await page.getByLabel('用途申请与许可，可横向滚动').count(),0);
  await page.getByText('当前内容不可用，请先处理页面提示。',{exact:true}).first().waitFor();await page.screenshot({path:out+'owner-collaboration-failed.png'});
  collaborationFault=false;await pointer(page,page.getByRole('button',{name:'重新读取',exact:true}),'retry collaboration');await page.getByLabel('用途申请与许可，可横向滚动').waitFor();await page.screenshot({path:out+'owner-collaboration-recovered.png'});
  stage='owner:pointer-recovery';await pointer(page,page.getByRole('button',{name:'资产列表',exact:true}),'list for recovery');await pointer(page,page.getByRole('button',{name:'原创合成量表结构说明 · A01 owner 20261113',exact:true}),'select recovery target');
  await page.locator('.detail-list').waitFor();await pointer(page,page.getByRole('button',{name:'更多操作',exact:true}),'more before recycle');await pointer(page,page.getByRole('button',{name:'移入回收站',exact:true}),'open recycle dialog');
  let dialog=page.getByRole('dialog',{name:'移入回收站',exact:true});await dialog.getByLabel('处理理由 *',{exact:true}).fill('A01鼠标恢复复测；此请求仅在独立浏览器阻止发送，不执行回收。');
  abortTrash=true;await pointer(page,dialog.getByRole('button',{name:'移入回收站',exact:true}),'abort named recycle before send');await dialog.getByRole('button',{name:'核对操作结果',exact:true}).waitFor();
  assert.equal(expectedFaults.filter(x=>x.type==='trash_request_aborted_before_transmission').length,1);await page.screenshot({path:out+'owner-recovery-unknown.png'});
  await pointer(page,dialog.getByRole('button',{name:'关闭，保留输入',exact:true}),'close unknown');
  await page.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('button')?.textContent.trim()==='继续上次操作')console.info('A01_RECOVERY_POINTER:'+JSON.stringify({isTrusted:e.isTrusted,detail:e.detail,pointerType:e.pointerType??null}));},true));
  page.on('console',m=>{if(m.text().startsWith('A01_RECOVERY_POINTER:'))pointerEvents.push({label:'trusted recovery event',...JSON.parse(m.text().slice('A01_RECOVERY_POINTER:'.length))});});
  await pointer(page,page.getByRole('button',{name:'更多操作',exact:true}),'more for recovery');await pointer(page,page.getByRole('button',{name:'继续上次操作',exact:true}),'continue previous operation by mouse');
  dialog=page.getByRole('dialog',{name:'移入回收站',exact:true});await dialog.waitFor();await page.screenshot({path:out+'owner-recovery-opened-by-mouse.png'});
  const originalResponse=page.waitForResponse(r=>new URL(r.url()).pathname.startsWith('/api/research-assets/operations/'));
  await pointer(page,dialog.getByRole('button',{name:'核对操作结果',exact:true}),'lookup original result');const response=await originalResponse;assert.equal(response.status(),200);assert.equal((await response.json()).status,'not_found');
  await dialog.getByRole('button',{name:'原输入重试',exact:true}).waitFor();await page.screenshot({path:out+'owner-recovery-not-sent-confirmed.png'});
  await pointer(page,dialog.getByRole('button',{name:'放弃输入',exact:true}),'discard only unsent input');await pointer(page,page.getByRole('dialog',{name:'放弃未保存的理由？',exact:true}).getByRole('button',{name:'放弃输入',exact:true}),'confirm discard');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert(pointerEvents.some(e=>e.label==='trusted recovery event'&&e.isTrusted&&e.detail===1&&e.pointerType==='mouse'));
 }
 stage=actor+':final';await pointer(page,page.getByRole('button',{name:'资产图谱',exact:true}),'final graph');await page.getByRole('list',{name:'真实来源与引用关系'}).waitFor();await page.screenshot({path:out+actor+'-final.png'});
 results.push({actor,layout,allFiveMainTabs:true,allFourPreviews:true,apiReads,video:actor+'.webm'});
 await context.close();contexts.splice(contexts.indexOf(context),1);await video.saveAs(out+actor+'.webm');
}
try{await verify('owner');await verify('admin');assert.equal(unexpectedWrites.length,0);assert.equal(errors.length,0);writeFileSync(out+'browser-result.json',JSON.stringify({passed:true,at:new Date().toISOString(),runtimePid:runtime.pid,syntheticOnly:true,realApiAndDatabase:true,results,expectedFaults,unexpectedWrites,errors,pointerEvents,businessRequestsForwarded:0,newBusinessObjects:0,paidCalls:0,oldProbesRearmed:false,recording:'Playwright recordVideo real-time Chrome render, not screenshot assembly'},null,2));console.log(JSON.stringify({passed:true,evidence:out+'browser-result.json'}));}
catch(e){writeFileSync(out+'browser-failure.json',JSON.stringify({passed:false,stage,message:safeError(e),results,expectedFaults,unexpectedWrites,errors,pointerEvents},null,2));console.error(JSON.stringify({passed:false,stage,message:safeError(e).slice(0,1300)}));process.exitCode=1;}
finally{for(const context of contexts)await context.close();await browser.close();}
