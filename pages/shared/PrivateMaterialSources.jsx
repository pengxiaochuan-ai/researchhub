import React from 'react';
import {materialKnowledgeHref} from '../../src/session-material-session.js';
import './PrivateMaterialSources.css';
export default function PrivateMaterialSources({evidence}){
 if(evidence?.schema!=='hub-private-material-pack.v1'||!Array.isArray(evidence.sources))return null;
 const scope=evidence.binding?.principal;
 return <details className="private-material-sources"><summary>本次资料与阅读范围 · {evidence.sources.length}份</summary>
  {evidence.sources.map((source,index)=>{
   const href=source.docVersion!=null&&source.contentSha256?materialKnowledgeHref({available:true,kbId:source.kbId,docId:source.docId,docVersion:source.docVersion,contentSha256:source.contentSha256},scope):null;
   return <section key={source.id} aria-label={'资料 '+(index+1)}><p><b>[{index+1}] {source.title}</b>{href&&<> · <a href={href} target="_blank" rel="noopener noreferrer">查看原资料</a></>}</p>
    <p>{source.reviewed?'本人私有资料':'本人上传，尚未审核'} · {source.coverage?.complete?'已读取本次全部解析文字':'已选读 '+source.coverage?.readCharacters+' / '+source.coverage?.totalCharacters+' 字符，非全文审阅'}</p>
    {source.fragments.map(fragment=><details key={fragment.id}><summary>原文 · 第{fragment.lineStart}–{fragment.lineEnd}行</summary><pre>{fragment.text}</pre></details>)}
   </section>;
  })}
 </details>;
}
