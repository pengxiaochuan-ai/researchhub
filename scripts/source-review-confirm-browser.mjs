import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {stageBatch} from '../server/hub-sources/staging-repository.mjs';
assert.equal(process.argv[2],'--mode');assert.equal(process.argv[3],'local-synthetic');
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',marker='review-confirm-'+randomUUID().slice(0,8);
const out=root+'researchhub/docs/testing/evidence/'+marker+'/';mkdirSync(out+'video',{recursive:true});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{ids}=runtime;
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),checks=[],errors=[],network=[];
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium||pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const admin=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}}),owner=await browser.newContext();
let page,fixture,originalHash;
async function login(c,actor){const r=await c.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(r.status(),201);}
async function queue(){const r=await admin.request.get(base+'/api/hub-sources/review-queue');assert.equal(r.status(),200);return (await r.json()).items;}
async function pick(name){await page.getByRole('complementary',{name:'来源审核队列'}).getByRole('button',{name:new RegExp(marker+' 来源'+name)}).click();await ready();}
async function ready(){await page.getByText('正在核对本次审核范围…',{exact:true}).waitFor({state:'hidden'});await page.getByLabel('本次可见范围',{exact:true}).waitFor();}
const range=()=>page.getByLabel('本次可见范围',{exact:true}),confirm=()=>page.getByRole('button',{name:'确认保存',exact:true});
const panel=()=>page.getByRole('region',{name:'本次审核决定'});
const writes=()=>network.filter(x=>x.method==='POST');
async function save(value,{advance=true}={}){await range().selectOption(value);await confirm().click();await page.getByRole('status').filter({hasText:'已保存为'}).waitFor();await ready();
  await page.locator('.hub-review-detail-heading h3').filter({hasText:marker+' 来源B'}).waitFor();
  assert.equal(await range().inputValue(),advance?'':value);assert.ok(await confirm().isDisabled());}
