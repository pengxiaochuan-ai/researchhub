# K01 两条失败导入任务一次性重跑提案（待确认，不执行）

当前原生接口没有失败导入的重试入口。本次提案只针对原admin/owner两条已失败任务，恢复为可被原生Worker重新认领的queued状态；这不同于原先只读stage/activate控制，因此必须取得一次准确的数据修复授权。

生产前置已免费验证：存储修补5f0161b及状态修补6e6ffba已同版发布；当前配对hub-runtime-6e6ffbaa-44679992177001。44678685955在目标环境只读读取两份原PDF并核原SHA、中文标题/正文、真实第1页、非OCR；原失败/版本不变。44680156763确认限定Worker/模型继续ON，原623条任务与累计2会话/2任务/2请求/费用上界0.05454元的账本保持。本提案仍待批准，预检、代码发布和只读页面复验均不等于重排获准。执行前须重新核当前配对、准入、失败原件和真实授权，状态变化即停。

- 唯一环境：独立演示researchhub，tenant=rh-kb-local-b0e2af9d-tenant；同原Study、原两账号，不碰aisci、旧服务、官网、历史任务。
- 任务仅cmwogdsd60011nq0786q4foiy、cmwogdwe10022nq07s1xoo7zq，各额外重新入队1次；不新建task/sourceFile，不重新上传。完成后最多新增原本已批准的2个PDF文档，总数仍最多6，每文档最多3版。
- 原失败必须仍为failed/stage=failed/progress=25/docId=null/IMPORT_FAILED/对象存储不可用，且updatedAt分别为04:09:11.190Z、04:09:11.193Z；原始文件SHA、大小、归属、当前原生权限及真实父对象须全部相同，已有同名修复审计则拒绝。
- 在一个已验证目标库的Serializable事务内，先持有原生租户授权变更锁并验证两行；仅追加2条系统维护审计（accountId=null，不冒充用户），完整保留原失败行及来源hash，再CAS修改原两行。任一校验/CAS差异则整体回滚。
- 仅重置这两条任务的执行状态/旧租约/错误字段以便原生重新认领；原始失败不丢失，存在追加审计中。仍复用原对象存储文件与已批准的本地Node文本PDF解析器；原生Worker负责后续当前授权、来源、租约与原子发布。不改算法/映射/审核，不直接创建成功状态或手工填正文。
- 只额外入队一次；再次失败或状态不确定即停，不再次手工重排。不增加模型请求、费用、角色、Token、云资源、邮件、对账或共享/导出权限。后续AI验收仍使用**原剩余2次Provider请求、4个新问答任务和原累计1元上限**，不续额。

## 已准备的免费证据

3项草案单元测试通过。专用合成库真实PG测试中，使用原生当前授权和真实锁；第二条CAS失败后回滚到savepoint，第一条也恢复原failed、两条审计均不存在；正向两条CAS及两条追加审计验证成功；最外层全部回滚。持久写入0、生产连接0、对象写入0、模型调用0。

证据：.tmp/k01-production-20261120/retry-proposal-unit.log、retry-proposal-pg.log。草案未装入应用、未发布执行工作流、未连接生产执行。

## 准确草案

以下函数只是准备物，直接运行文件不执行任何操作；真正执行前还须验证生产runtime/core/准入SHA、原失败原件只读预检通过，并在受保护的一次性操作入口显式提交批准标识。事务和原生授权锁必须由已核对的操作员封装，不能裸调用或分拆执行。

草案SHA256：`2e1da10d895bb68a218c277dd1de70c4faece93b5a5c1cf130c9076bed36b168`

