import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {root,base,runtime} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/session-policy-2026-11-06/'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const require=createRequire(root+'app/server/package.json'),{JwtService}=require('@nestjs/jwt'),jwt=new JwtService({secret:runtime.secret});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],network=[],errors=[],consoleMessages=[];
async function context(){return browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});}
async function login(ctx,role){const r=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}});assert.equal(r.status(),201);const body=await r.json();assert(!body.token);const cookie=(await ctx.cookies(base+'/api/auth/me')).find(x=>x.name.startsWith('rh_kb_local_'));assert(cookie?.httpOnly);assert.equal(cookie.sameSite,'Lax');const claims=jwt.decode(cookie.value);assert.equal(claims.exp-claims.iat,43200);assert.equal(cookie.expires,claims.exp);return{cookie,claims};}
async function follow(p){p.on('dialog',d=>void d.accept());p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(['warning','error'].includes(m.type()))consoleMessages.push({type:m.type(),text:m.text()});});p.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({path,status:r.status(),method:r.request().method()});});}
try{
 for(const role of ['admin','owner']){
  const ctx=await context(),{cookie,claims}=await login(ctx,role),p=await ctx.newPage();await follow(p);
  const destination=role==='admin'?'/pages/g02/?view=directory-review':'/pages/p01/';await Promise.all([p.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200),p.goto(base+destination)]);
  await p.screenshot({path:out+role+'-authenticated.png',fullPage:true});
  // Pure background reads must not emit cookies or renew.
  for(let i=0;i<3;i++){const r=await ctx.request.get(base+'/api/auth/me');assert.equal(r.status(),200);assert(!r.headers()['set-cookie']);}
  await p.waitForTimeout(1100);const renewal=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/renew');await p.mouse.click(400,160);assert.equal((await renewal).status(),200);const updated=(await ctx.cookies(base+'/api/auth/me')).find(x=>x.name===cookie.name),after=jwt.decode(updated.value);assert(after.exp>claims.exp);assert.equal(after.hubSessionId,claims.hubSessionId);
  const cross=await ctx.request.post(base+'/api/auth/renew',{headers:{Origin:'https://evil.invalid'},data:{}});assert.equal(cross.status(),403);
  // Real offline identity recheck leaves the route and current input in place.
  if(role==='admin'){
   await p.getByRole('button',{name:'维护资料：[合成验收] 针灸情志研究团队',exact:true}).click();await p.getByLabel('团队名称（必填）',{exact:true}).fill('[合成验收] 未提交的网络恢复测试');
   await ctx.setOffline(true);await p.bringToFront();await p.evaluate(()=>window.dispatchEvent(new Event('qiyan:auth-refresh')));await p.waitForTimeout(600);assert(p.url().endsWith(destination));assert.equal(await p.getByLabel('团队名称（必填）',{exact:true}).inputValue(),'[合成验收] 未提交的网络恢复测试');await p.screenshot({path:out+'admin-offline-input-retained.png',fullPage:true});await ctx.setOffline(false);await p.evaluate(()=>window.dispatchEvent(new Event('qiyan:auth-refresh')));await p.waitForTimeout(600);assert(p.url().endsWith(destination));
  }
  // Expired signed synthetic credential, not a changed product clock/config.
  const expired=await jwt.signAsync({...after,iat:Math.floor(Date.now()/1000)-43210,exp:Math.floor(Date.now()/1000)-10});
  await ctx.addCookies([{...updated,value:expired,expires:Math.floor(Date.now()/1000)+3600}]);await p.reload();await p.waitForURL(u=>u.pathname==='/pages/p003/');assert.equal(new URL(p.url()).searchParams.get('returnTo'),destination);await p.getByRole('button',{name:'登录',exact:true}).waitFor();await p.getByLabel('邮箱',{exact:true}).fill(role+'@example.org');await p.getByLabel('密码',{exact:true}).fill(runtime.password);await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL(base+destination);await p.screenshot({path:out+role+'-returned.png',fullPage:true});
  // Another tab sees logout; a previously renewed credential cannot resurrect it.
  const saved=(await ctx.cookies(base+'/api/auth/me')).find(x=>x.name===cookie.name),second=await ctx.newPage();await second.goto(base+destination);const logout=await ctx.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});assert.equal(logout.status(),200);
  const late=await ctx.request.post(base+'/api/auth/renew',{headers:{Origin:base,Cookie:saved.name+'='+saved.value},data:{}});assert.equal(late.status(),401);await second.reload();await second.waitForURL(u=>u.pathname==='/pages/p003/');
  await p.goto(base+'/pages/t01/');await p.waitForTimeout(400);assert.equal(new URL(p.url()).pathname,'/pages/t01/');
  await login(ctx,role);await p.goto(base+'/pages/k01/');const frame=p.frameLocator('iframe[title="知识资料操作区"]');await frame.locator('.knowledge-frame').waitFor();await p.waitForTimeout(500);const frameRenewal=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/renew');await frame.locator('body').click({position:{x:15,y:15}});assert.equal((await frameRenewal).status(),200);await p.screenshot({path:out+role+'-knowledge-frame.png',fullPage:true});
  checks.push({role,cookieAndJwtSeconds:43200,realActivityRenewed:true,knowledgeFrameActivity:true,backgroundReads:3,crossOrigin:403,expiredRefreshAndReturn:true,logoutLateRenewal:401,publicDirectoryAnonymous:true});await ctx.close();
 }
 const leafCtx=await context(),leafPage=await leafCtx.newPage();await follow(leafPage);
 for(const leaf of ['/pages/p006/','/pages/k01/?mode=manage','/pages/s08/?'+new URLSearchParams({studyGroupId:runtime.ids.group,researchProjectId:runtime.ids.project})]){
  const {cookie,claims}=await login(leafCtx,'admin'),expired=await jwt.signAsync({...claims,iat:Math.floor(Date.now()/1000)-43210,exp:Math.floor(Date.now()/1000)-10});await leafCtx.addCookies([{...cookie,value:expired,expires:Math.floor(Date.now()/1000)+3600}]);await leafPage.goto(base+leaf);await leafPage.waitForURL(u=>u.pathname==='/pages/p003/');assert.equal(new URL(leafPage.url()).searchParams.get('returnTo'),leaf);await leafPage.getByRole('button',{name:'登录',exact:true}).waitFor();await leafPage.getByLabel('邮箱',{exact:true}).fill('admin@example.org');await leafPage.getByLabel('密码',{exact:true}).fill(runtime.password);await leafPage.getByRole('button',{name:'登录',exact:true}).click();await leafPage.waitForURL(base+leaf);checks.push({protectedLeaf:new URL(base+leaf).pathname,preservedQuery:!!new URL(base+leaf).search,expiredRefreshAndReturn:true});
 }
 await leafCtx.close();
 assert.deepEqual(errors,[]);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,network,pageErrors:errors,consoleMessages,businessWrites:0,paidCalls:0,oldSystemChanges:false},null,2));console.log(JSON.stringify({passed:true,evidence:out,roles:checks.length}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,network,pageErrors:errors,consoleMessages,message:e.message},null,2));console.error(JSON.stringify({passed:false,evidence:out,message:e.message}));process.exitCode=1;}finally{await browser.close();}
