import{randomUUID}from'node:crypto';
import{assetDigest}from'../../scripts/research-assets-registration-contract.mjs';
import{catalogError}from'../../scripts/research-assets-catalog-contract.mjs';
import{loadCatalogRecords}from'../../scripts/local-research-assets-catalog-read.mjs';
import{createReportAiReader,readLatestReportAiConsent}from'./report-ai-reader.mjs';
import{assertReportAiAccess}from'./report-ai-access.mjs';
import{deriveMaterialBasis,lockMaterialBasis,revalidateMaterialBasis}from'./material-ai-basis.mjs';
import{assertCurrentReportAsset}from'./report-source-service.mjs';
const fail=(code='REPORT_AI_FORBIDDEN',status=403)=>{throw catalogError(code,status,'当前报告、来源或AI用途许可不可用，请重新核对。');};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const receipt=c=>({id:c.id,assetId:c.assetId,version:c.assetVersion,revision:c.revision,state:c.state,startsAt:c.startsAt,expiresAt:c.expiresAt});
export function createBusinessReportAiService({withAccess,assertSources,readSource,now=Date.now,loadRecords=loadCatalogRecords}){
 async function metadata(tx,p,id,version){
  if(!valid(id)||!Number.isSafeInteger(version)||version<1)fail('INPUT_INVALID',400);
  const [record]=await loadRecords(tx,p,assertSources,{family:'business',assetId:id}),r=record?.registry,v=record?.policies.find(v=>v.version===version);
  if(!r||!v||r.ownerAccountId!==p.accountId||r.kind!=='publication'||r.workingVersionNo!==version||r.approvedVersionNo!==version||r.workingState!=='approved'||r.deletedAt)fail();
  const ref=v.sourceBindings?.[0];if(v.sourceKind!=='artifact'||v.sourceBindings.length!==1||ref?.kind!=='artifact')fail();
  const [binding]=await tx.$queryRawUnsafe('SELECT id FROM rh_research.study_binding WHERE tenant_id=$1 AND study_group_id=$2 AND execution_project_id=$3',p.tenantId,p.studyGroupId,p.researchProjectId);if(!binding)fail();
  const source=await readSource(tx,p,{studyId:binding.id,reportId:ref.id});await assertCurrentReportAsset(tx,p,id,r,v,source.target);
  const materialBasisKey=deriveMaterialBasis(p,{studyId:binding.id,reportId:ref.id,version:ref.version},source.value).basisKey;
  return{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,id,version,studyId:binding.id,ownerAccountId:r.ownerAccountId,kind:r.kind,state:'approved',deletedAt:null,bodyAllowed:true,sourceValid:true,artifactVersionId:v.artifactVersionId,contentHash:v.contentHash,policyHash:v.policyHash,sourceReportId:ref.id,sourceReportVersion:ref.version,title:v.metadata.title,materialBasisKey};
 }
 async function material(tx,p,a){
  const source=await readSource(tx,p,{studyId:a.studyId,reportId:a.sourceReportId}),ref={studyId:a.studyId,reportId:a.sourceReportId,version:a.sourceReportVersion},binding=deriveMaterialBasis(p,ref,source.value);
  await lockMaterialBasis(tx,binding.basisKey);
  const [row]=await tx.$queryRawUnsafe('SELECT id,basis_hash,decision,expires_at FROM rh_asset.material_ai_basis_event WHERE tenant_id=$1 AND basis_key=$2 ORDER BY revision DESC LIMIT 1',p.tenantId,binding.basisKey);
  if(!row||row.decision!=='approve'||Date.parse(row.expires_at)<=now())fail('MATERIAL_AI_BASIS_REQUIRED');
  const c={basisReference:row.id,materialBasisHash:row.basis_hash};await revalidateMaterialBasis(tx,p,a,c);return c;
 }
 const readConsent=async(tx,p,a)=>{const c=await readLatestReportAiConsent(tx,p,a);if(c)await revalidateMaterialBasis(tx,p,a,c);return c;};
 const readBody=async(tx,p,a)=>{const v=await tx.researchArtifactVersion.findFirst({where:{id:a.artifactVersionId,artifactId:a.id,versionNo:a.version,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},select:{contentMd:true}});if(!v)fail();return v.contentMd;};
 const reader=createReportAiReader({withAccess,loadMetadata:metadata,readConsent,readBody,now});
 async function canRead(tx,p,a,c){try{await revalidateMaterialBasis(tx,p,a,c);assertReportAiAccess(p,a,c,{now:now(),providerScope:'deepseek'});return true;}catch(e){if([403,409].includes(e.status))return false;throw e;}}
 return{reader,
  status:(user,id,v)=>withAccess(user,'artifact.read',async(tx,p)=>{
   const a=await metadata(tx,p,id,Number(v)),c=await readLatestReportAiConsent(tx,p,a),canSearch=!!c&&await canRead(tx,p,a,c);let canGrant=false;
   if((!c||c.state==='revoked')&&(!c||Date.parse(c.expiresAt)>now()))try{await material(tx,p,a);canGrant=true;}catch(e){if(![403,409].includes(e.status))throw e;}
   return{schema:'rh-report-ai-status.v1',assetId:a.id,version:a.version,studyId:a.studyId,title:a.title,state:c?c.state==='revoked'?'revoked':Date.parse(c.expiresAt)<=now()?'expired':canSearch?'active':'unavailable':'not_granted',consentRevision:c?.revision??0,expiresAt:c?.expiresAt??null,canGrant,canRevoke:!!c&&c.state==='active',canSearch,canGenerate:false,providerStatus:'not_enabled'};
  }),
  consent:(user,id,v,input)=>{
   if(!input||Object.keys(input).sort().join(',')!=='action,expectedConsentRevision,requestKey'||!['grant','revoke'].includes(input.action)||!Number.isSafeInteger(input.expectedConsentRevision)||input.expectedConsentRevision<0||!valid(input.requestKey)||input.requestKey.length<8||input.requestKey.length>128)fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const a=await metadata(tx,p,id,Number(v));
    // Material lock precedes consent lock in grants and reads, including revoke.
    await lockMaterialBasis(tx,a.materialBasisKey);
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('rh-report-ai',$1::text,$2::text,$3::integer,$4::text,$5::text,$6::text)::text,0))::text",p.tenantId,a.id,a.version,p.accountId,'deepseek','research_report_qa');
    const requestHash=assetDigest({input,tenantId:p.tenantId,accountId:p.accountId,assetId:a.id,version:a.version});
    const [old]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.ai_use_consent_event WHERE tenant_id=$1 AND account_id=$2 AND request_key=$3',p.tenantId,p.accountId,input.requestKey);
    if(old){if(old.request_hash!==requestHash)fail('REQUEST_KEY_CONFLICT',409);return receipt({id:old.id,assetId:old.asset_id,assetVersion:old.version_no,revision:old.consent_revision,state:old.event_kind==='grant'?'active':'revoked',startsAt:new Date(old.starts_at).toISOString(),expiresAt:new Date(old.expires_at).toISOString()});}
    const prior=await readLatestReportAiConsent(tx,p,a);if((prior?.revision??0)!==input.expectedConsentRevision)fail('REPORT_AI_CONSENT_CONFLICT',409);
    if(input.action==='revoke'&&prior?.state!=='active'||input.action==='grant'&&prior?.state==='active')fail('REPORT_AI_CONSENT_CONFLICT',409);
    const binding=input.action==='grant'?await material(tx,p,a):{basisReference:prior.basisReference,materialBasisHash:prior.materialBasisHash};
    const c={...a,...binding,id:'rhaic-'+randomUUID(),assetId:a.id,assetVersion:a.version,accountId:p.accountId,providerScope:'deepseek',purpose:'research_report_qa',revision:(prior?.revision??0)+1,state:input.action==='grant'?'active':'revoked',materialUseAllowed:true,startsAt:prior?.startsAt??new Date(now()).toISOString(),expiresAt:prior?.expiresAt??new Date(now()+7*86400000).toISOString()};
    if(input.action==='grant')assertReportAiAccess(p,a,c,{now:now(),providerScope:'deepseek'});
    const audit=await tx.auditLog.create({data:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,accountId:p.accountId,action:'researchhub.asset_ai_consent_'+input.action,target:a.id,meta:{consentEventId:c.id,requestKey:input.requestKey,requestHash,version:a.version,consentRevision:c.revision}}});
    await tx.$executeRawUnsafe(`INSERT INTO rh_asset.ai_use_consent_event(id,tenant_id,study_group_id,research_project_id,study_id,asset_id,version_no,account_id,actor_account_id,provider_scope,purpose,consent_revision,event_kind,content_hash,policy_hash,source_report_id,source_report_version,material_basis_ref,material_basis_hash,material_ai_allowed,starts_at,expires_at,request_key,request_hash,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19::timestamptz,$20::timestamptz,$21,$22,$23)`,c.id,p.tenantId,p.studyGroupId,p.researchProjectId,a.studyId,a.id,a.version,p.accountId,c.providerScope,c.purpose,c.revision,input.action,a.contentHash,a.policyHash,a.sourceReportId,a.sourceReportVersion,c.basisReference,c.materialBasisHash,c.startsAt,c.expiresAt,input.requestKey,requestHash,audit.id);
    return receipt(c);
   });
  },
  fragment:(user,id,v,input)=>{if(!input||Object.keys(input).sort().join(',')!=='endLine,fragmentId,quoteHash,startLine')fail('INPUT_INVALID',400);return reader.fragment(user,{...input,assetId:id,version:Number(v)});},
  async search(user,id,v,input){if(!input||Object.keys(input).join(',')!=='question')fail('INPUT_INVALID',400);const pack=await reader.search(user,{assetId:id,version:Number(v),question:input.question});await reader.revalidate(user,pack);return{schema:'rh-report-qa-search.v1',status:pack.status,query:pack.query,assetId:id,version:Number(v),studyId:pack.binding.studyId,providerStatus:'not_enabled',generated:false,evidence:pack.evidence};}
 };
}
