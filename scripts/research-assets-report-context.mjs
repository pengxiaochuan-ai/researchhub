import {catalogError} from './research-assets-catalog-contract.mjs';
export const REPORT_CONTEXT=Object.freeze({projectId:'cmwczp5hk0003lud9lsla5b75',studyId:'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d',
 reportId:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe',version:1,runId:'cmwdq0636001jlud6scho3s1q',
 hash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b',assetId:'rh-report-asset-20261116-admin',
 key:'rh-research-asset:context-20261116:admin:publication'});
const fail=(code,status=409,message='报告来源或当前权限已变化，请重新核对。')=>{throw catalogError(code,status,message);};
export function reportContextSourceError(error){
 const status=error.status??error.getStatus?.(),code=error.code??error.getResponse?.()?.code;
 return [401,403,404,409].includes(status)&&(/^(?:REPORT|RESEARCH|AUTH|ANALYSIS|PARTICIPATION|EXECUTION)_/.test(code??'')||typeof error.getStatus==='function')?catalogError('REPORT_CONTEXT_SOURCE_INVALID',status,'来源报告或当前使用条件已变化，请重新核对原报告。'):error;
}
export function assertReportContextPrincipal(p){
 if(p?.tenantId!=='rh-kb-local-b0e2af9d-tenant'||p.studyGroupId!=='rh-kb-local-b0e2af9d-group'||p.researchProjectId!==REPORT_CONTEXT.projectId||p.accountId!=='rh-kb-local-b0e2af9d-admin'||p.isTenantAdmin!==true)fail('REPORT_CONTEXT_FORBIDDEN',403,'当前账号无权登记或审核此报告资产。');
}
// Call only with the existing T17 service's same-transaction verified result.
export function assertReportContextSource(value,p){
 assertReportContextPrincipal(p);const {artifact:a,version:v,basis,source}=value??{},c=REPORT_CONTEXT;
 if(!a||!v||a.id!==c.reportId||a.tenantId!==p.tenantId||a.studyGroupId!==p.studyGroupId||a.researchProjectId!==c.projectId||a.ownerAccountId!==p.accountId||a.status!=='released'||a.currentVersionNo!==c.version||v.versionNo!==c.version||v.contentHash!==c.hash||!v.id||!v.contentMd||basis?.studyId!==c.studyId||source?.id!==c.runId)fail('REPORT_CONTEXT_SOURCE_INVALID');
 return value;
}
export function buildReportContextRegistration(input,value,p){
 assertReportContextSource(value,p);
 if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='limitations,purpose,requestKey,rightsEvidence'||!['purpose','limitations','rightsEvidence'].every(k=>typeof input[k]==='string'&&!!input[k].trim()&&input[k].length<=(k==='rightsEvidence'?4000:2000)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input[k]))||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.requestKey))fail('INPUT_INVALID',400,'请补齐用途、限制及材料使用依据；输入已保留。');
 return{kind:'publication',metadata:{title:value.artifact.title,summary:'固定方法报告的历史结果与可复核来源；不代表新研究结果。',purpose:input.purpose.trim(),limitations:input.limitations.trim(),author:p.displayName,domains:[]},sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:REPORT_CONTEXT.reportId,version:REPORT_CONTEXT.version,contentHash:REPORT_CONTEXT.hash}],policy:{rightsEvidence:input.rightsEvidence.trim(),discoveryRecipients:[]},contentMd:value.version.contentMd,requestKey:input.requestKey};
}
