import {randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {buildT17Report,canonicalReportJson,FORMAL_REPORT_PREFIX,REPORT_SCHEMA,reportDigest} from './t17-report-content.mjs';
import {createT17ReportExports} from './t17-report-exports.mjs';
import {readT17Presentation} from './t17-report-presentation.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=(code='REPORT_CHANGED')=>{throw researchError(409,code,'报告、分析依据或使用条件已变化，请重新核对。');};
const missing=()=>{throw researchError(404,'REPORT_NOT_FOUND','未找到可访问的固定报告。');};
const uid=kind=>'rh-'+kind+'-'+randomUUID();
const reason=x=>{if(typeof x!=='string'||!x.trim()||x.length>5000)invalid();return x.trim();};
/** Formal reports share the existing immutable models, renderer, claim primitives and private storage. */
export function createT17Reports({studies,analysis,storage,load,deploymentScope,reportAdapter}){
 if(typeof studies?.withResearchStudyTransaction!=='function'||typeof analysis?.assertCurrent!=='function'||typeof load!=='function')throw Error('T17_REAL_SERVICES_REQUIRED');
 if(reportAdapter&&(!['runId','runGroupId'].includes(reportAdapter.sourceField)||typeof reportAdapter.schemaVersion!=='string'||!reportAdapter.schemaVersion||!['readSource','buildContent','blockSourceId','presentSource'].every(key=>typeof reportAdapter[key]==='function')||reportAdapter.render!==undefined&&typeof reportAdapter.render!=='function'))throw Error('T17_REPORT_ADAPTER_INVALID');
 const render=reportAdapter?.render??load('research-artifacts/research-artifact-export','renderResearchArtifact'),filename=load('research-artifacts/research-artifact-export','artifactExportFilename');
 const presentationDeps={normalizeSchema:load('study-operations/study-forms-policy','normalizeFormSchema'),canonicalManifestHash:load('research-methods/data-quality-release-policy','canonicalManifestHash')};
 const transition=load('research-artifacts/research-artifact-policy','assertArtifactTransition'),claim=load('common/worker-claim','claim'),liveClaim=load('common/worker-claim','assertLiveClaim'),heartbeat=load('common/worker-claim','heartbeat'),recoverExpiredClaim=load('common/worker-claim','recoverExpiredClaim');
 const owner=uid('report-worker'),scopeOf=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
 const transact=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{const s=scopeOf(ctx);await repository.setContext(tx,user,s.studyGroupId,s.researchProjectId);return fn(tx,s,ctx);});
 const studyContext=ctx=>typeof ctx?.studyTitle==='string'&&ctx.studyTitle.trim()&&ctx.studyTitle.length<=300?{studyTitle:ctx.studyTitle}:{};
 const configured=()=>{if(!deploymentScope?.enabledWorkerKinds?.includes('research-artifact-export')||!storage?.available)throw researchError(503,'REPORT_EXPORT_UNAVAILABLE','报告导出或文件存储尚不可用，请联系管理员。');};
 async function permission(tx,user,s,button){
  const a=await tx.account.findFirst({where:{id:user.accountId,tenantId:s.tenantId,status:'active'},include:{tenant:true}});
  if(!a||a.tenant.status!=='active'||a.authVersion!==user.authVersion||a.isTenantAdmin!==(a.role==='tenant_admin'))throw researchError(403,'REPORT_AUTHORIZATION_REVOKED','当前身份或报告权限已变化。');
  if(a.role==='tenant_admin'&&a.isTenantAdmin)return 'tenant_admin';
  const m=await tx.studyGroupMembership.findFirst({where:{tenantId:s.tenantId,studyGroupId:s.studyGroupId,accountId:a.id,status:'active',role:{status:'active'}},include:{role:true}});
  if(!m||!Array.isArray(m.role.menuPermissions)||!m.role.menuPermissions.includes('artifacts')||!Array.isArray(m.role.buttonPermissions)||!m.role.buttonPermissions.includes(button))throw researchError(403,'REPORT_FORBIDDEN','当前账号没有本报告的操作权限。');return m.role.key;
 }
 async function displayCapabilities(tx,user,s){
  const capabilities={};for(const [key,button] of [['canCreate','artifact.create'],['canReview','artifact.review'],['canRelease','artifact.release'],['canExport','artifact.export']]){try{await permission(tx,user,s,button);capabilities[key]=true;}catch(error){if(error?.code!=='REPORT_FORBIDDEN')throw error;capabilities[key]=false;}}
  return {capabilities,docxExportStatus:storage?.available===true&&deploymentScope?.enabledWorkerKinds?.includes('research-artifact-export')&&deploymentScope?.allowedTenantIds?.includes(s.tenantId)?'available':'unavailable'};
 }
 async function currentRun(tx,user,s,studyId,runId,phase='export',cache,withPresentation=false){
  const cacheKey=runId+':'+withPresentation;if(cache?.runs.has(cacheKey))return cache.runs.get(cacheKey);
  if(!id(runId))invalid();const row=await tx.researchMethodRun.findFirst({where:{...s,id:runId,skillKey:'descriptive-statistics'}});if(!row)missing();
  const ref=row.inputSummary;if(ref?.studyId!==studyId||!id(ref.snapshotId))fail('REPORT_SOURCE_INVALID');
  const current=cache?.bases.get(ref.snapshotId)??await analysis.assertCurrent(tx,user,s,studyId,ref.snapshotId,phase);cache?.bases.set(ref.snapshotId,current);
  const presentation=withPresentation?await readT17Presentation(tx,s,current.manifest,presentationDeps):undefined;
  await tx.$queryRaw`SELECT id FROM public.research_method_run WHERE id=${row.id} AND "tenantId"=${s.tenantId} FOR SHARE`;
  const fixed=await tx.researchMethodRun.findFirst({where:{...s,id:row.id}});if(!fixed||canonicalReportJson(fixed)!==canonicalReportJson(row))fail();
  const review=await tx.researchMethodReview.findFirst({where:{...s,runId:row.id},orderBy:{version:'desc'}});if(review?.conclusion!=='confirmed'||!review.comment?.trim())fail('REPORT_METHOD_REVIEW_REQUIRED');
  buildT17Report(fixed,current.basis,'核验',presentation);const verified={run:fixed,basis:current.basis,presentation};cache?.runs.set(cacheKey,verified);return verified;
 }
 const sourceField=reportAdapter?.sourceField??'runId',reportSchema=reportAdapter?.schemaVersion??REPORT_SCHEMA;
 const readSource=reportAdapter?.readSource??(async(...args)=>{const value=await currentRun(...args);return {source:value.run,basis:value.basis,presentation:value.presentation};});
 const buildContent=reportAdapter?.buildContent??buildT17Report,blockSourceId=reportAdapter?.blockSourceId??(block=>block.runId);
 const presentSource=reportAdapter?.presentSource??((source,basis)=>({runId:source.id,snapshotId:basis.snapshotId}));
 const defaultTitle=reportAdapter?.defaultTitle||'通用合成研究描述统计报告';
 const previewHash=(studyId,sourceId,built)=>reportDigest([studyId,sourceField,sourceId,built.contentHash,built.sourceSnapshotHash].join('\n'));
 async function current(tx,user,s,studyId,artifactId,button='artifact.read',cache){
  if(!id(artifactId)||!artifactId.startsWith(FORMAL_REPORT_PREFIX))missing();
  const role=await permission(tx,user,s,button);
  const artifact=await tx.researchArtifact.findFirst({where:{...s,id:artifactId,typeKey:'analysis_report',deletedAt:null}});if(!artifact)missing();
  const version=await tx.researchArtifactVersion.findFirst({where:{...s,artifactId,versionNo:artifact.currentVersionNo},include:{sources:true}});
  const block=version?.contentBlocks?.[0];if(block?.schemaVersion!==reportSchema||block.analysisBasis?.studyId!==studyId)fail('REPORT_SOURCE_INVALID');
  const {source,basis,presentation}=await readSource(tx,user,s,studyId,blockSourceId(block),'export',cache,Object.hasOwn(block,'presentation'));
  await tx.$queryRaw`SELECT id FROM public.research_artifact WHERE id=${artifactId} AND "tenantId"=${s.tenantId} FOR UPDATE`;
  const locked=await tx.researchArtifact.findFirst({where:{...s,id:artifactId,deletedAt:null}});if(!locked||canonicalReportJson(locked)!==canonicalReportJson(artifact)||artifact.status==='archived')fail();
  const expected=buildContent(source,basis,artifact.title,presentation),sources=version.sources;
  if(version.versionNo!==1||version.contentMd!==expected.contentMd||version.contentHash!==expected.contentHash||version.sourceSnapshotHash!==expected.sourceSnapshotHash||canonicalReportJson(version.contentBlocks)!==canonicalReportJson(expected.contentBlocks)||sources.length!==expected.sources.length)fail('REPORT_INTEGRITY_INVALID');
  for(const source of expected.sources){const saved=sources.find(x=>x.sourceType===source.sourceType&&x.sourceId===source.sourceId);if(!saved||saved.sourceVersion!==source.sourceVersion||saved.hash!==reportDigest(canonicalReportJson(source.snapshot))||canonicalReportJson(saved.snapshot)!==canonicalReportJson(source.snapshot))fail('REPORT_INTEGRITY_INVALID');}
  if(['approved','released'].includes(artifact.status)){const review=await tx.researchArtifactReview.findFirst({where:{...s,artifactId,versionId:version.id},orderBy:[{createdAt:'desc'},{id:'desc'}]});if(artifact.approvedVersionNo!==1||review?.conclusion!=='approved'||!review.comment?.trim())fail('REPORT_REVIEW_REQUIRED');}
  return {artifact,version,source,basis,role,...(sourceField==='runId'?{run:source}:{})};
 }
 async function mutate(user,studyId,body,action,target,perform){
  validateMutation(body);return transact(user,studyId,async(tx,s)=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const hash=requestHash({studyId,action,target,body}),saved=await repository.getReceipt(tx,user,body.requestKey);
   if(saved){if(saved.request_hash!==hash)fail('RESEARCH_REQUEST_KEY_CONFLICT');await validateReceipt(tx,user,s,studyId,saved,action,target);return saved.result;}
   const value=await perform(tx,s),auditId=uid('report-audit'),result={studyId,...value,receipt:{requestKey:body.requestKey,action,targetId:target}};
   await tx.auditLog.create({data:{id:auditId,...s,accountId:user.accountId,action:'researchhub.'+action,target,meta:{requestKey:body.requestKey,authVersion:user.authVersion,studyId,artifactId:value.artifactId??null,jobId:value.jobId??null,reason:body.reason??null}}});
   await repository.saveReceipt(tx,user,{id:uid('report-operation'),key:body.requestKey,hash,action,target,result,auditId});return result;
  });
 }
 async function validateReceipt(tx,user,s,studyId,saved,action,target){
  if(!saved||saved.action!==action||saved.target_id!==target||saved.result?.studyId!==studyId||saved.result.receipt?.action!==action||saved.result.receipt?.targetId!==target)throw researchError(404,'REPORT_RECEIPT_NOT_FOUND','暂未查到此操作结果，请保留原核对记录。');
  const button={'analysis.report.create':'artifact.create','analysis.report.review':'artifact.review','analysis.report.release':'artifact.release','analysis.report.export':'artifact.export'}[action];
  if(!button)throw researchError(404,'REPORT_RECEIPT_NOT_FOUND','暂未查到此操作结果，请保留原核对记录。');
  await current(tx,user,s,studyId,saved.result.artifactId,button);
 }
 const metadata=a=>({artifactId:a.id,title:a.title,status:a.status,versionNo:a.currentVersionNo,createdAt:a.createdAt});
 const api={
  async preview(user,studyId,query){only(query,[sourceField]);if(!id(query[sourceField]))invalid();return transact(user,studyId,async(tx,s,ctx)=>{
   await permission(tx,user,s,'artifact.read');const {source,basis,presentation}=await readSource(tx,user,s,studyId,query[sourceField],'export',undefined,true),built=buildContent(source,basis,defaultTitle,presentation);
   return {studyId,...studyContext(ctx),status:'preview',title:built.title,contentMd:built.contentMd,contentHash:built.contentHash,sourceSnapshotHash:built.sourceSnapshotHash,previewHash:previewHash(studyId,query[sourceField],built),...presentSource(source,basis),...await displayCapabilities(tx,user,s)};
  });},
  async readForAssetInTransaction(tx,user,s,studyId,artifactId){
   const ctx=await studies.resolveResearchStudyInTransaction(tx,user,studyId,'read');
   if(ctx.tenantId!==s.tenantId||ctx.studyGroupId!==s.studyGroupId||ctx.executionProjectId!==s.researchProjectId)fail('REPORT_ASSET_SCOPE_CHANGED');
   return current(tx,user,s,studyId,artifactId);
  },
  async create(user,studyId,body){only(body,['requestKey',sourceField,'title','previewHash']);if(!id(body[sourceField])||body.previewHash!==undefined&&(typeof body.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(body.previewHash))||body.title!==undefined&&(typeof body.title!=='string'||!body.title.trim()||body.title.length>300||/[\u0000-\u001f]/.test(body.title)))invalid();return mutate(user,studyId,body,'analysis.report.create',body[sourceField],async(tx,s)=>{
   await permission(tx,user,s,'artifact.create');const {source,basis,presentation}=await readSource(tx,user,s,studyId,body[sourceField],'export',undefined,true);
   const previewed=buildContent(source,basis,defaultTitle,presentation);if(body.previewHash!==undefined&&body.previewHash!==previewHash(studyId,body[sourceField],previewed))fail('REPORT_PREVIEW_CHANGED');
   const built=body.title?buildContent(source,basis,body.title.trim(),presentation):previewed,artifactId=FORMAL_REPORT_PREFIX+randomUUID();
   await tx.researchArtifact.create({data:{...s,id:artifactId,typeKey:'analysis_report',title:built.title,status:'in_review',ownerAccountId:user.accountId,createdBy:user.accountId,idempotencyKey:'formal-report:'+user.accountId+':'+body.requestKey,creationRequestHash:requestHash({studyId,[sourceField]:body[sourceField],basis}),reviewSubmittedVersionNo:1}});
   const version=await tx.researchArtifactVersion.create({data:{...s,artifactId,versionNo:1,contentMd:built.contentMd,contentBlocks:built.contentBlocks,contentHash:built.contentHash,sourceSnapshotHash:built.sourceSnapshotHash,changeSummary:'从已确认的固定方法运行生成待审报告',createdBy:user.accountId}});
   await tx.researchArtifactSource.createMany({data:built.sources.map(x=>({...s,artifactVersionId:version.id,...x,hash:reportDigest(canonicalReportJson(x.snapshot))}))});return {artifactId,versionNo:1,status:'in_review',...presentSource(source,basis)};
  });},
  read:(user,studyId,artifactId)=>transact(user,studyId,async(tx,s,ctx)=>{const c=await current(tx,user,s,studyId,artifactId);const reviews=await tx.researchArtifactReview.findMany({where:{...s,artifactId},orderBy:{createdAt:'asc'},take:100,include:{reviewer:{select:{id:true,displayName:true}}}});return {studyId,...studyContext(ctx),...await displayCapabilities(tx,user,s),...metadata(c.artifact),contentMd:c.version.contentMd,contentHash:c.version.contentHash,...presentSource(c.source,c.basis),reviews:reviews.map(x=>({id:x.id,decision:x.conclusion,reason:x.comment,reviewerId:x.reviewerAccountId,reviewerName:x.reviewer.displayName,createdAt:x.createdAt}))};}),
  list:(user,studyId)=>transact(user,studyId,async(tx,s,ctx)=>{await permission(tx,user,s,'artifact.read');const rows=await tx.researchArtifact.findMany({where:{...s,id:{startsWith:FORMAL_REPORT_PREFIX},deletedAt:null},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50});const items=[],cache={runs:new Map(),bases:new Map()};for(const row of rows){try{await current(tx,user,s,studyId,row.id,'artifact.read',cache);items.push({...metadata(row),analysisState:'current'});}catch(e){if(![403,404,409].includes(e.status??e.getStatus?.()))throw e;items.push({...metadata(row),analysisState:'blocked'});}}return {studyId,...studyContext(ctx),...await displayCapabilities(tx,user,s),items,limit:50};}),
  async review(user,studyId,artifactId,body){only(body,['requestKey','versionNo','decision','reason']);if(body.versionNo!==1||!['approved','changes_requested'].includes(body.decision))invalid();reason(body.reason);return mutate(user,studyId,body,'analysis.report.review',artifactId,async(tx,s)=>{const c=await current(tx,user,s,studyId,artifactId,'artifact.review');if(c.artifact.status!=='in_review'||c.artifact.reviewSubmittedVersionNo!==1)fail('REPORT_STATE_CONFLICT');transition(c.artifact.status,body.decision);const r=await tx.researchArtifactReview.create({data:{...s,artifactId,versionId:c.version.id,reviewerAccountId:user.accountId,roleKey:c.role,conclusion:body.decision,comment:reason(body.reason)}});await tx.researchArtifact.update({where:{id:artifactId,status:'in_review'},data:{status:body.decision,approvedVersionNo:body.decision==='approved'?1:null}});return {artifactId,versionNo:1,status:body.decision,reviewId:r.id};});},
  async release(user,studyId,artifactId,body){only(body,['requestKey','versionNo','reason']);if(body.versionNo!==1)invalid();reason(body.reason);return mutate(user,studyId,body,'analysis.report.release',artifactId,async(tx,s)=>{const c=await current(tx,user,s,studyId,artifactId,'artifact.release');if(c.artifact.status!=='approved'||c.artifact.approvedVersionNo!==1||!await tx.researchArtifactReview.findFirst({where:{...s,artifactId,versionId:c.version.id,conclusion:'approved',comment:{not:null}}}))fail('REPORT_REVIEW_REQUIRED');transition(c.artifact.status,'released');await tx.researchArtifact.update({where:{id:artifactId,status:'approved'},data:{status:'released',releasedVersionNo:1}});return {artifactId,versionNo:1,status:'released'};});},
  async export(user,studyId,artifactId,body){only(body,['requestKey','versionNo','format']);if(body.versionNo!==1||!['docx','pdf','markdown'].includes(body.format))invalid();configured();return mutate(user,studyId,body,'analysis.report.export',artifactId,async(tx,s)=>{const c=await current(tx,user,s,studyId,artifactId,'artifact.export');if(c.artifact.status!=='released'||c.artifact.releasedVersionNo!==1)fail('REPORT_RELEASE_REQUIRED');if(!deploymentScope.allowedTenantIds?.includes(s.tenantId))throw researchError(403,'REPORT_EXPORT_SCOPE_DENIED','本研究尚未启用文件导出。');const job=await tx.researchArtifactExportJob.create({data:{...s,artifactId,artifactVersionId:c.version.id,format:body.format,requestedBy:user.accountId}});return {artifactId,jobId:job.id,status:job.status,versionNo:1};});},
  async receipt(user,studyId,key,{action,targetId}){validateMutation({requestKey:key});if(!['analysis.report.create','analysis.report.review','analysis.report.release','analysis.report.export'].includes(action)||!id(targetId))invalid();return transact(user,studyId,async(tx,s)=>{const saved=await repository.getReceipt(tx,user,key);await validateReceipt(tx,user,s,studyId,saved,action,targetId);return saved.result;});},
 };
 return {...api,...createT17ReportExports({current,transact,permission,configured,render,filename,claim,liveClaim,heartbeat,recoverExpiredClaim,owner,deploymentScope,storage})};
}
