import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {root,base,runtime} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/team-page-confirmations-2026-11-06/'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}}),p=await ctx.newPage(),errors=[],dialogs=[],writes=[],checks=[];
let expectedConflict=false,intercepted=0;
p.on('console',m=>{if(['error','warning'].includes(m.type())&&!(expectedConflict&&m.text().includes('409')))errors.push(m.text());});
p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});
p.on('request',r=>{if(r.method()==='POST'&&!r.url().includes('/api/auth/'))writes.push(new URL(r.url()).pathname);});
const id='rhde-19ccf8f5caa84034b0dea6a897a0b43b',path=base+'/api/hubs/lingshu-xinyu/directory-admin/team-workspaces/'+id;
const modal=title=>p.getByRole('dialog',{name:title,exact:true});
async function choose(){await p.getByRole('button',{name:'维护资料：[合成验收] 针灸情志研究团队',exact:true}).click();}
async function checkDialog(title,width=1440){const d=modal(title);await d.waitFor();assert.equal(await p.evaluate(()=>document.activeElement.textContent),'取消');await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.closest('dialog')?.className),'ui-confirm-dialog');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'取消');const box=await d.boundingBox();assert(box.x>=0&&box.x+box.width<=width);return d;}
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 const before=await(await ctx.request.get(path)).json();
 await p.goto(base+'/pages/g02/?view=directory-review');await choose();
 const name=p.locator('[name=teamName]'),members=p.getByRole('region',{name:'负责人和成员'});
 await members.getByRole('button',{name:'移除人员1',exact:true}).waitFor();
 await members.locator('summary').filter({hasText:'更换人员'}).click();
 const picker=p.getByLabel('人员1选择',{exact:true});await picker.selectOption('');
 let d=await checkDialog('更换团队人员？');await p.screenshot({path:out+'replacement-1440.png',fullPage:true});await d.getByRole('button',{name:'取消',exact:true}).click();assert((await members.innerText()).includes(before.data.members[0].name));assert.equal(await picker.inputValue(),before.data.members[0].entityId);
 await picker.selectOption('');d=await checkDialog('更换团队人员？');await p.keyboard.press('Escape');assert.equal(await picker.inputValue(),before.data.members[0].entityId);
 for(const width of [390,320]){await p.setViewportSize({width,height:844});await picker.selectOption('');d=await checkDialog('更换团队人员？',width);await p.screenshot({path:out+'replacement-'+width+'.png',fullPage:true});await d.getByRole('button',{name:'取消',exact:true}).click();}
 await p.setViewportSize({width:1440,height:900});await picker.selectOption('');d=await checkDialog('更换团队人员？');await d.getByRole('button',{name:'更换人员',exact:true}).click();await members.getByLabel('人员1姓名',{exact:true}).waitFor();assert.equal(await members.getByLabel('人员1姓名',{exact:true}).inputValue(),'');checks.push('replacement cancel/Esc preserve, confirm updates only selected local row; focus/Tab/mobile');
 await choose();d=await checkDialog('放弃当前修改？');await d.getByRole('button',{name:'取消',exact:true}).click();await members.getByLabel('人员1姓名',{exact:true}).waitFor();
 await choose();d=await checkDialog('放弃当前修改？');await d.getByRole('button',{name:'放弃并继续',exact:true}).click();await members.getByRole('button',{name:'移除人员1',exact:true}).waitFor();assert.equal(await name.inputValue(),before.data.name);checks.push('switch cancel preserves and confirm reloads selected synthetic team');
 await name.fill(before.data.name+' 未保存');await p.getByRole('button',{name:'新建团队',exact:true}).click();d=await checkDialog('放弃当前修改？');await p.keyboard.press('Escape');assert.equal(await name.inputValue(),before.data.name+' 未保存');
 await p.getByRole('button',{name:'新建团队',exact:true}).click();d=await checkDialog('放弃当前修改？');await d.getByRole('button',{name:'放弃并继续',exact:true}).click();assert.equal(await name.inputValue(),'');checks.push('new-team Esc preserves, confirm opens empty local form without create submission');
 await choose();await members.getByRole('button',{name:'移除人员1',exact:true}).waitFor();await name.fill(before.data.name+' 冲突输入');
 await p.route(path,async route=>{if(route.request().method()==='POST'){intercepted++;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'DIRECTORY_VERSION_CONFLICT',message:'目录或依据已变化，请先核对当前展示资料，再保存。'})});}else await route.continue();});
 expectedConflict=true;await p.getByRole('button',{name:'保存草稿',exact:true}).click();await p.getByRole('button',{name:'查看最新资料',exact:true}).click();await p.getByRole('button',{name:'使用最新已保存草稿',exact:true}).click();d=await checkDialog('使用最新已保存草稿？');await p.screenshot({path:out+'server-draft-1440.png',fullPage:true});await d.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await name.inputValue(),before.data.name+' 冲突输入');
 await p.getByRole('button',{name:'使用最新已保存草稿',exact:true}).click();d=await checkDialog('使用最新已保存草稿？');await p.keyboard.press('Escape');assert.equal(await name.inputValue(),before.data.name+' 冲突输入');
 await p.getByRole('button',{name:'使用最新已保存草稿',exact:true}).click();d=await checkDialog('使用最新已保存草稿？');await d.getByRole('button',{name:'使用最新已保存草稿',exact:true}).click();assert.equal(await name.inputValue(),before.data.name);checks.push('controlled HTTP409 only: server draft cancel/Esc preserve input, confirm applies real GET snapshot; no backend write');
 assert.equal(intercepted,1);assert.equal(writes.length,1);assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);assert.deepEqual(await(await ctx.request.get(path)).json(),before);
 checks.push('DB snapshot unchanged; zero native dialogs/errors; only one locally intercepted business POST; no model calls');
 await ctx.close();writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,writes,intercepted,dialogs,errors},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
}catch(e){await p.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:e.message,checks,writes,intercepted,dialogs,errors},null,2));console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}finally{await browser.close();}
