// Target-environment read-only business checks; never sends an AI question.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {materialKnowledgeHref} from '../src/session-material-session.js';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-file-data-2026-11-12/p03-target-'+Date.now();mkdirSync(out+'/video',{recursive:true,mode:0o700});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const prior=JSON.parse(readFileSync('.tmp/ai-file-data-2026-11-12/p02-browser-1794503079959/result.json','utf8'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},scope={studyGroupId:ids.group,researchProjectId:ids.project},records=[],errors=[],blocked=[];let passed=false;
try{
 for(const actor of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});
  context.on('page',p=>{p.on('pageerror',e=>errors.push({actor,type:'pageerror',message:e.message}));p.on('console',m=>{if(m.type()==='error')errors.push({actor,type:'console',message:m.text().slice(0,400)});});});
  try{
   assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
   const status=await context.request.get(base+'/api/knowledge/ai-status',{headers});assert.equal(status.status(),200);assert.equal((await status.json()).materialUpload.analysisReady,true,'current runtime must load the real private-material adapter');
   const original=prior.uploads.find(x=>x.actor===actor&&x.format==='txt');assert(original?.sessionId);
   const materials=await context.request.get(base+'/api/sessions/'+original.sessionId+'/materials?limit=20',{headers});assert.equal(materials.status(),200);const item=(await materials.json()).items.find(x=>x.id===original.materialId);assert(item?.available);
   const response=await context.request.get(base+'/api/knowledge/docs/'+item.docId,{headers});assert.equal(response.status(),200);const doc=await response.json();
   const hash=createHash('sha256').update(doc.contentMd).digest('hex'),href=materialKnowledgeHref({...item,docVersion:doc.version,contentSha256:hash},scope);assert(href?.includes('docVersion='));
   await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();if(url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method())&&!['/api/auth/renew','/api/sessions/knowledge'].includes(url.pathname)){blocked.push({actor,path:url.pathname});return route.abort();}return route.continue();});
   const page=await context.newPage();await page.goto(base+'/pages/ai01/?sessionId='+original.sessionId);const question=page.getByLabel('研究问题',{exact:true});await question.waitFor();await page.waitForFunction(()=>!document.querySelector('#hub-agent-question')?.disabled);
   await question.fill('待人工验收：汇总本会话资料并标明来源，不发送。');assert(await question.isEnabled());await page.screenshot({path:out+'/'+actor+'-analysis-ready.png'});
   const network=page.getByRole('button',{name:'智能搜索',exact:true});await network.click();assert(await question.isDisabled());await page.getByText(/请先关闭“智能搜索”再分析本会话资料/).waitFor();await network.click();assert(await question.isEnabled());assert.equal(await question.inputValue(),'待人工验收：汇总本会话资料并标明来源，不发送。');
   const knowledge=await context.newPage();await knowledge.goto(base+href);const frame=knowledge.frameLocator('iframe[title="知识资料操作区"]');await frame.getByRole('button',{name:'抽取预览',exact:true}).click();await frame.getByText(/P02-HEAD/).first().waitFor();await knowledge.screenshot({path:out+'/'+actor+'-fixed-version.png'});
   await context.route('**/api/knowledge/docs/'+doc.id,route=>route.fulfill({json:{...doc,version:doc.version+1,contentMd:'CONTROLLED_CHANGED_REVISION_NOT_ORIGINAL'}}));
   await knowledge.reload();await knowledge.frameLocator('iframe[title="知识资料操作区"]').getByText(/资料已修订，与本次回答引用的版本不同/).waitFor();assert.equal(await knowledge.frameLocator('iframe[title="知识资料操作区"]').getByText('CONTROLLED_CHANGED_REVISION_NOT_ORIGINAL',{exact:false}).count(),0);await knowledge.screenshot({path:out+'/'+actor+'-version-changed.png'});
   records.push({actor,sessionId:original.sessionId,analysisReady:true,fixedVersion:doc.version,changedResponseRejected:true,controlledChangedResponse:true,newUploads:0,questionPosts:0});await knowledge.close();await page.close();
  }finally{try{await context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}catch{errors.push({actor,type:'cleanup',message:'Diagnostic logout unconfirmed'});}await context.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);passed=true;
}catch(e){console.error(JSON.stringify({passed:false,code:e.code??e.name??'TARGET_CHECK_FAILED',evidence:out}));process.exitCode=1;}
finally{await browser.close();writeFileSync(out+'/result.json',JSON.stringify({passed,records,errors,blocked,modelCalls:0,aiBusinessAcceptance:false},null,2),{mode:0o600});console.log(JSON.stringify({passed,evidence:out,accounts:records.length,errors:errors.length,blocked:blocked.length,modelCalls:0,aiBusinessAcceptance:false}));}
