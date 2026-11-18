// Pure, exact Q01 fixture plan. Importing/building it never reads config or creates a business object.
import assert from 'node:assert/strict';
import {assetDigest,canonicalAssetJson} from './research-assets-registration-contract.mjs';
const prefix='rh-research-asset:detail-20261113:';
const actors=['owner','admin'],kinds=['protocol','dataset','instrument','analysis','publication'];
const labels={protocol:'研究方案模板',dataset:'数据字典说明',instrument:'量表定义说明',analysis:'方法结果说明',publication:'研究报告说明'};
function scope(ids){for(const k of ['tenant','group','project','owner','admin'])assert.equal(ids?.[k],'rh-kb-local-b0e2af9d-'+k,'A02_NAMED_SCOPE_ONLY');}
export function buildA02Manifest(ids){
 scope(ids);
 const key=(actor,kind,suffix='')=>prefix+actor+':'+kind+suffix;
 const assets=actors.flatMap(actor=>kinds.map(kind=>({key:key(actor,kind),actor,ownerAccountId:ids[actor],kind,mode:'base',maxVersions:4,maxOperations:24,initialState:'draft',initialGrants:[],title:'原创合成'+labels[kind]+' · A02 '+actor+' 20261113',contentMd:'# 原创合成'+labels[kind]+'\n\n仅用于针灸辅助干预抑郁障碍的合成研究流程核对，不含患者记录、实际研究结果或外部版权正文。\n\n研究人群、干预、对照、结局与访视均须研究者确认。未声明的方法参数保留为待核对，不填补数值，不代表可直接临床应用。\n',rightsEvidence:'本轮原创合成材料，允许原两账号在具名本机Study范围按固定版许可阅读、引用、讨论、下载、AI解释、派生、应用与Markdown导出；未授权默认私有，非真实研究/量表/统计产物。'})));
 for(const [actor,kind] of [['owner','protocol'],['owner','dataset'],['owner','instrument'],['admin','protocol'],['admin','analysis'],['admin','publication']])assets.push({key:key(actor,kind,':copy'),actor,ownerAccountId:ids[actor],kind,mode:'copy',sourceKey:key(actor,kind),sourceVersion:1,maxVersions:2,maxOperations:24,initialState:'draft',initialGrants:[]});
 const targetStudy={id:'rh-asset-detail-20261113-study-b',code:'A02-REUSE-B-20261113',name:'A02科研方案复用验收B-20261113',tenantId:ids.tenant,studyGroupId:ids.group,setDefault:false,ownerMembership:{accountId:ids.owner,roleKey:'researcher',isDefault:false},adminMembershipRequired:false};
 const applications=actors.flatMap(actor=>[1,2].map(n=>({key:prefix+'application:'+actor+':'+n,actor,ownerAccountId:ids[actor],sourceKey:key(actor,'protocol'),sourceVersion:1,targetProjectId:targetStudy.id,maxVersions:2,initialState:'draft',initialGrants:[]})));
 const files=actors.flatMap(actor=>[['protocol','md'],['dataset','txt']].map(([kind,ext])=>{const content='# A02原创合成'+labels[kind]+'附件\n\n本文件只用于具名合成资产的来源、完整性与受控文件读取核对，不含临床记录或外部版权资料。\n';return{key:prefix+'file:'+actor+':'+kind,actor,assetKey:key(actor,kind),filename:'a02-'+actor+'-'+kind+'.'+ext,content,byteLength:Buffer.byteLength(content),sha256:assetDigest(content),maxBytes:1048576};}));
 const comments=actors.flatMap(actor=>[1,2,3,4].map(n=>({key:prefix+'comment:'+actor+':'+n,actor,assetKey:key(actor,'protocol'),version:1,parentKey:n%2===0?prefix+'comment:'+actor+':'+(n-1):null,maxEvents:3,body:n%2===0?'已核对该固定版来源，具体设计条件仍待研究者确认。':'请核对该固定版的结局声明及原始来源位置。'})));
 return{schema:'rh-asset-a02-manifest.v1',ids:Object.fromEntries(['tenant','group','project','owner','admin'].map(k=>[k,ids[k]])),assets,targetStudy,applications,files,comments,execution:{applied:false,paidCallsAllowed:false,ddlApplied:false,businessObjectsCreated:0}};
}
export function assertA02Manifest(value,ids){
 assert.equal(canonicalAssetJson(value),canonicalAssetJson(buildA02Manifest(ids)),'A02_EXACT_MANIFEST_REQUIRED');
 return assetDigest(value);
}
