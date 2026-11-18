// Real Chrome acceptance of the standing local service; does not own/stop that service.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.equal(runtime.ready,true);
const out=root+'docs/test/evidence/2026-10-22-researchhub-local-knowledge-runtime/'+Date.now()+'/';mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const direct=cb=>withFixtureTransaction(env,'direct',cb,{readOnly:true});
const history=()=>direct(tx=>tx.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(row_to_json(t)::text,',' ORDER BY id),'')) AS hash FROM knowledge_import_task t WHERE "tenantId" IS DISTINCT FROM ${runtime.ids.tenant}`);
const files=JSON.parse(readFileSync(root+'researchhub/src/knowledge-reuse/source-manifest.json')).files.map(x=>x.source).concat(['app/server/.env','app/server/src/auth/auth.service.ts','app/server/src/knowledge/knowledge.service.ts','app/server/src/knowledge/knowledge-import.service.ts','app/server/src/knowledge/knowledge.controller.ts','app/server/src/storage/storage.service.ts']);
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(root+file)).digest('hex')]));
const processes=()=>execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});
const before=hashes(),old=processes(),historyBefore=await history(),base='http://127.0.0.1:19501';
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],network=[],errors=[],consoleMessages=[],checks=[];let active,stage='login';
async function actor(name){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});contexts.push(context);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await context.newPage();active=page;page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push({actor:name,message:e.message}));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleMessages.push({actor:name,type:m.type(),text:m.text()});});
  page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({actor:name,path:u.pathname,method:r.request().method(),status:r.status()});});
  await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill(name+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByText(({owner:'合成科研人员',admin:'合成租户管理员',viewer:'合成只读用户',uninvited:'合成未邀请用户'})[name],{exact:false}).first().waitFor();
  await page.goto(base+'/pages/k01/');return{page,context,frame:page.frameLocator('iframe[title="知识资料操作区"]')};
}
try{
  const owner=await actor('owner'),f=owner.frame;
  stage='create';await f.getByRole('button',{name:'+ 新建库',exact:true}).click();await f.getByLabel('知识库名称').fill('本机体验资料（合成）');await f.getByRole('button',{name:'创建知识库',exact:true}).click();
  await f.locator('select').filter({has:f.locator('option',{hasText:'本机体验资料（合成）'})}).waitFor();checks.push('real-login-and-create-private-base');
  stage='import';const importedResponse=owner.page.waitForResponse(r=>r.url().endsWith('/api/knowledge/docs/import')&&r.request().method()==='POST');
  await f.locator('input[type=file]').setInputFiles(root+'researchhub/docs/testing/synthetic-knowledge-sample.html');
  const imported=await(await importedResponse).json();assert.equal(imported.queued,1);const taskId=imported.results[0].taskId;
  await f.getByLabel('文档标题').waitFor({timeout:60000});
  const task=await direct(tx=>tx.knowledgeImportTask.findFirst({where:{id:taskId,tenantId:runtime.ids.tenant}}));assert.equal(task.status,'complete');
  let doc=await direct(tx=>tx.knowledgeDoc.findUnique({where:{id:task.docId}}));assert.equal(doc.reviewed,false);checks.push('real-upload-storage-parser-worker-embedding-pg-draft');
  await f.getByRole('button',{name:'抽取预览',exact:true}).click();await f.getByText('仅供软件体验',{exact:false}).first().waitFor();await owner.page.screenshot({path:out+'owner-preview.png'});
  stage='review-search';await f.getByRole('button',{name:'审核通过',exact:true}).click();await f.getByText('已审核·可检索',{exact:true}).waitFor();
  if(await f.getByRole('button',{name:'文档树',exact:true}).isVisible())await f.getByRole('button',{name:'文档树',exact:true}).click();
  const search=f.getByPlaceholder('搜索当前知识库内容…');await search.fill('针灸辅助抑郁障碍');const found=owner.page.waitForResponse(r=>r.url().endsWith('/api/knowledge/search'));await search.press('Enter');assert.ok((await(await found).json()).some(x=>x.docId===doc.id&&x.via==='vector'));checks.push('review-then-real-vector-search');await owner.page.screenshot({path:out+'owner-search.png'});
  stage='edit-history';if(await f.getByRole('button',{name:'编辑',exact:true}).isVisible())await f.getByRole('button',{name:'编辑',exact:true}).click();await f.getByRole('button',{name:'Markdown',exact:true}).click();
  await f.locator('textarea').fill('# 合成针灸方案\n\n仅供本机软件体验。针灸辅助常规治疗成人抑郁障碍，研究者尚未确认正式研究方案。');
  const saved=owner.page.waitForResponse(r=>r.url().endsWith('/api/knowledge/docs/'+doc.id)&&r.request().method()==='PATCH');await f.getByRole('button',{name:'保存',exact:true}).click();assert.equal((await saved).status(),200);await f.getByRole('button',{name:'已保存',exact:true}).waitFor();
  await f.getByRole('button',{name:'历史版本',exact:true}).click();await f.getByRole('dialog',{name:'历史版本',exact:true}).waitFor();await owner.page.screenshot({path:out+'owner-history.png'});await owner.page.keyboard.press('Escape');checks.push('edit-save-review-reset-and-version-history');
  stage='trash-restore';await f.getByRole('button',{name:'删除',exact:true}).click();await f.getByRole('button',{name:'确认移入回收站',exact:true}).click();await f.getByRole('status').filter({hasText:'文档已移入回收站'}).waitFor();
  if(await f.getByRole('button',{name:'文档树',exact:true}).isVisible())await f.getByRole('button',{name:'文档树',exact:true}).click();await f.getByRole('button',{name:'回收站',exact:true}).click();await f.getByRole('button',{name:'恢复',exact:true}).click();await f.getByText('回收站为空',{exact:true}).waitFor();await f.getByRole('button',{name:'关闭',exact:true}).click();
  doc=await direct(tx=>tx.knowledgeDoc.findUnique({where:{id:doc.id}}));assert.equal(doc.trashedAt,null);assert.equal(doc.reviewed,false);checks.push('trash-and-restore-preserves-document');
  await f.getByRole('button',{name:'合成针灸方案',exact:false}).first().click();await f.getByRole('button',{name:'审核通过',exact:true}).click();await f.getByText('已审核·可检索',{exact:true}).waitFor();
  await owner.page.screenshot({path:out+'owner-ready-for-user.png'});
  stage='admin';const admin=await actor('admin');await admin.page.getByRole('button',{name:'知识库治理',exact:true}).click();await admin.frame.getByText('治理模式',{exact:false}).first().waitFor();await admin.page.screenshot({path:out+'admin-governance.png'});checks.push('admin-governance');
  stage='viewer';const viewer=await actor('viewer');assert.equal(await viewer.frame.getByRole('button',{name:'+ 新建库',exact:true}).isDisabled(),true);
  const headers={'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
  assert.equal((await viewer.context.request.post(base+'/api/knowledge/docs',{headers,data:{kbId:doc.kbId,title:'不允许写入'}})).status(),403);await viewer.page.screenshot({path:out+'viewer-readonly.png'});checks.push('readonly-ui-and-original-api-403');
  stage='uninvited';const uninvited=await actor('uninvited');await uninvited.frame.getByText('尚无可访问的知识资料研究项目',{exact:true}).waitFor();assert.equal((await uninvited.context.request.get(base+'/api/knowledge/docs/'+doc.id,{headers})).status(),403);await uninvited.page.screenshot({path:out+'uninvited-empty.png'});checks.push('uninvited-empty-and-forged-scope-403');
  assert.deepEqual(errors,[]);assert.deepEqual(hashes(),before);assert.equal(processes(),old);assert.deepEqual(await history(),historyBefore);
  save('result.json',{passed:true,checks,pageErrors:errors,consoleMessages,network,syntheticOnly:true,database:'wp01_test_full_baseline',runtimePid:runtime.pid,oldProcessesUnchanged:true,oldSourcesUnchanged:true,otherImportTasksUnchanged:true,paidCalls:0});
  save('source-hashes.json',before);console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){await active?.screenshot({path:out+'failure.png'}).catch(()=>{});save('failure.json',{stage,name:e.name,message:e.message,network,pageErrors:errors});console.error(JSON.stringify({passed:false,stage,evidence:out,message:e.message}));process.exitCode=1;
}finally{for(const c of contexts)await c.close();await browser.close();}
