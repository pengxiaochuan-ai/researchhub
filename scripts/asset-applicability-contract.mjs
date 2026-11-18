// Declaration projection only. This is not an AI prompt or clinical applicability test.
import assert from 'node:assert/strict';
import {assertCrfMethodReuseRecipe,CRF_ASSET_MARKER} from './crf-method-assets-contract.mjs';
import {normalizePreparationConfig} from './research-execution-preparation-contract.mjs';
import {edcDigest,exactEdcFields} from './synthetic-edc-contract.mjs';
const check=(v,code)=>assert.ok(v,code);
export function applicabilityInput({asset,target}={}){
 check(asset?.snapshot?.schema===CRF_ASSET_MARKER&&asset.sourceStatus==='current'&&asset.version===asset.currentVersion,'APPLICABILITY_SOURCE_INVALID');
 assertCrfMethodReuseRecipe(asset.snapshot.reuseRecipe);
 check(target?.stage==='protocol_draft'&&target.sourceStatus==='current'&&target.version===target.currentVersion&&target.pico&&target.confirmation?.hash,'APPLICABILITY_TARGET_INVALID');
 const recipe=asset.snapshot.reuseRecipe,projectConfig=c=>{const {notes,...value}=normalizePreparationConfig({...c,notes:''});return value;};
 const pico=v=>Object.fromEntries(['question','p','i','c','o'].map(k=>[k,typeof v?.[k]==='string'?v[k]:null]));
 const derived=target.derivedFrom;
 if(derived)check(typeof derived.planId==='string'&&Number.isSafeInteger(derived.versionNo)&&derived.versionNo>0&&/^[a-f0-9]{64}$/.test(derived.contentHash),'APPLICABILITY_TARGET_INVALID');
 return structuredClone({schema:'rh-asset-applicability-input.v1',source:{pico:pico(asset.snapshot.historicalFacts?.pico),config:projectConfig(recipe.config),method:recipe.method,coverage:recipe.coverage},
  target:{pico:pico(target.pico),config:target.preparationStatus==='current'&&target.config?projectConfig(target.config):null,confirmationStatus:derived?'derived_reference_only':'original_confirmation',derivedFrom:derived?{planId:derived.planId,versionNo:derived.versionNo,contentHash:derived.contentHash}:null}});
}
export const APPLICABILITY_RULE_IDS=['question','eligibility','outcomes','visits','crf_mapping','method_scope'];
export function renderApplicability(b){return'# 本人资产声明核对草稿\n\n仅供合成软件核对，不是临床适用结论、批准或自动应用。\n\n'+b.rules.items.map(g=>'## '+g.ruleId+'\n\n'+g.subitems.map(i=>'- '+i.path+'：'+i.state).join('\n')).join('\n\n')+'\n\n人工意见：\n\n'+Object.entries(b.opinions).sort(([a],[z])=>APPLICABILITY_RULE_IDS.indexOf(a)-APPLICABILITY_RULE_IDS.indexOf(z)).map(([k,v])=>k+'：'+v.decision+'\n\n'+v.reason).join('\n\n');}
export const applicabilityBodyRoute=()=>/^\/api\/asset-applicability-drafts(?:\/[^/]+\/(?:opinions|jobs))?\/?$/i;
export function compareApplicability(basis){
 const b=basis.input??basis;check(b?.schema==='rh-asset-applicability-input.v1','APPLICABILITY_INPUT_INVALID');
 const s=b.source,t=b.target,items=APPLICABILITY_RULE_IDS.map(ruleId=>({ruleId,subitems:[]}));
 const present=(v,path)=>v!==undefined&&v!==null&&v!==''&&(!path.endsWith('.visitKeys')||!Array.isArray(v)||v.length>0);
 function add(ruleId,path,a,z){const source={present:present(a,path),value:a===undefined?null:structuredClone(a)},target={present:present(z,path),value:z===undefined?null:structuredClone(z)};
  items.find(i=>i.ruleId===ruleId).subitems.push({path,source,target,state:!source.present||!target.present?'not_checked':edcDigest(a)===edcDigest(z)?'declared_equal':'declared_difference'});
 }
 const union=(a=[],z=[],key=v=>v.key)=>[...new Set([...a,...z].map(key))].sort();
 for(const k of ['question','p','i','c','o'])add('question','pico.'+k,s.pico[k],t.pico[k]);
 add('eligibility','eligibility',undefined,undefined);
 for(const [group,key,properties] of [['outcomes','outcomes',['key','definition','unit']],['visits','visits',['key','order','targetDayOffset','windowBeforeDays','windowAfterDays']]]){
  const a=s.config[key],z=t.config?.[key]??[];
  if(!a.length&&!z.length)add(group,key,undefined,undefined);
  for(const k of union(a,z)){const x=a.find(i=>i.key===k),y=z.find(i=>i.key===k);if(!x||!y)add(group,key+'.'+k,x,y);else for(const p of properties)add(group,key+'.'+k+'.'+p,x[p],y[p]);}
 }
 const a=s.config.form.schema.fields,z=t.config?.form.schema.fields??[];
 if(!a.length&&!z.length)add('crf_mapping','form.fields',undefined,undefined);
 for(const k of union(a,z)){const x=a.find(i=>i.key===k),y=z.find(i=>i.key===k),path='form.fields.'+k;if(!x||!y)add('crf_mapping',path,x,y);else{
  for(const p of ['type','required'])add('crf_mapping',path+'.'+p,x[p],y[p]);
  for(const p of ['options','min','max'])if(Object.hasOwn(x,p)||Object.hasOwn(y,p))add('crf_mapping',path+'.'+p,x[p],y[p]);
 }}
 const am=s.config.mappings,zm=t.config?.mappings??[],mk=v=>v.outcomeKey+'.'+v.fieldKey;
 if(!am.length&&!zm.length)add('crf_mapping','mappings',undefined,undefined);
 for(const k of union(am,zm,mk)){const x=am.find(v=>mk(v)===k),y=zm.find(v=>mk(v)===k);if(!x||!y)add('crf_mapping','mappings.'+k,x,y);else for(const p of ['visitKeys','unit'])add('crf_mapping','mappings.'+k+'.'+p,x[p],y[p]);}
 add('method_scope','method',s.method,undefined);add('method_scope','coverage',s.coverage,undefined);
 check(items.every(i=>i.subitems.length<=32),'APPLICABILITY_RULE_CAPACITY');
 return{schema:'rh-asset-applicability-rules.v1',items,coverage:{scope:'declarations_only',notExamined:['clinical_equivalence','unstructured_eligibility','target_method_not_declared','full_text','statistical_suitability']}};
}
export function applyApplicabilityOpinions({record,body,versionNo,result,accountId,at,pending}){
 const valid=v=>check(v,'APPLICABILITY_INPUT_INVALID');
 try{exactEdcFields(body,['baseVersionNo','resultMessageId','basisChangeConfirmed','decisions','requestKey']);}catch{valid(false);}
 valid(Number.isSafeInteger(body.baseVersionNo)&&body.baseVersionNo>0&&typeof body.basisChangeConfirmed==='boolean'&&(body.resultMessageId===null||typeof body.resultMessageId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(body.resultMessageId))&&typeof body.requestKey==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(body.requestKey));
 check(body.baseVersionNo===versionNo,'APPLICABILITY_VERSION_CONFLICT');check(versionNo<30,'APPLICABILITY_VERSION_CAPACITY');check(!pending,'APPLICABILITY_JOB_PENDING');
 valid(Array.isArray(body.decisions)&&body.decisions.length>0&&body.decisions.length<=6&&new Set(body.decisions.map(v=>v?.ruleId)).size===body.decisions.length);
 const decisions=body.decisions.map(d=>{try{exactEdcFields(d,['ruleId','decision','reason']);}catch{valid(false);}valid(APPLICABILITY_RULE_IDS.includes(d.ruleId)&&['reference','revise','decline'].includes(d.decision)&&typeof d.reason==='string'&&d.reason.trim().length>0&&d.reason.length<=1000);return{ruleId:d.ruleId,decision:d.decision,reason:d.reason.trim()};});
 if(body.resultMessageId!==null)check(result?.current===true&&result.resultMessageId===body.resultMessageId&&Number.isSafeInteger(result.executionRecordVersion)&&result.executionRecordVersion>0&&result.executionRecordVersion<=versionNo,'APPLICABILITY_AI_RESULT_CHANGED');
 const head={basisKind:body.resultMessageId===null?'rules':'ai',basisHash:record.basisHash,rulesHash:record.rulesHash,resultMessageId:body.resultMessageId,executionRecordVersion:body.resultMessageId===null?null:result.executionRecordVersion,lastRecordVersion:versionNo+1};
 const old=record.opinionHead,keys=['basisKind','basisHash','rulesHash','resultMessageId','executionRecordVersion'],switching=Boolean(old&&keys.some(k=>old[k]!==head[k]));
 if(old)check(old.lastRecordVersion===versionNo,'APPLICABILITY_OPINION_HEAD_CHANGED');
 if(switching)check(body.basisChangeConfirmed,'APPLICABILITY_OPINION_BASIS_CONFIRM');else valid(body.basisChangeConfirmed===false);
 const opinions=switching?{}:structuredClone(record.opinions),changes=[];
 for(const d of decisions){const previous=opinions[d.ruleId]??null;if(!previous||previous.decision!==d.decision||previous.reason!==d.reason){opinions[d.ruleId]={decision:d.decision,reason:d.reason,accountId,at};changes.push({ruleId:d.ruleId,previous,next:opinions[d.ruleId]});}}
 check(changes.length>0,'APPLICABILITY_NO_CHANGE');
 return{...structuredClone(record),opinions,opinionHead:head,opinionHistory:[...structuredClone(record.opinionHistory),{versionNo:versionNo+1,previousHead:old?structuredClone(old):null,head,changes,accountId,at}]};
}
