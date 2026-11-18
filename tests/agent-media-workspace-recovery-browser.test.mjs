// Complete product workspace with controlled HTTP only; no database, Provider or persisted media.
import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-video-recovery-2026-11-16/workspace-'+Date.now();mkdirSync(out,{recursive:true});
const file={name:'RECOVERY-SYNTHETIC.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1500000)};
test('owner and admin recover the original video through the actual workspace and auth focus chain',async t=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{for(const actor of ['owner','admin'])await t.test(actor,async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}}),page=await context.newPage(),calls=[],errors=[];let holdMe=false,releaseMe=null,item=null,firstInit=true;
  const user={accountId:actor,tenantId:'tenant',username:actor+'@example.org',displayName:'合成'+actor,authVersion:5,studyGroups:[{id:'group',name:'合成组',researchProjects:[{id:'project',name:'合成来源'}]}]};
  const uploadId='00000000-0000-4000-a000-000000000001';page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
   const path=u.pathname,method=q.method();calls.push({path,method,...(method==='POST'&&path.endsWith('/media-uploads')?{requestKey:q.postDataJSON().requestKey}:{})});let result;
   if(path==='/api/auth/me'){if(holdMe)await new Promise(resolve=>releaseMe=resolve);result=user;}
   else if(path==='/api/agents')result=[{id:'research-agent',type:'research'}];
   else if(path==='/api/knowledge/ai-status')result={quota:{blocked:false},materialUpload:{enabled:true,analysisReady:true,mediaEnabled:true}};
   else if(path.endsWith('/knowledge-state'))result={hubContext:{kind:'hub',sessionId:'recovery-session'},messages:[],jobs:[],nextCursor:null,quota:{blocked:false}};
   else if(path.endsWith('/history'))result={items:[],page:1,hasMore:false};
   else if(path.includes('/media/receipts/'))result={found:Boolean(item),item,upload:item?{uploadId,chunkSize:1024*1024,totalChunks:2}:null};
   else if(path.endsWith('/media-uploads')&&method==='POST'){
    if(firstInit){firstInit=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'合成初始化暂不可用，请保留原上传。'})});}
    item={id:'recovery-media',version:2,name:'media.mp4',extension:'mp4',byteSize:1500000,archiveState:'pending',inspectionState:'pending',classification:null,inspection:{hasVideo:false,hasAudio:false},contentUnderstood:false,canRecheck:false,createdAt:new Date().toISOString()};result={item,uploadId,chunkSize:1024*1024,totalChunks:2};
   }else if(path.includes('/chunks/')&&method==='POST')result={uploaded:true};
   else if(path.endsWith('/complete')&&method==='POST'){item={...item,version:5,archiveState:'archived',inspectionState:'complete',classification:'valid',inspection:{durationSeconds:1,hasVideo:true,hasAudio:true}};result=item;}
   else if(path.endsWith('/media'))result={items:item?[item]:[],nextCursor:null};
   else if(path.endsWith('/commands'))result={items:[]};
   else if(method==='GET')result={items:[],nextCursor:null};
   else{errors.push('Unexpected write '+path);return route.abort();}
   return route.fulfill({status:method==='POST'?201:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  try{
   await page.goto(base+'/scripts/fixtures/upload-focus-harness.html?sessionId=recovery-session');await page.getByRole('button',{name:'上传文件',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.composerTools button').disabled);
   const initial=page.waitForEvent('filechooser');await page.getByRole('button',{name:'上传文件',exact:true}).click();await(await initial).setFiles(file);await page.getByRole('alert').filter({hasText:'合成初始化暂不可用'}).waitFor();
   await page.getByRole('button',{name:'核对上传',exact:true}).click();await page.getByText('暂未查到这次上传记录，请选择原视频继续上传。',{exact:false}).waitFor();await page.screenshot({path:out+'/'+actor+'-unresolved.png'});
   const wrong=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await wrong).setFiles({...file,buffer:Buffer.alloc(1499999)});await page.getByRole('alert').filter({hasText:'格式和大小需与原记录一致'}).waitFor();
   holdMe=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.real-ai-revalidation').waitFor();holdMe=false;releaseMe();await page.locator('.real-ai-revalidation').waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('.composerTools button').disabled);
   await page.getByRole('alert').filter({hasText:'格式和大小需与原记录一致'}).waitFor();assert.equal(calls.filter(x=>x.method==='POST'&&x.path.endsWith('/media-uploads')).length,1);
   const resume=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();const chooser=await resume;holdMe=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.real-ai-revalidation').waitFor();await chooser.setFiles(file);
   assert.equal(calls.filter(x=>x.method==='POST'&&x.path.endsWith('/media-uploads')).length,1);holdMe=false;releaseMe();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor({timeout:5000});
   const attempts=calls.filter(x=>x.method==='POST'&&x.path.endsWith('/media-uploads'));assert.equal(attempts.length,2);assert.equal(new Set(attempts.map(x=>x.requestKey)).size,1);assert.equal(calls.filter(x=>x.path.includes('/chunks/')).length,2);assert.equal(calls.filter(x=>x.path.endsWith('/complete')).length,1);
   assert.equal(await page.getByRole('button',{name:'继续上传',exact:true}).count(),0);assert.deepEqual(errors,[]);
   for(const width of [1366,1440,1920]){await page.setViewportSize({width,height:1000});await page.screenshot({path:out+'/'+actor+'-'+width+'.png'});}
  }catch(e){await page.screenshot({path:out+'/'+actor+'-failure.png'});throw e;}
  finally{writeFileSync(out+'/'+actor+'.json',JSON.stringify({calls,errors,mockedHttp:true,newDatabaseObjects:0,newProviderRequests:0},null,2));await context.close();}
 });}finally{await browser.close();console.log(JSON.stringify({evidence:out,mockedHttp:true}));}
});
