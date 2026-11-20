// Free, fully intercepted component contracts. NOT real AI execution or backend acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const {default:pw}=await import('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const origin='http://127.0.0.1:19663',runId=randomUUID(),out=path.resolve('docs/testing/evidence/f07-adoption-contract-2026-11-20',runId);
fs.mkdirSync(out+'/video',{recursive:true});
const hash=createHash('sha256').update('contract source body').digest('hex');
const source={kbId:'contract-kb',docId:'contract-source',docTitle:'Contract source',kbName:'Contract',version:1,contentHash:hash,chunkId:'contract-chunk',quote:'contract excerpt',retrievedAt:'2026-11-20T01:00:00.000Z'};
const message={id:'contract-answer',role:'assistant',content:'Contract answer [1]\n![model image](https://external.invalid/image.png)\n<img src="https://external.invalid/html.png">\n[external](https://external.invalid/link)\nftp://external.invalid/file\nmodel@example.invalid',meta:{sourceStatus:'current',provenance:{knowledgeSources:[source]}}};
const report={kind:'contract_mock_not_ai_execution',runId,origin,backendRequests:0,modelCalls:0,databaseWrites:0,checks:[],errors:[],api:[],blockedExternal:[]};
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context,page;
async function start(scenario='page'){
 if(context)await context.close();
 context=await browser.newContext({viewport:{width:1600,height:1000},recordVideo:{dir:out+'/video'}});
 const control={delay:false,pending:[],requests:[],docs:{'contract-current':{id:'contract-current',title:'Contract current',contentMd:'initial editable text'},'contract-source':{id:'contract-source',title:'Contract source',contentMd:'contract source body'}},created:0};
 const detail=value=>({...value,kbId:'contract-kb',scope:'personal',version:1,reviewed:true,status:'active',canEdit:true,sourceFile:null});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){report.blockedExternal.push(request.url());return route.abort();}
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const event={method:request.method(),path:url.pathname,query:url.search};control.requests.push(event);report.api.push(event);
  const fulfill=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/agents')return fulfill([{id:'contract-agent',type:'research'}]);
  if(url.pathname==='/api/knowledge/ai-status')return fulfill({enabled:true,quota:{canStart:true,blocked:false,requiredTokens:'0',message:'contract fixture'}});
  if(url.pathname==='/api/sessions/knowledge'&&request.method()==='POST')return fulfill({id:'contract-session'});
  if(url.pathname==='/api/sessions/contract-session/knowledge-state')return fulfill({messages:[message],jobs:[],hubContext:{kind:'knowledge',kbId:'contract-kb'}});
  if(url.pathname==='/api/sessions/contract-session/knowledge-sources/contract-answer/1'){
   if(control.delay)return new Promise(resolve=>control.pending.push(async()=>{await fulfill({...source,status:'current'});resolve();}));
   return fulfill({...source,status:'current'});
  }
  if(url.pathname==='/api/knowledge/bases')return fulfill([{id:'contract-kb',name:'Contract personal',scope:'personal',visibility:'private',docCount:Object.keys(control.docs).length,canWrite:true,canManage:true}]);
  if(url.pathname==='/api/knowledge/bases/contract-kb/tree')return fulfill(Object.values(control.docs).map((d,i)=>({id:d.id,title:d.title,order:i,status:'active',reviewed:true,children:[]})));
  if(url.pathname==='/api/knowledge/docs'&&request.method()==='POST'){
   control.created++;const data=request.postDataJSON(),id='contract-created-'+control.created;control.docs[id]={id,title:data.title,contentMd:''};return fulfill({id});
  }
  if(url.pathname.startsWith('/api/knowledge/docs/')&&request.method()==='GET'){
   const d=control.docs[url.pathname.split('/').at(-1)];if(d)return fulfill(detail(d));
  }
  report.errors.push('unexpected mocked API: '+request.method()+' '+url.pathname);
  return route.fulfill({status:422,contentType:'application/json',body:'{"message":"contract request not declared"}'});
 });
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin+'/scripts/fixtures/f07-adoption-contract.html?scenario='+scenario);
 await page.waitForFunction(()=>!!window.__f07);
 return control;
}
const release=async control=>{assert(control.pending.length>0);for(const done of control.pending.splice(0))await done();};
const noPatch=control=>assert.equal(control.requests.filter(r=>r.method==='PATCH').length,0);
async function beginDelayed(control){control.delay=true;await page.getByRole('button',{name:'整理到当前文档',exact:true}).click();await page.waitForFunction(()=>document.body.textContent.includes('正在核对资料…'));const deadline=Date.now()+5000;while(!control.pending.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert(control.pending.length,'source verification request was not intercepted');}
try{
 report.stage='dirty-draft';let control=await start();
 await page.getByRole('button',{name:'Markdown',exact:true}).click();const editor=page.locator('main textarea');await editor.fill('original unsaved');
 await beginDelayed(control);await editor.fill('edited while source was delayed');await release(control);
 await page.locator('.knowledge-banner').filter({hasText:'已追加到当前草稿，请核对后保存。'}).waitFor();assert((await editor.inputValue()).startsWith('edited while source was delayed'));assert((await editor.inputValue()).includes('AI整理草稿'));noPatch(control);
 await page.screenshot({path:out+'/01-delayed-preserves-dirty.png'});report.checks.push('real KnowledgeBasePage preserves latest dirty draft when delayed adoption resolves; zero automatic PATCH');
 for(const mutation of ['document','version','readonly','identity']){
  report.stage='late-'+mutation;control=await start('panel');await page.getByRole('button',{name:'整理到当前文档',exact:true}).waitFor();await beginDelayed(control);
  await page.evaluate(kind=>{if(kind==='identity')window.__f07.changeIdentity();else window.__f07.changeTarget(kind==='document'?'other-doc:1':kind==='version'?'doc:2':'doc:1',kind!=='readonly');},mutation);
  await page.waitForTimeout(50);await release(control);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__f07.adoptionCalls),0);assert.equal(await page.getByLabel('contract draft').inputValue(),'contract original');noPatch(control);report.checks.push('real KbAgentPanel late '+mutation+' response cannot adopt');
 }
 report.stage='inert-model-render';control=await start('render');await page.evaluate(m=>window.__f07.renderAnswer(m),message);await page.locator('[data-testid="wysiwyg"] .ProseMirror').waitFor();await page.getByTestId('preview').getByText('AI整理草稿',{exact:true}).waitFor();
 for(const section of ['wysiwyg','preview']){
  const element=page.getByTestId(section);assert.equal(await element.locator('img').count(),0);const hrefs=await element.locator('a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert(hrefs.every(href=>href?.startsWith('/pages/k01/?')),JSON.stringify({section,hrefs}));
 }
 assert.equal(report.blockedExternal.length,0);noPatch(control);await page.screenshot({path:out+'/02-inert-model-editor-preview.png'});report.checks.push('actual WikiEditor and preview create zero model images/HTML images/external anchors; only verified local source links');
 report.stage='actual-template-loader';control=await start();await page.getByRole('button',{name:'+ 新建文档',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('文档类型').selectOption('reading');await dialog.getByLabel('文章标题').fill('Contract new reading record');await dialog.getByLabel('关联原资料（可选）').selectOption('contract-source');await dialog.getByRole('button',{name:'创建文档',exact:true}).click();
 await page.getByLabel('文档标题',{exact:true}).waitFor();await page.getByRole('button',{name:'Markdown',exact:true}).click();const created=page.locator('main textarea');await page.waitForFunction(()=>document.querySelector('main textarea')?.value.includes('## 本人思考'));assert((await created.inputValue()).includes('docId=contract-source'));assert.equal(await page.getByLabel('文档标题',{exact:true}).inputValue(),'Contract new reading record');assert.equal(control.created,1);assert(control.requests.some(r=>r.path==='/api/knowledge/docs/contract-created-1'&&r.method==='GET'));assert.equal(control.docs['contract-created-1'].contentMd,'');await page.getByRole('button',{name:'保存',exact:true}).waitFor();noPatch(control);await page.screenshot({path:out+'/03-template-actual-id-unsaved.png'});report.checks.push('real create dialog uses returned document ID and authorized document loader; template remains dirty in memory, persisted fixture body blank, zero automatic PATCH');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{if(context)await context.close();await browser.close();report.mockApiRequests=report.api.length;report.automaticPatchCount=report.api.filter(r=>r.method==='PATCH').length;report.finishedAt=new Date().toISOString();fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({kind:report.kind,passed:report.passed,stage:report.stage,evidence:out+'/result.json'}));}
