import {readFileSync} from 'node:fs';
import {routeDigest} from './skill-routing.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
const dictionary=JSON.parse(readFileSync(new URL('../hub-sources/search-dictionary-v1.json',import.meta.url)));
const clarification=question=>({status:'clarify',question});
const extras=[{id:'common-insomnia',zh:'失眠',en:['insomnia'],group:'病证',enabled:true},{id:'common-anxiety',zh:'焦虑',en:['anxiety'],group:'病证',enabled:true},{id:'common-depression',zh:'抑郁症',en:['depression'],group:'病证',enabled:true}];
const terms=[...dictionary.terms,...extras];
const aliases=terms.flatMap(term=>[term.zh,...term.en].map(value=>({term,value}))).sort((a,b)=>b.value.length-a.value.length);
const count={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
const phrase=s=>'"'+s.replaceAll('"','')+'"[Title/Abstract]';
export function planLiteratureQuery(question,{today=new Date().toISOString().slice(0,10)}={}){
 const inputError=agentQuestionError(question);if(inputError)return clarification(inputError);
 if(/(?:身份证|住院号|病历号|手机号|电话|患者编号|姓名)|\b\d{11,18}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(question))return clarification('请仅提供公开研究主题，不包含患者身份或联系方式。');
 let residue=question.normalize('NFKC'),date=null,design=null,maxResults=6,dateWindows=0;
 const noNetwork=/不要联网|不联网|仅依据已审核|(?:只用|仅用|仅限|只在|仅在|仅).*Hub|只看已审核|只依据已审核/i.test(residue);
 const scope=noNetwork||/已审核|资料库/i.test(residue)&&!/PubMed|联网检索/i.test(residue)?'hub-only':'hub-and-pubmed';
 residue=residue.replace(/(20\d{2})\s*(?:到|至|[-–])\s*(20\d{2})年?/g,(_,a,b)=>{dateWindows++;if(a>b||+b>+today.slice(0,4))date='invalid';else date=`${a}:${b}[Date - Publication]`;return'';});
 residue=residue.replace(/(?:最近|近)([一二两三四五六七八九十]|\d{1,2})年/g,(_,n)=>{dateWindows++;const years=count[n]??Number(n),d=new Date(today+'T00:00:00Z');if(!years||years>20){date='invalid';return'';}d.setUTCFullYear(d.getUTCFullYear()-years);date=`${d.toISOString().slice(0,10).replaceAll('-','/')}:${today.replaceAll('-','/')}[Date - Publication]`;return'';});
 if(date==='invalid'||dateWindows>1)return clarification('请明确一个有效的起止年份或最近多少年。');
 residue=residue.replace(/(?:前|最多|选取|列出)?([一二两三四五六七八九十]|\d{1,2})篇/g,(_,n)=>{maxResults=count[n]??Number(n);return'';});
 if(maxResults<1||maxResults>10)return clarification('本次先检索多少篇重点文献（1–10篇）？');
 residue=residue.replace(/随机对照试验|随机试验|RCT\b/gi,()=>{design='randomized controlled trial[Publication Type]';return'';});
 residue=residue.replace(/系统综述|systematic review/gi,()=>{if(design)design='invalid';else design='systematic review[Publication Type]';return'';});
 if(design==='invalid')return clarification('本次只看随机试验，还是系统综述？');
 if(scope==='hub-only'&&(date||design))return clarification('当前Hub检索尚不能可靠应用这些限定；是否改用PubMed检索或取消年份、研究类型限定？');
 const matched=[];let unknown='';
 for(let i=0;i<residue.length;){
  const a=aliases.find(a=>residue.slice(i,i+a.value.length).toLowerCase()===a.value.toLowerCase()&&(!/^[\x00-\x7f]+$/.test(a.value)||!/[a-z0-9]/i.test(residue[i-1]??'')&&!/[a-z0-9]/i.test(residue[i+a.value.length]??'')));
  if(a){if(!a.term.enabled)return clarification('该病证词形尚不能可靠展开，请补充明确的中英文检索词。');matched.push(a.term);i+=a.value.length;}else unknown+=residue[i++];
 }
 unknown=unknown.replace(/PubMed|已审核|资料库|临床|请帮我|帮我|请|仅依据|依据|仅|只用|只看|只|在|Hub|不要联网|不联网|查找|检索|查询|寻找|搜索|辅助|治疗|干预|疗效|有关|相关|关于|研究|论文|文献|资料|证据|哪些|有什么|有哪些|主要|局限|比较|分析|简短|简要|说明|总结|整理|概括|列出|来源|的|和|与|及|[\s，。！？、,:;；?!.]/gi,'');
 if(unknown||!matched.length)return clarification('请补充明确的检索关键词或限定条件；目前不能可靠保留全部条件。');
 const conceptGroups=[...new Map(matched.map(t=>[t.id,t])).values()].map(t=>{
  const children=(dictionary.broaderRetrieval?.find(b=>b.id===t.id)?.includeIds??[]).map(id=>terms.find(t=>t.id===id));
  return{id:t.id,zh:t.zh,relationship:'retrieval_variant',terms:[...new Set([t.zh,...t.en,...children.flatMap(t=>[t.zh,...t.en])])]};
 });
 if(conceptGroups.length>8)return clarification('请先聚焦最多8个研究概念。');
 const pubmedQuery=conceptGroups.map(g=>'('+g.terms.filter(s=>/^[\x00-\x7f]+$/.test(s)).map(phrase).join(' OR ')+')').concat([date,design].filter(Boolean)).join(' AND ');
 const plan={schema:'hub-literature-query.v1',asOf:today,question:question.trim(),scope,dictionaryVersion:dictionary.version,aliasVersion:'hub-task-aliases.v1',semanticEquivalence:false,conceptGroups,date,design,maxResults,pubmedQuery,
  localPlan:{originalQuery:question,mode:'mapped',dictionaryVersion:dictionary.version,conceptGroups,appliedTerms:conceptGroups.flatMap(g=>g.terms),warning:null}};
 return{status:'ready',...plan,hash:routeDigest(plan)};
}
