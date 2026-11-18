// Read-only media verification: only the six previously approved MV03 objects.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--read-existing-mv03']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/.tmp/ai-video-recovery-2026-11-16/live/';mkdirSync(out,{recursive:true,mode:0o700});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),old=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-2026-11-16/live/checkpoint.json'));
assert.equal(runtime.key,'rh-kb-local-b0e2af9d');assert.equal(old.scope,'MV03-six-synthetic-videos-20261116');
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const actor of ['owner','admin']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}}),record=old.actors[actor],entry=record.files['MV03-SYNTHETIC-AV.mp4'];assert(entry.completed);
 const identity=[runtime.ids.tenant,runtime.ids[actor],runtime.ids.group,runtime.ids.project].join(':'),key='rh-media-pending:'+identity+':'+record.sessionId;
 const pending={requestKey:entry.requestKey,uploadId:entry.uploadId,phase:'transferring',byteSize:entry.size,extension:'mp4'};
 const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(r.status(),201);
 // Private test-browser pending metadata only; never reads credentials or video bytes.
 await context.addInitScript(({key,pending})=>sessionStorage.setItem(key,JSON.stringify([pending])),{key,pending});
 let fault=true,actualReceipt=0;const errors=[],calls=[],consoleEvents=[];
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();
  if(u.pathname.startsWith('/api/')){
   calls.push({method:q.method(),path:u.pathname});
   if(q.method()!=='GET'&&!u.pathname.endsWith('/auth/renew')||u.pathname.endsWith('/content')){errors.push('Forbidden verification request '+u.pathname);return route.abort();}
   if(u.pathname.endsWith('/media/receipts/'+entry.requestKey)){
    if(fault)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'合成网络中断验证，原上传保持。'})});
    actualReceipt++;
   }
  }
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{if(['warning','error'].includes(message.type())){let path='';try{path=new URL(message.location().url).pathname;}catch{}consoleEvents.push({type:message.type(),path,expected:path.endsWith('/media/receipts/'+entry.requestKey)&&message.text().includes('503')});}});
 try{
  await page.goto(base+'/pages/ai01/?sessionId='+record.sessionId);await page.getByRole('button',{name:'继续上传',exact:true}).waitFor();await page.getByRole('alert').filter({hasText:'合成网络中断验证'}).waitFor();
  const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await picker).setFiles([]);
  await page.screenshot({path:out+actor+'-before-check.png'});
  fault=false;await page.getByRole('button',{name:'核对上传',exact:true}).click();await page.getByText('已核对，视频已归档。',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'继续上传',exact:true}).count(),0);assert.equal(await page.getByRole('alert').count(),0);assert(actualReceipt>0);assert.deepEqual(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),key),[]);assert.deepEqual(errors,[]);assert.deepEqual(consoleEvents.filter(event=>!event.expected),[]);
  await page.screenshot({path:out+actor+'-recovered.png'});
  const result={actor,actualReceipt,pickerOpened:true,originalPendingCleared:true,newMediaWrites:0,rawVideoRequests:0,controlledFault:'Initial receipt GET returns a synthetic 503; manual check reads actual archived receipt',errors,calls,consoleEvents};results.push(result);writeFileSync(out+actor+'.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});
 }catch(e){await page.screenshot({path:out+actor+'-failure.png'});throw e;}
 finally{await context.close();}
}}finally{await browser.close();}
writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),runtimePid:runtime.pid,results,newMediaObjects:0,newProviderRequests:0},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({passed:true,actors:results.length,newMediaObjects:0,newProviderRequests:0,evidence:out}));
