// Current local asset pages only. Login and open/cancel dialogs; no business
// write, permission change, model call or application deployment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {makeCatalogAssetUrl} from '../src/research-assets-catalog-session.js';
assert.deepEqual(process.argv.slice(2),['--read-only']);
const{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const directory=fileURLToPath(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/browser-c1/layout/',import.meta.url));mkdirSync(directory,{recursive:true});
const assets=JSON.parse(readFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/browser-c1/result.json',import.meta.url))).assets;
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium,browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),base='http://127.0.0.1:19501',metrics=[];
const style=n=>({font:getComputedStyle(n).fontSize,lineHeight:getComputedStyle(n).lineHeight,rect:n.getBoundingClientRect().toJSON(),fontRules:[...document.styleSheets].flatMap(s=>{try{return[...s.cssRules].filter(r=>r.selectorText&&n.matches(r.selectorText)&&(r.style.fontSize||r.style.font)).map(r=>r.cssText);}catch{return[];}})});
try{for(const actor of ['owner','admin']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 try{
  const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});assert(login.ok());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,1280]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/pages/a01/?studyGroupId='+ids.group+'&researchProjectId='+ids.project+'&pageSize=50');await page.locator('.asset-catalog-name').first().waitFor();
   const button=await page.locator('.asset-catalog-search button').evaluate(style);metrics.push({actor,page:'a01',width,button});
   await page.screenshot({path:directory+actor+'-a01-'+width+'.png'});
   assert.deepEqual({font:button.font,lineHeight:button.lineHeight},{font:'14px',lineHeight:'22px'});
  }
  await page.getByRole('button',{name:'上传资产',exact:true}).click();const dialog=page.getByRole('dialog',{name:'登记资产',exact:true});await dialog.getByRole('button',{name:'返回资产',exact:true}).waitFor();
  const dialogButton=await dialog.locator('.ui-confirm-dialog-actions .ui-button').last().evaluate(style);metrics.push({actor,page:'registration-capacity',button:dialogButton});assert.equal(dialogButton.font,'14px');assert.equal(dialogButton.lineHeight,'22px');await dialog.getByRole('button',{name:'返回资产',exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});const asset=assets.find(a=>a.actor===actor&&a.slot===1&&a.label===(actor==='admin'?'B':'A'));
  await page.goto(base+makeCatalogAssetUrl({studyGroupId:ids.group,researchProjectId:asset.project},asset.id,2));const reading=page.locator('.research-asset-reading p').first();await reading.waitFor();const paragraph=await reading.evaluate(style);assert.equal(paragraph.font,'16px');assert.equal(paragraph.lineHeight,'28px');
  await page.getByRole('button',{name:'版本历史',exact:true}).click();const compare=page.getByRole('button',{name:'比较版本',exact:true});await compare.waitFor();const compareButton=await compare.evaluate(style);assert.equal(compareButton.font,'14px');assert.equal(compareButton.lineHeight,'22px');metrics.push({actor,page:'a02',width:1440,paragraph,button:compareButton});await page.screenshot({path:directory+actor+'-a02-history-1440.png'});assert.deepEqual(errors,[]);
 }finally{await context.close();}
}
writeFileSync(directory+'metrics.json',JSON.stringify({passed:true,at:new Date().toISOString(),metrics,businessWrites:0,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,metrics,businessWrites:0,modelCalls:0}));
}catch(e){writeFileSync(directory+'failed-metrics-'+Date.now()+'.json',JSON.stringify({passed:false,metrics,error:e.message,businessWrites:0},null,2));throw e;}finally{await browser.close();}
