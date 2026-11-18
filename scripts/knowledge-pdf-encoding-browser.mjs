// Synthetic-only, real Chrome upload acceptance; retains all historical documents.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root='/Users/mac/aisciencesys/',out=root+'researchhub/docs/testing/evidence/knowledge-pdf-encoding-2026-11-16/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env,ids}=loadCatalogTarget();
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const direct=cb=>withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);return cb(tx);},{readOnly:true});
const oldIds=await direct(tx=>tx.knowledgeDoc.findMany({where:{tenantId:ids.tenant},select:{id:true}}).then(rows=>rows.map(row=>row.id)));
const snapshot=()=>direct(async tx=>({docs:await tx.$queryRawUnsafe('SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(d)::text,\',\' ORDER BY id),\'\')) AS hash FROM knowledge_doc d WHERE id=ANY($1::text[])',oldIds),roles:await tx.$queryRawUnsafe('SELECT md5(coalesce(string_agg(row_to_json(r)::text,\',\' ORDER BY id),\'\')) AS hash FROM permission_role r WHERE "tenantId"=$1',ids.tenant)}));
const before=await snapshot(),protectedFiles=['researchhub/scripts/local-knowledge.mjs','researchhub/scripts/local-full-study-simulation.mjs','researchhub/pages/k01/main.jsx','researchhub/pages/k01/frame.jsx','researchhub/src/knowledge-reuse/pages/knowledge/KnowledgeBasePage.tsx'];
const hashes=()=>Object.fromEntries(protectedFiles.map(path=>[path,createHash('sha256').update(readFileSync(root+path)).digest('hex')]));
const filesBefore=hashes(),base='http://127.0.0.1:19501',contexts=[],errors=[],network=[],checks=[],docs=[];
let name='PDF编码回归·'+randomUUID().slice(0,8),resume;
if(process.argv[2]==='--resume-empty-library'||process.argv[2]==='--resume-current-library'){
 const failed=JSON.parse(readFileSync(out+'browser-failure.json'));
 resume=await direct(tx=>tx.knowledgeBase.findUnique({where:{id:failed.kbId}}));
 assert.ok(resume?.name.startsWith('PDF编码回归·'));assert.equal(resume.tenantId,ids.tenant);assert.equal(resume.createdBy,ids.owner);
 const rows=await direct(tx=>tx.knowledgeDoc.findMany({where:{kbId:resume.id},select:{createdBy:true,reviewed:true,version:true,sources:{select:{sha256:true}}}}));
 assert.ok(rows.length<=2);const allowed=new Set(['synthetic-broken-cmap.pdf','synthetic-normal-cjk.pdf'].map(file=>createHash('sha256').update(readFileSync(out+file)).digest('hex')));
 for(const row of rows){assert.equal(row.createdBy,ids.owner);assert.equal(row.reviewed,false);assert.equal(row.version,1);assert.ok(row.sources.length===1&&allowed.has(row.sources[0].sha256));}
 name=resume.name;const attempt=Date.now();writeFileSync(out+`browser-attempt-${attempt}-failure.json`,readFileSync(out+'browser-failure.json'));writeFileSync(out+`browser-attempt-${attempt}-failure.png`,readFileSync(out+'browser-failure.png'));
}
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let active,stage='login',kbId;
const save=(file,value)=>writeFileSync(out+file,JSON.stringify(value,null,2));
async function actor(who){
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});contexts.push(context);
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();active=page;page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({method:r.request().method(),path:u.pathname,status:r.status()});});
 await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill(who+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/p01/**');
 await page.goto(base+'/pages/k01/'+(who==='admin'?'?mode=manage':''));
 const frame=page.frameLocator('iframe[title="知识资料操作区"]');await frame.getByRole('combobox',{name:'课题组',exact:true}).selectOption(ids.group);await frame.getByRole('combobox',{name:'研究项目',exact:true}).selectOption(ids.project);
 return{context,page,frame};
}
try{
 const owner=await actor('owner'),f=owner.frame;
 stage='create';
 if(resume){kbId=resume.id;await f.locator('select').filter({has:f.locator('option',{hasText:name})}).selectOption(kbId);}
 else{const created=owner.page.waitForResponse(r=>r.url().endsWith('/api/knowledge/bases')&&r.request().method()==='POST');await f.getByRole('button',{name:'+ 新建库',exact:true}).click();await f.getByLabel('知识库名称').fill(name);await f.getByRole('button',{name:'创建知识库',exact:true}).click();const response=await created;assert.equal(response.status(),201);kbId=(await response.json()).id;assert.ok(kbId);}
 for(const file of ['synthetic-broken-cmap.pdf','synthetic-normal-cjk.pdf']){
  stage='upload-'+file;const sha256=createHash('sha256').update(readFileSync(out+file)).digest('hex');
  const completed=await direct(tx=>tx.knowledgeImportTask.findFirst({where:{kbId,status:'complete',sourceFile:{sha256}},select:{id:true}}));let taskId=completed?.id;
  if(await f.getByRole('button',{name:'文档树',exact:true}).isVisible())await f.getByRole('button',{name:'文档树',exact:true}).click();
  if(!taskId){const uploaded=owner.page.waitForResponse(r=>r.url().endsWith('/api/knowledge/docs/import')&&r.request().method()==='POST');const chooser=owner.page.waitForEvent('filechooser');await f.getByRole('button',{name:'⬆ 批量导入',exact:true}).click();await(await chooser).setFiles(out+file);const upload=await(await uploaded).json();assert.equal(upload.queued,1);taskId=upload.results[0].taskId;}
  let task;
  for(let n=0;n<45;n++){task=await direct(tx=>tx.knowledgeImportTask.findFirst({where:{id:taskId,tenantId:ids.tenant},select:{id:true,status:true,docId:true,warnings:true,errorMessage:true}}));if(['complete','failed','blocked'].includes(task.status))break;await new Promise(resolve=>setTimeout(resolve,1000));}
  assert.equal(task.status,'complete',task.errorMessage);assert.ok(task.docId);
  const doc=await direct(tx=>tx.knowledgeDoc.findUnique({where:{id:task.docId},select:{id:true,kbId:true,title:true,contentMd:true,reviewed:true,metadataSource:true,metadataConfidence:true,version:true}}));assert.equal(doc.kbId,kbId);assert.equal(doc.reviewed,false);assert.match(doc.title,/中文文档编码验证/);assert.match(doc.contentMd,/中文文档编码验证/);assert.doesNotMatch(doc.contentMd,/\ufffd/);assert.equal(doc.metadataSource,file.includes('broken')?'pdf_ocr':'pdf_layout');
  await owner.page.goto(base+'/pages/k01/?'+new URLSearchParams({studyGroupId:ids.group,researchProjectId:ids.project,kbId,docId:doc.id}));await f.getByLabel('文档标题').waitFor({timeout:30000});
  await f.getByLabel('文档标题').fill(doc.title);await f.getByRole('button',{name:'富文本',exact:true}).click();await f.locator('[contenteditable=true]').getByText('中文文档编码验证',{exact:false}).first().waitFor();await owner.page.screenshot({path:out+file+'-rich.png'});
  await f.getByRole('button',{name:'Markdown',exact:true}).click();assert.match(await f.getByPlaceholder('开始编写知识文档…支持富文本 / Markdown / 预览三种模式').inputValue(),/中文文档编码验证/);await owner.page.screenshot({path:out+file+'-markdown.png'});
  await f.getByRole('button',{name:'抽取预览',exact:true}).click();await f.getByRole('heading',{name:'第 1 页',exact:true}).waitFor();await owner.page.screenshot({path:out+file+'-preview.png'});
  await f.getByRole('button',{name:'原件',exact:true}).click();await owner.page.screenshot({path:out+file+'-original.png'});
  checks.push(file+':real-upload-parser-worker-db-title-rich-markdown-preview-original');docs.push({id:doc.id,kbId,taskId,source:file,title:doc.title,metadataSource:doc.metadataSource,metadataConfidence:doc.metadataConfidence,warnings:task.warnings,version:doc.version});
 }
 stage='refresh';await owner.page.reload();await f.getByLabel('文档标题').waitFor();assert.match(await f.getByLabel('文档标题').inputValue(),/中文文档编码验证/);await f.getByRole('button',{name:'抽取预览',exact:true}).click();await f.getByRole('heading',{name:'第 1 页',exact:true}).waitFor();await owner.page.screenshot({path:out+'owner-refresh.png'});checks.push('refresh-retains-database-title-and-body');
 stage='admin';const admin=await actor('admin');await admin.page.goto(base+'/pages/k01/?'+new URLSearchParams({mode:'manage',studyGroupId:ids.group,researchProjectId:ids.project,kbId,docId:docs[0].id}));await admin.frame.getByText('不存在或无权访问',{exact:false}).waitFor();assert.equal(await admin.frame.getByLabel('文档标题').count(),0);await admin.page.screenshot({path:out+'admin-private-library-restricted.png'});checks.push('admin-governance-retains-existing-personal-library-read-restriction');
 assert.deepEqual(errors,[]);assert.deepEqual(await snapshot(),before);assert.deepEqual(hashes(),filesBefore);
 save('browser-result.json',{passed:true,stage,checks,docs,kbId,name,network,pageErrors:errors,protectedHistoricalDocuments:before,protectedFiles:filesBefore,runtimePid:runtime.pid,paidCalls:0,reviewed:false});console.log(JSON.stringify({passed:true,checks:checks.length,kbId,docs:docs.map(x=>x.id)}));
}catch(error){await active?.screenshot({path:out+'browser-failure.png'}).catch(()=>{});save('browser-failure.json',{stage,error:error.message,kbId,docs,network,pageErrors:errors});console.error(JSON.stringify({stage,error:error.message}));process.exitCode=1;
}finally{for(const context of contexts)await context.close();await browser.close();}
