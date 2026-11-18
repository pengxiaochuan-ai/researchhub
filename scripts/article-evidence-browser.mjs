// Readonly real-Chrome smoke: B04 endpoints, not B05 UI or paid AI acceptance.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',phase=process.argv[2]??'after';
assert(['before','after'].includes(phase));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out='docs/testing/evidence/article-evidence-browser-'+phase+'-'+randomUUID();mkdirSync(out,{recursive:true});
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',hash=v=>createHash('sha256').update(v).digest('hex'),budgetBefore=hash(readFileSync(ledger));
const counters=()=>withFixtureTransaction(env,'direct',async db=>({sessions:await db.session.count({where:{tenantId:ids.tenant}}),jobs:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant}}),
  active:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant,status:{in:['queued','processing']}}})}),{readOnly:true});
const before=await counters();assert.equal(before.active,0,'DO_NOT_RESTART_ACTIVE_LOCAL_WORK');
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],checks=[],network=[],errors=[],mutations=[];let page;
try{
  for(const role of ['owner','admin']){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(ctx);
    assert.equal((await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
    await ctx.route('**/api/**',route=>{if(!['GET','HEAD'].includes(route.request().method())){mutations.push(route.request().url());return route.abort();}return route.continue();});
    page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
    const get=async(path,status=200,scope=headers)=>{const r=await ctx.request.get(base+path,{headers:scope});network.push({role,path,status:r.status(),at:new Date().toISOString()});assert.equal(r.status(),status,path);return r;};
    const list=await(await get('/api/hub-sources/member/publications?limit=20')).json();
    assert(list.items.some(i=>i.id==='pmc-PMC13672493'));
    if(phase==='after'){
      for(const recordId of ['pmc-PMC13672493','pmc-PMC13678665']){
        const detail=(await(await get('/api/hub-sources/member/publications/'+recordId)).json()).item;
        const r=await get('/api/hub-sources/article-context/'+recordId),a=await r.json();
        assert.equal(r.headers()['cache-control'],'no-store');
        for(const key of ['articleVersion','rawSha256','reviewVersion'])assert.equal(a.binding[key],detail[key]);
        assert.equal(a.binding.recordId,recordId);assert(a.coverage.characters>0&&a.coverage.characters<=6000);assert.match(a.coverage.notice,/非全文/);
        assert.deepEqual(Object.keys(a.coverage.sections).sort(),['discussion','methods','results']);
        assert.equal(a.latestTask,null);assert.equal(a.existingSessionId,null);
        const recovery=await(await get('/api/hub-sources/article-context/'+recordId+'?requestKey=b04-not-created-key')).json();
        assert.equal(recovery.requestStatus,'not_found');assert.equal(recovery.latestTask,null);
        writeFileSync(out+'/'+role+'-'+recordId+'.json',JSON.stringify(a,null,2));
      }
      await get('/api/hub-sources/article-context/pmc-PMC999999999',404);
      await get('/api/hub-sources/article-context/pmc-PMC13672493?contextKey=forged',400);
      await get('/api/hub-sources/article-context/pmc-PMC13672493',400,{});
      checks.push(role+'_actual_article_context_version_hash_coverage_readonly_recovery_and_rejection');
    }
    await page.goto(base+'/pages/e01/');await page.waitForFunction(()=>/^已加载/.test(document.querySelector('#real-evidence-title')?.textContent??''));
    await page.screenshot({path:out+'/'+role+'-e01-1440.png'});
    const title=list.items.find(x=>x.id==='pmc-PMC13672493').title;
    await page.getByRole('button',{name:title,exact:true}).click();
    await page.locator('.paper-detail-actions').getByRole('link',{name:'查看完整详情'}).click();
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'岐研 AI 解读（未接通）'}).isDisabled(),true);
    await page.screenshot({path:out+'/'+role+'-e02-1440.png'});
    await page.setViewportSize({width:390,height:1000});await page.screenshot({path:out+'/'+role+'-e02-390.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    checks.push(role+'_existing_list_preview_detail_layout_unchanged_no_B05_entry_enabled');
  }
  if(phase==='after'){
    const anon=await browser.newContext();contexts.push(anon);
    const r=await anon.request.get(base+'/api/hub-sources/article-context/pmc-PMC13672493');assert.equal(r.status(),401);
    assert(!(await r.text()).includes('Acupuncture combined'));checks.push('anonymous_article_context_denied_without_content');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);const after=await counters();assert.deepEqual(after,before);
  assert.equal(hash(readFileSync(ledger)),budgetBefore);
  writeFileSync(out+'/result.json',JSON.stringify({passed:true,phase,at:new Date().toISOString(),checks,network,errors,mutations,counters:{before,after},budgetUnchanged:true,modelCalls:0,newPersistentTasks:0,scope:'B04 readonly endpoints and existing UI smoke only; no B05/B06 UI or real Provider acceptance'},null,2));
  console.log(JSON.stringify({passed:true,phase,checks,evidence:out}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({message:e.message,network,checks,errors},null,2));await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.close();await browser.close();}
