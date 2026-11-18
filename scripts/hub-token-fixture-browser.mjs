// Controlled HTTP+PG write acceptance against a NEW tenant, not experience
// accounts. Production authentication is tested separately by hub-token-browser.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createTokenFixture} from './hub-token-fixtures.mjs';
import {createHubBilling} from '../server/billing/service.mjs';
import {createHubBillingController} from '../server/billing/controller.mjs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/docs/testing/evidence/hub-token-accounting-2026-11-11/fixture-browser/'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const {BillingService}=require('./src/billing/billing.service.ts');
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),transaction=cb=>withFixtureTransaction(env,'direct',cb),fixture=await createTokenFixture(transaction);
const service=createHubBilling({scope:{allowedTenantIds:[fixture.tenantId]},transaction,billing:{myTokenQuota:user=>transaction(tx=>new BillingService({elevated:tx},{}).myTokenQuota(user))}});
const C=createHubBillingController({require,origin:base,service}),controller=new C(),key=randomUUID(),http=[];
let conflict=false,deny=false;
const server=createServer(async(req,res)=>{
 if(req.headers['x-fixture-key']!==key){res.writeHead(403).end();return;}
 try{
  const url=new URL(req.url,base),match=url.pathname.match(/^\/api\/hub-billing\/reconciliations\/([A-Za-z0-9_-]+)(\/resolve)?$/),id=match?.[1];
  if(id)assert(Object.values(fixture.records).some(x=>x.id===id),'No historical target may be written');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('fixture input too large');}
  req.user=deny?fixture.user:fixture.admin;const name=match?(match[2]?'resolve':'detail'):url.pathname.endsWith('/me')?'me':'list';
  if(conflict&&name==='resolve'){conflict=false;res.writeHead(409,{'Content-Type':'application/json'}).end(JSON.stringify({code:'HUB_TOKEN_CONFLICT',message:'记录或核验依据已变化，请核对最新状态。'}));return;}
  const data=await controller[name](req,res,body?JSON.parse(body):undefined,{id},Object.fromEntries(url.searchParams));
  http.push({method:req.method,path:url.pathname,status:200});res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data));
 }catch(e){const status=e.getStatus?.()??500;http.push({method:req.method,path:req.url,status});res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(e.getResponse?.()??{message:'fixture service failed'}));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const endpoint='http://127.0.0.1:'+server.address().port;
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}}),p=await ctx.newPage();
const checks=[],errors=[];let drop=false,postCount=0;
p.on('pageerror',e=>errors.push(e.message));
await ctx.route('**/api/hub-billing/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(req.method()==='POST')postCount++;
 const response=await route.fetch({url:endpoint+url.pathname+url.search,headers:{...req.headers(),'x-fixture-key':key}});
 if(drop&&req.method()==='POST'){drop=false;assert.equal(response.status(),200);await route.abort();}else await route.fulfill({response});
});
async function open(name){await p.locator('[data-billing-id="'+fixture.records[name].id+'"]').click();await p.getByRole('dialog').waitFor();}
try{
 const login=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}});assert.equal(login.status(),201);
 await p.goto(base+'/pages/g02/?view=token-reconciliation');await p.getByRole('table').waitFor();
 await open('normal');const focused=[];for(let i=0;i<10;i++){await p.keyboard.press('Tab');focused.push(await p.evaluate(()=>document.activeElement.tagName));}assert(focused.includes('SUMMARY'),'call evidence disclosure must be reachable by keyboard');await p.getByRole('dialog').getByRole('button',{name:'确认结算',exact:true}).click();await p.getByRole('dialog').waitFor({state:'detached'});await p.getByRole('status').filter({hasText:'已按实际用量结算'}).waitFor();checks.push('real new-tenant HTTP+PG settlement closes dialog and refreshes list; evidence keyboard reachable');await p.screenshot({path:out+'normal-settled.png'});
 await open('lost-response');drop=true;await p.getByRole('dialog').getByRole('button',{name:'确认结算',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'核对原提交结果',exact:true}).waitFor();const writes=postCount;await p.waitForTimeout(500);assert.equal(postCount,writes,'no automatic retry');await p.screenshot({path:out+'lost-response.png'});await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'detached',timeout:1000});await p.reload();await p.getByRole('button',{name:'恢复未确认结算',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'核对原提交结果',exact:true}).click();await p.getByRole('dialog').waitFor({state:'detached'});checks.push('committed response loss closes, survives refresh and recovers same key without second debit');
 await open('concurrent');conflict=true;await p.getByRole('dialog').getByRole('button',{name:'确认结算',exact:true}).click();await p.getByRole('dialog').getByRole('alert').waitFor();assert(await p.getByRole('dialog').isVisible());await p.getByRole('dialog').getByRole('button',{name:'重新核对',exact:true}).click();await p.getByRole('dialog').getByRole('alert').waitFor({state:'detached'});await p.keyboard.press('Escape');checks.push('409 retains object; recheck recovers; Escape closes');
 await open('unknown');assert(await p.getByRole('dialog').getByRole('button',{name:'确认结算',exact:true}).isDisabled());await p.keyboard.press('Escape');checks.push('new unknown cannot release');
 await open('live');assert(await p.getByRole('dialog').getByRole('button',{name:'确认结算',exact:true}).isDisabled());await p.keyboard.press('Escape');checks.push('live claim cannot settle');
 await open('concurrent');deny=true;await p.getByRole('dialog').getByRole('button',{name:'重新核对',exact:true}).click();await p.getByRole('dialog').waitFor({state:'detached'});await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('table').count(),0);checks.push('current access loss clears private list/dialog without logout');
 const db=await transaction(async tx=>({usage:await tx.usageRecord.findMany({where:{tenantId:fixture.tenantId},select:{totalTokens:true}}),rows:await tx.tokenQuotaReservation.findMany({where:{tenantId:fixture.tenantId},select:{id:true,status:true,actualTokens:true}})}));
 assert.equal(db.usage.length,2);assert.equal(db.usage.reduce((n,x)=>n+x.totalTokens,0),240);assert.deepEqual(errors,[]);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,fixture,checks,http,errors,postCount,db,paidCalls:0,scope:'controlled new-tenant HTTP+PG fixture; original auth separately verified'},(_k,v)=>typeof v==='bigint'?v.toString():v,2));console.log(JSON.stringify({passed:true,checks:checks.length,out}));
}catch(e){console.error(e.stack);await p.screenshot({path:out+'failure.png'}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({fixture,http,checks,error:e.message},null,2));process.exitCode=1;}
finally{await ctx.close();await browser.close();await new Promise(ok=>server.close(ok));}
