import {AGENT_QUESTION_MAX_CHARACTERS} from '../../src/agent-question.js';
const failure=(code,message)=>Object.assign(new Error(message),{code,status:400});
const word=char=>Boolean(char&&/[\p{L}\p{N}_]/u.test(char));
const unique=terms=>[...new Map(terms.map(term=>[term.toLowerCase(),term])).values()];

// Pure plan compiler. Consumers must AND groups and OR terms within each group.
// It does not fetch, translate with a model, change permissions or execute SQL.
export function compileHubQuery(q,dictionary,{maxCharacters=100}={}){
 if(![100,AGENT_QUESTION_MAX_CHARACTERS].includes(maxCharacters)||typeof q!=='string'||[...q.trim()].length<2||[...q.trim()].length>maxCharacters)throw failure('HUB_QUERY_INVALID',`请输入2–${maxCharacters}个字符`);
 if(!dictionary?.version||!Array.isArray(dictionary.terms))throw failure('HUB_DICTIONARY_INVALID','检索词表不可用');
 const text=q.trim(),lower=text.toLowerCase();
 const base={originalQuery:q,mode:'literal',dictionaryVersion:dictionary.version,conceptGroups:[],appliedTerms:[text],warning:null};
 let identifier;
 if(/^PMC\d+$/i.test(text))identifier=text.toUpperCase();
 else if(/^10\.\d{4,9}\/[^\s?#]+$/i.test(text))identifier=lower;
 else if(/^https:\/\/doi\.org\/10\.\d{4,9}\/[^\s?#]+$/i.test(text))identifier=lower.slice('https://doi.org/'.length);
 if(identifier)return {...base,mode:'identifier',appliedTerms:[identifier]};

 // Include disabled phrases in longest-match tokenization so e.g. 狂越 is
 // never partially expanded as 狂. Disabled matches force literal mode.
 const aliases=dictionary.terms.flatMap(term=>[term.zh,...term.en].map(value=>({term,value,lower:value.toLowerCase(),english:/^[\x00-\x7f]+$/.test(value)}))).sort((a,b)=>b.value.length-a.value.length||a.term.id-b.term.id);
 const matched=[],residue=[];let disabled=false;
 for(let index=0;index<text.length;){
  const found=aliases.find(alias=>lower.startsWith(alias.lower,index)&&(!alias.english||!word(text[index-1])&&!word(text[index+alias.value.length])));
  if(found){matched.push(found.term);disabled||=!found.term.enabled;index+=found.value.length;}
  else{residue.push(text[index]);index++;}
 }
 // Only explicit, finite courtesy/connective phrases may disappear. Never
 // discard an unknown disease, year, logical operator, sign or negation.
 const rest=residue.join('').replace(/请帮我|帮我|请|检索|查找|查询|有关|相关|关于|研究|文献|资料|的|和|与|、|\s/gu,'');
 if(disabled||!matched.length||rest)return {...base,warning:disabled?'包含停用词，仅按原文检索，未作英文扩展。':'存在未知词或不能安全解析的逻辑/约束，仅按原文检索；请改用明确关键词。'};

 const conceptGroups=[...new Map(matched.map(term=>[term.id,term])).values()].map(term=>{
  const broad=dictionary.broaderRetrieval?.find(item=>item.id===term.id);
  const children=(broad?.includeIds??[]).map(id=>dictionary.terms.find(item=>item.id===id&&item.enabled));
  if(children.some(child=>!child))throw failure('HUB_DICTIONARY_INVALID','宽类检索词表不完整');
  return {id:term.id,zh:term.zh,relationship:broad?'broader_retrieval':'retrieval_variant',terms:unique([term.zh,...term.en,...children.flatMap(child=>[child.zh,...child.en])])};
 });
 if(conceptGroups.length>8||conceptGroups.reduce((sum,group)=>sum+group.terms.length,0)>64)throw failure('HUB_QUERY_LIMIT','最多8个概念组、64个检索词形；请缩小检索范围。');
 return {...base,mode:'mapped',conceptGroups,appliedTerms:unique(conceptGroups.flatMap(group=>group.terms)),warning:conceptGroups.some(group=>group.relationship==='broader_retrieval')?'针灸按获准宽类覆盖针刺与艾灸，仅为检索导航，不表示医学等价。':null};
}
