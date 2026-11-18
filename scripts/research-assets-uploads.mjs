import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,lstatSync,renameSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {join,extname,isAbsolute} from 'node:path';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
const MAX_BYTES=5*1024*1024,DAY=86400000;
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const same=(a,b)=>['tenantId','studyGroupId','researchProjectId','accountId'].every(k=>a[k]===b[k]);
const fail=(code='UPLOAD_INVALID',status=409,message='暂存文件当前无法核对，请保留输入并重新读取。')=>{throw catalogError(code,status,message);};

/** All calls run under the existing tenant authorization transaction lock.
 * Local private manifest only; no fifth table, KB import, background cleanup or model.
 */
export function createAssetUploadStore({directory,ids,inspectFile,storage,storageEndpoint='http://127.0.0.1:19402',now=()=>Date.now()}){
 if(!isAbsolute(directory)||typeof inspectFile!=='function'||storageEndpoint!=='http://127.0.0.1:19402')throw new TypeError('Named local storage and existing file inspection required');
 const manifestFile=join(directory,'uploads.json');
 const actor=p=>{if(p.tenantId!==ids.tenant||p.studyGroupId!==ids.group||p.researchProjectId!==ids.project||![ids.owner,ids.admin].includes(p.accountId)||!Number.isSafeInteger(p.authVersion)||p.authVersion<0)fail('UPLOAD_FORBIDDEN',403);};
 function ensure(){
  if(!existsSync(directory))mkdirSync(directory,{recursive:true,mode:0o700});
  const entry=lstatSync(directory);if(!entry.isDirectory()||entry.isSymbolicLink())fail();
  if(!existsSync(manifestFile))writeFileSync(manifestFile,JSON.stringify({schemaVersion:'rh-asset-uploads.v1',ids,items:[]}),{flag:'wx',mode:0o600});
 }
 function read(){
  ensure();let m;try{m=JSON.parse(readFileSync(manifestFile,'utf8'));}catch{fail();}
  if(m.schemaVersion!=='rh-asset-uploads.v1'||!['tenant','group','project','owner','admin'].every(k=>m.ids?.[k]===ids[k])||!Array.isArray(m.items)||m.items.length>4||new Set(m.items.map(x=>x.uploadId)).size!==m.items.length||m.items.reduce((n,x)=>n+x.sizeBytes,0)>20*1024*1024)fail();
  for(const x of m.items)if(!valid(x.uploadId)||!valid(x.uploadRequestKey)||x.tenantId!==ids.tenant||x.studyGroupId!==ids.group||x.researchProjectId!==ids.project||![ids.owner,ids.admin].includes(x.accountId)||!Number.isSafeInteger(x.authVersion)||!Number.isSafeInteger(x.sizeBytes)||x.sizeBytes<1||x.sizeBytes>MAX_BYTES||!/^[a-f0-9]{64}$/.test(x.sha256)||!['staging','pending','binding','bound'].includes(x.status)||!['primary','local_fallback',null].includes(x.storageMode)||!Number.isFinite(Date.parse(x.expiresAt))||!Number.isFinite(Date.parse(x.createdAt))||Date.parse(x.expiresAt)-Date.parse(x.createdAt)!==DAY)fail();
  return m;
 }
 function write(m){
  const temporary=join(directory,'manifest-'+randomUUID()+'.tmp');const fd=openSync(temporary,'wx',0o600);
  try{writeFileSync(fd,JSON.stringify(m,null,2));fsyncSync(fd);}finally{closeSync(fd);}renameSync(temporary,manifestFile);
 }
 function inspect(file){
  if(!file||!Buffer.isBuffer(file.buffer)||!['.txt','.md'].includes(extname(file.originalname??'').toLowerCase())||file.buffer.length<1||file.buffer.length>MAX_BYTES)fail('UPLOAD_INVALID',422,'仅支持不超过5MiB的TXT或Markdown合成文件。');
  let content;try{content=new TextDecoder('utf-8',{fatal:true}).decode(file.buffer);}catch{fail('UPLOAD_INVALID',422,'文件须为有效UTF-8文本。');}
  if(!content.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content))fail('UPLOAD_INVALID',422,'文件包含无效文本内容。');
  const checked=inspectFile({filename:file.originalname,declaredMimetype:file.mimetype||undefined,buffer:file.buffer,size:file.buffer.length});
  if(checked.sha256!==assetDigest(file.buffer)||!['txt','md'].includes(checked.extension))fail();return checked;
 }
 const present=x=>({uploadId:x.uploadId,filename:x.filename,sha256:x.sha256,sizeBytes:x.sizeBytes,status:x.status,expiresAt:x.expiresAt,storageMode:x.storageMode});
 function owned(m,p,id){const x=m.items.find(x=>x.uploadId===id&&same(x,p));if(!x)fail('UPLOAD_NOT_FOUND',404,'未找到当前账号可登记的暂存文件。');if(x.authVersion!==p.authVersion)fail();return x;}
 function targetMatches(a,b){return a&&b&&['assetId','version','requestKey','requestHash'].every(k=>a[k]===b[k]);}
 async function bytes(x){
  let buffer;
  try{buffer=x.storageMode==='primary'?await storage.getBuffer(x.storageKey,MAX_BYTES):readFileSync(join(directory,x.uploadId+'.content'));}catch{fail('UPLOAD_UNAVAILABLE',503,'暂存文件暂时无法读取，请保留输入后重试。');}
  if(!Buffer.isBuffer(buffer)||buffer.length!==x.sizeBytes||assetDigest(buffer)!==x.sha256)fail();return buffer;
 }
 return{
  async stage(p,file,requestKey){
   actor(p);if(!valid(requestKey)||requestKey.length<8)fail('INPUT_INVALID',400);const checked=inspect(file),m=read();
   let item=m.items.find(x=>same(x,p)&&x.uploadRequestKey===requestKey);
   if(item){if(item.sha256!==checked.sha256||item.authVersion!==p.authVersion)fail('REQUEST_KEY_CONFLICT');if(item.status!=='bound'&&Date.parse(item.expiresAt)<=now())fail('UPLOAD_EXPIRED');if(item.status!=='staging')return present(item);}
   else{
    if(m.items.length>=4||m.items.reduce((n,x)=>n+x.sizeBytes,0)+file.buffer.length>20*1024*1024)fail('FIXTURE_CAPACITY',409,'已达到当前可用文件上限，请先核对已有暂存记录。');
    const uploadId='rh-upload-'+randomUUID(),created=now(),stamp=new Date(created).toISOString();
    item={uploadId,...Object.fromEntries(['tenantId','studyGroupId','researchProjectId','accountId','authVersion'].map(k=>[k,p[k]])),uploadRequestKey:requestKey,filename:'asset_'+checked.sha256.slice(0,16)+'.'+checked.extension,sha256:checked.sha256,sizeBytes:file.buffer.length,mimeType:checked.contentType,createdAt:stamp,expiresAt:new Date(created+DAY).toISOString(),status:'staging',storageMode:null,storageKey:p.tenantId+'/hub-assets/'+uploadId+'.'+checked.extension};
    m.items.push(item);write(m);
   }
   try{if(!storage?.available)throw new Error('local storage unavailable');await storage.put(item.storageKey,file.buffer,item.mimeType);item.storageMode='primary';}
   catch{const path=join(directory,item.uploadId+'.content');if(existsSync(path)){if(assetDigest(readFileSync(path))!==item.sha256)fail();}else writeFileSync(path,file.buffer,{flag:'wx',mode:0o600});item.storageMode='local_fallback';}
   item.status='pending';write(m);return present(item);
  },
  async resolve(p,id,target){
   actor(p);const m=read(),item=owned(m,p,id);if(item.status==='staging'||item.status!=='bound'&&Date.parse(item.expiresAt)<=now())fail('UPLOAD_EXPIRED',409,'暂存文件已到期或尚未完成，请核对后重新选择。');
   if(item.binding&&target&&!targetMatches(item.binding,target))fail('UPLOAD_ALREADY_BOUND',409,'此文件已属于另一次登记，请先核对原结果。');
   const buffer=await bytes(item);return{...item,contentMd:new TextDecoder('utf-8',{fatal:true}).decode(buffer)};
  },
  async prepareBinding(p,id,target){
   actor(p);if(!valid(target?.assetId)||!Number.isSafeInteger(target.version)||target.version<1||target.version>8||!valid(target.requestKey)||!/^[a-f0-9]{64}$/.test(target.requestHash??''))fail('INPUT_INVALID',400);
   const m=read(),item=owned(m,p,id);if(item.status==='staging'||item.status!=='bound'&&Date.parse(item.expiresAt)<=now())fail('UPLOAD_EXPIRED');
   if(item.binding&&!targetMatches(item.binding,target))fail('UPLOAD_ALREADY_BOUND',409,'此文件已属于另一次登记，请先核对原结果。');
   if(!item.binding){item.binding={...target};item.status='binding';write(m);}return present(item);
  },
  async confirmBinding(p,id,receipt,target){
   actor(p);const m=read(),item=owned(m,p,id);if(!targetMatches(item.binding,target)||receipt?.assetId!==target.assetId||receipt.version!==target.version||receipt.status!=='committed')fail();
   item.status='bound';write(m);return present(item);
  },
  async releaseUncommittedBinding(p,id,target){
   actor(p);const m=read(),item=owned(m,p,id);if(item.status!=='binding'||!targetMatches(item.binding,target))fail();
   // Called only after the binding adapter proves no committed event or content/file parent under the tenant lock.
   delete item.binding;item.status='pending';write(m);return present(item);
  },
  async verifyBound(p,id,target){
   actor(p);const item=read().items.find(x=>x.uploadId===id&&x.tenantId===p.tenantId&&x.studyGroupId===p.studyGroupId&&x.researchProjectId===p.researchProjectId);
   if(!item||!['binding','bound'].includes(item.status)||!targetMatches(item.binding,target))return false;
   await bytes(item);return true;
  },
  inspect:read
 };
}