async function visibility(row,member=false,c=admin){return (await c.request.get(base+'/api/hub-sources/'+(member?'member/':'')+'publications/'+row.id)).status();}
async function withdraw(){if(!fixture)return;for(const item of (await queue()).filter(x=>x.detail?.batchId===fixture.batchId)){
  if(item.state.status==='withheld')continue;
  const r=await admin.request.post(base+'/api/hub-sources/object-reviews',{data:{kind:'workbook',batchId:fixture.batchId,sourceRegistryId:item.detail.sourceRegistryId,
    expectedFingerprint:item.fingerprint,operationId:randomUUID(),visibility:'withheld'}});assert.equal(r.status(),201);
}}
try{
  const target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
  await login(admin,'admin');await login(owner,'owner');originalHash=hash(await queue());
  const rows=[{rowNumber:2,sourceName:marker+' 来源A',title:marker+' 合成记录A',raw:{'Summary-摘要':marker+' 仅供确认保存测试'},errors:[]},
    {rowNumber:3,sourceName:marker+' 来源A',title:marker+' 合成记录B',raw:{},errors:[]},
    {rowNumber:4,sourceName:marker+' 来源B',title:marker+' 合成记录C',raw:{},errors:[]}].map(row=>({...row,rowSha256:hash(row)}));
  const preview={filePath:marker+'.json',sheetName:'本轮下拉确认合成夹具',mapperVersion:'review-confirm-v1',sourceKey:marker,rows};
  const snapshot=JSON.stringify(preview,null,2);writeFileSync(out+'synthetic-source.json',snapshot);preview.fileSha256=createHash('sha256').update(snapshot).digest('hex');
  fixture=await withFixtureTransaction(env,'direct',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    const staged=await stageBatch({db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',preview,source:{createdBy:ids.admin,snapshotPath:out+'synthetic-source.json',snapshotSha256:preview.fileSha256}});
    return {...staged,rows:await db.$queryRaw`SELECT id,title FROM rh_source.source_record WHERE batch_id=${staged.batchId} ORDER BY row_number`};});
  writeFileSync(out+'fixture.json',JSON.stringify({marker,...fixture},null,2));
  page=await admin.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/hub-sources/'))network.push({path,method:r.request().method(),status:r.status()});});
  await page.goto(base+'/pages/g02/?view=source-review');await page.getByLabel('来源类型',{exact:true}).selectOption('workbook');
  await page.getByLabel('处理状态',{exact:true}).selectOption('all');await page.getByLabel('搜索题名或编号').fill(marker);await pick('A');
  assert.equal(await range().inputValue(),'');assert.ok(await confirm().isDisabled());assert.match(await panel().innerText(),/当前已生效范围：尚未放行/);
  const beforeWrites=writes().length;await range().selectOption('public');assert.ok(await confirm().isEnabled());
  const sizes=await page.locator('.hub-review-decision-actions').evaluate(row=>({row:row.getBoundingClientRect().width,select:row.querySelector('select').getBoundingClientRect().width,button:row.querySelector('button').getBoundingClientRect().width,gap:parseFloat(getComputedStyle(row).columnGap)}));
  const oldWidth=sizes.row-sizes.button-sizes.gap;assert.ok(Math.abs(sizes.select/oldWidth-.5)<.04,JSON.stringify(sizes));
  assert.match(await panel().innerText(),/当前已生效范围：尚未放行/);assert.match(await panel().innerText(),/本次选择尚未保存/);
  assert.equal(await visibility(fixture.rows[0]),404);assert.equal(writes().length,beforeWrites);await panel().screenshot({path:out+'selected-not-saved.png'});
  checks.push('新具名待审内容无默认公开；选择仅改变输入与说明，DB投影仍404且无POST');
  let release,captured;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{captured=resolve;});
  await page.route('**/api/hub-sources/object-reviews',async route=>{captured();await gate;await route.continue();},{times:1});
  await confirm().click();await started;assert.ok(await range().isDisabled());assert.ok(await confirm().isDisabled());
  assert.ok(await page.getByRole('complementary',{name:'来源审核队列'}).getByRole('button').first().isDisabled());release();
  await page.getByRole('status').filter({hasText:'已保存为'}).waitFor();await ready();
  await page.locator('.hub-review-detail-heading h3').filter({hasText:marker+' 来源B'}).waitFor();assert.equal(await range().inputValue(),'');
  assert.ok(await confirm().isDisabled());assert.match(await panel().innerText(),/当前已生效范围：尚未放行/);
  assert.equal(await visibility(fixture.rows[0]),200);assert.equal(writes().length,beforeWrites+1);await panel().screenshot({path:out+'saved-public.png'});
  checks.push('实际确认仅一笔POST201；成功重读后自动进入下一待审对象，新对象仍未放行，标题/反馈明确上一项已保存');
  await pick('A');await range().selectOption('tenant');await pick('B');assert.equal(await range().inputValue(),'');await pick('A');assert.equal(await range().inputValue(),'public');
  assert.equal(writes().length,beforeWrites+1);checks.push('切对象不携带未保存选择，返回显示真实已生效范围，不静默提交');
  await save('tenant');assert.equal(await visibility(fixture.rows[0]),404);assert.equal(await visibility(fixture.rows[0],true,owner),200);
  await pick('A');
  await range().selectOption('public');await page.getByRole('button',{name:'单独审核此行',exact:true}).first().click();
  await page.getByText('当前单行：第 2 行',{exact:true}).waitFor();
  await panel().getByText('本次决定作用于：当前所选单行。页面展示与AI检索同步生效。',{exact:true}).waitFor();await ready();assert.equal(await range().inputValue(),'tenant');
  await save('withheld');assert.equal(await visibility(fixture.rows[0],true,owner),404);assert.equal(await visibility(fixture.rows[1],true,owner),200);
  checks.push('真实租户范围：公共404/同租户200；换单行重置选择，确认只撤回本人本轮该行，兄弟行不受影响');
  await pick('A');
  await panel().getByText('本次决定作用于：当前来源、本批次的 2 条合格记录。页面展示与AI检索同步生效。',{exact:true}).waitFor();await ready();assert.equal(await range().inputValue(),'');
  const faultWrites=writes().length;await page.route('**/api/hub-sources/object-reviews',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'本轮合成503'})}),{times:1});
  await range().selectOption('public');await confirm().click();await page.getByRole('alert').filter({hasText:'保存结果尚未确认'}).waitFor();assert.equal(writes().length,faultWrites+1);
  assert.equal(await visibility(fixture.rows[0]),404);assert.match(await panel().innerText(),/本次选择尚未保存/);await panel().screenshot({path:out+'failed-not-saved.png'});
  await page.getByRole('button',{name:'重新核对',exact:true}).click();await ready();await save('withheld');
  checks.push('返回混合批次无默认范围；注入503不假保存、不自动重试，重新核对后可明确确认恢复');
  await pick('B');await range().selectOption('public');const beta=(await queue()).find(x=>x.detail?.batchId===fixture.batchId&&x.title.endsWith('来源B'));
  const conflict=await admin.request.post(base+'/api/hub-sources/object-reviews',{data:{kind:'workbook',batchId:fixture.batchId,sourceRegistryId:beta.detail.sourceRegistryId,
    expectedFingerprint:beta.fingerprint,operationId:randomUUID(),visibility:'withheld'}});assert.equal(conflict.status(),201);
  await confirm().click();await page.getByRole('alert').filter({hasText:'内容或审核状态已变化'}).waitFor();await ready();assert.equal(await range().inputValue(),'withheld');
  assert.ok(await confirm().isDisabled());checks.push('真实并发决定使旧确认409，重读当前已保存范围，不覆盖或自动补交');
  await save('public',{advance:false});assert.match(await page.getByRole('status').filter({hasText:'已保存为'}).innerText(),/已无其他待审内容/);
  await save('withheld',{advance:false});checks.push('当前筛选内最后一项保存后留在当前，明确已无下一待审项；不跳其他来源或循环');
  assert.equal(hash((await queue()).filter(x=>x.detail?.batchId!==fixture.batchId)),originalHash);assert.deepEqual(errors,[]);
  writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,errors,network,fixture,originalHash,modelCalls:0},null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(error){await page?.screenshot({path:out+'failure.png'}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({passed:false,error:error.message,checks,errors,network},null,2));console.error(JSON.stringify({passed:false,error:error.message,evidence:out}));process.exitCode=1;
}finally{try{await withdraw();}catch(error){console.error('NEW_FIXTURE_WITHDRAWAL_FAILED:'+error.message);process.exitCode=1;}await admin.close();await owner.close();await browser.close();}
