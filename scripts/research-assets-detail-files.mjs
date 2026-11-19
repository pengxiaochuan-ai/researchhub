import {Readable} from 'node:stream';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {buildA02Manifest} from './research-assets-a02-preflight-contract.mjs';
import {createAssetCatalogReader,loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {lockCatalogAsset,findCatalogOperation,appendCatalogEvent} from './local-research-assets-registration.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
const fail=(code='FILE_CONTEXT_CHANGED',status=409,message='文件或固定版本无法核对，请重新读取。')=>{throw catalogError(code,status,message);};
const ident=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export const detailFileId=key=>'rh-a02-file-'+assetDigest(key).slice(0,32);
export const detailFileStorageKey=(ids,slot)=>ids.tenant+'/hub-a02-files/'+detailFileId(slot.key)+'.'+slot.filename.split('.').at(-1);
export function assertFixedAssetFile(file,slot,parent){
 if(!file||!slot||file.artifactId!==parent.id||parent.version!==1||file.artifactVersionId!==parent.artifactVersionId||file.filename!==slot.filename||file.sha256!==slot.sha256||Number(file.sizeBytes)!==slot.byteLength||file.role!=='source_attachment'||!['text/plain; charset=utf-8','text/markdown; charset=utf-8'].includes(file.mimeType))fail('FILE_BINDING_INVALID');
 return file;
}
export function assertBusinessAssetFile(file,p,parent){
 const size=Number(file?.sizeBytes),ext=file?.filename?.split('.').at(-1);
 if(!file||!ident(file.id)||file.artifactId!==parent.id||file.artifactVersionId!==parent.artifactVersionId||['tenantId','studyGroupId','researchProjectId'].some(k=>file[k]!==p[k])||file.role!=='source_attachment'||!['md','txt'].includes(ext)||!Number.isSafeInteger(size)||size<1||size>5*1024*1024||!/^[a-f0-9]{64}$/.test(file.sha256??'')||file.filename!=='asset_'+file.sha256.slice(0,16)+'.'+ext||!(ext==='md'?['text/markdown','text/markdown; charset=utf-8']:['text/plain','text/plain; charset=utf-8']).includes(file.mimeType)||!new RegExp('^'+p.tenantId+'/hub-assets/rh-upload-[a-f0-9]{40}\\.'+ext+'$').test(file.storageKey??''))fail('FILE_BINDING_INVALID');
 return file;
}
export function assertAssetFileBytes(buffer,file,{maxBytes=1048576}={}){if(!Buffer.isBuffer(buffer)||buffer.length!==Number(file.sizeBytes)||buffer.length>maxBytes||assetDigest(buffer)!==file.sha256)fail('FILE_DIGEST_MISMATCH');return buffer;}
export function assetFileRange(parser,header,size){try{return parser(header,size);}catch{fail('RANGE_UNSATISFIABLE',416,'请求的文件范围无效，请重新下载完整文件。');}}
export async function openRecheckedAssetStream({open,recheck,signal}){
 let stream;const cancel=()=>stream?.destroy();
 try{if(signal?.aborted)fail('REQUEST_CANCELLED',499,'下载已取消。');stream=await open();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)fail('REQUEST_CANCELLED',499,'下载已取消。');await recheck();if(signal?.aborted||stream.destroyed)fail('REQUEST_CANCELLED',499,'下载已取消。');stream.once('close',()=>signal?.removeEventListener('abort',cancel));return stream;}
 catch(e){signal?.removeEventListener('abort',cancel);stream?.destroy();throw e;}
}
export function assetMarkdownInput(detail,policy){
 return{id:detail.id,title:detail.metadata.title,typeKey:'research_report',status:'draft',versionNo:detail.version,generatedAt:new Date(detail.createdAt),contentMd:detail.contentMd+'\n\n---\n\n## 固定版本与复用依据\n\n资产：'+detail.id+' · v'+detail.version+'\n\n许可依据：'+policy.rightsEvidence+'\n\n原始来源：'+(policy.sourceBindings.length?JSON.stringify(policy.sourceBindings):'作者原创整理，无外部来源绑定')+'\n\n此导出是固定版本的草稿材料；应用到新的研究前须重新核对研究条件，不代表已审批或产生新的科研结果。\n'};
}
export function createAssetDetailFiles({ids,withAccess,assertSources=async()=>false,storage,renderMarkdown,parseRange,now=()=>Date.now(),runtimeBusiness=false,loadRecords=loadCatalogRecords,exportEnabled=true}){
 const slots=()=>runtimeBusiness?[]:buildA02Manifest(ids).files;
 const maxBytes=runtimeBusiness?5*1024*1024:1048576;
 const readFixed=(tx,p,id,v)=>createAssetCatalogReader({withAccess:(_u,_perm,run)=>run(tx,p),assertSources,now,loadRecords}).detail({},id,v);
 async function current(tx,p,id,v,purpose=null,fileId=null){
  if(!ident(id)||(runtimeBusiness?!/^[1-9][0-9]*$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)>2147483647:!/^[1-8]$/.test(String(v))))fail('INPUT_INVALID',400);
  const record=(await loadRecords(tx,p,assertSources)).find(x=>x.registry.assetId===id);if(!record||record.family.family!==(runtimeBusiness?'business':'detail'))fail('NOT_FOUND',404);
  const detail=await readFixed(tx,p,id,Number(v));if(detail.bodyAccess!=='allowed')fail('FORBIDDEN',403,'请先取得本固定版本的正文阅读许可。');
  const [rights]=await tx.$queryRawUnsafe("SELECT rh_asset.detail_actor_can_use($1,$2::integer,'download') AS download,rh_asset.detail_actor_can_use($1,$2::integer,'export') AS export",id,Number(v));if(rights&&!exportEnabled)rights.export=false;if(purpose&&!rights?.[purpose])fail('FORBIDDEN',403,'当前没有本固定版本的'+(purpose==='download'?'文件下载':'Markdown导出')+'许可。');
  const policy=record.policies.find(x=>x.version===Number(v));let files=await tx.researchArtifactFile.findMany({where:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,artifactId:id,artifactVersionId:policy.artifactVersionId},orderBy:{id:'asc'},take:5});if(files.length>4)fail();
  files=files.map(f=>{if(runtimeBusiness)return assertBusinessAssetFile(f,p,{id,artifactVersionId:policy.artifactVersionId});const slot=slots().find(s=>s.assetKey===record.parent.idempotencyKey&&detailFileId(s.key)===f.id);assertFixedAssetFile(f,slot,{id,version:Number(v),artifactVersionId:policy.artifactVersionId});if(f.storageKey!==detailFileStorageKey(ids,slot))fail();return f;});
  const file=fileId?files.find(f=>f.id===fileId):null;if(fileId&&!file)fail('NOT_FOUND',404,'本固定版本未找到该附件。');
  const binding={id,version:Number(v),contentHash:policy.contentHash,policyHash:policy.policyHash,identityRevision:p.identityRevision,...(file?{fileId:file.id,sha256:file.sha256,storageKey:file.storageKey,size:Number(file.sizeBytes)}:{})};
  if(detail.bodyExpiresAt!=null&&Date.parse(detail.bodyExpiresAt)<=now())fail('FORBIDDEN',403,'正文许可已到期。');return{record,detail,policy,rights,files,file,binding};
 }
 async function recheck(user,id,v,purpose,fileId,expected){return withAccess(user,'artifact.read',async(tx,p)=>{const c=await current(tx,p,id,v,purpose,fileId);if(assetDigest(c.binding)!==assetDigest(expected))fail();});}
 async function authorize(user,id,v,purpose,fileId,requestKey,expected,range){
  if(!ident(requestKey)||requestKey.length<8)fail('INPUT_INVALID',400,'缺少原文件操作标识。');return withAccess(user,'artifact.read',async(tx,p)=>{
   await lockCatalogAsset(tx,p,id);const c=await current(tx,p,id,v,purpose,fileId);if(assetDigest(c.binding)!==assetDigest(expected))fail();
   const type=purpose==='download'?'file_accessed':'markdown_exported',requestHash=assetDigest({operation:type,actor:p.accountId,binding:c.binding,range:range??null}),old=await findCatalogOperation(tx,p,requestKey,requestHash);if(old)return old;
   if(!assetEventBudgetAllows(c.record,type,now()))fail('FIXTURE_CAPACITY',409,'当前可用文件操作数量已达上限。');
   const next={...c.record.registry,revision:c.record.registry.revision+1},n=await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=$1,updated_at=now() WHERE asset_id=$2 AND revision=$3',next.revision,id,c.record.registry.revision);if(n!==1)fail('VERSION_CONFLICT');
   const receipt={status:'committed',operation:type,assetId:id,version:Number(v),revision:next.revision,phase:'authorized'};
   await appendCatalogEvent(tx,p,{registry:next,version:Number(v),type,requestKey,requestHash,payload:{phase:'authorized',...(fileId?{fileId}:{}),contentHash:c.policy.contentHash,policyHash:c.policy.policyHash,range:range??null},receipt},{syntheticOnly:!runtimeBusiness});return receipt;
  });
 }
 return{
  async list(user,id,v){return withAccess(user,'artifact.read',async(tx,p)=>{const c=await current(tx,p,id,v);return{schemaVersion:'rh-asset-files.v1',id,version:Number(v),identityRevision:p.identityRevision,canExport:c.rights.export===true,items:c.files.map(f=>({id:f.id,filename:f.filename,sizeBytes:Number(f.sizeBytes),sha256:f.sha256,mimeType:runtimeBusiness?f.mimeType.split(';')[0]+'; charset=utf-8':f.mimeType,canDownload:c.rights.download===true}))};});},
  async bind(user,key){if(runtimeBusiness)fail('FORBIDDEN',403);return withAccess(user,'artifact.edit',async(tx,p)=>{
   const slot=slots().find(s=>s.key===key&&ids[s.actor]===p.accountId);if(!slot)fail('FORBIDDEN',403);const parent=await tx.researchArtifact.findFirst({where:{tenantId:p.tenantId,idempotencyKey:slot.assetKey,ownerAccountId:p.accountId}});if(!parent)fail('NOT_FOUND',404);await lockCatalogAsset(tx,p,parent.id);const c=await current(tx,p,parent.id,1),fileId=detailFileId(slot.key),stored=c.files.find(f=>f.id===fileId);if(stored)return{status:'already_bound',assetId:parent.id,version:1,fileId};
   if(!assetEventBudgetAllows(c.record,'attachment_bound',now()))fail('FIXTURE_CAPACITY');const storageKey=detailFileStorageKey(ids,slot),buffer=await storage.getBuffer(storageKey,1048576);assertAssetFileBytes(buffer,{sizeBytes:slot.byteLength,sha256:slot.sha256});
   const next={...c.record.registry,revision:c.record.registry.revision+1};await tx.researchArtifactFile.create({data:{id:fileId,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,artifactId:parent.id,artifactVersionId:c.policy.artifactVersionId,role:'source_attachment',storageKey,filename:slot.filename,mimeType:slot.filename.endsWith('.md')?'text/markdown; charset=utf-8':'text/plain; charset=utf-8',sizeBytes:BigInt(slot.byteLength),sha256:slot.sha256}});
   const n=await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=$1,updated_at=now() WHERE asset_id=$2 AND revision=$3',next.revision,parent.id,c.record.registry.revision);if(n!==1)fail();const requestKey='a02-file-bind-'+assetDigest(slot.key).slice(0,32),requestHash=assetDigest({key:slot.key,sha256:slot.sha256}),receipt={status:'committed',operation:'attachment_bound',assetId:parent.id,version:1,revision:next.revision,fileId};await appendCatalogEvent(tx,p,{registry:next,version:1,type:'attachment_bound',requestKey,requestHash,payload:{fileId,phase:'bound'},receipt});return receipt;
  });},
  async content(user,id,v,{fileId=null,markdown=false,range,requestKey,head=false,signal}={}){
   const purpose=markdown?'export':'download';if(!markdown&&!ident(fileId)||markdown&&fileId)fail('INPUT_INVALID',400);let c=await withAccess(user,'artifact.read',(tx,p)=>current(tx,p,id,v,purpose,fileId));
   let buffer,filename,mimeType;
   if(markdown){const rendered=await renderMarkdown(assetMarkdownInput(c.detail,c.policy));if(rendered.extension!=='md'||!Buffer.isBuffer(rendered.buffer)||rendered.buffer.length>maxBytes)fail('EXPORT_INVALID');buffer=rendered.buffer;filename='asset-'+id+'-v'+Number(v)+'.md';mimeType='text/markdown; charset=utf-8';}
   else{buffer=assertAssetFileBytes(await storage.getBuffer(c.file.storageKey,maxBytes),c.file,{maxBytes});filename=c.file.filename;mimeType=runtimeBusiness?c.file.mimeType.split(';')[0]+'; charset=utf-8':c.file.mimeType;}
   const selected=assetFileRange(parseRange,range,buffer.length),start=selected?.start??0,end=selected?.end??buffer.length-1,length=selected?.length??buffer.length;
   if(signal?.aborted)fail('REQUEST_CANCELLED',499,'下载已取消。');if(!head)await authorize(user,id,v,purpose,fileId,requestKey,c.binding,selected);
   const options={filename,mimeType,size:buffer.length,start,end,length,partial:Boolean(selected),sha256:assetDigest(buffer)};
   if(head){await recheck(user,id,v,purpose,fileId,c.binding);return options;}
   const stream=await openRecheckedAssetStream({open:async()=>Readable.from([buffer.subarray(start,end+1)]),recheck:()=>recheck(user,id,v,purpose,fileId,c.binding),signal});return{...options,stream};
  }
 };
}
