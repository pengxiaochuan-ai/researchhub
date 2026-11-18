// Synthetic execution preparation only: no formal Protocol/Form/Subject writes or scoring.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {editablePlanContent} from './research-plan-contract.mjs';
const check=(ok,code='PREPARATION_INPUT_INVALID')=>assert.ok(ok,code);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function fields(v,required,optional=[]){check(plain(v));check(required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>[...required,...optional].includes(k)));}
const text=(v,max,blank=false)=>{check(typeof v==='string'&&v.length<=max&&(blank||v.trim().length));return v.trim();};
const key=v=>{check(typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v)&&!['prototype','constructor','__proto__'].includes(v));return v;};
const array=(v,max)=>{check(Array.isArray(v)&&v.length<=max);return v;};
const unique=v=>check(new Set(v).size===v.length);
const chineseNumerals='零〇一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟';
// Share quantity detection between free-text input masking and candidate prose validation.
function scientificNumbers(){const n='['+chineseNumerals+']+',units='毫秒|微秒|分钟|小时|刻钟|毫克|微克|千克|公斤|毫升|微升|厘米|毫米|千米|平方厘米|立方厘米|日|天|周|月|年|秒|时|分|次|例|名|人|组|倍|成|个|项|份|克|升|米|度|岁|％|%|mg|kg|ml|mL|cm|mm|mmHg|mmol';return new RegExp('['+chineseNumerals+']{2,}|点'+n+'|(?:'+n+'(?:点'+n+')?|半)(?:余|多|来)?\\s*(?:'+units+')|'+n+'比'+n+'|(?:为|等于|取|设定为|设为|达到|约|至少|至多|大于|小于|[：:])\\s*'+n+'(?=$|[\\s，。；、！？,.;!?])|百分之|半数','g');}
export const preparationDigest=v=>createHash('sha256').update(JSON.stringify(v,(_k,x)=>plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)).digest('hex');
export function preparationBasis(p){
 check(p.block.confirmation?.hash&&Number.isSafeInteger(p.a.currentVersionNo));return{artifactId:p.a.id,versionNo:p.a.currentVersionNo,contentHash:createHash('sha256').update(editablePlanContent(p.v.contentMd)).digest('hex'),picoConfirmationHash:p.block.confirmation.hash,sourcesHash:preparationDigest(p.block.sources)};
}
export function readPreparationBlock(root){
 if(root.executionPreparation===undefined)return null;const b=root.executionPreparation;
 fields(b,['schemaVersion','purpose','basis','headVersionNo','revisionNo','config','rules','pending','opinionHead','decisions']);check(b.schemaVersion===1&&b.purpose==='synthetic_execution_preparation'&&Number.isSafeInteger(b.headVersionNo)&&b.headVersionNo>0&&Number.isSafeInteger(b.revisionNo)&&b.revisionNo>0,'PREPARATION_CONTEXT_INVALID');
 fields(b.basis,['artifactId','versionNo','contentHash','picoConfirmationHash','sourcesHash']);normalizePreparationConfig(b.config);return b;
}
export function preparationCurrent(b,currentRootVersionNo){return Boolean(b&&b.headVersionNo===currentRootVersionNo);}
export function preparationSummary(root,version){const b=readPreparationBlock(root);if(!b)return{status:'empty'};const status=preparationCurrent(b,version)?'current':'stale';return{status,revisionNo:b.revisionNo,findingCount:preparationRules(b.config,status).findings.length};}
const bindingKeys=['artifactId','executionVersionNo','ownerAccountId','tenantId','studyGroupId','researchProjectId','sessionId','kbId','basisHash','configHash','rulesHash','revisionNo'];
export function preparationTaskBinding(payload){
 check(['researchPlan','researchDesign','researchExecutionPreparation'].filter(k=>payload?.[k]!==undefined).length<=1,'PREPARATION_BINDING_CHANGED');if(payload?.researchExecutionPreparation===undefined)return null;
 const task=payload.researchExecutionPreparation;fields(task,['kind','binding']);check(task.kind==='consistency','PREPARATION_BINDING_CHANGED');fields(task.binding,bindingKeys);for(const k of ['executionVersionNo','revisionNo'])check(Number.isSafeInteger(task.binding[k])&&task.binding[k]>0,'PREPARATION_BINDING_CHANGED');for(const k of bindingKeys.filter(k=>!['executionVersionNo','revisionNo'].includes(k)))text(task.binding[k],160);return task;
}
export function preparationInputBinding(plan,user,executionVersionNo=plan.a.currentVersionNo){
 const b=readPreparationBlock(plan.block);check(b&&plan.a.ownerAccountId===user.accountId,'PREPARATION_BINDING_CHANGED');return{artifactId:plan.a.id,executionVersionNo,ownerAccountId:user.accountId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId:plan.block.sessionId,kbId:plan.block.kbId,basisHash:preparationDigest(b.basis),configHash:preparationDigest(b.config),rulesHash:preparationDigest(b.rules),revisionNo:b.revisionNo};
}
export function assertPreparationBinding(binding,current){fields(binding,bindingKeys);check(bindingKeys.every(k=>binding[k]!==undefined&&binding[k]===current[k])&&binding.executionVersionNo===current.currentVersionNo,'PREPARATION_BINDING_CHANGED');}
const opinionKeys=['resultMessageId','executionVersionNo','basisHash','configHash','rulesHash','revisionNo'];
export function preparationResultCurrent(result,block,rootVersion){
 if(!result?.binding||!block||!preparationCurrent(block,rootVersion))return false;const b=result.binding;if(b.basisHash!==preparationDigest(block.basis)||b.configHash!==preparationDigest(block.config)||b.rulesHash!==preparationDigest(block.rules)||b.revisionNo!==block.revisionNo)return false;
 if(!block.opinionHead)return rootVersion===b.executionVersionNo;const expected={resultMessageId:result.resultMessageId,...b},h=block.opinionHead;return h.lastRootVersionNo===rootVersion&&opinionKeys.every(k=>h[k]===expected[k]);
}
export function applyPreparationDecisions({block,result,rootVersion,decisions,accountId,at}){
 check(preparationResultCurrent(result,block,rootVersion),'PREPARATION_RESULT_CHANGED');array(decisions,6);check(decisions.length>0);unique(decisions.map(d=>d?.itemId));
 const records=decisions.map(d=>{fields(d,['itemId','action','reason']);check(result.items.some(i=>i.itemId===d.itemId)&&!block.decisions.some(r=>r.resultMessageId===result.resultMessageId&&r.itemId===d.itemId),'PREPARATION_ITEM_FINALIZED');check(['acknowledge','needs_revision'].includes(d.action));return{itemId:d.itemId,action:d.action,reason:text(d.reason,600),resultMessageId:result.resultMessageId,accountId,at};});
 const binding=result.binding,opinionHead=Object.fromEntries(opinionKeys.map(k=>[k,k==='resultMessageId'?result.resultMessageId:binding[k]]));return{...block,headVersionNo:rootVersion+1,opinionHead:{...opinionHead,lastRootVersionNo:rootVersion+1},decisions:[...block.decisions,...records]};
}
export function rebindPreparation({block,basis,rootVersion}){check(block&&basis.artifactId===block.basis.artifactId&&basis.versionNo===rootVersion,'PREPARATION_BASIS_CHANGED');return{...nextPreparation({config:block.config,basis,previous:null,baseVersionNo:rootVersion}),revisionNo:block.revisionNo+1};}
/** Three existing producer families share the same parent, without a new queue/lock. */
export async function assertPreparationIdle(plan,readJob){
 for(const ref of [plan.block.pending,plan.block.design?.pending,readPreparationBlock(plan.block)?.pending]){if(!ref)continue;const j=await readJob(ref.jobId);check(j&&j.id===ref.jobId&&j.accountId===plan.a.ownerAccountId&&j.sessionId===plan.block.sessionId,'PREPARATION_CONTEXT_INVALID');preparationTaskBinding(j.payload);const parent=j.payload?.researchPlan?.artifactId??j.payload?.researchDesign?.binding?.artifactId??j.payload?.researchExecutionPreparation?.binding?.artifactId;check(parent===plan.a.id&&['queued','processing','completed','failed'].includes(j.status),'PREPARATION_CONTEXT_INVALID');check(!['queued','processing'].includes(j.status),'PREPARATION_JOB_PENDING');}
}
export function preparationPaths(config){const c=normalizePreparationConfig(config);return['basis','outcomes','visits','form.fields',...c.outcomes.flatMap(o=>['outcomes.'+o.key+'.definition','outcomes.'+o.key+'.unit']),...c.visits.map(v=>'visits.'+v.key+'.timing'),...c.form.schema.fields.map(f=>'form.fields.'+f.key+'.required'),...c.mappings.flatMap(m=>['mappings.'+m.outcomeKey+'.'+m.fieldKey+'.visitKeys','mappings.'+m.outcomeKey+'.'+m.fieldKey+'.unit'])];}
export function preparationModelConfig(config){
 const technical=new Set(['key','outcomeKey','fieldKey','visitKeys','schemaVersion']);function mask(value,name){if(typeof value==='number')return'NUMERIC_PARAMETER_REDACTED';if(typeof value==='string')return technical.has(name)?value:value.replace(/[0-9０-９]+(?:[.．][0-9０-９]+)?/g,'NUMERIC_PARAMETER_REDACTED').replace(scientificNumbers(),'NUMERIC_PARAMETER_REDACTED');if(Array.isArray(value))return value.map(v=>mask(v,name));if(plain(value))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,mask(v,k)]));return value;}return mask(normalizePreparationConfig(config));
}
export function preparationModelRules(rules){return{findings:rules.findings.map(({findingId,targetPaths,severity,message})=>({findingId,targetPaths,severity,message}))};}
/** Strict candidate prose: no model-authored patch or numerical configuration enters storage. */
export function parsePreparationCheck(value,trusted){
 text(value,16000);const parsed=JSON.parse(value);fields(parsed,['items']);array(parsed.items,6);check(parsed.items.length>0);const paths=preparationPaths(trusted.config),findings=trusted.rules.findings,allReferences=[];
 const items=parsed.items.map(item=>{
  fields(item,['kind','targetPaths','findingIds','text']);check(['explanation','question'].includes(item.kind));array(item.targetPaths,4);check(item.targetPaths.length>0);unique(item.targetPaths);check(item.targetPaths.every(p=>paths.includes(p)),'PREPARATION_TARGET_INVALID');array(item.findingIds,4);unique(item.findingIds);check(item.findingIds.every(id=>findings.some(f=>f.findingId===id&&f.targetPaths.some(p=>item.targetPaths.includes(p)))),'PREPARATION_FINDING_INVALID');
  const prose=text(item.text,600);check(item.kind!=='explanation'||item.findingIds.length>0,'PREPARATION_FINDING_REQUIRED');check(item.kind!=='question'||/[?？](?:\s*\[[1-9]\d*\])*\s*$/.test(prose),'PREPARATION_QUESTION_REQUIRED');
  const refs=[...prose.matchAll(/[\[［][^\]］]*[\]］]/g)].map(m=>m[0]);check(refs.every(r=>/^\[[1-9]\d*\]$/.test(r)&&Number(r.slice(1,-1))<=trusted.sources.length),'PREPARATION_CITATION_INVALID');allReferences.push(...refs);
  check(refs.length>0||item.kind==='explanation'&&item.findingIds.length>0&&!/材料|资料|文献|片段|研究结果|证据|报告|显示|指出/.test(prose),'PREPARATION_CITATION_REQUIRED');
  let narrative=prose.replace(/\[[1-9]\d*\]/g,'');for(const id of [...item.targetPaths,...item.findingIds])narrative=narrative.split(id).join('');
  check(!/[\d０-９]/.test(narrative)&&!scientificNumbers().test(narrative),'PREPARATION_NUMERIC_UNGROUNDED');check(!/忽略.{0,12}(规则|约束|指令)|执行(?:命令|脚本)|(?:请|立即|直接|自动).{0,8}(?:写入|修改|覆盖|删除|发布|审批|导出)/.test(narrative),'PREPARATION_INSTRUCTION_REJECTED');
  return{...item,text:prose,itemId:'epi_'+preparationDigest(item).slice(0,24)};
 });unique(items.map(i=>i.itemId));check(allReferences.length>0,'PREPARATION_CITATION_REQUIRED');return{items};
}
export function nextPreparation({config,basis,previous,baseVersionNo}){
 check(!previous||preparationCurrent(previous,baseVersionNo),'PREPARATION_STALE');const clean=normalizePreparationConfig(config);
 return{schemaVersion:1,purpose:'synthetic_execution_preparation',basis:previous?.basis??basis,headVersionNo:baseVersionNo+1,revisionNo:(previous?.revisionNo??0)+1,config:clean,rules:preparationRules(clean,'current'),pending:null,opinionHead:null,decisions:[]};
}
export function assertPreparationRequestSize(kind,value,rawBytes){
 check(['versions','previews','jobs','decisions','rebindings'].includes(kind));const bytes=rawBytes??Buffer.byteLength(JSON.stringify(value));check(Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=(kind==='versions'?131072:32768),'PREPARATION_REQUEST_TOO_LARGE');return bytes;
}
export function preparationRequestRoute(kind){check(['versions','small'].includes(kind));return new RegExp('^/api/research-plan-drafts/[^/]+/execution-preparation/'+(kind==='versions'?'versions':'(?:previews|jobs|decisions|rebindings)')+'/?$','i');}
export function normalizePreparationConfig(input){
 fields(input,['label','outcomes','visits','form','mappings','missingStates','notes']);
 const outcomes=array(input.outcomes,8).map(o=>{fields(o,['key','label','definition','unit']);return{key:key(o.key),label:text(o.label,120),definition:text(o.definition,1000,true),unit:text(o.unit,40,true)};});unique(outcomes.map(o=>o.key));
 const visits=array(input.visits,4).map(v=>{fields(v,['key','name','order','targetDayOffset','windowBeforeDays','windowAfterDays']);check(Number.isInteger(v.order)&&v.order>=1&&v.order<=4);for(const [k,min,max]of [['targetDayOffset',-3650,3650],['windowBeforeDays',0,365],['windowAfterDays',0,365]])check(v[k]===null||Number.isInteger(v[k])&&v[k]>=min&&v[k]<=max);return{...v,key:key(v.key),name:text(v.name,120)};});unique(visits.map(v=>v.key));unique(visits.map(v=>v.order));
 fields(input.form,['key','name','schema']);fields(input.form.schema,['schemaVersion','fields']);check(input.form.schema.schemaVersion==='form-schema.v1');
 const formFields=array(input.form.schema.fields,12).map(f=>{
  fields(f,['key','label','type'],['required','min','max','options']);check(['number','integer','text','select','boolean'].includes(f.type));if(Object.hasOwn(f,'required'))check(typeof f.required==='boolean');
  const numeric=['number','integer'].includes(f.type);for(const n of ['min','max'])if(Object.hasOwn(f,n))check(numeric&&Number.isFinite(f[n]));if(Object.hasOwn(f,'min')&&Object.hasOwn(f,'max'))check(f.min<=f.max);
  const next={...f,key:key(f.key),label:text(f.label,120)};
  if(f.type==='select'){array(f.options,12);check(f.options.length>0);next.options=f.options.map(o=>{if(typeof o==='string')return text(o,64);fields(o,['value','label']);return{value:text(o.value,64),label:text(o.label,120)};});unique(next.options.map(o=>typeof o==='string'?o:o.value));}else check(!Object.hasOwn(f,'options'));
  return next;
 });unique(formFields.map(f=>f.key));
 const form={key:key(input.form.key),name:text(input.form.name,120),schema:{schemaVersion:'form-schema.v1',fields:formFields}};
 const mappings=array(input.mappings,24).map(m=>{fields(m,['outcomeKey','fieldKey','visitKeys','unit']);key(m.outcomeKey);key(m.fieldKey);check(outcomes.some(o=>o.key===m.outcomeKey)&&formFields.some(f=>f.key===m.fieldKey));array(m.visitKeys,4);unique(m.visitKeys);check(m.visitKeys.every(k=>visits.some(v=>v.key===k)));return{outcomeKey:m.outcomeKey,fieldKey:m.fieldKey,visitKeys:[...m.visitKeys],unit:text(m.unit,40,true)};});unique(mappings.map(m=>m.outcomeKey+'.'+m.fieldKey));
 check(JSON.stringify(input.missingStates)===JSON.stringify(['missing','not_measured','not_applicable']));
 return{label:text(input.label,120),outcomes,visits,form,mappings,missingStates:[...input.missingStates],notes:text(input.notes,1000,true)};
}

