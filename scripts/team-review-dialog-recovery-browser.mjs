// Controlled browser contract only: every directory POST is intercepted; no business writes.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {root,base,runtime} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/team-review-dialog-2026-11-07/'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}}),page=await ctx.newPage();
const id='rhde-19ccf8f5caa84034b0dea6a897a0b43b',api='/api/hubs/lingshu-xinyu/directory-admin/',entity=api+'team-workspaces/'+id;
let original,submitted=false,failRead=false,key,posts=0,receipts=0,operation='review';const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 original=await(await ctx.request.get(base+entity)).json();
 const snapshot={...original,hasDraft:true,baseRevision:original.currentRevision,data:{...original.data,verificationMethod:'administrator'}};
 await page.route('**/api/hubs/lingshu-xinyu/directory-admin/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const respond=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(request.method()==='POST'){
   assert.equal(url.pathname,operation==='review'?entity+'/reviews':entity);posts++;key=request.postDataJSON().requestKey;if(operation==='save')snapshot.data=request.postDataJSON().data;submitted=true;failRead=true;
   return respond(200,{id,version:original.version+1,reviewedAt:new Date().toISOString(),changedFacts:1});
  }
  if(url.pathname===entity){if(failRead){failRead=false;return respond(404,{code:'TEST_POST_COMMIT_READ_FAILURE'});}return respond(200,{...snapshot,...(submitted?{version:original.version+1,reviewedVersion:original.version+1}: {})});}
  if(url.pathname===entity+'/preview')return respond(200,{id,version:original.version,planHash:'a'.repeat(64),audience:'tenant',publicExposure:false,jointInstitutions:[],canApprove:true,issues:[],changes:[],newObjects:[],data:snapshot.data,current:{id},sources:[]});
  if(url.pathname===entity+'/receipts'){assert.equal(url.searchParams.get('key'),key);receipts++;return respond(200,{operation,result:{id,version:original.version+1}});}
  return route.continue();
 });
 await page.goto(base+'/pages/g02/?view=directory-review');
 const search=page.getByRole('searchbox',{name:'查找团队',exact:true});await search.fill(original.data.name);await page.getByRole('button',{name:'查找团队',exact:true}).click();
 await page.getByRole('button',{name:'审核：'+original.data.name,exact:true}).click();
 const editor=page.locator('dialog.team-workspace-dialog');await editor.getByLabel('核实说明',{exact:true}).fill('受控浏览器回执契约，不提交真实业务');
 const review=editor.getByRole('button',{name:'审核通过并展示',exact:true});
 await page.waitForFunction(()=>[...document.querySelectorAll('.team-workspace-dialog button')].some(e=>e.textContent==='审核通过并展示'&&!e.disabled));await review.click();
 await editor.getByRole('button',{name:'核对原提交结果',exact:true}).waitFor();assert.equal(posts,1);assert(await review.isDisabled());
 await editor.getByRole('button',{name:'关闭审核弹窗'}).click();assert(await editor.isVisible());await page.keyboard.press('Escape');assert(await editor.isVisible());
 await page.screenshot({path:out+'post-commit-404.png',fullPage:true});
 await editor.getByRole('button',{name:'核对原提交结果',exact:true}).click();await editor.waitFor({state:'detached'});
 assert.equal(posts,1);assert.equal(receipts,1);assert.equal(await search.inputValue(),original.data.name);
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-team-review-id')===id,id);
 await page.screenshot({path:out+'receipt-restored-list.png',fullPage:true});
 operation='save';await page.getByRole('button',{name:'审核：'+original.data.name,exact:true}).click();
 await editor.getByLabel('团队简介（选填）',{exact:true}).fill('受控草稿回读恢复，不写数据库');await editor.getByLabel('核实说明',{exact:true}).fill('受控核实说明');
 await page.waitForFunction(()=>[...document.querySelectorAll('.team-workspace-dialog button')].some(e=>e.textContent==='审核通过并展示'&&!e.disabled));await editor.getByRole('button',{name:'审核通过并展示',exact:true}).click();
 await editor.getByRole('button',{name:'核对原提交结果',exact:true}).waitFor();assert.equal(posts,2);assert(await editor.getByRole('button',{name:'审核通过并展示',exact:true}).isDisabled());
 await editor.getByRole('button',{name:'核对原提交结果',exact:true}).click();await editor.getByRole('button',{name:'核对原提交结果',exact:true}).waitFor({state:'detached'});assert(await editor.isVisible());assert.equal(receipts,2);assert.equal(await editor.getByLabel('团队简介（选填）',{exact:true}).inputValue(),'受控草稿回读恢复，不写数据库');
 await page.screenshot({path:out+'draft-receipt-keeps-editor.png',fullPage:true});
 const after=await(await ctx.request.get(base+entity)).json();assert.equal(after.version,original.version);assert.deepEqual(after.data,original.data);assert.deepEqual(errors,[]);
 await ctx.close();
 writeFileSync(out+'result.json',JSON.stringify({passed:true,type:'controlled-browser-contract-not-real-review',checks:['POST200 then read404 preserves pending and blocks close/new submit','original-key review receipt then readback/list closes editor and restores focus/query','review preparation save200 then read404 preserves original save key; recovered draft stays open without automatic approval'],interceptedPosts:posts,receiptReads:receipts,realBusinessWrites:0,errors},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
}catch(e){await page.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:e.message,posts,receipts,errors},null,2));console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}finally{await browser.close();}
