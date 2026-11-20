import {coreSourcePath} from '../server/research-runtime/dependencies.mjs';
// Approved private synthetic candidates only. No formal Asset/template publication.
import{ASSET_MARKER,assetHash,buildAssetSnapshot,deriveAssetLineage,renderAssetDraft,validateAssetNotes}from'./synthetic-asset-contract.mjs';
import{hashText}from'./knowledge-ai-contract.mjs';
export async function createLocalSyntheticAssets({root,ids,prisma,require,service,withScope,inReport}){
 const{Controller,Get,Post,Req,Body,Param,Query,HttpException}=require('@nestjs/common');
 const{RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(coreSourcePath('common/decorators'));
 const{lockAuthorizationMutation}=require(coreSourcePath('common/worker-publication'));
 const prefix='rh-asset-20261022:',typeKey='research_report',fail=(code,message,status=409)=>{throw new HttpException({code,message},status);};
 const invalid=()=>fail('ASSET_INPUT_INVALID','资产候选请求字段、版本或说明格式无效',400),deny=()=>fail('ASSET_FORBIDDEN','当前账号或研究没有该本人资产候选权限',403);
 const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value))invalid();return value;};
 const exact=(input,keys)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||!keys.every(k=>Object.hasOwn(input,k))||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.requestKey))invalid();};
 const version=n=>{if(!Number.isSafeInteger(n)||n<1||n>30)invalid();return n;};
 const scope=user=>({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:user.accountId,createdBy:user.accountId,typeKey,status:'draft',deletedAt:null,idempotencyKey:{startsWith:prefix}});
 const seal=b=>({...b,seal:assetHash(b)}),sourceShape=rows=>rows.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,sourceVersion:s.sourceVersion??null,snapshot:s.snapshot})).sort((a,b)=>(a.sourceType+':'+a.sourceId).localeCompare(b.sourceType+':'+b.sourceId));
 async function receipt(tx,user,key,hash,assetId){const where={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,action:'local_synthetic_asset_request',target:user.accountId+':'+hashText(key)},old=await tx.auditLog.findFirst({where});if(old&&old.meta?.requestHash!==hash)fail('ASSET_KEY_CONFLICT','请求标识已用于不同操作或输入');if(assetId&&!old)await tx.auditLog.create({data:{...where,meta:{requestHash:hash,assetId}}});return old?.meta?.assetId;}
 await prisma.elevated.$transaction(async tx=>{await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});if(await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'local_synthetic_asset_authorized',target:ids.project}}))return;const members=await tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,roleId:ids.role},select:{accountId:true}});if(members.length!==2||![ids.owner,ids.admin].every(a=>members.some(m=>m.accountId===a)))deny();await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:'local_synthetic_asset_authorized',target:ids.project,meta:{accounts:[ids.owner,ids.admin],operations:['create','read','revise-notes','derive-own-draft'],typeKey,ownCurrentSyntheticCandidateOnly:true,rolePermissionsChanged:false,shareReviewLockPublishExport:false}}});});

 async function load(tx,user,assetId,no){
  const a=await tx.researchArtifact.findFirst({where:{...scope(user),id:id(assetId)}});if(!a)deny();const number=no??a.currentVersionNo;version(number);if(number>a.currentVersionNo)invalid();
  const v=await tx.researchArtifactVersion.findFirst({where:{artifactId:a.id,versionNo:number},include:{sources:true}}),b=v?.contentBlocks?.find(b=>b.type===ASSET_MARKER),unsigned={...b};delete unsigned.seal;
  if(!b||b.ownerAccountId!==user.accountId||b.seal!==assetHash(unsigned)||b.snapshotHash!==assetHash(b.snapshot)||hashText(v.contentMd)!==v.contentHash||v.contentMd!==renderAssetDraft(b.snapshot,b.notes,b.lineage)||assetHash(sourceShape(v.sources))!==assetHash(sourceShape(b.nativeSources)))fail('ASSET_CONTEXT_INVALID','候选正文、事实或来源完整性校验失败');
  return{a,v,b};
 }
 async function state(tx,user,asset,context){
  if(context.report?.sourceStatus==='restricted'||context.live.status==='restricted')return'restricted';
  for(const source of asset.b.snapshot.facts.sources){const chunk=await tx.knowledgeChunk.findUnique({where:{id:source.chunkId},select:{reviewed:true}});if(chunk&&chunk.reviewed!==true)return'restricted';}
  const{b}=asset;let status=context.report?.sourceStatus==='current'&&context.report.version===b.snapshot.report.version&&hashText(context.report.contentMd)===b.snapshot.report.contentHash?'current':'stale';
  for(const parent of b.lineage){const ancestor=await load(tx,user,parent.id,parent.version);if(ancestor.b.planId!==b.planId||ancestor.b.runId!==b.runId||ancestor.b.snapshotHash!==b.snapshotHash||ancestor.v.contentHash!==parent.contentHash)fail('ASSET_LINEAGE_INVALID','派生来源与固定父版本不一致');if(ancestor.a.currentVersionNo!==parent.version)status='stale';}
  return status;
 }
 async function view(tx,user,asset,context){
  const sourceStatus=await state(tx,user,asset,context),{a,v,b}=asset;
  if(sourceStatus==='restricted')return{id:a.id,status:'restricted',sourceStatus,message:'来源撤审或访问失效，候选正文、数值、快照和说明不再交付。'};
  return{id:a.id,title:a.title,status:a.status,typeKey,version:v.versionNo,currentVersion:a.currentVersionNo,sourceStatus,canEdit:sourceStatus==='current'&&v.versionNo===a.currentVersionNo,contentMd:v.contentMd,contentHash:v.contentHash,notes:b.notes,snapshot:b.snapshot,snapshotHash:b.snapshotHash,lineage:b.lineage,planId:b.planId,runId:b.runId,sourceRows:v.sources.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,sourceVersion:s.sourceVersion,hash:s.hash})),versions:await tx.researchArtifactVersion.findMany({where:{artifactId:a.id},select:{versionNo:true,createdAt:true,changeSummary:true},orderBy:{versionNo:'desc'},take:30})};
 }
 function current(asset,context,status){context.ready();if(!context.report||status!=='current'||asset.v.versionNo!==asset.a.currentVersionNo)fail('ASSET_SOURCE_CHANGED','报告、来源或派生父版本已经变化，请核对原版本；不能自动重绑');}
 async function checked(user,assetId,no,permission,cb){return withScope(user,permission,async tx=>{const asset=await load(tx,user,assetId,no),context=await inReport(tx,user,asset.b.planId,asset.b.runId);return cb(tx,asset,context);});}
 async function persist(tx,user,key,requestHash,b,title){
  if(await tx.researchArtifact.count({where:scope(user)})>=100)fail('ASSET_COUNT_LIMIT','本轮本人候选最多100份');
  const artifactId=await service(tx).createWithSourcesInTx(user,{title,typeKey,idempotencyKey:key,creationRequestHash:requestHash,contentMd:renderAssetDraft(b.snapshot,b.notes,b.lineage),contentBlocks:[seal(b)]},b.nativeSources,user.accountId,tx);return{id:artifactId};
 }
 async function create(user,p,r,input){
  exact(input,['requestKey','reportVersionNo']);version(input.reportVersionNo);
  return withScope(user,'artifact.create',async tx=>{const context=await inReport(tx,user,id(p),id(r));context.ready();if(!context.report||context.report.version!==input.reportVersionNo)fail('ASSET_REPORT_CHANGED','请先保存并核对当前报告版本');
   const requestHash=assetHash({operation:'create',planId:p,runId:r,reportVersionNo:input.reportVersionNo});await receipt(tx,user,input.requestKey,requestHash);const key=prefix+user.accountId+':report:'+context.report.id+':'+input.reportVersionNo;let a=await tx.researchArtifact.findFirst({where:{...scope(user),idempotencyKey:key}});
   if(!a){const snapshot=buildAssetSnapshot(context.report,context.live),nativeSources=[...sourceShape(context.native.v.sources),{sourceType:'data_snapshot',sourceId:context.native.v.id,sourceVersion:String(input.reportVersionNo),snapshot:{kind:'research_report_version',reportId:context.report.id,contentHash:snapshot.report.contentHash,factsHash:snapshot.report.factsHash}}],b={type:ASSET_MARKER,ownerAccountId:user.accountId,planId:p,runId:r,snapshot,snapshotHash:assetHash(snapshot),nativeSources,lineage:[],notes:'',operations:[]};a=await persist(tx,user,key,assetHash({report:context.report.id,version:input.reportVersionNo}),b,'可复用科研资产候选草稿');}
   await receipt(tx,user,input.requestKey,requestHash,a.id);return view(tx,user,await load(tx,user,a.id),context);
  });
 }
 const read=(user,a,no)=>checked(user,a,no,'artifact.read',(tx,asset,context)=>view(tx,user,asset,context));
 async function save(user,a,input){
  exact(input,['requestKey','baseVersionNo','notes']);version(input.baseVersionNo);if(!validateAssetNotes(input.notes).valid)invalid();
  return checked(user,a,null,'artifact.edit',async(tx,asset,context)=>{current(asset,context,await state(tx,user,asset,context));const requestHash=assetHash(input),receiptHash=assetHash({operation:'notes',assetId:a,input}),previous=await receipt(tx,user,input.requestKey,receiptHash),op=asset.b.operations.find(o=>o.key===input.requestKey);if(previous)return view(tx,user,asset,context);if(op){if(op.hash!==requestHash)fail('ASSET_KEY_CONFLICT','幂等标识已用于其他修改');await receipt(tx,user,input.requestKey,receiptHash,a);return view(tx,user,asset,context);}
   if(asset.a.currentVersionNo!==input.baseVersionNo)fail('ASSET_VERSION_CONFLICT','资产候选已有新版本，保留当前输入，请刷新核对');if(asset.b.notes===input.notes){await receipt(tx,user,input.requestKey,receiptHash,a);return view(tx,user,asset,context);}if(asset.a.currentVersionNo>=30)fail('ASSET_HISTORY_LIMIT','每份本轮候选最多30版');
   const b={...asset.b,notes:input.notes,operations:[...asset.b.operations,{key:input.requestKey,hash:requestHash}]};delete b.seal;await service(tx).createVersion(user,a,{baseVersionNo:input.baseVersionNo,contentMd:renderAssetDraft(b.snapshot,b.notes,b.lineage),contentBlocks:[seal(b)],changeSummary:'修订复用说明；机器事实与派生血缘未改'});await receipt(tx,user,input.requestKey,receiptHash,a);return view(tx,user,await load(tx,user,a),context);
  });
 }
 async function derive(user,a,input){
  exact(input,['requestKey','baseVersionNo']);version(input.baseVersionNo);
  return checked(user,a,null,'artifact.create',async(tx,parent,context)=>{current(parent,context,await state(tx,user,parent,context));if(parent.a.currentVersionNo!==input.baseVersionNo)fail('ASSET_VERSION_CONFLICT','父候选已有新版本，请核对后派生');
   const key=prefix+user.accountId+':derive:'+input.requestKey,requestHash=assetHash({parentId:a,baseVersionNo:input.baseVersionNo}),receiptHash=assetHash({operation:'derive',parentId:a,input});await receipt(tx,user,input.requestKey,receiptHash);let child=await tx.researchArtifact.findFirst({where:{...scope(user),idempotencyKey:key}});if(child&&child.creationRequestHash!==requestHash)fail('ASSET_KEY_CONFLICT','派生标识已用于另一父候选或版本');
   if(!child){let lineage;try{lineage=deriveAssetLineage({id:a,version:parent.v.versionNo,currentVersion:parent.a.currentVersionNo,contentHash:parent.v.contentHash,notes:parent.b.notes,lineage:parent.b.lineage});}catch{fail('ASSET_DERIVATION_LIMIT','本轮最多8层派生');}const b={...parent.b,lineage,notes:'',operations:[],nativeSources:[...sourceShape(parent.v.sources),{sourceType:'data_snapshot',sourceId:parent.v.id,sourceVersion:String(parent.v.versionNo),snapshot:{kind:'research_asset_draft_version',assetId:a,contentHash:parent.v.contentHash}}]};delete b.seal;child=await persist(tx,user,key,requestHash,b,'派生科研资产候选草稿');}
   await receipt(tx,user,input.requestKey,receiptHash,child.id);return view(tx,user,await load(tx,user,child.id),context);
  });
 }
 async function list(user,query){
  if(Object.keys(query).some(k=>!['limit','before'].includes(k)))invalid();const limit=Number(query.limit??20);if(!Number.isSafeInteger(limit)||limit<1||limit>20)invalid();if(query.before)id(query.before);
  return withScope(user,'artifact.read',async tx=>{if(query.before&&!await tx.researchArtifact.findFirst({where:{...scope(user),id:query.before}}))deny();const rows=await tx.researchArtifact.findMany({where:scope(user),orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,...(query.before?{cursor:{id:query.before},skip:1}:{})}),items=[];for(const row of rows.slice(0,limit)){const asset=await load(tx,user,row.id),context=await inReport(tx,user,asset.b.planId,asset.b.runId),v=await view(tx,user,asset,context);items.push({id:v.id,title:v.title,status:v.status,sourceStatus:v.sourceStatus,version:v.version,reportId:v.snapshot?.report.id,reportVersion:v.snapshot?.report.version,depth:v.lineage?.length});}return{items,nextCursor:rows.length>limit?rows[limit-1].id:null};});
 }
 class AssetController{list(req,q){return list(req.user,q);}read(req,a){return read(req.user,a);}history(req,a,no){if(!/^[1-9][0-9]?$/.test(no))invalid();return read(req.user,a,Number(no));}save(req,a,input){return save(req.user,a,input);}derive(req,a,input){return derive(req.user,a,input);}}
 Controller('research-asset-drafts')(AssetController);RequireStudyGroup()(AssetController);RequireResearchProject()(AssetController);RequireStudyGroupMenu('artifacts')(AssetController);RequireStudyGroupPermission('artifact.read')(AssetController);
 for(const[method,verb,path]of[['list',Get,''],['read',Get,':id'],['history',Get,':id/versions/:versionNo'],['save',Post,':id/versions'],['derive',Post,':id/derivations']]){verb(path)(AssetController.prototype,method,Object.getOwnPropertyDescriptor(AssetController.prototype,method));Req()(AssetController.prototype,method,0);if(method==='list')Query()(AssetController.prototype,method,1);else{Param('id')(AssetController.prototype,method,1);if(method==='history')Param('versionNo')(AssetController.prototype,method,2);if(['save','derive'].includes(method))Body()(AssetController.prototype,method,2);}}
 return{Controller:AssetController,create};
}
