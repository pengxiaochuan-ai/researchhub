import assert from 'node:assert/strict';
import{datasetHash}from'./synthetic-quality-contract.mjs';
export const REPORT_MARKER='rh-synthetic-report.v1';
export const reportFactsHash=datasetHash;
export function reportDocumentSources(sources){const docs=new Map();for(const s of sources){let row=docs.get(s.docId);if(!row){row={sourceType:'knowledge_doc',sourceId:s.docId,sourceVersion:String(s.version),snapshot:{docId:s.docId,version:s.version,contentHash:s.contentHash,chunks:[]}};docs.set(s.docId,row);}assert.ok(row.snapshot.version===s.version&&row.snapshot.contentHash===s.contentHash,'REPORT_SOURCE_VERSION_CONFLICT');row.snapshot.chunks.push(s);}return[...docs.values()];}
export function validateReportNotes(value){return typeof value==='string'&&value.length<=6000?{valid:true,value}:{valid:false,message:'人工说明最多6000字，机器事实和来源不可修改。'};}
export function buildReportFacts(plan,run){
 assert.ok(run.status==='needs_review'&&run.reviewStatus==='pending_review','REPORT_RUN_NOT_READY');
 assert.ok(run.plan?.planId===plan.id&&run.plan.version===plan.version&&run.plan.picoHash===plan.confirmation?.hash,'REPORT_PARENT_CHANGED');
 assert.ok(run.manifestHash&&run.datasetHash&&run.operatorVersion&&Array.isArray(run.numericEvidence)&&run.numericEvidence.length&&run.numericEvidence.every(n=>Number.isFinite(n.value)&&n.operator&&n.operatorVersion),'REPORT_NUMERIC_PROVENANCE_MISSING');
 return JSON.parse(JSON.stringify({schema:REPORT_MARKER,syntheticOnly:true,reviewRequired:true,plan:{id:plan.id,version:plan.version,binding:run.plan,pico:plan.pico,confirmation:plan.confirmation,contentMd:plan.contentMd},sources:plan.sources,run:{id:run.id,inputHash:run.inputHash,revision:run.revision,seed:run.dataset.seed,status:run.status,reviewStatus:run.reviewStatus,datasetHash:run.datasetHash,manifestHash:run.manifestHash,operatorVersion:run.operatorVersion,numericEvidence:run.numericEvidence,summary:run.summary,findings:run.findings,limitations:run.limitations,changes:run.changes,reason:run.reason,versions:run.versions}}));
}
const text=value=>String(value??'未提供').replace(/[\\`*_{}\[\]<>|#~]/g,'\\$&').replace(/\r?\n/g,' ');
export function renderSyntheticReport(facts,notes){
 assert.equal(facts.schema,REPORT_MARKER);const r=facts.run,p=facts.plan;
 return['### 合成试运行报告草稿 · 未审批','仅用于软件验证；不是临床疗效、正式统计、方法学批准或数据放行。不自动修复，不开放审批、锁库、发布、导出。',
 '#### 研究意图与绑定方案',text(p.pico.question),...['p','i','c','o'].map(k=>`- ${k.toUpperCase()}：${text(p.pico[k])}`),`- 方案：${text(p.id)} · v${p.version} · 正文指纹 ${text(p.binding.contentHash)} · PICO指纹 ${text(p.binding.picoHash)}`,
 '#### 实际质控与数值来源',text(r.summary),`- 运行：${text(r.id)} · 合成v${r.revision} · seed ${r.seed} · ${text(r.status)} / ${text(r.reviewStatus)}`,`- 数据SHA256：${text(r.datasetHash)}`,`- Manifest SHA256：${text(r.manifestHash)} · 执行器 ${text(r.operatorVersion)}`,
 ['| 数值项 | 实际值 | 算子／版本 |','| --- | --- | --- |',...r.numericEvidence.map(n=>`| ${text(n.name)} | ${text(n.value)} | ${text(n.operator)} / ${text(n.operatorVersion)} |`)].join('\n'),
 '#### 未解决问题与局限',...r.findings.map(f=>`- ${text(f.severity)} · ${text(f.code)}：${text(f.message)}`),...r.limitations.map(x=>'- '+text(x)),
 '#### 本次人工修订与运行链',text(r.reason),...r.changes.map(c=>`- ${text(c.rowId)} · ${text(c.field)}：${text(c.before??'缺失')} → ${text(c.after??'缺失')}`),...r.versions.map(v=>`- 合成v${v.revision} · ${text(v.id)} · ${text(v.status)}`),
 '#### 已保存方案正文（候选，不是正式方案）',text(p.contentMd),
 '#### 可追溯资料快照',...facts.sources.map((s,i)=>`- 来源 [${i+1}] ${text(s.docTitle)} · 文档 ${text(s.docId)} v${s.version} · 分块 ${text(s.chunkId)}；正文 ${text(s.contentHash)}；分块 ${text(s.chunkHash)}\n\n${text(s.quote)}`),
 '#### 研究者人工说明（不是确定性数值证据）',notes.trim()?text(notes):'尚无人工说明。',`事实快照SHA256：${reportFactsHash(facts)}`].join('\n\n');
}
