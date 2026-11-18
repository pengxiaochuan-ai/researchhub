import {routeDigest} from './skill-routing.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
const clarify=()=>({status:'clarify',question:'请指定最近检索清单中要解读的一至三篇（如“第三篇”或“比较上述三篇”）；本次只解读已有材料，不新增检索或计算。'});
export function planInterpretation(text,{retrieval,priorPlan,continuation=false}={}){
 if(!retrieval?.jobId||!retrieval.hash||!retrieval.selected?.length||agentQuestionError(text))return clarify();
 if(/全文|翻译|计算|合并效应|检索|搜索|查找|排除|不包括|不要包括|筛掉|只保留|患者|病历|身份证|姓名|电话|邮箱|住院号|张三|李四|https?:|@|\d{11,}/.test(text))return clarify();
 const sources=retrieval.selected;let selectedIds;
 if(/不要|别选|不选|除外|去掉|最后|最末|末篇/.test(text))return clarify();
 if(continuation){
  if(priorPlan?.schema!=='hub-interpretation-query.v1'||priorPlan.parentJobId!==retrieval.jobId||priorPlan.parentEvidenceHash!==retrieval.hash)return clarify();
  selectedIds=priorPlan.selectedIds;
 }else{
  const pmids=[...text.matchAll(/PMID\s*:?\s*(\d+)/gi)].map(m=>m[1]);
  const ordinal=[...text.matchAll(/第\s*([一二两三四五六七八九十]|\d+)\s*篇/g)].map(m=>/^\d+$/.test(m[1])?Number(m[1]):({一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10})[m[1]]);
  if(pmids.length&&ordinal.length||[...text.matchAll(/第\s*([一二两三四五六七八九十]|\d+)/g)].length!==ordinal.length)return clarify();
  if(pmids.length){if(pmids.some(p=>!sources.some(s=>s.pmid===p)))return clarify();selectedIds=pmids.map(p=>sources.find(s=>s.pmid===p).id);}
  else if(ordinal.length){if(ordinal.some(n=>!sources[n-1]))return clarify();selectedIds=ordinal.map(n=>sources[n-1].id);}
  else if(/上述|上轮|这些|这几篇|多篇|全部/.test(text)){
   const count=text.match(/([一二两三四五六七八九十]|\d+)篇/);if(count){const n=/^\d+$/.test(count[1])?Number(count[1]):({一:1,二:2,两:2,三:3})[count[1]];if(n!==sources.length)return clarify();}
   selectedIds=sources.map(s=>s.id);
  }else if(sources.length===1)selectedIds=[sources[0].id];else return clarify();
 }
 selectedIds=[...new Set(selectedIds??[])];if(!selectedIds.length||selectedIds.length>3||selectedIds.some(id=>!sources.some(s=>s.id===id)))return clarify();
 const data={schema:'hub-interpretation-query.v1',status:'ready',question:continuation?priorPlan.question:text.trim(),parentJobId:retrieval.jobId,parentEvidenceHash:retrieval.hash,selectedIds,scope:'fixed-retrieval-materials'};
 return{...data,hash:routeDigest(data)};
}
