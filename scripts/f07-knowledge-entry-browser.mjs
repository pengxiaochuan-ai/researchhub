// Read-only P01 -> K01 entry and cancellation-focus continuation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {f07Owned} from './f07-knowledge-rehearsal.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),owned=f07Owned(process.argv[2]??''),{prepared,origin:base}=owned,secret=JSON.parse(fs.readFileSync(owned.directory+'/test-identities.private.json'));
const {default:pw}=await import('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),out=root+'/docs/testing/evidence/f07-knowledge-entry-2026-11-20/'+randomUUID();fs.mkdirSync(out+'/video',{recursive:true});
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}}),page=await context.newPage(),report={syntheticOnly:true,origin:base,startedAt:new Date().toISOString(),checks:[],blockedWrites:[],errors:[],modelCalls:0};
try{
 const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:prepared.tenantSlug,username:'deploy.invite@example.test',password:secret.invite}});assert.equal(login.status(),201);
 await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==base)return route.abort();if(url.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(req.method())&&url.pathname!=='/api/auth/renew'){report.blockedWrites.push({path:url.pathname,method:req.method()});return route.abort();}return route.continue();});
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(base+'/pages/p01/');await page.getByRole('link',{name:'个人知识库 →',exact:true}).click();await page.waitForURL(url=>url.pathname==='/pages/k01/');const frame=page.frameLocator('iframe');await frame.getByLabel('研究项目',{exact:true}).waitFor();assert.equal(await frame.getByLabel('研究项目',{exact:true}).inputValue(),prepared.ids.targetProject);await frame.getByRole('button',{name:'+ 新建文档',exact:true}).waitFor();await page.screenshot({path:out+'/01-p01-personal-library-entry.png'});report.checks.push('P01 actual personal-library link opens existing K01 with the ordinary member target project selected automatically, without entering IDs');
 const trigger=frame.getByRole('button',{name:'+ 新建文档',exact:true}),opener=await trigger.elementHandle();await trigger.click();const dialog=frame.getByRole('dialog',{name:'新建知识文档',exact:true});await dialog.getByLabel('文档类型',{exact:true}).selectOption('guidance');await dialog.getByLabel('文章标题',{exact:true}).fill('取消后不提交的合成标题');await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'});await (await opener.ownerFrame()).waitForFunction(e=>e===document.activeElement,opener,{timeout:2000});await page.screenshot({path:out+'/02-cancel-restored-trigger-focus.png'});report.checks.push('new guidance dialog cancellation restores the real opener focus and submits no document');
 assert.deepEqual(report.blockedWrites,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{report.finishedAt=new Date().toISOString();await context.close();await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,evidence:out+'/result.json',businessWrites:0,modelCalls:0}));}
