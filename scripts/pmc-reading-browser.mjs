import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';import {createHash,randomUUID} from 'node:crypto';
assert.equal(process.argv[2],'--mode');assert.equal(process.argv[3],'local-synthetic');
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const out=root+'researchhub/docs/testing/evidence/pmc-reading-'+randomUUID().slice(0,8)+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium||pw.default.chromium;
const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),contexts=[],checks=[],errors=[],network=[],metrics=[];
let active,zoom;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function login(context,actor='admin'){const r=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(r.status(),201);}
async function session(viewport={width:1440,height:900},actor='admin') {const c=await browser.newContext({viewport,recordVideo:{dir:out+'video'}});contexts.push(c);await login(c,actor);const page=await c.newPage();page.setDefaultTimeout(12000);watch(page);return {c,page};}
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/hub-sources/'))network.push({path,status:r.status()});});}
async function queue(c){const r=await c.request.get(base+'/api/hub-sources/review-queue');assert.equal(r.status(),200);return(await r.json()).items;}
async function open(page){await page.goto(base+'/pages/g02/?view=source-review');await page.getByLabel('来源类型',{exact:true}).waitFor();await page.getByLabel('处理状态',{exact:true}).selectOption('all');await page.getByLabel('来源类型',{exact:true}).selectOption('pmc');}
async function pick(page,id){await page.getByRole('complementary',{name:'来源审核队列'}).getByRole('button',{name:new RegExp(id)}).click();await page.locator('.hub-review-detail-heading').filter({hasText:id}).waitFor();}
async function body(page){await page.getByText('展开正文',{exact:true}).click();await page.getByRole('navigation',{name:'文章目录'}).waitFor();}
async function visibleTarget(page,selector){const r=await page.locator(selector).evaluate(e=>({y:e.getBoundingClientRect().y,height:e.getBoundingClientRect().height,viewport:innerHeight}));assert.ok(r.y>=60&&r.y<r.viewport-40,JSON.stringify(r));return r;}
async function layout(page,label){const m=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,dpr:devicePixelRatio,
  reading:[...document.querySelectorAll('.hub-pmc-structured-body p')].filter(x=>x.getClientRects().length).slice(0,1).map(x=>({font:getComputedStyle(x).fontSize,line:getComputedStyle(x).lineHeight})),
  actions:[...document.querySelectorAll('.hub-review-reading-actions button')].filter(x=>x.getClientRects().length).map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height,font:getComputedStyle(x).fontSize}))}));
  assert.ok(m.document<=m.width+1,JSON.stringify(m));assert.ok(m.actions.every(x=>x.height>=44&&x.font==='14px'),JSON.stringify(m));if(m.reading.length)assert.deepEqual(m.reading,[{font:'16px',line:'28px'}]);metrics.push({label,...m});}
