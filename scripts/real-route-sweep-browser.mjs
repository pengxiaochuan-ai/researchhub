import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {REAL_MODE_ROUTE_IDS,realModeRouteState} from '../src/real-mode-route.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const out=root+'docs/test/evidence/2026-10-28-researchhub-real-entry/';
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501',results=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}});
 assert.equal(login.status(),201);
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push({route:new URL(page.url()).pathname,message:error.message.slice(0,150)}));
 for(const id of REAL_MODE_ROUTE_IDS){
  const expected=realModeRouteState(id,'',{configured:true});
  await page.goto(base+'/pages/'+id+'/');
  if(expected==='pending'){
   await page.getByRole('heading',{name:'此页面的真实数据尚未接通'}).waitFor();
   assert.equal(await page.locator('body[data-real-page-gated="true"]').count(),1,id);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#root')).display),'none',id);
  }
  results.push({id,expected,visibleGate:expected==='pending'});
 }
 assert.equal(results.length,52);
 assert.equal(results.filter(item=>item.visibleGate).length,35);
 const result={at:new Date().toISOString(),environment:'local-synthetic-only',passed:true,routes:results,errors};
 writeFileSync(out+'route-sweep.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,routes:results.length,gated:35,pageErrors:errors.length}));
 await context.close();
}finally{await browser.close();}
