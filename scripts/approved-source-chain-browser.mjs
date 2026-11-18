import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';

if(process.argv[2]!=='--mode'||process.argv[3]!=='local-synthetic')throw Error('EXPLICIT_LOCAL_SYNTHETIC_MODE_REQUIRED');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const out=root+'researchhub/docs/testing/evidence/approved-source-chain-'+randomUUID().slice(0,8)+'/';
mkdirSync(out+'video',{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],network=[],errors=[],queries=[],articles=[],mutations=[],contexts=[];
const sha=text=>createHash('sha256').update(text).digest('hex');
const norm=text=>String(text).replace(/\s+/g,' ');
let page;
async function context(actor,viewport={width:1440,height:900}){
  const ctx=await browser.newContext({viewport,recordVideo:{dir:out+'video'}});contexts.push(ctx);
  if(actor){const login=await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(login.status(),201);}
  await ctx.route('**/api/**',route=>{
    if(!['GET','HEAD'].includes(route.request().method())){mutations.push({actor,path:new URL(route.request().url()).pathname,method:route.request().method()});return route.abort();}
    return route.continue();
  });
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push({actor,message:e.message}));
  p.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({actor:actor||'anonymous',path,status:r.status(),method:r.request().method()});});
  return {ctx,p,actor};
}
async function get(c,path,status=200,headers={}){
  assert.ok(path.startsWith('/api/'));const r=await c.ctx.request.get(base+path,{headers});
  network.push({actor:c.actor||'anonymous',path,status:r.status(),method:'GET'});assert.equal(r.status(),status,path);return r;
}
const sourceId=source=>source.pmcRecordId||source.sourceRecordId||source.externalDocumentId;
async function search(c,query){const r=await get(c,'/api/hub-sources/agent-retrieval?query='+encodeURIComponent(query));const body=await r.json();
  assert.equal(body.mutated,false);assert.equal(body.meta.actualRetrieval,'ResearchHub-current-reviewed-PG');
  queries.push({actor:c.actor,query,at:body.meta.at,sources:body.meta.sources,result:body.result});return body;
}
try{
  const admin=await context('admin'),owner=await context('owner'),anon=await context(null);
  const initial=await(await get(admin,'/api/hub-sources/review-queue')).json();
  const approved=initial.items.filter(i=>i.kind==='pmc'&&i.state.status==='public');
  assert.ok(approved.length>0,'NEEDS_CURRENT_ADMIN_APPROVED_ARTICLE');
  const pending=initial.items.find(i=>i.kind==='pmc'&&i.state.status==='pending');
  const publicList=await(await get(anon,'/api/hub-sources/publications?limit=20')).json();
  for(const candidate of approved)assert.ok(publicList.items.some(x=>x.id==='pmc-'+candidate.subtitle));
  assert.ok(publicList.items.every(i=>!i.id.startsWith('pmc-')||approved.some(x=>'pmc-'+x.subtitle===i.id)));
  checks.push('当前获准PMC真实公开投影与管理员决定逐篇对应，无未审记录混入');
  for(const c of [owner,admin]){
    const list=await(await get(c,'/api/hub-sources/member/publications?limit=20')).json();
    for(const candidate of approved){
      const recordId='pmc-'+candidate.subtitle;
      assert.ok(list.items.some(i=>i.id===recordId));
      const detail=(await(await get(c,'/api/hub-sources/member/publications/'+recordId)).json()).item;
      assert.equal(detail.title,candidate.title);assert.equal(detail.visibility,'public');
      assert.match(detail.rawSha256,/^[a-f0-9]{64}$/);assert.ok(detail.body);
      const query=detail.title.slice(0,70),hit=await search(c,query);
      const source=hit.meta.sources.find(s=>sourceId(s)===recordId);assert.ok(source,recordId);
      for(const key of ['title','doi','sourceUrl','rawSha256','articleVersion','reviewVersion','aiReviewVersion'])assert.equal(source[key],detail[key],key);
      const field=source.snippetField==='table'?JSON.stringify(detail.tables||[]):source.snippetField==='body'?detail.body:source.snippetField==='abstract'?detail.abstract:detail.title;
      assert.equal(sha(norm(field).slice(source.snippetOffset,source.snippetOffset+1200)),source.snippetHash);
      if(c===owner)articles.push({recordId,title:detail.title,reviewVersion:detail.reviewVersion,rawSha256:detail.rawSha256,bodyChars:detail.body.length,tables:detail.tables?.length||0,images:detail.assets?.filter(a=>a.assetKind==='image').length||0});
    }
  }
  checks.push('原两账号逐篇真实读取与AI只读检索，引用题名/DOI/URL/文章审核版本/片段hash对应当前正文');
  if(pending){const id='pmc-'+pending.subtitle;await get(owner,'/api/hub-sources/member/publications/'+id,404);await get(anon,'/api/hub-sources/publications/'+id,404);
    const result=await search(owner,pending.title.slice(0,70));assert.ok(!result.meta.sources.some(s=>sourceId(s)===id));checks.push('当前未审核文章仍404且不能被AI检索');}
  await get(anon,'/api/hub-sources/agent-retrieval?query=acupuncture',401);
  const english=await search(owner,'acupuncture'),chinese=await search(owner,'针灸');
  const target=publicList.items.find(i=>i.id==='pmc-PMC13672493')||publicList.items.find(i=>i.id.startsWith('pmc-'));
  const detail=(await(await get(owner,'/api/hub-sources/member/publications/'+target.id)).json()).item;
  page=owner.p;
  await page.goto(base+'/pages/e01/');await page.getByRole('button',{name:target.title,exact:true}).waitFor();
  await page.getByLabel('检索标题、作者、期刊或 DOI').fill(target.doi||target.title.slice(0,45));
  await page.getByRole('button',{name:'应用筛选',exact:true}).click();
  await page.getByRole('button',{name:target.title,exact:true}).waitFor();
  await page.getByRole('button',{name:target.title,exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:out+'e01-owner-desktop.png'});
  await page.locator('.paper-detail-actions').getByRole('link',{name:'查看完整详情'}).click();
  await page.getByRole('heading',{name:detail.title,exact:true}).waitFor();
  assert.equal(await page.locator('.real-evidence-approved-body').innerText(),detail.body);
  assert.equal(await page.getByRole('link',{name:'打开来源链接'}).getAttribute('href'),detail.sourceUrl);
  assert.ok((await page.locator('body').innerText()).includes(detail.rawSha256));
  assert.equal(await page.getByRole('button',{name:'岐研 AI 解读（未接通）'}).isDisabled(),true);
  await page.screenshot({path:out+'e02-owner-desktop.png'});
  for(const image of await page.locator('.real-evidence-figure img').all()){
    await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());
    assert.ok(await image.evaluate(img=>img.naturalWidth>0&&img.naturalHeight>0));
    assert.ok((await image.getAttribute('src')).startsWith('/api/hub-sources/pmc-images/'));
  }
  if(await page.locator('.real-evidence-figure').count())await page.locator('.real-evidence-figure').first().screenshot({path:out+'e02-current-original-image.png'});
  checks.push('科研人员真实E01筛选预览→E02正文/表格/原图与来源回链，未使用演示资料');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.goto(base+'/pages/e02/?recordId='+target.id);
    await page.getByRole('heading',{name:detail.title,exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'DETAIL_OVERFLOW_'+width);
    await page.screenshot({path:out+'e02-owner-'+width+'.png'});
  }
  await anon.p.goto(base+'/pages/e02/?recordId='+target.id);await anon.p.getByRole('heading',{name:detail.title,exact:true}).waitFor();
  checks.push('获准公开文章匿名可读、手机390/320无整页横向溢出；匿名AI接口401');
  for(const c of [owner,admin]){
    await c.p.setViewportSize({width:1440,height:900});await c.p.goto(base+'/pages/ai01/');
    await c.p.getByText('仅当前获准用于 AI 检索的来源进入回答；模型调用仍受原预算门禁控制。',{exact:true}).waitFor();
    const me=await(await get(c,'/api/auth/me')).json();const g=me.studyGroups.find(g=>g.researchProjects?.length);
    const status=await(await get(c,'/api/knowledge/ai-status',200,{'X-Study-Group-Id':g.id,'X-Research-Project-Id':g.researchProjects[0].id})).json();
    writeFileSync(out+c.actor+'-budget-state.json',JSON.stringify({blocked:status.budget?.blocked,reason:status.budget?.reason,hasBudget:!!status.budget},null,2));
    assert.equal(await c.p.getByRole('button',{name:'发送问题',exact:true}).isDisabled(),true);
    await c.p.screenshot({path:out+'ai01-'+c.actor+'-no-model.png'});
  }
  checks.push('原两账号AI入口与现有预算状态真实读取；不新建会话/任务、不发送模型问题，非真实AI回答验收');
  const final=await(await get(admin,'/api/hub-sources/review-queue')).json();
  const queueChanged=sha(JSON.stringify(initial.items))!==sha(JSON.stringify(final.items));
  assert.equal(queueChanged,false,'SOURCE_QUEUE_CHANGED_DURING_READ_ONLY_CHECK');
  assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);
  writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,network,errors,articles,queries,languageProbe:{englishHits:english.meta.sources.length,chineseHits:chinese.meta.sources.length},queueChanged,modelRequests:0,paidCalls:0,sourceWrites:0,limitations:['未执行实际Provider或生成新回答','未修改原审核决定/正文/权限','E02岐研AI解读仍未接通，AI01为独立入口']},null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,approved:approved.length,queueChanged,englishHits:english.meta.sources.length,chineseHits:chinese.meta.sources.length,evidence:out}));
}catch(error){await page?.screenshot({path:out+'failure.png'}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({passed:false,error:error.message,checks,network,errors,queries,articles,mutations},null,2));console.error(JSON.stringify({passed:false,error:error.message,evidence:out}));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
