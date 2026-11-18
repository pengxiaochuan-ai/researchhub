import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(rt.ids.tenant,/^rh-kb-local-/);
const out=root+'researchhub/docs/testing/evidence/governance-deferred-tabs-2026-11-16/'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const expected=['总览','数据治理','用户与权限','审计日志','系统配置'],result={checks:[],pageErrors:[],businessWrites:[],pid:rt.pid};let c,p;
async function nav(active){const n=p.getByRole('navigation',{name:'管理与治理上下文导航',exact:true});await n.waitFor();assert.deepEqual(await n.getByRole('button').allTextContents(),expected);if(active)assert.equal(await n.locator('[aria-current="page"]').innerText(),active);return n;}
const settled=()=>p.waitForFunction(()=>document.querySelector('.governance-queue')?.getAttribute('aria-busy')==='false',{},{timeout:30000});
try{
 for(const username of ['admin@example.org','owner@example.org']){
  c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}});await c.route('**/api/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())&&!new URL(r.request().url()).pathname.startsWith('/api/auth/')){result.businessWrites.push(new URL(r.request().url()).pathname);return r.abort();}return r.continue();});p=await c.newPage();p.on('pageerror',e=>result.pageErrors.push(e.message));assert.equal((await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username,password:rt.password}})).status(),201);
  await p.goto(base+'/pages/g02/');await nav('总览');await settled();await p.screenshot({path:out+username.split('@')[0]+'-1440.png'});
  const links=p.locator('.governance-overview > section').first().locator('a.governance-action[href*="s07"]');assert(await links.count()>0,'existing pending protocol remains accessible');await links.first().click();await p.waitForURL(/\/pages\/s07\//);await p.getByRole('button',{name:'查看研究方案',exact:true}).waitFor();result.checks.push(username+': original protocol pending item still opens fixed S07');
  await p.goto(base+'/pages/g02/');await nav('总览');await settled();await p.locator('.governance-history > summary').click();await p.waitForFunction(()=>document.querySelector('.governance-history .governance-queue')?.getAttribute('aria-busy')==='false',{},{timeout:30000});assert(await p.locator('.governance-history a[href*="s07"]').count()>0);result.checks.push(username+': original processed protocol links retained');
  for(const[label,path,view]of [['数据治理','/pages/g02/','source-review'],['用户与权限','/pages/g03/'],['审计日志','/pages/g04/'],['系统配置','/pages/g02/','token-reconciliation']]){
   await p.goto(base+'/pages/g02/');const n=await nav('总览');await n.getByRole('button',{name:label,exact:true}).click();await p.waitForURL(u=>u.pathname===path&&(!view||u.searchParams.get('view')===view));await nav(label);result.checks.push(username+': '+label+' original destination and active state');
  }
  await p.goto(base+'/pages/g01/');await nav();await p.getByRole('navigation',{name:'方案审核记录',exact:true}).waitFor();result.checks.push(username+': G01 original protocol list retained');
  await p.goto(base+'/pages/g02/');await nav('总览');await settled();for(const width of [1366,1920,390,320]){await p.setViewportSize({width,height:1000});await nav('总览');await p.screenshot({path:out+username.split('@')[0]+'-'+width+'.png'});}result.checks.push(username+': five widths retain exactly five tabs');
  await c.close();c=null;
 }
 assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(error){result.passed=false;result.error=error.message;process.exitCode=1;await p?.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{await c?.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,out}));}
