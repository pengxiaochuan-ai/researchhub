import {randomUUID} from 'node:crypto';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {findCatalogOperation} from '../../scripts/local-research-assets-registration.mjs';
const MAX=5*1024*1024,DAY=86400000;
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fields=['tenantId','studyGroupId','researchProjectId','accountId'];
const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
const fail=(code='UPLOAD_INVALID',status=409)=>{throw catalogError(code,status,'暂存文件或登记状态无法核对；请保留文件及输入，先核对原保存结果。');};
const missing=e=>['NoSuchKey','NotFound','NoSuchObject'].includes(e?.code);
const same=(a,b)=>a&&b&&['assetId','version','requestKey','requestHash'].every(k=>a[k]===b[k]);
export function createBusinessAssetUploads({withAccess,storage,inspectFile,now=Date.now}){
 const itemKey=(p,id)=>p.tenantId+'/hub-assets/metadata/'+id+'.json';
 const indexKey=p=>p.tenantId+'/hub-assets/pending/'+assetDigest(fields.map(k=>p[k]))+'.json';
 async function json(key,fallback){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await storage.getBuffer(key,262144)));}catch(e){if(missing(e))return fallback;fail('UPLOAD_UNAVAILABLE',503);}}
 const write=(key,value)=>storage.put(key,Buffer.from(JSON.stringify(value)),'application/json');
 function identity(p){if(fields.some(k=>!valid(p[k]))||!Number.isSafeInteger(p.authVersion)||p.authVersion<0)fail('UPLOAD_FORBIDDEN',403);}
 async function item(p,id,{optional=false,historical=false}={}){
  identity(p);if(!valid(id))fail('INPUT_INVALID',400);const v=await json(itemKey(p,id),null);if(!v){if(optional)return null;fail('UPLOAD_NOT_FOUND',404);}
  if(v.uploadId!==id||fields.some(k=>v[k]!==p[k])||!historical&&v.authVersion!==p.authVersion||!['staging','pending','binding','bound'].includes(v.status)||!Number.isSafeInteger(v.sizeBytes)||v.sizeBytes<1||v.sizeBytes>MAX||!/^[a-f0-9]{64}$/.test(v.sha256??'')||!['md','txt'].includes(v.extension)||v.filename!=='asset_'+v.sha256.slice(0,16)+'.'+v.extension||v.storageKey!==p.tenantId+'/hub-assets/'+v.uploadId+'.'+v.extension||Date.parse(v.expiresAt)-Date.parse(v.createdAt)!==DAY)fail();
  return v;
 }
 async function index(p){identity(p);const value=await json(indexKey(p),[]);if(!Array.isArray(value)||value.length>4||value.some(x=>!valid(x))||new Set(value).size!==value.length)fail();return value;}
 async function pending(p){const ids=await index(p),items=[];for(const id of ids){const v=await item(p,id,{historical:true});if(v.authVersion===p.authVersion&&v.status!=='bound'&&Date.parse(v.expiresAt)>now())items.push(v);}return items;}
 const present=v=>({uploadId:v.uploadId,filename:v.filename,sha256:v.sha256,sizeBytes:v.sizeBytes,status:v.status,expiresAt:v.expiresAt,storageMode:'primary',...(v.binding?{assetId:v.binding.assetId,version:v.binding.version,operationKey:v.binding.requestKey}:{})});
 async function bytes(v){let buffer;try{buffer=await storage.getBuffer(v.storageKey,MAX);}catch{fail('UPLOAD_UNAVAILABLE',503);}if(!Buffer.isBuffer(buffer)||buffer.length!==v.sizeBytes||assetDigest(buffer)!==v.sha256)fail();return buffer;}
 async function bound(tx,p,v,receipt){
  const target=v.binding;if(!target||receipt?.assetId!==target.assetId||receipt.version!==target.version||receipt.uploadId!==v.uploadId||receipt.status!=='committed')fail();
  const fixed=await tx.researchArtifactVersion.findFirst({where:{...scope(p),artifactId:target.assetId,versionNo:target.version},select:{id:true,contentMd:true,contentHash:true}});
  const file=fixed&&await tx.researchArtifactFile.findFirst({where:{...scope(p),artifactId:target.assetId,artifactVersionId:fixed.id,role:'source_attachment',storageKey:v.storageKey,filename:v.filename,sha256:v.sha256,sizeBytes:BigInt(v.sizeBytes),mimeType:v.mimeType}});
  if(!file||fixed.contentHash!==v.sha256||assetDigest(fixed.contentMd)!==v.sha256)fail();await bytes(v);
  await write(itemKey(p,v.uploadId),{...v,status:'bound'});await write(indexKey(p),(await index(p)).filter(id=>id!==v.uploadId));return{...receipt,attachmentStatus:'bound'};
 }
 const api={
  list:async p=>(await pending(p)).map(present),
  stage:(user,file,requestKey)=>withAccess(user,'artifact.create',async(_tx,p)=>{
   identity(p);if(!valid(requestKey)||requestKey.length<8||!file||!Buffer.isBuffer(file.buffer)||file.buffer.length<1||file.buffer.length>MAX||!/^.+\.(md|txt)$/i.test(file.originalname??''))fail('INPUT_INVALID',422);
   let md;try{md=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(file.buffer);}catch{fail('UPLOAD_INVALID',422);}if(!md.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(md))fail('UPLOAD_INVALID',422);
   const checked=inspectFile({filename:file.originalname,declaredMimetype:file.mimetype||undefined,buffer:file.buffer,size:file.buffer.length}),sha256=assetDigest(file.buffer);if(checked.sha256!==sha256||!['md','txt'].includes(checked.extension))fail();
   const uploadId='rh-upload-'+assetDigest({...scope(p),accountId:p.accountId,authVersion:p.authVersion,requestKey}).slice(0,40);let v=await item(p,uploadId,{optional:true});
   if(v&&(v.sha256!==sha256||v.extension!==checked.extension))fail('REQUEST_KEY_CONFLICT');
   if(v?.status==='bound')return present(v);if(v&&Date.parse(v.expiresAt)<=now())fail('UPLOAD_EXPIRED');
   const current=await pending(p),ids=current.map(v=>v.uploadId);if(!ids.includes(uploadId)&&ids.length>=4)fail('UPLOAD_CAPACITY',409);
   if(!v){const createdAt=new Date(now()).toISOString();v={...Object.fromEntries([...fields,'authVersion'].map(k=>[k,p[k]])),uploadId,uploadRequestKey:requestKey,filename:'asset_'+sha256.slice(0,16)+'.'+checked.extension,extension:checked.extension,sha256,sizeBytes:file.buffer.length,mimeType:checked.contentType,createdAt,expiresAt:new Date(now()+DAY).toISOString(),status:'staging',storageKey:p.tenantId+'/hub-assets/'+uploadId+'.'+checked.extension};await write(itemKey(p,uploadId),v);}
   if(!ids.includes(uploadId))ids.push(uploadId);await write(indexKey(p),ids);
   if(v.status==='staging'){await storage.put(v.storageKey,file.buffer,v.mimeType);v={...v,status:'pending'};await write(itemKey(p,uploadId),v);}return present(v);
  }),
  async resolve(_tx,p,value,context){
   const v=await item(p,value.uploadId);if(!['pending','binding','bound'].includes(v.status)||v.status!=='bound'&&Date.parse(v.expiresAt)<=now())fail('UPLOAD_EXPIRED');
   const assetId=context.assetId??v.binding?.assetId??'rhab-'+randomUUID(),target={assetId,version:context.version,requestKey:value.requestKey,requestHash:context.requestHash};if(v.binding&&!same(v.binding,target))fail('UPLOAD_ALREADY_BOUND');
   const buffer=await bytes(v);return{...value,contentMd:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(buffer),sourceBindings:[{kind:'upload',id:v.uploadId,version:1,contentHash:v.sha256}],reservedAssetId:assetId,uploadBinding:{uploadId:v.uploadId,target},file:{storageKey:v.storageKey,filename:v.filename,mimeType:v.mimeType,sizeBytes:v.sizeBytes,sha256:v.sha256}};
  },
  async prepare(_tx,p,full){const v=await item(p,full.uploadBinding.uploadId),target=full.uploadBinding.target;if(v.binding&&!same(v.binding,target))fail('UPLOAD_ALREADY_BOUND');if(!v.binding){if(Date.parse(v.expiresAt)<=now()||v.status!=='pending')fail();await write(itemKey(p,v.uploadId),{...v,status:'binding',binding:target});}},
  async reconcile(tx,p,key,receipt){
   let v;if(receipt?.uploadId)v=await item(p,receipt.uploadId);else{const matches=(await pending(p)).filter(v=>v.binding?.requestKey===key);if(matches.length>1)fail();v=matches[0];}
   if(!v)return receipt;const target=v.binding;if(!target)fail();const stored=await findCatalogOperation(tx,p,key,target.requestHash);
   if(stored)return bound(tx,p,v,stored);
   if(receipt||v.status!=='binding')fail();
   const parent=await tx.researchArtifact.findFirst({where:{...scope(p),id:target.assetId},select:{id:true,currentVersionNo:true,typeKey:true,status:true,deletedAt:true}});
   const fixed=await tx.researchArtifactVersion.findFirst({where:{...scope(p),artifactId:target.assetId,versionNo:target.version},select:{id:true}}),file=await tx.researchArtifactFile.findFirst({where:{...scope(p),storageKey:v.storageKey},select:{id:true}});
   // A revision's parent predates this attempt. Only the exact attempted new
   // fixed version/file indicates a partial commit; the unchanged base is safe.
   const parentUnchanged=target.version===1?!parent:parent?.currentVersionNo===target.version-1&&parent.typeKey==='research_report'&&parent.status==='draft'&&!parent.deletedAt;
   if(!parentUnchanged||fixed||file)fail();const {binding,...rest}=v;await write(itemKey(p,v.uploadId),{...rest,status:'pending'});return null;
  },
  async assertSources(tx,p,policy){
   const b=policy.sourceBindings?.[0];if(policy.sourceKind!=='upload'||!Array.isArray(policy.sourceBindings)||policy.sourceBindings.length!==1||b?.kind!=='upload'||b.version!==1||!valid(b.id)||!valid(policy.assetId))return false;
   const fixed=await tx.researchArtifactVersion.findFirst({where:{...scope(p),artifactId:policy.assetId,versionNo:policy.version},select:{id:true,contentHash:true,contentMd:true}});if(!fixed||fixed.contentHash!==b.contentHash||assetDigest(fixed.contentMd)!==b.contentHash)return false;
   const file=await tx.researchArtifactFile.findFirst({where:{...scope(p),artifactId:policy.assetId,artifactVersionId:fixed.id,role:'source_attachment',sha256:b.contentHash}});if(!file||!['md','txt'].includes(file.filename.split('.').at(-1))||file.storageKey!==p.tenantId+'/hub-assets/'+b.id+'.'+file.filename.split('.').at(-1)||Number(file.sizeBytes)<1||Number(file.sizeBytes)>MAX)return false;
   const buffer=await bytes({storageKey:file.storageKey,sha256:file.sha256,sizeBytes:Number(file.sizeBytes)});return assetDigest(buffer)===b.contentHash;
  }
 };
 return api;
}
