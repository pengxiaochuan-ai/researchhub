import {getVisiblePmc} from '../hub-sources/pmc-visible.mjs';
import {getVisibleClinicalRegistry,getVisibleGuidanceDocument} from '../hub-sources/external-visible.mjs';
import {directoryHash,normalizeProvenance,directoryError} from './contract.mjs';
import {resolveAdminVerification,isManualReference,readAdminVerification} from './admin-verification.mjs';
const permitted=(d,audience)=>d?.decision==='approve'&&['public',...(audience==='tenant'?['tenant']:[])].includes(d.audience)&&(!d.expiresAt||d.expiresAt>new Date());
const doiKey=(doi,fallback)=>typeof doi==='string'&&/^10\.\d{4,9}\/\S+$/i.test(doi)?'doi:'+doi.toLowerCase():fallback;
export async function holdDirectorySources(tx,refs){
 const unique=new Map();for(const input of refs){const [r]=normalizeProvenance([input]);const key=[r.kind,r.sourceId,r.versionId??r.rowId].join(':');if(unique.has(key)&&unique.get(key).sourceHash!==r.sourceHash)throw directoryError('DIRECTORY_SOURCE_CHANGED',409,'引用资料版本不一致。');unique.set(key,r);}
 for(const [_,r]of [...unique].sort(([a],[b])=>a.localeCompare(b)))try{
  if(isManualReference(r)){
   const [scope]=await tx.$queryRaw`SELECT current_setting('app.tenant_id',true) AS "tenantId",current_setting('app.hub_key',true) AS "hubKey"`;
   await tx.$queryRaw`SELECT id FROM rh_directory.entity WHERE tenant_id=${scope.tenantId} AND id=${r.sourceId} AND creation_hub_key=${scope.hubKey} FOR UPDATE`;
   if(!(await readAdminVerification(tx,{...scope,audience:'tenant'},r)).available)throw directoryError('DIRECTORY_SOURCE_CHANGED',409,'人工核实记录已变化，请重新核对。');
  }else await tx.$queryRaw`SELECT rh_directory.hold_source_for_commit(${r.kind},${r.sourceId},${r.versionId},${r.rowId},${r.sourceHash})`;
 }catch(e){if(['23514','55P03','57014'].includes(e.meta?.code))throw directoryError('DIRECTORY_SOURCE_CHANGED',409,'来源版本或可用状态已变化，请重新核对。');if(e.meta?.code==='42501')throw directoryError('DIRECTORY_FORBIDDEN',403,'当前身份不能提交目录资料。');throw e;}
}
export async function resolveDirectorySource(tx,scope,input,{fact}={}){
 const ref=normalizeProvenance([input])[0],{tenantId,hubKey,audience='public',principal=null}=scope;
 if(hubKey!=='lingshu-xinyu'||!['public','tenant'].includes(audience))throw directoryError('DIRECTORY_SCOPE_REJECTED',403,'目录范围不可用。');
 const [ctx]=await tx.$queryRaw`SELECT current_setting('app.tenant_id',true) AS tenant,current_setting('app.hub_key',true) AS hub`;if(ctx?.tenant!==tenantId||ctx.hub!==hubKey)throw directoryError('DIRECTORY_SCOPE_REJECTED',403,'目录事务范围不正确。');
 if(isManualReference(ref))return resolveAdminVerification(tx,scope,ref,fact);
 let row,item,decisions=[],workType='material',canonicalKey,detailUrl=null;
 if(ref.kind==='source_record'){
  [row]=await tx.$queryRaw`SELECT r.id,r.row_sha256 AS sha,r.title,r.authors,r.journal,r.publication_year AS year,r.doi,r.source_url AS "sourceUrl",r.abstract_text AS abstract,r.validation_errors AS errors,s.source_name AS "sourceName",s.rights_status AS "rightsStatus",b.status,c.id AS canonical FROM rh_source.source_record r JOIN rh_source.source_registry s ON s.tenant_id=r.tenant_id AND s.hub_key=r.hub_key AND s.id=r.source_registry_id JOIN rh_source.import_batch b ON b.tenant_id=r.tenant_id AND b.hub_key=r.hub_key AND b.id=r.batch_id LEFT JOIN rh_source.canonical_publication c ON c.tenant_id=r.tenant_id AND c.hub_key=r.hub_key AND c.source_record_id=r.id WHERE r.tenant_id=${tenantId} AND r.hub_key=${hubKey} AND r.source_registry_id=${ref.sourceId} AND r.id=${ref.rowId}`;
  if(row){decisions=await tx.$queryRaw`SELECT DISTINCT ON(d.field_kind) d.field_kind AS field,d.decision,d.audience,d.expires_at AS "expiresAt",d.decision_version::text AS version FROM rh_source.review_decision d JOIN rh_source.source_record r ON r.tenant_id=d.tenant_id AND r.hub_key=d.hub_key AND r.source_registry_id=d.source_registry_id AND (d.source_record_id=r.id OR (d.source_record_id IS NULL AND d.batch_id=r.batch_id)) WHERE r.tenant_id=${tenantId} AND r.hub_key=${hubKey} AND r.id=${ref.rowId} AND d.purpose='display' ORDER BY d.field_kind,d.decision_version DESC`;
   if(row.status==='staged'&&row.rightsStatus!=='rejected'&&row.errors?.length===0&&row.title&&permitted(decisions.find(d=>d.field==='bibliographic'),audience)){item={...row,abstract:permitted(decisions.find(d=>d.field==='abstract'),audience)?row.abstract:null};if(row.canonical){workType='publication';detailUrl='/pages/e02/?documentId='+encodeURIComponent(row.id);}}
   canonicalKey=doiKey(row.doi,'source:'+row.id);
  }
 }else if(ref.kind==='pmc_candidate_version'){
  [row]=await tx.$queryRaw`SELECT id,pmcid,raw_sha256 AS sha FROM rh_source.pmc_candidate_version WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND candidate_id=${ref.sourceId} ORDER BY staged_at DESC,id DESC LIMIT 1`;
  if(row){const args={db:tx,tenantId,hubKey,principal,recordId:'pmc-'+row.pmcid};item=await getVisiblePmc({...args,audience});if(!item&&audience==='tenant')item=await getVisiblePmc({...args,audience:'public'});canonicalKey=doiKey(item?.doi,'pmc:'+row.pmcid);workType='publication';detailUrl='/pages/e02/?documentId=pmc-'+row.pmcid;}
 }else{
  [row]=await tx.$queryRaw`SELECT v.id,v.content_sha256 AS sha,d.document_type AS type,d.external_key AS "externalKey" FROM rh_source.external_document_version v JOIN rh_source.external_document d ON d.tenant_id=v.tenant_id AND d.hub_key=v.hub_key AND d.id=v.document_id WHERE v.tenant_id=${tenantId} AND v.hub_key=${hubKey} AND v.document_id=${ref.sourceId} ORDER BY v.version_number DESC LIMIT 1`;
  if(row){const args={db:tx,tenantId,hubKey,principal,documentId:ref.sourceId,audience:audience==='tenant'?'member':'public'};item=row.type==='clinical_registry'?await getVisibleClinicalRegistry(args):await getVisibleGuidanceDocument(args);if(item)item={...item,body:item.structuredDetails??item.clauseDetails??null};workType=row.type==='clinical_registry'?'clinical_registry':'guidance';canonicalKey=(workType==='clinical_registry'?'registry:':'guidance:')+row.externalKey;detailUrl='/pages/'+(workType==='clinical_registry'?'h06':'c03')+'/?documentId='+encodeURIComponent(ref.sourceId);}
 }
 const fieldsPresent=Boolean(item)&&ref.fieldNames.every(k=>{const value=item[k];return value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length>0);});
 const available=Boolean(row&&row.sha===ref.sourceHash&&(ref.kind==='source_record'?row.id===ref.rowId:row.id===ref.versionId)&&fieldsPresent);
 const fingerprint=directoryHash({ref,head:row?.id??null,hash:row?.sha??null,available,decisions,review:item?.reviewVersion??null,visibility:item?.visibility??null,abstract:item?.abstractDisplayVersion??null,body:item?.bodyDisplayVersion??null,structured:item?.structuredDetails?.reviewVersion??null,clauses:item?.clauseDetails?.reviewVersion??null});
 if(!available)return{available:false,fingerprint};
 return{available:true,fingerprint,kind:ref.kind,sourceId:ref.sourceId,versionId:ref.versionId,rowId:ref.rowId,sourceHash:ref.sourceHash,locator:ref.locator,fieldNames:ref.fieldNames,title:item.title,sourceName:item.sourceName??null,sourceUrl:item.sourceUrl??null,canonicalKey,workType,detailUrl};
}