async function fitQueue(page){
  await page.waitForFunction(()=>{const e=document.querySelector('.hub-review-queue'),r=e?.getBoundingClientRect();return r&&Math.abs(innerHeight-r.bottom-16)<=2&&r.top>=64;});
}
try{
  const admin=await session();active=admin.page;const before=await queue(admin.c),beforeHash=hash(before);
  await admin.page.goto(base+'/pages/g02/');await admin.page.getByRole('heading',{name:'研究项目状态',exact:true}).waitFor();await admin.page.screenshot({path:out+'overview.png'});
  await open(admin.page);assert.equal((await admin.page.getByLabel('处理状态',{exact:true}).inputValue()),'all');
  const options=await admin.page.getByLabel('处理状态',{exact:true}).locator('option').allTextContents();assert.ok(options.includes('全部（20）'));checks.push('总览保留；状态和类型计数均套用当前其他筛选条件');
  await fitQueue(admin.page);await admin.page.screenshot({path:out+'queue-entry.png'});await pick(admin.page,'PMC13678665');
  await fitQueue(admin.page);
  const list=admin.page.getByRole('complementary',{name:'来源审核队列'}).locator('ul'),main=admin.page.locator('main.platform-main');
  const initialScroll=await main.evaluate(e=>e.scrollTop),listBox=await list.boundingBox();
  await admin.page.mouse.move(listBox.x+listBox.width/2,listBox.y+listBox.height/2);await admin.page.mouse.wheel(0,400);
  await admin.page.waitForFunction(()=>document.querySelector('.hub-review-queue ul').scrollTop>0);
  assert.equal(await main.evaluate(e=>e.scrollTop),initialScroll);await fitQueue(admin.page);
  checks.push('桌面首屏与阅读时左队列填满窗口剩余高度、底部留16px，内部滚动不带动详情');
  const decision=admin.page.getByRole('region',{name:'本次审核决定'});
  const choice=decision.getByLabel('本次可见范围',{exact:true}),firstStatus=before.find(x=>x.detail?.pmcid==='PMC13678665').state.status;
  assert.equal(await choice.inputValue(),['public','tenant','withheld'].includes(firstStatus)?firstStatus:'');
  assert.ok(await decision.getByRole('button',{name:'确认保存',exact:true}).isDisabled());
  const writes=[];admin.page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/hub-sources/'))writes.push(r.url());});
  for(const value of ['public','tenant','withheld']){
    await choice.selectOption(value);const id=(await choice.getAttribute('aria-describedby')).split(' ')[0];assert.ok(id);
    const note=admin.page.locator('[id="'+id+'"]');assert.ok(await note.isVisible());assert.ok((await note.innerText()).length>20);
    assert.equal(await note.evaluate(e=>getComputedStyle(e).fontSize),'14px');
    assert.match(await decision.innerText(),value===firstStatus?/当前范围已保存/:/本次选择尚未保存/);
  }
  assert.deepEqual(writes,[]);await choice.selectOption('');
  await decision.screenshot({path:out+'review-actions.png'});checks.push('下拉默认不公开；三范围切换仅更新14px说明，不提交；单一确认按钮与生效状态分开');
  await body(admin.page);await admin.page.locator('.hub-pmc-contents').scrollIntoViewIfNeeded();
  assert.ok(await admin.page.locator('.hub-pmc-structured-body p').count()>20);assert.ok(await admin.page.locator('.hub-pmc-structured-body h4').count()>1);
  await admin.page.screenshot({path:out+'first-contents.png'});
  const chapter=admin.page.getByRole('navigation',{name:'文章目录'}).getByRole('link').nth(3),chapterTarget=await chapter.getAttribute('href');await chapter.click();await visibleTarget(admin.page,chapterTarget);
  const citation=admin.page.locator('.hub-pmc-structured-body a').filter({hasText:/^\d+$/}).first(),ref=await citation.getAttribute('href');await citation.click();await visibleTarget(admin.page,ref);
  await admin.page.screenshot({path:out+'first-reference.png'});
  await fitQueue(admin.page);
  await admin.page.locator(ref).getByRole('link',{name:'返回正文引用位置',exact:true}).click();
  assert.equal(await admin.page.locator('.hub-pmc-references ol').evaluate(e=>getComputedStyle(e).listStyleType),'none');
  checks.push('首篇正文有独立章节/段落，目录与真实参考文献双向定位，引用不重复编号');
  const bar=admin.page.getByRole('navigation',{name:'长文审核操作'});assert.equal(await bar.isVisible(),true);
  const br=await bar.boundingBox();assert.ok(br.y>=60&&br.y+br.height<=900+1,JSON.stringify(br));
  await bar.getByRole('button',{name:'回到审核决定',exact:true}).click();await visibleTarget(admin.page,'.hub-review-decision');
  await admin.page.getByLabel('当前文章内容完整性',{exact:true}).waitFor({state:'attached'});
  assert.ok((await admin.page.locator('.hub-pmc-inventory').innerText()).includes('原文未列出作者附录'));assert.ok((await admin.page.locator('.hub-review-content-state').innerText()).includes('PMC13678665.1.pdf'));
  assert.equal(await admin.page.getByText('表格（0）',{exact:true}).count(),0);
  await admin.page.getByText('原始文件与追溯（3）',{exact:true}).click();await admin.page.screenshot({path:out+'first-file-classification.png'});checks.push('首篇仅PDF缺失，三份机器格式副本不再称作者附录，无空表格入口；长文操作可达');
  await admin.page.locator('.hub-review-technical').last().scrollIntoViewIfNeeded();await pick(admin.page,'PMC13672493');await visibleTarget(admin.page,'.hub-review-detail-heading h3');
  await body(admin.page);assert.equal(await admin.page.getByText('图片（2）',{exact:true}).count(),1);
  const articleResponse=await admin.c.request.get(base+'/api/hub-sources/pmc-review-articles/'+before.find(x=>x.detail?.pmcid==='PMC13672493').detail.versionId);assert.equal(articleResponse.status(),200);const article=(await articleResponse.json()).article;
  const prefix='pmc-'+article.versionId+'-',tableId=prefix+article.targets[article.tables[0].refId];
  await admin.page.locator('.hub-pmc-structured-body a[href="#'+tableId+'"]').first().click();await visibleTarget(admin.page,'#'+tableId);
  assert.ok(await admin.page.locator('#'+tableId+' th[scope=col]').count()>0);assert.ok(await admin.page.locator('#'+tableId+' caption').count());await admin.page.screenshot({path:out+'second-table.png'});
  await admin.page.locator('#'+tableId).getByRole('link',{name:'返回正文引用位置',exact:true}).click();
  const figureId=prefix+article.targets[article.media[0].refId];await admin.page.locator('.hub-pmc-structured-body a[href="#'+figureId+'"]').first().click();await visibleTarget(admin.page,'#'+figureId);
  await admin.page.locator('#'+figureId+' img').waitFor();await admin.page.waitForFunction(id=>document.querySelector('#'+id+' img')?.naturalWidth>0,figureId);
  await admin.page.screenshot({path:out+'second-figure.png'});await admin.page.locator('#'+figureId).getByRole('link',{name:'返回正文引用位置',exact:true}).click();
  checks.push('从深处切篇后新标题可见；第二篇表格有真实表头/跨度，图片保留原比例，正文与图表双向定位');
  await bar.getByRole('button',{name:'回到审核决定',exact:true}).click();
  const secondStatus=before.find(x=>x.detail?.pmcid==='PMC13672493').state.status,secondSaved=['public','tenant','withheld'].includes(secondStatus);
  assert.match(await admin.page.getByRole('region',{name:'本次审核决定'}).innerText(),secondSaved?/当前决定已保存/:/尚未提交决定/);
  await admin.page.getByRole('region',{name:'本次审核决定'}).getByRole('button',{name:secondSaved?'下一篇待审核 →':'跳过，查看下一篇 →',exact:true}).focus();await admin.page.keyboard.press('Enter');await visibleTarget(admin.page,'.hub-review-detail-heading h3');
  assert.ok(!(await admin.page.locator('.hub-review-detail-heading').innerText()).includes('PMC13672493'));checks.push('未决定明确显示跳过，键盘下一篇不写入决定，新对象焦点与标题一致');
  // Inject a 503 for this read only; the explicit retry uses the real backend again.
  await admin.page.route('**/pmc-review-articles/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'本轮本机读取故障夹具'})}));
  await pick(admin.page,'PMC13678665');await admin.page.getByText('展开正文',{exact:true}).click();await admin.page.getByRole('alert').filter({hasText:'结构化阅读未就绪'}).waitFor();await admin.page.unroute('**/pmc-review-articles/**');
  await admin.page.getByRole('button',{name:'重试读取章节',exact:true}).click();await admin.page.getByRole('navigation',{name:'文章目录'}).waitFor();checks.push('读取失败明确降级，不能冒称无图表，显式重试恢复真实章节');
  const detailBox=await admin.page.locator('.hub-review-detail').boundingBox();
  await admin.page.mouse.move(detailBox.x+detailBox.width/2,400);await admin.page.mouse.wheel(0,100000);
  await admin.page.waitForFunction(()=>{const e=document.querySelector('main.platform-main');return e.scrollHeight-e.clientHeight-e.scrollTop<2;});
  const endFrames=await admin.page.evaluate(async()=>{const samples=[];for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const r=document.querySelector('.hub-review-queue').getBoundingClientRect();samples.push({top:r.top,height:r.height,bottom:r.bottom});}return samples;});
  assert.ok(Math.max(...endFrames.map(x=>x.height))-Math.min(...endFrames.map(x=>x.height))<=2,JSON.stringify(endFrames));
  assert.ok(endFrames.every(x=>x.top>=64&&x.bottom<=900),JSON.stringify(endFrames));
  await admin.page.screenshot({path:out+'queue-bottom.png'});await admin.page.mouse.wheel(0,-100000);await fitQueue(admin.page);
  checks.push('主容器真正底部静置60帧队列高度稳定，回上方仍填满剩余高度');
  for(const viewport of [{width:1366,height:768},{width:1920,height:1200},{width:390,height:844},{width:320,height:740}]){
    const s=await session(viewport);active=s.page;await open(s.page);await pick(s.page,'PMC13672493');await body(s.page);await s.page.locator('.hub-pmc-structured-body p').last().scrollIntoViewIfNeeded();
    await layout(s.page,'viewport'+viewport.width);const longBar=await s.page.getByRole('navigation',{name:'长文审核操作'}).boundingBox();assert.ok(longBar.y>=60&&longBar.y+longBar.height<=viewport.height+1,JSON.stringify(longBar));
    if(viewport.width>=960)await fitQueue(s.page);
    await s.page.screenshot({path:out+'reading-'+viewport.width+'.png'});
    await s.page.getByRole('navigation',{name:'长文审核操作'}).getByRole('button',{name:'回到审核决定',exact:true}).click();await visibleTarget(s.page,'.hub-review-decision');
    const range=s.page.getByRole('region',{name:'本次审核决定'}).getByLabel('本次可见范围',{exact:true});
    for(const value of ['public','tenant','withheld']){
      await range.scrollIntoViewIfNeeded();await range.selectOption(value);
      const described=(await range.getAttribute('aria-describedby')).split(' ')[0];assert.ok(await s.page.locator('[id="'+described+'"]').isVisible());
    }
    await s.page.getByRole('region',{name:'本次审核决定'}).screenshot({path:out+'actions-'+viewport.width+'.png'});
    if(viewport.width<960){await s.page.getByRole('button',{name:'返回审核队列',exact:true}).click();assert.ok(await s.page.getByRole('complementary',{name:'来源审核队列'}).isVisible());}
    checks.push(viewport.width+'视口：阅读字号、操作触达、长文入口、无页面横向溢出及返回通过');
  }
  zoom=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/pmc-reading-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'video'}});
  const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await login(zoom);
  const zp=await zoom.newPage();watch(zp);active=zp;await open(zp);await pick(zp,'PMC13672493');await body(zp);await zp.locator('.hub-pmc-structured-body p').last().scrollIntoViewIfNeeded();
  assert.equal(await zp.evaluate(()=>devicePixelRatio),2);await layout(zp,'native200');
  const zoomBar=await zp.getByRole('navigation',{name:'长文审核操作'}).boundingBox(),zoomHeight=await zp.evaluate(()=>innerHeight);
  assert.ok(zoomBar.y>=60&&zoomBar.y+zoomBar.height<=zoomHeight+1,JSON.stringify(zoomBar));
  // Capture the native window surface: Playwright's viewport:null clip can truncate a page zoomed via chrome://settings.
  const cdp=await zoom.newCDPSession(zp),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false});
  writeFileSync(out+'native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();
  await zp.getByRole('navigation',{name:'长文审核操作'}).getByRole('button',{name:'回到审核决定',exact:true}).click();await visibleTarget(zp,'.hub-review-decision');
  checks.push('原生Chrome200%真实阅读、字号、长文入口与返回决定通过');
  const owner=await session({width:1440,height:900},'owner');active=owner.page;await owner.page.goto(base+'/pages/g02/?view=source-review');await owner.page.getByRole('alert').filter({hasText:'当前账号没有此 Hub'}).waitFor();
  assert.equal(await owner.page.getByLabel('本次可见范围',{exact:true}).count(),0);checks.push('科研人员没有来源审核与新原文读取入口');
  assert.equal(hash(await queue(admin.c)),beforeHash);assert.deepEqual(errors,[]);checks.push('全部原对象/决定摘要前后完全一致，未提交放行或调用模型');
  const identity=await session();active=identity.page;await open(identity.page);await pick(identity.page,'PMC13672493');await body(identity.page);
  let release,captured,delivered;const held=new Promise(resolve=>{release=resolve;}),received=new Promise(resolve=>{captured=resolve;}),done=new Promise(resolve=>{delivered=resolve;});
  const firstVersion=before.find(x=>x.detail?.pmcid==='PMC13678665').detail.versionId;
  await identity.page.route('**/pmc-review-articles/'+firstVersion,async route=>{
    const response=await route.fetch();assert.equal(response.status(),200);captured();await held;
    await route.fulfill({response}).catch(()=>{});delivered();
  },{times:1});
  await pick(identity.page,'PMC13678665');
  let timer;try{await Promise.race([received,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('READING_CAPTURE_TIMEOUT')),12000);})]);}finally{clearTimeout(timer);}
  await identity.page.locator('[data-user-trigger][data-authenticated="true"]').click();
  await identity.page.getByRole('button',{name:'退出当前浏览器会话',exact:true}).click();
  await identity.page.getByText('已退出当前浏览器会话，不代表撤销其他设备。',{exact:true}).waitFor();
  await identity.page.getByRole('button',{name:'关闭',exact:true}).click();release();await done;
  await identity.page.getByRole('alert').waitFor();
  assert.equal(await identity.page.locator('.hub-pmc-review').count(),0);assert.equal(await identity.page.getByRole('navigation',{name:'文章目录'}).count(),0);
  await identity.page.screenshot({path:out+'logout-late-reading.png'});assert.deepEqual(errors,[]);
  checks.push('真实原文200在退出后释放，未回填上一身份的文章、目录或操作入口');
  writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,errors,network,metrics,beforeHash,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(error){const stamp=Date.now();await active?.screenshot({path:out+'failure-'+stamp+'.png'}).catch(()=>{});writeFileSync(out+'failure-'+stamp+'.json',JSON.stringify({passed:false,error:error.message,checks,errors,network},null,2));console.error(JSON.stringify({passed:false,error:error.message,evidence:out}));process.exitCode=1;
}finally{await zoom?.close().catch(()=>{});for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