/** Deterministic configuration findings; never a methodological approval. */
export function preparationRules(config,basisState){
 check(['current','stale'].includes(basisState));const c=normalizePreparationConfig(config),findings=[];
 const add=(ruleKey,path,message,severity='missing')=>{const targetPaths=[path];findings.push({findingId:'epf_'+preparationDigest({ruleKey,targetPaths}).slice(0,24),ruleKey,targetPaths,severity,message});};
 if(!c.outcomes.length)add('R01','outcomes','尚未登记结局定义。');
 for(const o of c.outcomes){if(!o.definition)add('R01','outcomes.'+o.key+'.definition','结局操作定义待确认。');if(!o.unit)add('R01','outcomes.'+o.key+'.unit','结局单位或不适用声明待确认。');if(!c.mappings.some(m=>m.outcomeKey===o.key))add('R02','outcomes.'+o.key+'.definition','结局尚无采集字段映射。');}
 if(!c.visits.length)add('R03','visits','尚未登记访视。');
 for(const m of c.mappings)if(!m.visitKeys.length)add('R03','mappings.'+m.outcomeKey+'.'+m.fieldKey+'.visitKeys','映射尚未指定访视。');
 for(const v of c.visits)if(['targetDayOffset','windowBeforeDays','windowAfterDays'].some(k=>v[k]===null))add('R04','visits.'+v.key+'.timing','访视时间安排待专业确认。');
 if(!c.form.schema.fields.length)add('R05','form.fields','尚未登记采集字段。');
 for(const f of c.form.schema.fields)if(c.mappings.some(m=>m.fieldKey===f.key)&&f.required!==true)add('R05','form.fields.'+f.key+'.required','该结局字段采集必需性待核对。');
 for(const m of c.mappings){const o=c.outcomes.find(o=>o.key===m.outcomeKey);if(!m.unit||!o.unit)add('R06','mappings.'+m.outcomeKey+'.'+m.fieldKey+'.unit','单位声明尚未明确。');else if(m.unit!==o.unit)add('R06','mappings.'+m.outcomeKey+'.'+m.fieldKey+'.unit','人工单位声明不同，未作单位换算。','conflict');}
 if(basisState==='stale')add('R07','basis','方案基准已变化，须显式核对后重绑。','stale');
 findings.sort((a,b)=>a.ruleKey.localeCompare(b.ruleKey)||a.targetPaths[0].localeCompare(b.targetPaths[0]));
 return{version:'execution-preparation.rules.v1',findings,capacityExceeded:findings.length>24};
}

