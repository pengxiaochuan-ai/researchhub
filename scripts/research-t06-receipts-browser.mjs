// Real receipt GET 200/404 with a seeded minimal unknown marker; no business POST replay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const accepted=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-current.json')).acceptedFile));
assert(accepted.syntheticOnly&&accepted.runId.startsWith('rh-t06-http-'));
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
const base='http://127.0.0.1:19501',runId='t06-receipts-browser-'+randomUUID().slice(0,8),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t06-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const {chromium}=createRequire(workspaceRoot+'app/package.json')('./node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),checks=[],network=[];
let stage='prepare';
try{
 const me=await(await fetch(base+'/api/auth/me',{headers:{Cookie:cookies.admin}})).json();assert(Number.isSafeInteger(me.authVersion));
 const rows=await withFixtureTransaction(env,'direct',async tx=>{
  const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;assert.equal(marker.manifest.syntheticOnly,true);assert.equal(marker.manifest.studyId,accepted.study.id);
  return tx.$queryRaw`SELECT request_key FROM rh_research.operation WHERE tenant_id=${me.tenantId} AND actor_id=${me.accountId} AND target_id=${accepted.cases.A.id} AND result->>'studyId'=${accepted.study.id} AND action='participation.record' ORDER BY created_at LIMIT 1`;
 });assert(rows[0]);
 for(const missing of [false,true]){
  stage=missing?'actual_404':'actual_200';const requestKey=missing?randomUUID():rows[0].request_key,subjectId=accepted.cases.A.id;
  const marker={actor:me.accountId,authVersion:me.authVersion,studyId:accepted.study.id,subjectId,kind:'events',requestKey},storageKey='rh-subject-pending:'+me.accountId+':'+accepted.study.id+':'+subjectId;
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+stage+'-video'}});
  const split=cookies.admin.indexOf('=');await context.addCookies([{name:cookies.admin.slice(0,split),value:cookies.admin.slice(split+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}]);
  await context.addInitScript(({marker,storageKey})=>{if(!sessionStorage.getItem('t06-recovery-seeded')){sessionStorage.setItem(storageKey,JSON.stringify(marker));sessionStorage.setItem('t06-recovery-seeded','1');}},{marker,storageKey});
  const page=await context.newPage(),businessWrites=[];
  page.on('request',request=>{if(request.url().includes('/api/research-studies/')&&request.method()!=='GET')businessWrites.push({method:request.method(),path:new URL(request.url()).pathname});});
  page.on('response',response=>{if(response.url().includes('/api/research-studies/'))network.push({stage,method:response.request().method(),path:new URL(response.url()).pathname,status:response.status()});});
  await page.goto(base+'/pages/s04/?'+new URLSearchParams({formalSubjects:'1',studyId:accepted.study.id,subjectId}));
  const button=page.getByRole('button',{name:'核对上次操作结果',exact:true});await button.waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='核对上次操作结果'&&!b.disabled));
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/receipts/'+requestKey),{timeout:15000});await button.click();const response=await responsePromise;assert.equal(response.status(),missing?404:200);
  if(missing){
   await page.getByText('暂未查到上次结果，请稍后继续核对。',{exact:true}).waitFor();
   assert.deepEqual(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),storageKey),marker);
   await page.reload();await button.waitFor();
   assert.deepEqual(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),storageKey),marker);
   checks.push('real_404_keeps_minimal_unknown_marker_after_reload_and_never_replays_post');
  }else{
   await page.getByText('已核对上次操作和当前状态。',{exact:true}).waitFor();assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),storageKey),null);
   await page.getByText('已结束',{exact:false}).first().waitFor();
   checks.push('real_200_clears_unknown_only_after_current_withdrawn_state_read');
  }
  assert.equal(businessWrites.length,0);await page.screenshot({path:out+stage+'.png',fullPage:true});await context.close();
 }
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,network,syntheticOnly:true,minimalUnknownMarkerSeeded:true,receiptResponsesInjected:false,businessWrites:0},null,2));console.log(JSON.stringify({passed:true,checks,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,message:String(error.message).slice(0,1600),checks,network},null,2));console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,1000)}));process.exitCode=1;}
finally{await browser.close();}