```js
// DRAFT: not installed, published or executed in production. Requires separate approval.
import{createHash}from'node:crypto';
export const approvalFlag='REQUEUE_TWO_EXISTING_K01_IMPORTS_ONCE';
export const tenant='rh-kb-local-b0e2af9d-tenant',group='rh-kb-local-b0e2af9d-group',project='rh-kb-local-b0e2af9d-project';
export const targets=[
 {taskId:'cmwogdsd60011nq0786q4foiy',kbId:'cmwogc60l0003nq0764rrwb8h',actor:'rh-kb-local-b0e2af9d-admin',updatedAt:'2026-11-20T04:09:11.190Z',sha256:'3b83d035edc68e9c2593a400dee1168a535ab1c87bae741cc4be52d927ce1988',bytes:61972},
 {taskId:'cmwogdwe10022nq07s1xoo7zq',kbId:'cmwogdump0015nq07gkdim17h',actor:'rh-kb-local-b0e2af9d-owner',updatedAt:'2026-11-20T04:09:11.193Z',sha256:'edc10bafa65d30529aa9122d6bd9dee5a27a4be059aea857281b924d249dd2dc',bytes:61974},
];
const need=(ok,code)=>{if(!ok)throw Error(code);};
// Caller MUST hold the native tenant authorization mutation lock and use one
// verified researchhub transaction. Any error rolls back both audits and tasks.
export async function requeueTwoImports({tx,authorize,confirm,approvalRef,now=()=>new Date()}){
 need(confirm===approvalFlag&&typeof approvalRef==='string'&&approvalRef.length>=12&&typeof authorize==='function','K01_REQUEUE_NOT_APPROVED');
 const prepared=[];
 for(const expected of targets){
  const task=await tx.knowledgeImportTask.findUnique({where:{id:expected.taskId},include:{sourceFile:true,kb:true}}),file=task?.sourceFile,kb=task?.kb;
  need(task&&task.tenantId===tenant&&task.studyGroupId===group&&task.kbId===expected.kbId&&task.createdBy===expected.actor&&task.status==='failed'&&task.stage==='failed'&&task.progress===25&&task.docId===null&&task.errorCode==='IMPORT_FAILED'&&task.errorMessage==='对象存储不可用'&&new Date(task.updatedAt).toISOString()===expected.updatedAt,'K01_REQUEUE_FAILURE_CHANGED');
  need(file&&task.sourceFileId===file.id&&file.tenantId===tenant&&file.studyGroupId===group&&file.kbId===expected.kbId&&file.docId===null&&file.createdBy===expected.actor&&file.sha256===expected.sha256&&Number(file.size)===expected.bytes&&file.extension==='pdf','K01_REQUEUE_SOURCE_CHANGED');
  need(kb&&kb.id===expected.kbId&&kb.tenantId===tenant&&kb.studyGroupId===group&&kb.researchProjectId===project&&kb.ownerAccountId===expected.actor&&kb.visibility==='private','K01_REQUEUE_PARENT_CHANGED');
  await authorize(tx,expected.taskId);
  const auditId='rh-k01-requeue-'+expected.taskId;need(!await tx.auditLog.findUnique({where:{id:auditId},select:{id:true}}),'K01_REQUEUE_ALREADY_USED');
  need(await tx.knowledgeDoc.count({where:{kbId:expected.kbId}})===2,'K01_REQUEUE_DOCUMENT_COUNT_CHANGED');
  const{sourceFile,kb:ignored,...snapshot}=task;
  prepared.push({expected,task,auditId,snapshot:JSON.parse(JSON.stringify(snapshot)),storageKeyHash:createHash('sha256').update(file.storageKey).digest('hex')});
 }
 for(const{expected,task,auditId,snapshot,storageKeyHash}of prepared){
  await tx.auditLog.create({data:{id:auditId,tenantId:tenant,studyGroupId:group,researchProjectId:project,accountId:null,action:'knowledge_import_requeue_approved_k01',target:task.id,meta:{operator:'approved-system-maintenance',approvalRef,reason:'storage-startup-readiness-race',originalFailure:snapshot,sourceSha256:expected.sha256,storageKeyHash,extraEnqueues:1}}});
  const result=await tx.knowledgeImportTask.updateMany({where:{id:task.id,tenantId:tenant,studyGroupId:group,kbId:expected.kbId,createdBy:expected.actor,sourceFileId:task.sourceFileId,docId:null,status:'failed',updatedAt:new Date(expected.updatedAt),executionToken:task.executionToken,workerOwner:task.workerOwner,leaseExpiresAt:task.leaseExpiresAt},data:{status:'queued',stage:'uploaded',progress:10,executionToken:null,workerOwner:null,leaseExpiresAt:null,startedAt:null,finishedAt:null,errorCode:null,errorMessage:null,updatedAt:now()}});
  need(result.count===1,'K01_REQUEUE_COMPARE_AND_SWAP_LOST');
 }
 return{tasks:targets.map(x=>x.taskId),taskUpdates:2,appendOnlyAudits:2,newTasks:0,newFiles:0,modelCalls:0};
}
```