/** Missing/required truth table wraps, rather than changes, the original pure validator. */
export function preparationPreview(config,input,validate){
 const c=normalizePreparationConfig(config);check(plain(input));check(Object.keys(input).every(k=>c.form.schema.fields.some(f=>f.key===k)));
 const normalized={},errors=[];
 if(!c.form.schema.fields.length)errors.push({fieldKey:null,code:'FORM_EMPTY'});
 for(const f of c.form.schema.fields){
  const answer=Object.hasOwn(input,f.key)?input[f.key]:{state:'missing'};check(plain(answer));
  if(answer.state==='value')fields(answer,['state','value']);else{fields(answer,['state']);check(c.missingStates.includes(answer.state));}
  if(answer.state!=='value'){normalized[f.key]={state:answer.state};if(f.required)errors.push({fieldKey:f.key,code:'REQUIRED_MISSING'});continue;}
  if(answer.value===null||typeof answer.value==='string'&&!answer.value.trim()){errors.push({fieldKey:f.key,code:'EMPTY_VALUE'});continue;}
  try{const result=validate({schemaVersion:'form-schema.v1',fields:[f]},{[f.key]:answer.value});normalized[f.key]={state:'value',value:result[f.key]};}catch(e){const code=e instanceof Error?e.message:'';check(/^FORM_ANSWER_(INVALID_TYPE|OUT_OF_RANGE|INVALID_OPTION)$/.test(code),'PREPARATION_VALIDATOR_FAILED');errors.push({fieldKey:f.key,code});}
 }
 return{valid:errors.length===0,normalized,errors};
}
