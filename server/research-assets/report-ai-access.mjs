import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
const scope=['tenantId','studyGroupId','researchProjectId'];
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const fail=()=>{throw catalogError('REPORT_AI_FORBIDDEN',403,'当前报告、研究权限或AI用途许可不可用，请重新核对。');};
// Principal and selected asset metadata must be obtained under current native
// authorization. Consent MUST be the latest ledger event, including revocations;
// this pure predicate cannot authenticate a browser DTO or find the latest row.
export function assertReportAiAccess(p,a,c,{now=Date.now(),providerScope}={}){
 if(!p||!a||!c||!Number.isFinite(now)||!id(providerScope)||!scope.every(k=>id(p[k])&&a[k]===p[k]&&c[k]===p[k])||!id(p.accountId)||!Number.isSafeInteger(p.authVersion)||p.authVersion<0||!hash(p.identityRevision)||!id(a.id)||!id(a.studyId)||!id(a.sourceReportId)||!positive(a.sourceReportVersion)||!positive(a.version)||!hash(a.contentHash)||!hash(a.policyHash)||a.ownerAccountId!==p.accountId||a.kind!=='publication'||a.state!=='approved'||a.deletedAt||a.bodyAllowed!==true||a.sourceValid!==true)fail();
 if(!id(a.artifactVersionId)||!id(c.id)||c.assetId!==a.id||c.assetVersion!==a.version||c.studyId!==a.studyId||c.accountId!==p.accountId||c.providerScope!==providerScope||c.purpose!=='research_report_qa'||c.contentHash!==a.contentHash||c.policyHash!==a.policyHash||c.sourceReportId!==a.sourceReportId||c.sourceReportVersion!==a.sourceReportVersion||c.materialUseAllowed!==true||!id(c.basisReference)||!hash(c.materialBasisHash)||!positive(c.revision)||c.state!=='active'||!Number.isFinite(Date.parse(c.startsAt))||!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.startsAt)>now||Date.parse(c.expiresAt)<=now||Date.parse(c.expiresAt)<=Date.parse(c.startsAt))fail();
 return true;
}
// A stable manifest identity, never a replacement for assertReportAiAccess.
export function reportAiBinding(p,a,c){return{...Object.fromEntries(scope.map(k=>[k,p[k]])),studyId:a.studyId,accountId:p.accountId,authVersion:p.authVersion,identityRevision:p.identityRevision,assetId:a.id,assetVersion:a.version,artifactVersionId:a.artifactVersionId,contentHash:a.contentHash,policyHash:a.policyHash,sourceReportId:a.sourceReportId,sourceReportVersion:a.sourceReportVersion,consentId:c.id,consentRevision:c.revision,providerScope:c.providerScope,purpose:c.purpose,materialBasisHash:c.materialBasisHash};}
