import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {makeCrfMethodAssetUrl} from '../src/crf-method-assets-session.js';
export async function verifyReviewReadFailures({page,checks,actor}){
 const originalUrl=page.url(),path='/api/crf-method-asset-drafts/'+new URL(page.url()).searchParams.get('crfMethodAssetId'),input=page.getByLabel('方法资产本人复用说明（不改写历史证据）',{exact:true}),notes='保留本人尚未提交说明 '+randomUUID(),match=u=>u.pathname===path;
 await input.waitFor();await input.fill(notes);
 for(const kind of ['integrity','network']){
  await page.route(match,async route=>{if(kind==='network')return route.abort('failed');const response=await route.fetch();assert.equal(response.status(),200);return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'CRF_ASSET_CONTEXT_INVALID',message:'受控来源校验失败'})});});
  try{await page.waitForFunction(()=>document.querySelector('#method-asset-notes')?.disabled,{},{timeout:9000});assert.equal(await input.inputValue(),notes);assert.equal(await page.getByText('来源有效',{exact:false}).count(),0,'unverified read cannot retain positive source claim');
   assert.equal(await page.locator('.method-reading').count(),kind==='integrity'?0:1);assert(await page.getByRole('button',{name:'派生本人新方法候选',exact:true}).isDisabled());checks.push(actor+'-'+kind+'-read-disables-writes-preserves-dirty-and-does-not-claim-current');
  }finally{await page.unroute(match);}
  await page.getByRole('button',{name:'重新验证当前候选',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#method-asset-notes')?.disabled);assert.equal(await input.inputValue(),notes);assert.equal(await page.getByText('受控来源校验失败',{exact:false}).count(),0);checks.push(actor+'-'+kind+'-successful-reread-clears-read-error-without-discarding-input');
 }
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'核对最新方法候选',exact:true}).click();await page.waitForFunction(value=>document.querySelector('#method-asset-notes')?.value!==value,notes);
 await page.getByRole('link',{name:'返回我的方法候选列表',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.method-assets-workspace .asset-list>li').length===20);
 const list=u=>u.pathname==='/api/crf-method-asset-drafts';for(const kind of ['integrity','network']){await page.route(list,async route=>{if(kind==='network')return route.abort('failed');const res=await route.fetch();assert.equal(res.status(),200);return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'CRF_ASSET_CONTEXT_INVALID',message:'受控列表来源校验失败'})});});
  try{await page.getByRole('button',{name:'刷新方法候选列表',exact:true}).click();await page.getByText('列表当前未核实',{exact:false}).waitFor();assert.equal(await page.locator('.method-assets-workspace .asset-list>li').count(),kind==='integrity'?0:20);assert.equal(await page.getByText('来源有效',{exact:false}).count(),0);checks.push(actor+'-'+kind+'-list-not-falsely-current');}finally{await page.unroute(list);}
  await page.getByRole('button',{name:'刷新方法候选列表',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.method-assets-workspace .asset-list>li').length===20);assert.equal(await page.getByText('受控列表来源校验失败',{exact:false}).count(),0);
 }
 await page.goto(originalUrl);await input.waitFor();
}
export async function verifyReviewTargetAuthorization({page,context,base,headers,privateDir,scope,checks,actor}){
 const originalUrl=page.url(),scopePath=privateDir+'wp08-scope.json',original=readFileSync(scopePath,'utf8'),replace=text=>{const p=scopePath+'.'+randomUUID()+'.tmp';writeFileSync(p,text,{mode:0o600,flag:'wx'});renameSync(p,scopePath);};
 async function heldWithdrawal(url,no,withdraw,label){await page.goto(url);await page.getByLabel('方法资产本人复用说明（不改写历史证据）',{exact:true}).waitFor();const id=new URL(page.url()).searchParams.get('crfMethodAssetId'),path='/api/crf-method-asset-drafts/'+id+(no?'/versions/'+no:'');let release,signal,held=false;const captured=new Promise(ok=>signal=ok),match=u=>u.pathname===path;
  await page.route(match,async route=>{if(held)return route.continue();held=true;const res=await route.fetch();assert.equal(res.status(),200);signal();await new Promise(ok=>release=ok);await route.fulfill({response:res}).catch(()=>{});});
  try{if(no)await page.getByLabel('方法候选历史版本',{exact:true}).selectOption(String(no));else await page.getByRole('button',{name:'核对最新方法候选',exact:true}).click();await captured;replace(JSON.stringify(withdraw(JSON.parse(original))));await page.waitForFunction(()=>!document.querySelector('[aria-label="方法资产候选内容"]'),{},{timeout:9000});release();await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));assert.equal(await page.getByRole('region',{name:'方法资产候选内容',exact:true}).count(),0);checks.push(actor+'-'+label+'-exact-target-revoked-late200-not-delivered');
  }finally{release?.();replace(original);await page.unroute(match);}
  await page.getByRole('button',{name:'重新核对会话与授权',exact:true}).click();await page.getByLabel('方法资产本人复用说明（不改写历史证据）',{exact:true}).waitFor();checks.push(actor+'-'+label+'-restored-explicit-reread-not-stuck');
 }
 try{await heldWithdrawal(originalUrl,1,s=>({...s,operations:s.operations.filter(op=>op!=='A02')}),'A02-only-history');
  const list=await(await context.request.get(base+'/api/crf-method-asset-drafts?limit=20',{headers})).json(),first=list.items[0].reportId;let row=list.items.find(v=>v.reportId!==first),before=list.nextCursor;
  for(let i=0;!row&&before&&i<4;i++){const data=await(await context.request.get(base+'/api/crf-method-asset-drafts?limit=20&before='+before,{headers})).json();row=data.items.find(v=>v.reportId!==first);before=data.nextCursor;}assert(row,'different registered source fixture required');
  await heldWithdrawal(base+makeCrfMethodAssetUrl('a02',scope,row.id),null,s=>({...s,sourceRoots:s.sourceRoots.filter(v=>v.reportId!==row.reportId)}),'non-first-source-root');
 }finally{replace(original);assert.equal(readFileSync(scopePath,'utf8'),original);await page.goto(originalUrl);}
}
