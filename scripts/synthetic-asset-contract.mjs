import assert from'node:assert/strict';
import{reportFactsHash}from'./synthetic-report-contract.mjs';
import{hashText}from'./knowledge-ai-contract.mjs';
export const ASSET_MARKER='rh-synthetic-asset.v1';
export const assetHash=reportFactsHash;
export const validateAssetNotes=value=>typeof value==='string'&&value.length<=6000?{valid:true,value}:{valid:false};
export function buildAssetSnapshot(report,run){
 assert.ok(report.status==='draft'&&report.sourceStatus==='current'&&report.version===report.currentVersion,'ASSET_REPORT_NOT_CURRENT');
 assert.ok(report.facts?.syntheticOnly===true&&report.facts.run.id===run.id&&report.facts.run.status==='needs_review','ASSET_REPORT_PARENT_INVALID');
 assert.ok(run.dataset&&assetHash(run.dataset)===run.datasetHash,'ASSET_DATASET_CHANGED');
 return structuredClone({schema:ASSET_MARKER,syntheticOnly:true,report:{id:report.id,version:report.version,contentHash:hashText(report.contentMd),factsHash:report.factsHash,contentMd:report.contentMd},facts:report.facts,sources:report.sourceRows,simulation:{dataset:run.dataset,datasetHash:run.datasetHash}});
}
export function deriveAssetLineage(parent){
 assert.ok(parent.version===parent.currentVersion&&parent.lineage.length<8,'ASSET_DERIVATION_LIMIT_OR_HISTORY');
 return[...structuredClone(parent.lineage),{id:parent.id,version:parent.version,contentHash:parent.contentHash,notes:parent.notes}];
}
const text=v=>String(v??'未提供').replace(/[\\`*_{}\[\]<>|#~]/g,'\\$&');
export function renderAssetDraft(snapshot,notes,lineage){
 assert.equal(snapshot.schema,ASSET_MARKER);
 return['### 可复用科研资产候选草稿 · 未共享／未审批',
 '仅本人本轮合成研究的软件复用候选，不是正式资产、获准模板或临床结论。历史数值只证明原运行，不能成为新研究结果。',
 '#### 复用目标与前提',text(snapshot.facts.plan.pico.question),
 '仅适用于合成软件流程验证；真实研究须另行确认资料授权、方案、方法学、采集和质控规则。原问题与局限必须保留，不因复制消除。',
 '#### 可复用步骤',
 '1. 核对原资料、PICO、方案和报告固定版本；确认当前仍有访问权限。',
 '2. 阅读下方原报告及其未解决问题；软件快照仅可作为测试输入，禁止当作真实受试者数据。',
 '3. 填写本人的复用说明；派生新草稿保留父版本和根报告，不修改原对象。',
 '4. 本片派生不执行新计算、不新建Study或方案，也不共享、审批、锁库、发布或导出。',
 '#### 根报告与软件配方',`报告 ${text(snapshot.report.id)} · v${snapshot.report.version}\n\n正文SHA256：${snapshot.report.contentHash}\n\n事实SHA256：${snapshot.report.factsHash}\n\n合成seed：${snapshot.simulation.dataset.seed} · 数据SHA256：${snapshot.simulation.datasetHash}`,
 '#### 原报告（历史事实，只读）',snapshot.report.contentMd,
 '#### 派生血缘与父说明（历史，不是本人的新结论）',lineage.length?lineage.map(p=>`- ${text(p.id)} · v${p.version} · ${p.contentHash}\n\n${text(p.notes)||'原父版本无人工说明。'}`).join('\n\n'):'初始候选，直接来自根报告。',
 '#### 本草稿人工复用说明（非数值证据）',notes?text(notes):'尚未填写；复用前请说明用途、适用条件与人工核对事项。',
 `候选事实SHA256：${assetHash(snapshot)}`].join('\n\n');
}