## 受保护执行封装草案（未批准，不执行）

批准标识和具名引用缺失时，在导入运行时模块、数据库或存储前停止；之后严格核实际researchhub库/专属角色/marker/core55/准确V2 SHA、原native当前授权、原文件SHA及中文第一页，再使用原生授权变更锁与独立Serializable事务调用二行函数。未新建云助手动作或部署执行入口。

独立复核发现，原通用事务helper不支持isolationLevel参数，旧草案传参被忽略。现改为本次一次性runner专用封装，直接向原生Prisma传递Serializable；在同一事务复验数据库身份并读取实际transaction_isolation，不为serializable即拒绝，随后绑定租户/部署上下文，再允许业务回调。共享事务helper和业务底座不变，不做自动重试。

5项单元测试通过。专用合成PG实测实际隔离级别serializable、同事务身份和作用域正确、最外层回滚；数据库写入0、生产连接0。缺批准标识的真实运行返回K01_REQUEUE_NOT_APPROVED，未连接数据库/存储。证据：retry-serializable-unit.log、retry-serializable-pg.log、retry-runner-no-approval.log；二行CAS/审计原子回滚证据仍见retry-proposal-pg.log。

### 专用事务封装

SHA256：`f5c74f4deb16366831f041ef5c5639a59a306a2b89554b10f376f68dc695ed84`。

