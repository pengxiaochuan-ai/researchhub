import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=(code='REPORT_SOURCE_INVALID',status=409)=>{throw catalogError(code,status,'原报告、来源依据或当前权限已变化，请重新核对。');};
// This accepts only a trusted native T17 same-transaction read result. It is
// never proof for arbitrary DTOs or a replacement for the native run/basis checks.
export function assertVerifiedReportSource(value,p,target){
 const{artifact:a,version:v,basis,source}=value??{};
 if(!p||!['tenantId','studyGroupId','researchProjectId','accountId'].every(k=>id(p[k]))||!target||![target.studyId,target.reportId].every(id)||target.version!==1||!a||!v||!['tenantId','studyGroupId','researchProjectId'].every(k=>a[k]===p[k])||a.id!==target.reportId||a.ownerAccountId!==p.accountId||a.typeKey!=='analysis_report'||a.status!=='released'||a.deletedAt||a.currentVersionNo!==target.version||v.versionNo!==target.version||!id(v.id)||typeof v.contentMd!=='string'||!v.contentMd.trim()||v.contentHash!==target.contentHash||assetDigest(v.contentMd)!==target.contentHash||basis?.studyId!==target.studyId||!id(basis.snapshotId)||!id(source?.id))fail();
 return value;
}
export function buildReportSourceRegistration(input,value,p,target){
 assertVerifiedReportSource(value,p,target);
 if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='limitations,purpose,requestKey,rightsEvidence'||!['purpose','limitations','rightsEvidence'].every(k=>typeof input[k]==='string'&&input[k].trim()&&input[k].length<=(k==='rightsEvidence'?4000:2000)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input[k]))||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.requestKey))fail('INPUT_INVALID',400);
 return{kind:'publication',metadata:{title:value.artifact.title,summary:'固定方法报告的历史结果与可复核来源；不代表新研究结果。',purpose:input.purpose.trim(),limitations:input.limitations.trim(),author:p.displayName,domains:[]},sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:target.reportId,version:target.version,contentHash:target.contentHash}],policy:{rightsEvidence:input.rightsEvidence.trim(),discoveryRecipients:[]},contentMd:value.version.contentMd,requestKey:input.requestKey};
}
