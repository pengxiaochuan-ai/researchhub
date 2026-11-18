// Read-only API verification and unsaved UI edits; never approve a user's draft.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {root,base,runtime,directoryPath} from './directory-runtime.mjs';
const id='rhde-af6f5f0913104f50827d550ec384159d',path=directoryPath+'team-workspaces/'+id;
const out=root+'researchhub/docs/testing/evidence/team-friction-2026-11-08/'+randomUUID()+'/';
mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}}),p=await ctx.newPage();
const errors=[],checks=[],writes=[],network=[];let stage='login';
const get=async url=>{const r=await ctx.request.get(base+url);assert.equal(r.status(),200);return r.json();};
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 const ids=[id,'rhde-c334b97521154b98a52f8fba3926afde','rhde-19ccf8f5caa84034b0dea6a897a0b43b'];
 const originals=await Promise.all(ids.map(x=>get(directoryPath+'team-workspaces/'+x))),w=originals[0];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 p.on('response',r=>{if(r.url().includes('/directory-admin/'))network.push({method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()});});
 await p.route('**/directory-admin/**',route=>{if(!['GET','HEAD'].includes(route.request().method())){writes.push(route.request().method());return route.abort();}return route.continue();});
 stage='actual-preview';const preview=await get(path+'/preview?audience=tenant');assert.equal(preview.canApprove,true,JSON.stringify(preview.issues));assert(preview.jointInstitutions.some(x=>x.audience==='public'));checks.push('actual saved user draft preview permits tenant review while institution remains public');
 stage='editor';await p.goto(base+'/pages/g02/?view=directory-review');
 await p.getByRole('searchbox',{name:'查找团队',exact:true}).fill(w.data.name);await p.getByRole('button',{name:'查找团队',exact:true}).click();await p.getByRole('button',{name:'审核：'+w.data.name,exact:true}).click();
 const editor=p.locator('dialog.team-workspace-dialog');await editor.getByRole('button',{name:'审核通过并展示',exact:true}).waitFor();
 await p.waitForFunction(()=>!document.querySelector('dialog.team-workspace-dialog button[disabled]')?.textContent?.includes('正在核对'));
 assert.equal(await editor.getByText(/民政部行政区划字典|此选择不替代/).count(),0);
 await editor.getByText('该机构已公开；审核后机构修改仍公开展示，团队按所选范围展示。',{exact:true}).waitFor();
 checks.push('removed division developer copy; public institution scope disclosed without extra action');
 stage='default-new-person';await editor.getByRole('button',{name:'添加人员',exact:true}).click();
 await editor.getByText('来自其他机构时修改',{exact:true}).last().waitFor();
 const details=editor.locator('details').filter({has:p.getByText('来自其他机构时修改',{exact:true})});assert(await details.count()>0);
 await editor.getByText('所属机构：与团队一致',{exact:true}).last().waitFor();
 assert.equal(await details.last().getAttribute('open'),null);checks.push('new person defaults to team organization; optional different institution collapsed; no save submitted');
 stage='responsive';for(const width of [1440,390,320]){
  await p.setViewportSize({width,height:1000});await editor.getByRole('region',{name:'核实与审核'}).scrollIntoViewIfNeeded();
  const metrics=await editor.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,buttons:[...e.querySelectorAll('footer button')].map(b=>b.getBoundingClientRect().height)}));
  assert(metrics.scroll<=metrics.client+1);assert.equal(metrics.font,'14px');assert.equal(metrics.line,'22px');assert(metrics.buttons.every(h=>h>=44));await p.screenshot({path:out+'review-'+width+'.png',fullPage:true});checks.push({width,metrics});
 }
 stage='unchanged-data';for(let n=0;n<ids.length;n++)assert.deepEqual(await get(directoryPath+'team-workspaces/'+ids[n]),originals[n]);
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);checks.push('all three user drafts unchanged; zero business writes and zero model calls');
 await ctx.close();writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,network,errors,writes,paidCalls:0,actualApproval:false},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
}catch(e){await p.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,message:e.message,checks,network,errors,writes},null,2));console.error(JSON.stringify({passed:false,stage,message:e.message,evidence:out}));process.exitCode=1;}finally{await browser.close();}
