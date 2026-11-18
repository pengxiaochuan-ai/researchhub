// Deterministic packaging only: historical facts are never a new study's result.
import assert from 'node:assert/strict';
import {edcDigest,exactEdcFields} from './synthetic-edc-contract.mjs';
import {normalizePreparationConfig} from './research-execution-preparation-contract.mjs';
import {CRF_REPORT_MARKER,renderCrfMethodReport} from './synthetic-crf-methods-report-contract.mjs';
import {hashText} from './knowledge-ai-contract.mjs';
export const CRF_ASSET_MARKER='rh-crf-method-asset.v1';
export const CRF_ASSET_PREFIX='rh-crf-method-asset-20261026:';
const recipeSchema='rh-crf-method-reuse-recipe.v1';
const steps=['reconfirm_context','prepare_new_data','run_new_quality','execute_new_method','review_new_report'];
const confirmations=['question_and_material_rights','population_and_eligibility','visits_units_and_missingness','manual_ranges_and_method','new_data_and_quality','formal_governance'];
const confirmationLabels=['目标问题/PICO及材料使用授权','目标人群和入排标准','访视时点、单位及缺失语义','人工范围与方法适用性','新数据及新质控','正式治理要求'];
const sourceKeys=['docId','kbId','chunkId','docTitle','version','contentHash','chunkHash'];
const factKeys=['schema','syntheticOnly','reviewRequired','packet','binding','pico','config','basis','quality','recordVersions','method','coverage','result','sources','ai'];
const check=(value,code='CRF_ASSET_CONTEXT_INVALID')=>assert.ok(value,code);
const exact=(v,keys)=>{try{exactEdcFields(v,keys);}catch{check(false,'CRF_ASSET_INPUT_INVALID');}};
const pick=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]]));
const isId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const isHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const isVersion=v=>Number.isSafeInteger(v)&&v>=1&&v<=30;
const bounded=(v,max)=>check(Buffer.byteLength(typeof v==='string'?v:JSON.stringify(v))<=max,'CRF_ASSET_CAPACITY');
export function assertCrfMethodReuseRecipe(r){
 exact(r,['schema','source','config','method','coverage','steps','mustReconfirm']);check(r.schema===recipeSchema);
 exact(r.source,['reportId','versionNo','versionId','factsHash','materials']);
 check(isId(r.source.reportId)&&isVersion(r.source.versionNo)&&isId(r.source.versionId)&&isHash(r.source.factsHash));
 check(Array.isArray(r.source.materials)&&r.source.materials.length>0);
 for(const m of r.source.materials){exact(m,sourceKeys);check(['docId','kbId','chunkId'].every(k=>isId(m[k]))&&typeof m.docTitle==='string'&&m.docTitle.length>0&&Number.isSafeInteger(m.version)&&m.version>0&&isHash(m.contentHash)&&isHash(m.chunkHash));}
 exact(r.config,['label','outcomes','visits','form','mappings','missingStates']);
 // The original normalizer rejects unknown keys at every configuration level.
 normalizePreparationConfig({...r.config,notes:''});
 exact(r.method,['executor','workerVersion','adapterVersion']);check(Object.values(r.method).every(v=>typeof v==='string'&&v.length>0&&v.length<=160));
 exact(r.coverage,['scope','included','notExamined','rangeRule']);
 check(r.coverage.scope==='own_synthetic_packet'&&r.coverage.rangeRule==='explicit_manual_config_only');
 check(Array.isArray(r.coverage.included)&&Array.isArray(r.coverage.notExamined)&&[...r.coverage.included,...r.coverage.notExamined].every(v=>typeof v==='string'&&v.length>0));
 check(edcDigest(r.steps)===edcDigest(steps)&&edcDigest(r.mustReconfirm)===edcDigest(confirmations));bounded(r,768*1024);return r;
}
export function buildCrfMethodAssetSnapshot({report,reportVersionId,run}){
 check(report?.typeKey==='data_quality_report'&&report.status==='draft'&&report.sourceStatus==='current'&&report.version===report.currentVersion&&isVersion(report.version)&&isId(report.id)&&isId(reportVersionId));
 const f=report.facts;exact(f,factKeys);bounded(f,240000);check(f.schema===CRF_REPORT_MARKER&&f.syntheticOnly===true&&f.reviewRequired===true&&report.factsHash===edcDigest(f));
 check(run?.sourceStatus==='current'&&run.status==='needs_review'&&f.method.runId===run.id&&f.packet.id===run.collectionId&&f.method.inputHash===run.inputHash&&f.method.resultHash===run.resultHash);
 check(report.contentMd===renderCrfMethodReport(f,report.notes));
 const c=normalizePreparationConfig(f.config),config={label:c.label,outcomes:c.outcomes,visits:c.visits,form:c.form,mappings:c.mappings,missingStates:c.missingStates};
 const reuseRecipe=assertCrfMethodReuseRecipe({schema:recipeSchema,source:{reportId:report.id,versionNo:report.version,versionId:reportVersionId,factsHash:report.factsHash,materials:f.sources.map(m=>pick(m,sourceKeys))},config,
  method:pick(f.method,['executor','workerVersion','adapterVersion']),coverage:pick(f.coverage,['scope','included','notExamined','rangeRule']),steps:[...steps],mustReconfirm:[...confirmations]});
 const snapshot=structuredClone({schema:CRF_ASSET_MARKER,report:{id:report.id,versionNo:report.version,versionId:reportVersionId,contentHash:hashText(report.contentMd),factsHash:report.factsHash,contentMd:report.contentMd},historicalFacts:f,reuseRecipe});
 bounded(snapshot,768*1024);return {snapshot,snapshotHash:edcDigest(snapshot)};
}
const text=v=>String(v??'未提供').replace(/[\\`*_{}\[\]<>|#~]/g,'\\$&').replace(/\r?\n/g,' ');
export function renderCrfMethodAsset(snapshot,notes,lineage){
 check(snapshot?.schema===CRF_ASSET_MARKER);assertCrfMethodReuseRecipe(snapshot.reuseRecipe);
 check(typeof notes==='string'&&notes.length<=6000,'CRF_ASSET_INPUT_INVALID');check(Array.isArray(lineage)&&lineage.length<=8,'CRF_ASSET_LINEAGE_INVALID');
 const r=snapshot.reuseRecipe;
 const md=['### 本人方法资产候选 · 私有草稿','仅为复用准备；未应用到新研究，未重新执行方法或AI。以下历史证据不是新研究结果，不是正式模板或方法学认可。',
  '#### 复用配方（原配置，仅供重新核对）',`配置：${text(r.config.label)}；方法：${text(r.method.executor)} / ${text(r.method.workerVersion)} / ${text(r.method.adapterVersion)}`,
  ...r.config.visits.map(v=>`- 访视：${text(v.name)}；时点 ${text(v.targetDayOffset)}（null为未定义，不代表0）`),
  ...r.config.form.schema.fields.map(f=>`- 字段：${text(f.label)} / ${text(f.type)}；人工范围 ${text(f.min)} 至 ${text(f.max)}；必须按目标重新确认。`),
  '#### 待重新确认（未检查）',...confirmationLabels.map(v=>'- '+v),
  '#### 原方法覆盖范围（不是目标研究覆盖）',`覆盖：${text(r.coverage.included.join('、'))}`,`未检查：${text(r.coverage.notExamined.join('、'))}`,
  '#### 固定来源',`报告 ${text(snapshot.report.id)} v${snapshot.report.versionNo}；实际版本 ${text(snapshot.report.versionId)}`,
  ...r.source.materials.map(m=>`- ${text(m.docTitle)} · ${text(m.docId)} v${m.version} / ${text(m.chunkId)}`),
  '#### 原报告历史证据（只读）',snapshot.report.contentMd,
  '#### 本人复用说明（不是机器事实或新AI输出）',notes.trim()?text(notes):'尚无本人复用说明。',
  '#### 派生血缘（固定父版本，不新建研究）',...lineage.map(v=>`- ${text(v.id)} v${v.version}；原说明：${text(v.notes)}`)].join('\n\n');
 bounded(md,512*1024);return md;
}

export function crfMethodAssetNotesOperation(state,body){
 exact(body,['baseVersionNo','notes','requestKey']);check(isVersion(body.baseVersionNo)&&typeof body.notes==='string'&&body.notes.length<=6000&&typeof body.requestKey==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(body.requestKey),'CRF_ASSET_INPUT_INVALID');
 const hash=edcDigest(body),prior=state.operations.find(o=>o.key===body.requestKey);
 if(prior){check(prior.hash===hash,'CRF_ASSET_KEY_CONFLICT');return {idempotent:true,notes:state.notes,operation:prior};}
 check(state.versionNo===body.baseVersionNo,'CRF_ASSET_VERSION_CONFLICT');check(state.notes!==body.notes,'CRF_ASSET_NO_CHANGE');check(state.versionNo<30,'CRF_ASSET_CAPACITY');
 return {idempotent:false,notes:body.notes,operation:{key:body.requestKey,hash,versionNo:state.versionNo+1}};
}
export function crfMethodAssetSourceState({snapshot,report,ancestors}){
 check(snapshot?.schema===CRF_ASSET_MARKER&&report?.id===snapshot.report.id&&Array.isArray(ancestors));
 if(report.sourceStatus==='restricted'||ancestors.some(p=>p.sourceStatus==='restricted'))return 'restricted';
 return report.sourceStatus==='current'&&report.currentVersion===snapshot.report.versionNo&&ancestors.every(p=>p.sourceStatus==='current'&&p.version===p.currentVersion)?'current':'stale';
}
export function deriveCrfMethodAssetLineage(parent){
 check(parent?.sourceStatus==='current'&&isId(parent.id)&&isVersion(parent.version)&&parent.version===parent.currentVersion&&isHash(parent.contentHash)&&typeof parent.notes==='string'&&parent.notes.length<=6000&&Array.isArray(parent.lineage),'CRF_ASSET_LINEAGE_INVALID');
 check(parent.lineage.length<8,'CRF_ASSET_CAPACITY');
 for(const p of parent.lineage){exact(p,['id','version','contentHash','notes']);check(isId(p.id)&&isVersion(p.version)&&isHash(p.contentHash)&&typeof p.notes==='string'&&p.notes.length<=6000,'CRF_ASSET_LINEAGE_INVALID');}
 check(new Set([...parent.lineage.map(p=>p.id),parent.id]).size===parent.lineage.length+1,'CRF_ASSET_LINEAGE_INVALID');
 return [...structuredClone(parent.lineage),{id:parent.id,version:parent.version,contentHash:parent.contentHash,notes:parent.notes}];
}
