// Hand-reviewed complete expected rows. No production comparator is used here.
import {inputGolden} from './asset-applicability-input-golden.mjs';
export function rulesGolden(){
 const eq=(path,value)=>({path,source:{present:true,value},target:{present:true,value},state:'declared_equal'}),unknown=path=>({path,source:{present:false,value:null},target:{present:false,value:null},state:'not_checked'}),b=inputGolden();
 return{schema:'rh-asset-applicability-rules.v1',items:[
  {ruleId:'question',subitems:[eq('pico.question','合成配置能否用于软件核对？'),eq('pico.p','合成对象'),eq('pico.i','合成干预'),eq('pico.c','合成对照'),eq('pico.o','合成观察')]},
  {ruleId:'eligibility',subitems:[unknown('eligibility')]},
  {ruleId:'outcomes',subitems:[eq('outcomes.signal.key','signal'),eq('outcomes.signal.definition','合成软件验证，不是临床量表'),eq('outcomes.signal.unit','软件单位')]},
  {ruleId:'visits',subitems:[eq('visits.baseline.key','baseline'),eq('visits.baseline.order',1),unknown('visits.baseline.targetDayOffset'),unknown('visits.baseline.windowBeforeDays'),unknown('visits.baseline.windowAfterDays'),eq('visits.followup.key','followup'),eq('visits.followup.order',2),unknown('visits.followup.targetDayOffset'),unknown('visits.followup.windowBeforeDays'),unknown('visits.followup.windowAfterDays')]},
  {ruleId:'crf_mapping',subitems:[eq('form.fields.choice.type','select'),eq('form.fields.choice.required',false),eq('form.fields.choice.options',[{value:'a',label:'测试类别'}]),eq('form.fields.flag.type','boolean'),eq('form.fields.flag.required',true),eq('form.fields.note.type','text'),eq('form.fields.note.required',false),eq('form.fields.value.type','number'),eq('form.fields.value.required',true),eq('form.fields.value.min',0),eq('form.fields.value.max',10),eq('mappings.signal.value.visitKeys',['baseline','followup']),eq('mappings.signal.value.unit','软件单位')]},
  {ruleId:'method_scope',subitems:[{path:'method',source:{present:true,value:b.source.method},target:{present:false,value:null},state:'not_checked'},{path:'coverage',source:{present:true,value:b.source.coverage},target:{present:false,value:null},state:'not_checked'}]}
 ],coverage:{scope:'declarations_only',notExamined:['clinical_equivalence','unstructured_eligibility','target_method_not_declared','full_text','statistical_suitability']}};
}
export function mixedRulesGolden(){
 const v=rulesGolden();v.items.find(g=>g.ruleId==='outcomes').subitems=[
  {path:'outcomes.other',source:{present:false,value:null},target:{present:true,value:{key:'other',label:'同名不可配对',definition:'新定义',unit:'软件单位'}},state:'not_checked'},
  {path:'outcomes.signal.key',source:{present:true,value:'signal'},target:{present:true,value:'signal'},state:'declared_equal'},
  {path:'outcomes.signal.definition',source:{present:true,value:'合成软件验证，不是临床量表'},target:{present:true,value:'不同的软件定义'},state:'declared_difference'},
  {path:'outcomes.signal.unit',source:{present:true,value:'软件单位'},target:{present:false,value:''},state:'not_checked'}
 ];return v;
}
