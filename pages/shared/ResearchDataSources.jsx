import React from 'react';import {captureUrl} from '../../src/formal-capture-session.js';import {subjectUrl} from '../../src/research-subjects-session.js';
import './ResearchDataSources.css';
export default function ResearchDataSources({evidence}){
 if(evidence?.schema!=='hub-data-evidence.v1'||!evidence.study?.id||!Array.isArray(evidence.sources))return null;
 return <details className="research-data-sources"><summary>核对本次程序结果与来源 · {evidence.sources.length}条</summary><p>[R1] {evidence.study.name}{evidence.study.protocolVersion?` · 方案v${evidence.study.protocolVersion}`:''}{evidence.counts?` · ${evidence.counts.subjects}名被试、${evidence.counts.responses}份固定表单`:''}</p><ul>{evidence.sources.map(s=><li key={s.id}><a href={s.kind==='fixed-crf'?captureUrl('s09',evidence.study.id,{visitId:s.visitId,assignmentId:s.assignmentId,...s.ref}):subjectUrl('s03',evidence.study.id)}>[{s.id}] {s.subjectCode}{s.kind==='fixed-crf'?` · ${s.visitCode} · 修订${s.ref.revisionNo}`:' · 建档记录'}</a>{s.source&&<span> · {s.source.sheet}第{s.source.rowNumber}行</span>}</li>)}</ul><p>仅本次本人固定导入记录；程序事实与AI解释分别展示。</p></details>;
}
