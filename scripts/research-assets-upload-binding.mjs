import {randomUUID} from 'node:crypto';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {findCatalogOperation} from './local-research-assets-registration.mjs';
const fail=()=>{throw catalogError('UPLOAD_ALREADY_BOUND',409,'此文件已属于另一次登记，请先核对原结果。');};
const storageKey=item=>item.storageMode==='local_fallback'?'hub-local-fallback:'+item.uploadId:item.storageKey;
export function createAssetUploadBinding({ids,store,withAccess,now=()=>Date.now()}){
 if(!store||typeof withAccess!=='function')throw new TypeError('Bound private upload store required');
 const api={
  list:p=>store.inspect().items.filter(x=>x.tenantId===p.tenantId&&x.studyGroupId===p.studyGroupId&&x.researchProjectId===p.researchProjectId&&x.accountId===p.accountId&&x.authVersion===p.authVersion&&['pending','binding','staging'].includes(x.status)&&Date.parse(x.expiresAt)>now()).map(x=>({uploadId:x.uploadId,filename:x.filename,sizeBytes:x.sizeBytes,sha256:x.sha256,status:x.status,...(x.binding?{assetId:x.binding.assetId,version:x.binding.version,operationKey:x.binding.requestKey}:{})})),
  stage:(user,file,key)=>withAccess(user,'artifact.create',(_tx,p)=>store.stage(p,file,key)),
  async resolve(_tx,p,value,context){
   const item=await store.resolve(p,value.uploadId),assetId=context.assetId??item.binding?.assetId??'rh-asset-'+randomUUID();
   const target={assetId,version:context.version,requestKey:value.requestKey,requestHash:context.requestHash};
   if(item.binding&&Object.keys(target).some(k=>item.binding[k]!==target[k]))fail();
   return{...value,contentMd:item.contentMd,sourceBindings:[{kind:'upload',id:item.uploadId,version:1,contentHash:item.sha256}],reservedAssetId:assetId,uploadBinding:{uploadId:item.uploadId,target},file:{storageKey:storageKey(item),filename:item.filename,mimeType:item.mimeType,sizeBytes:item.sizeBytes,sha256:item.sha256}};
  },
  prepare:(_tx,p,full)=>store.prepareBinding(p,full.uploadBinding.uploadId,full.uploadBinding.target),
  confirm:(user,full,receipt)=>withAccess(user,'artifact.read',async(tx,p)=>{
   const {uploadId,target}=full.uploadBinding,stored=await findCatalogOperation(tx,p,target.requestKey,target.requestHash);
   if(stored?.status!=='committed'||stored.assetId!==receipt.assetId||stored.version!==receipt.version)fail();
   return store.confirmBinding(p,uploadId,stored,target);
  }),
  async reconcile(tx,p,key,receipt){
   const matched=store.inspect().items.filter(x=>x.accountId===p.accountId&&x.authVersion===p.authVersion&&x.tenantId===p.tenantId&&x.studyGroupId===p.studyGroupId&&x.researchProjectId===p.researchProjectId&&x.binding?.requestKey===key);
   if(matched.length>1)fail();const item=matched[0];if(!item){if(receipt?.uploadId)fail();return receipt;}
   const target=item.binding,stored=await findCatalogOperation(tx,p,key,target.requestHash);
   if(stored){
    if(!receipt||receipt.assetId!==stored.assetId||receipt.version!==stored.version||receipt.uploadId!==item.uploadId||!await api.assertSources(tx,p,{assetId:target.assetId,version:target.version,sourceKind:'upload',sourceBindings:[{kind:'upload',id:item.uploadId,version:1,contentHash:item.sha256}]}))fail();
    await store.confirmBinding(p,item.uploadId,stored,target);return{...receipt,attachmentStatus:'bound'};
   }
   if(receipt||item.status!=='binding')fail();
   const exactScope={tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId};
   const parent=await tx.researchArtifact.findFirst({where:{...exactScope,id:target.assetId},select:{id:true}}),file=await tx.researchArtifactFile.findFirst({where:{...exactScope,OR:[{artifactId:target.assetId},{storageKey:storageKey(item)}]},select:{id:true}});
   if(parent||file)fail();await store.releaseUncommittedBinding(p,item.uploadId,target);return null;
  },
  async assertSources(tx,p,policy){
   if(policy.sourceKind!=='upload'||policy.sourceBindings?.length!==1)return false;
   const b=policy.sourceBindings[0],item=store.inspect().items.find(x=>x.uploadId===b.id);
   if(b.kind!=='upload'||b.version!==1||!item||!['binding','bound'].includes(item.status)||!item.binding||item.binding.assetId!==policy.assetId||item.binding.version>policy.version||item.sha256!==b.contentHash||item.tenantId!==p.tenantId||item.studyGroupId!==p.studyGroupId||item.researchProjectId!==p.researchProjectId||![ids.owner,ids.admin].includes(item.accountId))return false;
   // Verify the uploader's already committed event; this is not impersonation or a new grant.
   const receipt=await findCatalogOperation(tx,{...p,accountId:item.accountId},item.binding.requestKey,item.binding.requestHash);
   if(receipt?.assetId!==policy.assetId||receipt.version!==item.binding.version||receipt.status!=='committed')return false;
   const parent=await tx.researchArtifactVersion.findFirst({where:{artifactId:policy.assetId,versionNo:item.binding.version,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},select:{id:true}});
   if(!parent)return false;
   const file=await tx.researchArtifactFile.findFirst({where:{artifactId:policy.assetId,artifactVersionId:parent.id,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,storageKey:storageKey(item),sha256:item.sha256,sizeBytes:BigInt(item.sizeBytes)},select:{sha256:true}});
   return Boolean(file&&await store.verifyBound(p,item.uploadId,item.binding));
  }
 };return api;
}
