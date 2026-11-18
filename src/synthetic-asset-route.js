// Presentation selection only. Every API independently verifies real authorization.
export const isAssetDraftRoute=(pageId,search)=>['a01','a02'].includes(pageId)&&['assetDraftId','assetDrafts'].some(key=>new URLSearchParams(search).has(key));
export function assetDraftHeader(base,pageId,search){if(!isAssetDraftRoute(pageId,search))return base;return{...base,title:pageId==='a02'?'资产候选草稿详情':'我的资产候选草稿',crumbs:[['科研资产'],['本人资产候选']],concept:'本机合成候选',description:'本人私有的可复用草稿；保留原报告、方案、资料和质控血缘，不执行新计算。',meta:"范围：本人本次候选 · 未共享／未审批 · 不开放锁库、发布或导出",actions:[],nav:undefined,tags:[]};}
