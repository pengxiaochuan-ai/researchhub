// Approved A-R01..03 only. No old fixture, role, account, Study or model mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalResearchPlans} from '../../scripts/local-research-plans.mjs';
import {createResearchAssetsReader} from '../../scripts/local-research-assets-read.mjs';
import {RESEARCH_ASSET_KINDS,sealResearchAssetVersion} from '../../scripts/research-assets-read-contract.mjs';
import {LOCAL_ASSET_FIXTURE_PREFIX,assertNamedResearchAssetFixtures} from './research-assets-fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',mode=process.argv[2];
assert(['seed','verify','preflight'].includes(mode),'EXPLICIT_LOCAL_ASSET_ACTION_REQUIRED');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
assert(['tenant','group','project','owner','admin'].every(k=>ids[k]?.startsWith('rh-kb-local-')));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);
const prefix=LOCAL_ASSET_FIXTURE_PREFIX;
const inventory=tx=>tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:prefix}},take:11,select:{tenantId:true,studyGroupId:true,researchProjectId:true,ownerAccountId:true,createdBy:true,idempotencyKey:true,currentVersionNo:true,status:true,deletedAt:true}});
const initial=await withFixtureTransaction(env,'direct',async tx=>{
 assert(await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'local_research_plan_authorized',target:ids.role}}),'OLD_INITIALIZER_FORBIDDEN');
 const pendingWhere={tenantId:ids.tenant,status:{in:['queued','processing']}};
 const historicalPending=await tx.knowledgeChatJob.count({where:pendingWhere});
 // Historical fixtures deliberately retain pending states. Never drain, cancel or recover them.
 const activeLease=await tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,status:'processing',leaseExpiresAt:{gt:new Date()}}});
 const recentPending=await tx.knowledgeChatJob.count({where:{...pendingWhere,updatedAt:{gt:new Date(Date.now()-15*60*1000)}}});
 const dispatchable=await tx.message.count({where:{tenantId:ids.tenant,AND:[{meta:{path:['hubCommand','schema'],equals:'hub-conversation-command.v1'}},{meta:{path:['hubCommand','consumerKey'],equals:'researchhub-interactive.v1'}},{meta:{path:['hubCommand','status'],equals:'waiting'}}]}});
 const resumable=await tx.knowledgeChatJob.count({where:{...pendingWhere,payload:{path:['hubCommand','consumerKey'],equals:'researchhub-interactive.v1'}}});
 assert.equal(activeLease+recentPending+dispatchable+resumable,0,'ACTIVE_MODEL_TASKS_STOP_LOCAL_RESTART');
 const existing=assertNamedResearchAssetFixtures(await inventory(tx),ids);
 const accounts=await tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]},tenantId:ids.tenant,status:'active'},select:{id:true,authVersion:true,role:true}});assert.equal(accounts.length,2);
 return{pending:activeLease+recentPending+dispatchable+resumable,historicalPending,existing,accounts};
},{readOnly:true});
if(mode==='preflight'){console.log(JSON.stringify({syntheticOnly:true,activeModelTasks:initial.pending,historicalPendingUntouched:initial.historicalPending,existingNamedAssets:initial.existing}));process.exit(0);}
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name];
const transact=callback=>withFixtureTransaction(env,'direct',tx=>callback(tx),{readOnly:mode!=='seed'});
const db=new Proxy({$transaction:transact},{get:(_target,name)=>name==='$transaction'?transact:new Proxy({}, {get:(_model,method)=>(...args)=>transact(tx=>tx[name][method](...args))})});
const prisma={elevated:db,app:db,forTenant:()=>db,withTenantTransaction:(_t,_g,_p,cb)=>transact(cb)};
// The initializer audit is already present and explicitly checked above; it must never restore roles.
const plans=await createLocalResearchPlans({root,ids,prisma,storage:{},knowledge:{},load,require,quota:{},own:()=>{throw Error('NO_SESSION_OR_MODEL_IN_ASSET_FIXTURE');}});
const reader=createResearchAssetsReader({withScope:plans.withScope}),Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService');
const service=tx=>new Artifacts({forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)}, {},null,null);
const users=Object.fromEntries(['owner','admin'].map(actor=>{const a=initial.accounts.find(x=>x.id===ids[actor]);return[actor,{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:a.id,authVersion:a.authVersion,role:a.role}];}));
const labels={protocol:'研究方案',dataset:'数据集字典',instrument:'采集工具说明',analysis:'分析方法说明',publication:'科研报告提纲'};
const bodies={protocol:'## PICO讨论\n\n研究问题：针灸辅助干预抑郁障碍研究应如何明确人群、干预、对照与结局？\n\n此处仅是人工编写的方法学讨论提纲，尚未确认PICO，不提供样本量或疗效结果。',dataset:'## 变量字典\n\n|变量|含义|缺失语义|\n|---|---|---|\n|visit_name|访视名称|未填写与未实施区分|\n|record_state|记录状态|不能将缺失填为零|\n\n仅合成字典，无被试行、临床数据或真实数据快照。',instrument:'## 工具用途\n\n人工访视记录表说明，用于讨论字段、必填和缺失语义。\n\n未包含受版权限制的量表全文、计分规则或临床阈值；不能据此执行计分。',analysis:'## 方法配方讨论\n\n先核对输入字段、单位与缺失语义，再选择确定性方法；需要新数据与新的方法运行。\n\n本草稿没有执行统计、不包含科学数值或旧研究结论。',publication:'## 报告提纲\n\n研究背景、方法来源、材料限制、待确认问题与下一步。\n\n尚无真实分析结果、AI解读或审稿结论；不是已发表论文。'};
function payload(actor,kind,number){
 const user=users[actor],label=actor==='owner'?'科研人员':'管理员',registrationKey=prefix+actor+':'+kind;
 const title='合成'+labels[kind]+'｜针灸辅助干预抑郁障碍 · '+label+(number===1?' · 初稿':' · 说明修订');
 const metadata={title,summary:'人工整理的'+labels[kind]+'，仅用于合成研究演练。',purpose:'讨论研究材料、来源与复用前应重新确认的条件。',limitations:'未审核、未共享；不能当作临床结论、已执行分析或已批准方案。',author:'合成'+label};
 const contentMd='# '+title+'\n\n'+bodies[kind]+'\n\n## 材料声明\n\n作者整理的合成演练材料，不含真实被试资料。'+(number===2?'\n\n## 说明修订\n\n补充复用前须重新核对目标研究的资料授权与适用条件；未变更旧系统或旧研究。':'');
 return{registrationKey,title,contentMd,block:sealResearchAssetVersion({...user,ownerAccountId:user.accountId,registrationKey,assetKind:kind,versionNo:number,metadata,source:{kind:'author_declared_synthetic',label:'作者整理的合成演练材料'},contentMd})};
}
const items=[];
for(const bad of [{...users.owner,authVersion:users.owner.authVersion+1},{...users.owner,researchProjectId:'foreign-study'},{...users.owner,tenantId:'foreign-tenant'}])await assert.rejects(reader.read(bad,'unknown-asset'),e=>e.getStatus?.()===403);
for(const actor of ['owner','admin'])for(const kind of RESEARCH_ASSET_KINDS){
 const user=users[actor],p1=payload(actor,kind,1),p2=payload(actor,kind,2);
 let artifact=await plans.withScope(user,'artifact.read',tx=>tx.researchArtifact.findFirst({where:{tenantId:ids.tenant,idempotencyKey:p1.registrationKey}}));
 if(mode==='seed'&&!artifact)artifact=await plans.withScope(user,'artifact.create',async tx=>{
  // Same current-authorization lock/transaction as the actual create, not only a startup count.
  const count=assertNamedResearchAssetFixtures(await inventory(tx),ids);assert(count<10,'ASSET_FIXTURE_CAPACITY_EXCEEDED');
  return service(tx).create(user,{typeKey:'research_report',title:p1.title,idempotencyKey:p1.registrationKey,creationRequestHash:createHash('sha256').update(JSON.stringify(p1)).digest('hex'),contentMd:p1.contentMd,contentBlocks:[p1.block]});
 });
 assert(artifact&&artifact.ownerAccountId===user.accountId&&artifact.createdBy===user.accountId&&[1,2].includes(artifact.currentVersionNo),'NAMED_FIXTURE_MISSING_OR_CHANGED');
 assert.equal((await reader.read(user,artifact.id,'1')).contentMd,p1.contentMd);
 if(mode==='seed'&&artifact.currentVersionNo===1)await plans.withScope(user,'artifact.edit',async tx=>{
  await service(tx).createVersion(user,artifact.id,{baseVersionNo:1,contentMd:p2.contentMd,contentBlocks:[p2.block],changeSummary:'人工补充合成复用限制'});
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,action:'research_asset_read_fixture_20261112',target:artifact.id,meta:{syntheticOnly:true,kind,versions:[1,2],scope:'own-current-study-read-only-verification'}}});
 });
 const head=await reader.read(user,artifact.id);assert.equal(head.version,2);assert.equal(head.contentMd,p2.contentMd);assert.equal(head.title,p2.title);
 const history=await reader.read(user,artifact.id,'1');assert.equal(history.title,p1.title);assert.equal(history.isHistorical,true);
 await assert.rejects(reader.read(users[actor==='owner'?'admin':'owner'],artifact.id),e=>e.status===404);
 await assert.rejects(reader.read(user,artifact.id,'3'),e=>e.status===404);
 items.push({actor,kind,id:artifact.id,version:head.version,historyVersion:history.version,title:head.title,url:'/pages/a02/?'+new URLSearchParams({researchAssetId:artifact.id,studyGroupId:ids.group,researchProjectId:ids.project})});
}
console.log(JSON.stringify({syntheticOnly:true,mode,fixtureCount:items.length,versionCount:items.length*2,modelCalls:0,permissionChanges:0,items},null,2));
