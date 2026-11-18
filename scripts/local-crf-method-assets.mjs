// WP08 purpose is narrower than the original roles. Never initializes grants.
import assert from 'node:assert/strict';
import {lstatSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {CRF_ASSET_MARKER,CRF_ASSET_PREFIX,buildCrfMethodAssetSnapshot,renderCrfMethodAsset,crfMethodAssetNotesOperation,crfMethodAssetSourceState,deriveCrfMethodAssetLineage} from './crf-method-assets-contract.mjs';
import {edcDigest,exactEdcFields} from './synthetic-edc-contract.mjs';
import {hashText} from './knowledge-ai-contract.mjs';
const rootKeys=['accountId','planId','collectionId','runId','reportId'];
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
export function readCrfMethodAssetScope(path,ids,user,operation='A01',root){
 const reject=()=>assert.fail('CRF_ASSET_SCOPE_RESTRICTED');
 let s;try{
  const f=lstatSync(path),d=lstatSync(dirname(path));
  assert(f.isFile()&&!f.isSymbolicLink()&&(f.mode&0o077)===0&&f.size<=65536&&d.isDirectory()&&!d.isSymbolicLink()&&(d.mode&0o077)===0);
  s=JSON.parse(readFileSync(path));
 }catch{reject();}
 if(s.schema!=='rh-crf-method-asset-scope.v1'||s.enabled!==true||s.marker!==CRF_ASSET_MARKER||s.prefix!==CRF_ASSET_PREFIX||!Number.isFinite(Date.parse(s.approvedAt))||
  s.tenantId!==ids.tenant||s.studyGroupId!==ids.group||s.researchProjectId!==ids.project||user.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||
  !Array.isArray(s.accounts)||s.accounts.length!==2||new Set(s.accounts).size!==2||![ids.owner,ids.admin].every(a=>s.accounts.includes(a))||!s.accounts.includes(user.accountId)||
  !Array.isArray(s.operations)||new Set(s.operations).size!==s.operations.length||!s.operations.every(o=>['A01','A02','A03','A04'].includes(o))||!s.operations.includes('A01')||!s.operations.includes(operation)||!Array.isArray(s.sourceRoots))reject();
 const seen=new Set(),counts=new Map();
 for(const r of s.sourceRoots){
  if(!r||Object.keys(r).length!==rootKeys.length||!rootKeys.every(k=>id(r[k]))||!s.accounts.includes(r.accountId))reject();
  const key=JSON.stringify(rootKeys.map(k=>r[k]));if(seen.has(key))reject();seen.add(key);counts.set(r.accountId,(counts.get(r.accountId)??0)+1);if(counts.get(r.accountId)>18)reject();
 }
 if(root&&(!rootKeys.every(k=>id(root[k]))||root.accountId!==user.accountId||!s.sourceRoots.some(r=>rootKeys.every(k=>r[k]===root[k]))))reject();
 return s;
}

export function createCrfMethodAssets({root,ids,plans,reports,storage,load,require,scope}){
 const {Controller,Get,Post,Req,Param,Body,Query,HttpException}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(root+'app/server/src/common/decorators.ts');
 const {canonicalArtifactJson}=require(root+'app/server/src/research-artifacts/research-artifact-integrity.ts');
 const Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService'),typeKey='research_report';
 const fail=(code,message,status=409)=>{throw new HttpException({code,message},status);};
 const invalid=()=>fail('CRF_ASSET_INPUT_INVALID','资产请求字段、版本或标识格式无效',400);
 const checked=fn=>{try{return fn();}catch(e){if(e instanceof assert.AssertionError){const code=e.message.startsWith('CRF_ASSET_')?e.message:'CRF_ASSET_CONTEXT_INVALID';fail(code,'资产事实、来源或容量无法核对',code==='CRF_ASSET_INPUT_INVALID'?400:code==='CRF_ASSET_CAPACITY'?429:code==='CRF_ASSET_NO_CHANGE'?422:409);}throw e;}};
 const identity=v=>{if(!id(v))invalid();return v;},version=v=>{if(!Number.isSafeInteger(v)||v<1||v>30)invalid();return v;};
 const input=(b,keys)=>{try{exactEdcFields(b,keys);}catch{invalid();}if(typeof b.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(b.requestKey))invalid();};
 const emptyQuery=q=>{try{exactEdcFields(q,[]);}catch{invalid();}};
 const purpose=(u,op='A01',r)=>{try{return readCrfMethodAssetScope(scope,ids,u,op,r);}catch{fail('CRF_ASSET_SCOPE_RESTRICTED','当前本人方法资产目的授权不可用',403);}};
 const where=u=>({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:u.accountId,createdBy:u.accountId,typeKey,status:'draft',deletedAt:null,idempotencyKey:{startsWith:CRF_ASSET_PREFIX+u.accountId+':'}});
 const capacityWhere=u=>({tenantId:ids.tenant,ownerAccountId:u.accountId,createdBy:u.accountId,idempotencyKey:{startsWith:CRF_ASSET_PREFIX+u.accountId+':'}});
 const origin=(u,b)=>({accountId:u.accountId,planId:b.planId,collectionId:b.collectionId,runId:b.runId,reportId:b.reportId});
 const bound=tx=>({forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)}),service=tx=>new Artifacts(bound(tx),storage,null,null);
 const canonical=v=>JSON.parse(canonicalArtifactJson(v));
 const seal=b=>{const value={...b,seal:edcDigest(b)};if(Buffer.byteLength(JSON.stringify(value))>1024*1024)fail('CRF_ASSET_CAPACITY','资产候选超过容量',429);return value;};
 async function authorized(tx,u,op='A01',r){const s=purpose(u,op,r),a=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,action:'local_crf_method_asset_authorized',target:ids.project}});
  if(!a||a.meta?.approvedAt!==s.approvedAt||a.meta.marker!==CRF_ASSET_MARKER||a.meta.prefix!==CRF_ASSET_PREFIX||!s.operations.every(o=>a.meta.operations?.includes(o))||edcDigest(a.meta.accounts)!==edcDigest(s.accounts))fail('CRF_ASSET_SCOPE_RESTRICTED','本轮目的授权尚未登记或不匹配',403);return s;
 }
 async function lockOrigins(tx,u,r){
  // Original official→tenant advisory lock is already held by plans.withScope.
  for(const key of ['planId','collectionId']){const rows=await tx.$queryRaw`SELECT id FROM research_artifact WHERE id=${r[key]} AND "tenantId"=${u.tenantId} AND "studyGroupId"=${u.studyGroupId} AND "researchProjectId"=${u.researchProjectId} AND "ownerAccountId"=${u.accountId} FOR SHARE`;if(rows.length!==1)fail('CRF_ASSET_FORBIDDEN','本人真实父对象不可访问',403);}
  const run=await tx.$queryRaw`SELECT id FROM research_method_run WHERE id=${r.runId} AND "tenantId"=${u.tenantId} AND "studyGroupId"=${u.studyGroupId} AND "researchProjectId"=${u.researchProjectId} AND "accountId"=${u.accountId} FOR UPDATE`;
  const report=await tx.$queryRaw`SELECT id FROM research_artifact WHERE id=${r.reportId} AND "tenantId"=${u.tenantId} AND "studyGroupId"=${u.studyGroupId} AND "researchProjectId"=${u.researchProjectId} AND "ownerAccountId"=${u.accountId} FOR SHARE`;
  if(run.length!==1||report.length!==1)fail('CRF_ASSET_FORBIDDEN','本人真实方法或报告不可访问',403);
 }
 async function stored(tx,u,aId,no){
  const s=purpose(u),a=await tx.researchArtifact.findFirst({where:{...where(u),id:identity(aId)}});if(!a||a.createdAt.getTime()<Date.parse(s.approvedAt))fail('CRF_ASSET_FORBIDDEN','无法访问该本人方法资产候选',403);
  const v=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:a.id,versionNo:no??a.currentVersionNo}},include:{sources:true}});if(!v)fail('CRF_ASSET_VERSION_MISSING','本人候选版本不存在',404);
  const b=v.contentBlocks?.[0],unsigned={...b};delete unsigned.seal;
  if(v.contentBlocks.length!==1||b?.type!==CRF_ASSET_MARKER||b.ownerAccountId!==u.accountId||b.seal!==edcDigest(unsigned)||b.snapshotHash!==edcDigest(b.snapshot)||hashText(v.contentMd)!==v.contentHash||v.contentMd!==checked(()=>renderCrfMethodAsset(b.snapshot,b.notes,b.lineage)))fail('CRF_ASSET_CONTEXT_INVALID','候选正文或快照完整性无法核对');
  await authorized(tx,u,'A01',origin(u,b));return {a,v,b};
 }
 async function context(tx,u,b){return reports.inReport(tx,u,b.planId,b.collectionId,b.runId,b.reportId,b.snapshot.report.versionNo);}
 const shape=rows=>rows.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,...(s.sourceVersion!=null?{sourceVersion:s.sourceVersion}:{}),snapshot:s.snapshot})).sort((a,b)=>(a.sourceType+a.sourceId).localeCompare(b.sourceType+b.sourceId));
 const nativeFor=(ctx,b,ancestors)=>canonical([...ctx.nativeSources,{sourceType:'data_snapshot',sourceId:ctx.reportVersionId,sourceVersion:String(ctx.report.version),snapshot:{kind:'crf_method_report_version',reportId:b.reportId,contentHash:b.snapshot.report.contentHash,factsHash:b.snapshot.report.factsHash}},...ancestors.map(p=>({sourceType:'data_snapshot',sourceId:p.v.id,sourceVersion:String(p.v.versionNo),snapshot:{kind:'crf_method_asset_version',assetId:p.a.id,contentHash:p.v.contentHash,snapshotHash:p.b.snapshotHash}}))]);
 function assertNative({v,b},native){
  if(!Array.isArray(b.nativeSources)||edcDigest(shape(native))!==edcDigest(shape(v.sources))||edcDigest(native)!==edcDigest(b.nativeSources)||v.sourceSnapshotHash!==hashText(JSON.stringify(native)))fail('CRF_ASSET_CONTEXT_INVALID','候选或祖先原生来源完整性无法核对');
  for(const row of v.sources){const wanted=native.find(s=>s.sourceType===row.sourceType&&s.sourceId===row.sourceId);if(!wanted||row.hash!==hashText(JSON.stringify(wanted.snapshot)))fail('CRF_ASSET_CONTEXT_INVALID','候选或祖先逐项来源指纹无法核对');}
 }
 async function sources(tx,u,asset,ctx){
  const {b}=asset,ancestors=[];
  if(!Array.isArray(b.lineage)||b.lineage.length>8||new Set(b.lineage.map(v=>v.id)).size!==b.lineage.length||b.lineage.some(v=>v.id===asset.a?.id))fail('CRF_ASSET_LINEAGE_INVALID','派生血缘无法核对');
  for(const [i,p] of b.lineage.entries()){
   const parent=await stored(tx,u,p.id,version(p.version));
   if(edcDigest(origin(u,parent.b))!==edcDigest(origin(u,b))||parent.b.snapshotHash!==b.snapshotHash||parent.v.contentHash!==p.contentHash||parent.b.notes!==p.notes||edcDigest(parent.b.lineage)!==edcDigest(b.lineage.slice(0,i)))fail('CRF_ASSET_LINEAGE_INVALID','固定父版本与真实来源不符');assertNative(parent,nativeFor(ctx,parent.b,ancestors));ancestors.push(parent);
  }
  return {ancestors,native:nativeFor(ctx,b,ancestors)};
 }
 async function view(tx,u,asset){
  const {a,v,b}=asset,ctx=await context(tx,u,b),s=await authorized(tx,u,'A01',origin(u,b));
  // Integrity only. Freshness below always uses the real current head/context.
  const expected=checked(()=>buildCrfMethodAssetSnapshot({report:{...ctx.report,sourceStatus:'current',currentVersion:ctx.report.version},reportVersionId:ctx.reportVersionId,run:{...ctx.run,sourceStatus:'current'}}));
  if(expected.snapshotHash!==b.snapshotHash)fail('CRF_ASSET_CONTEXT_INVALID','候选与原报告固定事实不符');
  const {native,ancestors}=await sources(tx,u,asset,ctx);
  assertNative(asset,native);
  const sourceStatus=checked(()=>crfMethodAssetSourceState({snapshot:b.snapshot,report:ctx.report,ancestors:ancestors.map(p=>({id:p.a.id,version:p.v.versionNo,currentVersion:p.a.currentVersionNo,sourceStatus:'current'}))})),readOnly=sourceStatus!=='current'||v.versionNo!==a.currentVersionNo,count=await tx.researchArtifact.count({where:capacityWhere(u)});
  purpose(u,'A01',origin(u,b));
  return{id:a.id,title:a.title,typeKey,status:'draft',version:v.versionNo,currentVersion:a.currentVersionNo,contentHash:v.contentHash,sourceStatus,readOnly,canEdit:!readOnly&&s.operations.includes('A02')&&v.versionNo<30,canDerive:!readOnly&&s.operations.includes('A03')&&b.lineage.length<8&&count<100,capacity:{count,max:100},contentMd:v.contentMd,notes:b.notes,snapshot:b.snapshot,snapshotHash:b.snapshotHash,reuseRecipe:b.snapshot.reuseRecipe,lineage:b.lineage,rootReference:{...origin(u,b),reportVersionNo:b.snapshot.report.versionNo},sourceRows:v.sources.map(r=>({sourceType:r.sourceType,sourceId:r.sourceId,sourceVersion:r.sourceVersion,hash:r.hash})),versions:s.operations.includes('A02')?await tx.researchArtifactVersion.findMany({where:{artifactId:a.id},select:{versionNo:true,createdAt:true,changeSummary:true},orderBy:{versionNo:'desc'},take:30}):[]};
 }
 async function receipt(tx,u,key,hash,operation){const where={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_crf_method_asset_request',target:u.accountId+':'+hashText(key)},prior=await tx.auditLog.findFirst({where});if(prior&&prior.meta?.requestHash!==hash)fail('CRF_ASSET_KEY_CONFLICT','请求标识已用于其他输入或操作');if(operation&&!prior)await tx.auditLog.create({data:{...where,meta:{requestHash:hash,operation}}});return prior?.meta?.operation;}
 async function persist(tx,u,key,hash,b,title){
  if(await tx.researchArtifact.count({where:capacityWhere(u)})>=100)fail('CRF_ASSET_CAPACITY','本轮本人候选达到100份容量',429);
  const aId=await service(tx).createWithSourcesInTx(u,{title,typeKey,idempotencyKey:key,creationRequestHash:hash,contentMd:checked(()=>renderCrfMethodAsset(b.snapshot,b.notes,b.lineage)),contentBlocks:[seal(b)]},b.nativeSources,u.accountId,tx);
  await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_crf_method_asset_create',target:aId,meta:{reportId:b.reportId,reportVersionNo:b.snapshot.report.versionNo,snapshotHash:b.snapshotHash}}});return aId;
 }
 async function read(u,aId,no){if(no!==undefined)version(no);const result=await plans.withScope(u,'artifact.read',async tx=>{await authorized(tx,u,no===undefined?'A01':'A02');return view(tx,u,await stored(tx,u,aId,no));});purpose(u,no===undefined?'A01':'A02');return no===undefined?result:{...result,readOnly:true,canEdit:false,canDerive:false};}
 async function create(u,p,c,r,reportId,b){
  input(b,['baseReportVersionNo','requestKey']);version(b.baseReportVersionNo);[p,c,r,reportId].forEach(identity);const rootRef={accountId:u.accountId,planId:p,collectionId:c,runId:r,reportId};
  const op=await plans.withScope(u,'artifact.create',async tx=>{
   await authorized(tx,u,'A01',rootRef);const hash=edcDigest({path:{p,c,r,reportId},body:b}),prior=await receipt(tx,u,b.requestKey,hash);if(prior){await view(tx,u,await stored(tx,u,prior.assetId));return prior;}
   await lockOrigins(tx,u,rootRef);const ctx=await reports.inReport(tx,u,p,c,r,reportId);if(ctx.report.sourceStatus!=='current'||ctx.report.version!==ctx.report.currentVersion||ctx.report.version!==b.baseReportVersionNo)fail('CRF_ASSET_SOURCE_CHANGED','报告、方法或数据已变化，请核对当前版本');
   const key=CRF_ASSET_PREFIX+u.accountId+':report:'+reportId+':'+b.baseReportVersionNo,existing=await tx.researchArtifact.findUnique({where:{tenantId_idempotencyKey:{tenantId:ids.tenant,idempotencyKey:key}}});let aId=existing?.id;
   if(!aId){const {snapshot,snapshotHash}=checked(()=>buildCrfMethodAssetSnapshot(ctx)),block={type:CRF_ASSET_MARKER,ownerAccountId:u.accountId,planId:p,collectionId:c,runId:r,reportId,snapshot,snapshotHash,lineage:[],notes:'',operations:[]};block.nativeSources=(await sources(tx,u,{b:block},ctx)).native;aId=await persist(tx,u,key,edcDigest({reportId,versionNo:b.baseReportVersionNo}),block,'本人方法资产候选草稿');}
   const operation={id:b.requestKey,assetId:aId,versionNo:1};await view(tx,u,await stored(tx,u,aId));await receipt(tx,u,b.requestKey,hash,operation);await authorized(tx,u,'A01',rootRef);return operation;
  });const asset=await read(u,op.assetId);purpose(u,'A01',rootRef);return {asset,operation:op};
 }
 async function mutation(u,aId,operation,permission,b,apply){
  identity(aId);const op=await plans.withScope(u,permission,async tx=>{
   await authorized(tx,u,operation);let parent=await stored(tx,u,aId);const hash=edcDigest({path:{assetId:aId,operation},body:b}),prior=await receipt(tx,u,b.requestKey,hash);
   if(prior){await view(tx,u,await stored(tx,u,prior.assetId));return prior;}
   await lockOrigins(tx,u,origin(u,parent.b));
   for(const id of [...parent.b.lineage.map(p=>p.id),aId]){const rows=await tx.$queryRaw`SELECT id FROM research_artifact WHERE id=${id} AND "tenantId"=${u.tenantId} AND "ownerAccountId"=${u.accountId} FOR UPDATE`;if(rows.length!==1)fail('CRF_ASSET_FORBIDDEN','本人候选父链不可访问',403);}
   parent=await stored(tx,u,aId);const current=await view(tx,u,parent);if(current.sourceStatus!=='current'||current.version!==current.currentVersion)fail('CRF_ASSET_SOURCE_CHANGED','报告、来源或派生父版本已变化，不能提交');
   if(b.baseVersionNo!==current.version)fail('CRF_ASSET_VERSION_CONFLICT','本人候选已有新版本，保留输入并核对');
   const result=await apply(tx,parent,current,hash),value={id:b.requestKey,...result};await receipt(tx,u,b.requestKey,hash,value);await view(tx,u,await stored(tx,u,value.assetId));await authorized(tx,u,operation,origin(u,parent.b));return value;
  });const asset=await read(u,op.assetId);purpose(u,operation,asset.rootReference);return {asset,operation:op};
 }
 async function save(u,aId,b){
  input(b,['baseVersionNo','notes','requestKey']);version(b.baseVersionNo);
  return mutation(u,aId,'A02','artifact.edit',b,async(tx,parent)=>{
   const change=checked(()=>crfMethodAssetNotesOperation({versionNo:parent.a.currentVersionNo,notes:parent.b.notes,operations:parent.b.operations},b));if(change.idempotent)fail('CRF_ASSET_CONTEXT_INVALID','成功操作的原子回执缺失');
   const block={...parent.b,notes:change.notes,operations:[...parent.b.operations,change.operation]};delete block.seal;
   await service(tx).createVersion(u,aId,{baseVersionNo:b.baseVersionNo,contentMd:checked(()=>renderCrfMethodAsset(block.snapshot,block.notes,block.lineage)),contentBlocks:[seal(block)],changeSummary:'修订本人复用说明；固定报告、事实和血缘不变'});
   await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_crf_method_asset_notes',target:aId,meta:{versionNo:change.operation.versionNo,snapshotHash:block.snapshotHash}}});return {assetId:aId,versionNo:change.operation.versionNo};
  });
 }
 async function derive(u,aId,b){
  input(b,['baseVersionNo','requestKey']);version(b.baseVersionNo);
  return mutation(u,aId,'A03','artifact.create',b,async(tx,parent,current,hash)=>{
   const lineage=checked(()=>deriveCrfMethodAssetLineage(current)),block={...parent.b,lineage,notes:'',operations:[]};delete block.seal;
   const ctx=await context(tx,u,block);block.nativeSources=(await sources(tx,u,{b:block},ctx)).native;
   const id=await persist(tx,u,CRF_ASSET_PREFIX+u.accountId+':derive:'+b.requestKey,hash,block,'派生本人方法资产候选草稿');return {assetId:id,versionNo:1};
  });
 }
 async function list(u,q={}){
  if(!q||Object.keys(q).some(k=>!['limit','before'].includes(k))||q.limit!==undefined&&!/^(?:[1-9]|1[0-9]|20)$/.test(String(q.limit))||q.before!==undefined&&!id(q.before))invalid();
  const result=await plans.withScope(u,'artifact.read',async tx=>{const s=await authorized(tx,u),limit=Number(q.limit??20);if(q.before)await stored(tx,u,q.before);const rows=await tx.researchArtifact.findMany({where:{...where(u),createdAt:{gte:new Date(s.approvedAt)}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,...(q.before?{cursor:{id:q.before},skip:1}:{})}),items=[];
   for(const row of rows.slice(0,limit)){const v=await view(tx,u,await stored(tx,u,row.id));items.push({id:v.id,title:v.title,status:v.status,sourceStatus:v.sourceStatus,version:v.version,reportId:v.rootReference.reportId,reportVersionNo:v.rootReference.reportVersionNo,depth:v.lineage.length});}purpose(u);return {items,nextCursor:rows.length>limit?rows[limit-1].id:null};});purpose(u);return result;
 }
 class AssetController{create(req,p,c,r,report,b,q){emptyQuery(q);return create(req.user,p,c,r,report,b);}list(req,q){return list(req.user,q);}read(req,a,q){emptyQuery(q);return read(req.user,a);}history(req,a,no,q){emptyQuery(q);if(!/^(?:[1-9]|[12][0-9]|30)$/.test(no))invalid();return read(req.user,a,Number(no));}save(req,a,b,q){emptyQuery(q);return save(req.user,a,b);}derive(req,a,b,q){emptyQuery(q);return derive(req.user,a,b);}}
 // https://docs.nestjs.com/controllers#routing — no prefix; exact paths only.
 Controller()(AssetController);RequireStudyGroup()(AssetController);RequireResearchProject()(AssetController);RequireStudyGroupMenu('artifacts')(AssetController);RequireStudyGroupPermission('artifact.read')(AssetController);
 for(const [name,verb,path,params] of [['create',Post,'research-plan-drafts/:p/synthetic-collections/:c/method-runs/:r/report-drafts/:report/asset-drafts',[Param('p'),Param('c'),Param('r'),Param('report'),Body(),Query()]],['list',Get,'crf-method-asset-drafts',[Query()]],['read',Get,'crf-method-asset-drafts/:id',[Param('id'),Query()]],['history',Get,'crf-method-asset-drafts/:id/versions/:no',[Param('id'),Param('no'),Query()]],['save',Post,'crf-method-asset-drafts/:id/notes',[Param('id'),Body(),Query()]],['derive',Post,'crf-method-asset-drafts/:id/derivations',[Param('id'),Body(),Query()]]]){verb(path)(AssetController.prototype,name,Object.getOwnPropertyDescriptor(AssetController.prototype,name));Req()(AssetController.prototype,name,0);params.forEach((v,i)=>v(AssetController.prototype,name,i+1));}
 return {Controller:AssetController,create,read,list,save,derive,
  async inAsset(tx,u,aId,no){
   if(no!==undefined)version(no);await authorized(tx,u,no===undefined?'A01':'A02');
   let parent=await stored(tx,u,aId,no);await lockOrigins(tx,u,origin(u,parent.b));
   for(const id of [...parent.b.lineage.map(p=>p.id),aId]){
    const rows=await tx.$queryRaw`SELECT id FROM research_artifact WHERE id=${id} AND "tenantId"=${u.tenantId} AND "ownerAccountId"=${u.accountId} FOR SHARE`;
    if(rows.length!==1)fail('CRF_ASSET_FORBIDDEN','本人候选父链不可访问',403);
   }
   parent=await stored(tx,u,aId,no);const asset=await view(tx,u,parent);await authorized(tx,u,no===undefined?'A01':'A02',origin(u,parent.b));
   return{asset:no===undefined?asset:{...asset,readOnly:true,canEdit:false,canDerive:false},nativeSources:canonical(parent.b.nativeSources)};
  }
 };
}