```js
// DRAFT one-off operator helper, not a shared runtime API.
export async function withK01Serializable({client,expected,validateRuntimeIdentity},operation){
 return client.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'");
  const [identity]=await tx.$queryRawUnsafe(`SELECT current_database() AS database,current_user AS role,r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",encode(sha256(convert_to(coalesce(shobj_description(d.oid,'pg_database'),''),'UTF8')),'hex') AS "markerDigest" FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`);
  validateRuntimeIdentity(expected,'direct',identity);
  const [isolation]=await tx.$queryRawUnsafe('SHOW transaction_isolation');
  if(isolation?.transaction_isolation!=='serializable')throw Error('K01_REQUEUE_ISOLATION_REJECTED');
  await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id','',true),set_config('app.research_project_id','',true),set_config('app.account_id','',true),set_config('app.auth_version','',true),set_config('app.deployment_id',$2,true),set_config('app.deployment_product','researchhub',true)",expected.tenantId,expected.deploymentId);
  return operation(tx);
 },{isolationLevel:'Serializable',maxWait:8000,timeout:20000});
}
```

### 完整执行封装

SHA256：`24304847d9819f41fbbae3d07548755e30bd0580357a686561cefde75cfb6463`。

```js
// DRAFT only. Neither installed nor run in production. All gates precede writes.
import{createHash}from'node:crypto';import{requeueTwoImports,targets,tenant,group,project,approvalFlag}from'./retry-two-imports-proposal.mjs';
import{withK01Serializable}from'./retry-serializable-proposal.mjs';
let prisma;const need=(ok,code)=>{if(!ok)throw Error(code);};
try{
 need(process.env.HUB_K01_REQUEUE_CONFIRM===approvalFlag&&/^K01_TWO_IMPORTS_APPROVED_[A-Za-z0-9_-]{12,160}$/.test(process.env.HUB_K01_REQUEUE_APPROVAL_REF??''),'K01_REQUEUE_NOT_APPROVED');
 const{readResearchRuntimeConfig}=await import('/opt/researchhub/hub/server/research-runtime/config.mjs'),{runtimeDependencies}=await import('/opt/researchhub/hub/server/research-runtime/dependencies.mjs'),{bindRuntimeTransactions,withDeploymentTransaction,verifyRuntimeSchema,validateRuntimeIdentity}=await import('/opt/researchhub/hub/server/database/transactions.mjs'),{loadChatAdmission,createChatBudget}=await import('/opt/researchhub/hub/server/research-runtime/chat-budget.mjs');
 const config=readResearchRuntimeConfig(process.env),sha='6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492';
 need(config.profile==='full'&&config.identity.database==='researchhub'&&config.identity.tenantId===tenant&&config.identity.appRole==='researchhub_demo_app'&&config.identity.directRole==='researchhub_demo_owner'&&config.identity.markerDigest==='cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523'&&config.scope.deploymentId==='researchhub-demo-20261119'&&config.core.digest==='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669'&&config.executionProfile==='bounded-hub-knowledge-v2'&&process.env.HUB_PAID_AI_ENABLED==='true'&&process.env.HUB_CHAT_ADMISSION_SHA256===sha&&!process.env.KB_DOC_PARSER_URL,'K01_REQUEUE_TARGET_REJECTED');
 const admission=loadChatAdmission(process.env.HUB_CHAT_ADMISSION_FILE,sha);need(admission.schema==='hub-chat-admission.v2'&&admission.k01.studyGroupId===group&&admission.k01.researchProjectId===project&&admission.k01.bindings.length===2&&targets.every(t=>admission.k01.bindings.some(b=>b.importTaskId===t.taskId&&b.kbId===t.kbId&&b.accountId===t.actor)),'K01_REQUEUE_ADMISSION_REJECTED');
 const budget=createChatBudget({admission,admissionSha:sha,directory:process.env.HUB_CHAT_LEDGER_DIR}),before=budget.snapshot();need(before.dispatches.every(d=>d.state==='known'),'K01_REQUEUE_PAID_OUTCOME_PENDING');
 const{load,require}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:config.identity});await verifyRuntimeSchema(env,{schemas:process.env.HUB_MANAGED_SCHEMAS.split(','),fingerprint:process.env.HUB_SCHEMA_FINGERPRINT});
 const{storageSettings,createReadyRuntimeStorage}=await import('/opt/researchhub/hub/server/research-runtime/storage.mjs'),{createRuntimeDocExtractor}=await import('/opt/researchhub/hub/server/research-runtime/knowledge-parser.mjs'),storage=await createReadyRuntimeStorage({load,require,settings:storageSettings(process.env)}),parser=createRuntimeDocExtractor({Native:load('knowledge/doc-extract.service','DocExtractService'),PDFParse:require('pdf-parse').PDFParse,resolveMetadata:load('knowledge/knowledge-literature-metadata','resolveLiteratureMetadata'),parserConfigured:false});
 const authorize=async(tx,taskId)=>load('common/worker-authorization','assertWorkerAuthorized')(tx,config.scope,{kind:'knowledge-import',taskId,tenantId:tenant});
 for(const t of targets){
  const row=await withDeploymentTransaction(env,'direct',async tx=>{await authorize(tx,t.taskId);return tx.knowledgeImportTask.findFirst({where:{id:t.taskId,tenantId:tenant,kbId:t.kbId,createdBy:t.actor,status:'failed',docId:null,updatedAt:new Date(t.updatedAt)},include:{sourceFile:true}});},{readOnly:true});
  need(row&&row.sourceFile.sha256===t.sha256&&Number(row.sourceFile.size)===t.bytes,'K01_REQUEUE_PREFLIGHT_SOURCE_CHANGED');const bytes=await storage.getBuffer(row.sourceFile.storageKey,t.bytes);need(createHash('sha256').update(bytes).digest('hex')===t.sha256,'K01_REQUEUE_PREFLIGHT_HASH_CHANGED');const parsed=await parser.extract(row.sourceFile.filename,bytes);need(parsed.extractor==='node-local'&&parsed.usedOcr===false&&parsed.pageCount===1&&parsed.contentMd.includes('# 第1页')&&parsed.contentMd.includes('核对来源')&&!parsed.contentMd.includes('\uFFFD'),'K01_REQUEUE_PREFLIGHT_TEXT_INVALID');
 }
 const result=await withK01Serializable({client:prisma.elevated,expected:config.identity,validateRuntimeIdentity},async tx=>{await load('common/worker-publication','lockAuthorizationMutation')(tx,tenant,{includeOfficial:true});return requeueTwoImports({tx,authorize,confirm:process.env.HUB_K01_REQUEUE_CONFIRM,approvalRef:process.env.HUB_K01_REQUEUE_APPROVAL_REF});});
 console.log(JSON.stringify({status:'k01-two-existing-imports-requeued-once',...result,originalFailuresRetained:true,successDocumentsNotFabricated:true}));
}catch(error){console.log(JSON.stringify({status:'stopped',code:/^K01_[A-Z_]+$/.test(error.message??'')?error.message:'K01_REQUEUE_OPERATION_FAILED_STATE_MUST_BE_RECHECKED',automaticRetry:false}));process.exitCode=1;}finally{if(prisma)await prisma.onModuleDestroy();}
```
