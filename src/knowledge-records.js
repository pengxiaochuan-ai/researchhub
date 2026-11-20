import {materialKnowledgeHref,readMaterialKnowledgeTarget} from './session-material-session.js';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const fail=()=>{throw Error('回答或资料已变化，请刷新核对；当前文档草稿保持不变。');};
const label=value=>String(value??'').replace(/[\\\[\]\r\n]/g,' ');
export async function knowledgeDocumentSource(doc,scope){
 if(!id(doc?.id)||!id(doc.kbId)||!Number.isSafeInteger(doc.version)||doc.version<1||typeof doc.contentMd!=='string')fail();
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(doc.contentMd));
 const hash=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
 const href=materialKnowledgeHref({available:true,kbId:doc.kbId,docId:doc.id,docVersion:doc.version,contentSha256:hash},scope);
 if(!href)fail();return{title:doc.title,version:doc.version,href};
}
const reference=source=>source?`[${label(source.title)} · v${source.version}](${source.href})`:'';
export function knowledgeRecordTemplate(kind='document',source){
 const original=reference(source);
 switch(kind){
  case 'document':return '';
  case 'reading':return `## 原资料\n\n${original}\n\n## 要点\n\n\n## 本人思考\n\n\n## 后续行动\n\n`;
  case 'idea':return `## 问题\n\n\n## 证据线索\n\n${original}\n\n## 拟探索方向\n\n\n## 后续行动\n\n`;
  case 'guidance':return `## 指导信息\n\n- 指导人：\n- 日期：\n- 关联研究：\n\n## 原材料\n\n${original}\n\n## 讨论要点\n\n\n## 后续行动\n\n`;
  default:throw TypeError('KNOWLEDGE_RECORD_TYPE_INVALID');
 }
}
export function knowledgeRecordLinks(md,scope){
 const found=new Map();
 for(const match of String(md??'').matchAll(/\[([^\]\n]{1,500})\]\((\/pages\/k01\/\?[^\s)]+)\)/g)){
  const target=readMaterialKnowledgeTarget(match[2].slice('/pages/k01/'.length));
  if(target.kind!=='valid'||!target.docVersion||target.studyGroupId!==scope?.studyGroupId||target.researchProjectId!==scope?.researchProjectId)continue;
  found.set(match[2],{title:match[1],href:match[2]});if(found.size===20)break;
 }return [...found.values()];
}
// Model prose enters an ordinary editable document as inert text. Only the
// separately verified fixed-source metadata below produces actionable links.
const safeModelText=text=>text.replace(/https?:\/\//gi,value=>value.replace(':','[:]')).replace(/[\\`*_{}\[\]<>()#+.!|~]/g,'\\$&');
const sameSource=(a,b)=>['docId','kbId','version','contentHash','chunkId','quote'].every(k=>a?.[k]===b?.[k]);
export async function adoptKnowledgeAnswer({get,sessionId,kbId,message,scope}){
 if(!id(sessionId)||!id(kbId)||!id(message?.id)||message.role!=='assistant'||typeof message.content!=='string'||!message.content.trim())fail();
 const state=await get(`/sessions/${sessionId}/knowledge-state?limit=100`);
 const current=state.messages?.find(value=>value.id===message.id),sources=current?.meta?.provenance?.knowledgeSources;
 if(state.hubContext?.kind!=='knowledge'||state.hubContext.kbId!==kbId||current?.role!=='assistant'||current.content!==message.content||current.meta?.sourceStatus!=='current'||!Array.isArray(sources)||sources.length<1||sources.length>6||!Array.isArray(message.meta?.provenance?.knowledgeSources)||sources.length!==message.meta.provenance.knowledgeSources.length)fail();
 const links=[];
 for(let i=0;i<sources.length;i++){
  const source=sources[i];if(!sameSource(source,message.meta.provenance.knowledgeSources[i])||source.kbId!==kbId)fail();
  const actual=await get(`/sessions/${sessionId}/knowledge-sources/${message.id}/${i+1}`);
  if(actual.status!=='current'||!sameSource(actual,source))fail();
  const href=materialKnowledgeHref({available:true,kbId:actual.kbId,docId:actual.docId,docVersion:actual.version,contentSha256:actual.contentHash},scope);
  if(!href)fail();links.push(`- [${i+1}] ${reference({title:actual.docTitle,version:actual.version,href})}`);
 }
 return `## AI整理草稿\n\n${safeModelText(current.content)}\n\n### 资料来源\n\n${links.join('\n')}\n`;
}
export function appendKnowledgeAnswer(draft,answer){
 if(typeof draft!=='string'||typeof answer!=='string'||!answer.trim())fail();
 const result=draft+(draft?'\n\n---\n\n':'')+answer;
 if(new TextEncoder().encode(result).length>131072)throw Error('整理后正文过长，请先精简当前草稿；未修改文档。');
 return result;
}
