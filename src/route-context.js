export const CONTEXT_KEYS=['hubId','opportunityId','projectId','protocolId','subjectId','assetId','outputId','view','returnTo'];
export function safeReturnTo(value){
  if(typeof value!=='string'||!/^\/pages\/[a-z0-9]+\/(?:[?#].*)?$/.test(value)||/[\\\r\n]/.test(value))return '/pages/q02/';
  return value;
}
export function readContext(search=''){
  const params=new URLSearchParams(search),context={};
  for(const key of CONTEXT_KEYS){const value=params.get(key);if(value&&(key==='returnTo'||/^[\w-]{1,100}$/.test(value)))context[key]=key==='returnTo'?safeReturnTo(value):value;}
  return context;
}
export function buildPageRoute(routes,pageId,context={}){
  const route=routes[pageId];if(!route)throw Error('页面尚未接入：'+pageId);
  const params=new URLSearchParams();
  for(const key of CONTEXT_KEYS){const value=context[key];if(value!=null&&value!==''){if(key==='returnTo')params.set(key,safeReturnTo(String(value)));else if(/^[\w-]{1,100}$/.test(String(value)))params.set(key,value);}}
  return route+(params.size?'?'+params.toString():'');
}
