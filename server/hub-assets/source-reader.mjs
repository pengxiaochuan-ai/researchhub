const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const hex=value=>/^[a-f0-9]{64}$/.test(value??'');
export function supportsHubAssetSource(value){
 if(value?.sourceKind==='author')return Array.isArray(value.sourceBindings)&&value.sourceBindings.length===0;
 const ref=value?.sourceBindings?.[0];
 return value?.sourceKind==='artifact'&&Array.isArray(value.sourceBindings)&&value.sourceBindings.length===1&&ref?.kind==='artifact'&&id(ref.id)&&ref.id.startsWith('rh-formal-report-')&&ref.version===1&&hex(ref.contentHash);
}

/** SQL is responsible for current actor, purpose, source binding and transaction locks.
 * Native JS validation is mandatory for report metadata as well as delivery.
 * Raw source records never leave this adapter. */
export function createHubAssetSourceReader({verifyReport}){
 if(typeof verifyReport!=='function')throw TypeError('HUB_NATIVE_REPORT_VERIFIER_REQUIRED');
 return async(tx,entry,purpose='probe')=>{
  if(!id(entry?.id)||!['probe','read','cite','copy'].includes(purpose))throw TypeError('HUB_SOURCE_READER_INPUT_INVALID');
  const [row]=await tx.$queryRawUnsafe('SELECT rh_hub_asset.read_source($1,$2) AS data',entry.id,purpose),base=row?.data;
  if(!base||base.sourceType!=='fixed-report')return base??null;
  if(!id(base.studyId)||!id(base.reportId)||base.reportVersion!==1||!hex(base.reportHash)||base.reportHash!==base.contentHash)return null;
  const [raw]=await tx.$queryRawUnsafe('SELECT rh_hub_asset.report_bundle($1,$2) AS data',entry.id,purpose);
  if(!raw?.data)return null;
  try{
   const verified=await verifyReport(raw.data,{studyId:base.studyId,reportId:base.reportId,version:base.reportVersion,contentHash:base.reportHash});
   if(verified?.reportId!==base.reportId||verified.version!==base.reportVersion||verified.contentHash!==base.contentHash||typeof verified.contentMd!=='string'||!verified.contentMd.trim())return null;
   return{entryId:base.entryId,version:base.version,contentHash:base.contentHash,sourceType:'fixed-report',studyId:base.studyId,reportId:base.reportId,reportVersion:base.reportVersion,reportHash:base.reportHash,...(['read','copy'].includes(purpose)?{contentMd:verified.contentMd}:{})};
  }catch(error){if([401,403,404,409,422].includes(error.status??error.getStatus?.()))return null;throw error;}
 };
}
