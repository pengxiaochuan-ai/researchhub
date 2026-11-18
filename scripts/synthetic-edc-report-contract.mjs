import assert from 'node:assert/strict';
import {edcDigest,syntheticDataBasis,syntheticQualityCurrent} from './synthetic-edc-contract.mjs';
export const EDC_REPORT_MARKER='rh-synthetic-edc-report.v1';
export function buildEdcReportFacts(packet,b,corrections,live,sources){
 assert(syntheticQualityCurrent(b),'EDC_REPORT_QUALITY_STALE');const e=live.explanation,status=e?.status??(live.aiStatus==='restricted'?'unavailable':live.job?.status??'not_run'),current=e?.status==='current',items=current?e.items:[];
 const facts={schema:EDC_REPORT_MARKER,syntheticOnly:true,reviewRequired:true,packet, binding:b.binding,config:b.config,basis:syntheticDataBasis(b),quality:b.quality,recordVersions:b.records.map(({recordId,syntheticSubjectKey,visitKey,formKey,status,responseRevision})=>({recordId,syntheticSubjectKey,visitKey,formKey,status,responseRevision})),corrections,sources,ai:{status,...(current?{resultMessageId:e.resultMessageId,sessionId:e.sessionId,binding:e.binding,items,sources:e.sources}:{}),unexplainedFindingIds:b.quality.findings.filter(f=>!items.some(i=>i.findingId===f.findingId)).map(f=>f.findingId)}};
 assert(Buffer.byteLength(JSON.stringify(facts))<=240000,'EDC_REPORT_CAPACITY');return structuredClone(facts);
}
export function edcReportCurrent(facts,b){return facts.schema===EDC_REPORT_MARKER&&syntheticQualityCurrent(b)&&edcDigest(facts.binding)===edcDigest(b.binding)&&edcDigest(facts.basis)===edcDigest(syntheticDataBasis(b))&&facts.quality.id===b.quality.id&&facts.quality.findingsHash===b.quality.findingsHash;}
const text=v=>String(v??'未提供').replace(/[\\`*_{}\[\]<>|#~]/g,'\\$&').replace(/\r?\n/g,' ');
export function renderEdcReport(facts,notes){
 assert.equal(facts.schema,EDC_REPORT_MARKER);assert(typeof notes==='string'&&notes.length<=6000);const q=facts.quality,ai=facts.ai;
 return['### 合成采集质控报告草稿 · 待本人核对','仅为本包合成采集演练，不是正式采集、临床有效性结论、审批或研究放行。不开放审批、锁库、共享、发布或导出。未执行Python、ResearchMethodRun或旧固定种子试跑。',
 '#### 配置与真实输入',`包 ${text(facts.packet.id)} v${facts.packet.versionNo} · 父方案 ${text(facts.binding.planId)} v${facts.binding.parentRootVersionNo}`,`数据修订 d${facts.basis.dataRevision} · 数据 SHA256 ${facts.basis.dataHash} · 配置 SHA256 ${facts.basis.configHash}`,`质控 ${text(q.id)} · ${text(q.rulesVersion)} · 问题 SHA256 ${q.findingsHash}`,`程序确定性检查 ${q.checkedRecordCount} 张记录，已完成合成录入 ${q.recordedRecordCount} 张，发现 ${q.findings.length} 项问题；不是全Study覆盖率或临床指标。`,
 '#### 记录版本',...facts.recordVersions.map(r=>`- ${text(r.recordId)} · ${text(r.syntheticSubjectKey)} / ${text(r.visitKey)} / ${text(r.formKey)} · ${text(r.status)} · 答案 r${r.responseRevision}`),
 '#### 未解决的确定性问题',...q.findings.map(f=>`- ${text(f.ruleKey)} / ${text(f.code)} · ${text(f.findingId)} · ${text(f.subjectKey)} / ${text(f.visitKey)} / ${text(f.fieldKey)}`),...(q.findings.length?[]:['本片规则未检出问题，不代表临床有效或研究放行。']),
 '#### 实际原因更正及前后值',...(facts.corrections.length?facts.corrections.flatMap(c=>[`包 v${c.versionNo} · ${text(c.recordId)} · ${text(c.author)} · ${text(c.at)} · 原因：${text(c.reason)}`,...c.changes.map(v=>`- ${text(v.fieldKey)}：${text(JSON.stringify(v.before))} → ${text(JSON.stringify(v.after))}`)]):['本包尚无实际原因更正，不生成虚构更正。']),
 '#### AI解释及未解释范围',`AI状态：${text(ai.status)}。未解释问题 ${ai.unexplainedFindingIds.length} 项；报告生成不证明AI已执行或问题已解决。`,...(ai.items??[]).flatMap(i=>[text(i.explanation),text(i.question)]),...(ai.resultMessageId?[`真实消息 ${text(ai.resultMessageId)} · 会话 ${text(ai.sessionId)}`]:['无当前可用的真实AI解释；不展示固定示例。']),
 '#### 已审核资料快照',...facts.sources.map((s,i)=>`- 来源 [${i+1}] ${text(s.docTitle)} · ${text(s.docId)} v${s.version} · ${text(s.chunkId)} · ${text(s.contentHash)} / ${text(s.chunkHash)}\n\n${text(s.quote)}`),
 '#### 本人说明（不是机器事实或科学数值证据）',notes.trim()?text(notes):'尚无本人说明。',`机器事实 SHA256：${edcDigest(facts)}`].join('\n\n');
}
