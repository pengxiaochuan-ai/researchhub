export function pmcStorageKey(tenantId,asset){
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(tenantId??'')||!/^objects\/[a-f0-9]{64}$/.test(asset?.localObjectKey??'')||
   asset.localObjectKey.slice(8)!==asset.sha256||!Number.isSafeInteger(asset.byteCount)||asset.byteCount<1||asset.byteCount>50*1024*1024)throw Error('HUB_PMC_STORAGE_INPUT_REJECTED');
 return tenantId+'/hub-pmc/'+asset.localObjectKey;
}
export function createPmcObjectReader(storage,tenantId){
 return asset=>storage.getBuffer(pmcStorageKey(tenantId,asset),asset.byteCount);
}
