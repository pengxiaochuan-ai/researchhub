export const NETWORK_INTENT_SCHEMA='hub-network-intent.v1';
const bad=()=>{throw Object.assign(Error('联网参数无效。'),{code:'HUB_NETWORK_INPUT_INVALID',status:400,publicMessage:'联网参数无效。'});};
export function normalizeNetworkIntent(value){
 if(value===undefined)return{schema:NETWORK_INTENT_SCHEMA,enabled:false};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='enabled,schema'||value.schema!==NETWORK_INTENT_SCHEMA||typeof value.enabled!=='boolean')bad();
 return{schema:NETWORK_INTENT_SCHEMA,enabled:value.enabled};
}
export function effectiveNetworkIntent(value,text=''){
 const intent=normalizeNetworkIntent(value);
 return{...intent,enabled:intent.enabled&&!isLocalOnlyRequest(text)};
}
export function isLocalOnlyRequest(text=''){
 const q=String(text).replace(/不仅仅?|不只是?|并非只|不只/g,'');
 return /(?:不|不要|无需|禁止|不可|别)(?:再|进行|使用|访问|检索|搜索)?(?:联网|外部(?:检索|网站|网络|网页|来源)?|互联网|公网)|(?:只|仅)(?:允许|限于|能)?(?:使用|用|限|在|依据|从|检索|查询|搜索|查找|查阅|基于)?\s*.{0,8}(?:Hub|已审核|资料库|本地)|\b(?:Hub\s+only|only\s+(?:(?:use|search)\s+)?Hub|offline|do\s+not\s+(?:browse|search\s+the\s+web))\b/i.test(q);
}
