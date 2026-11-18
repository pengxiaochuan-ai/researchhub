import {FANG_TABLE5_ALGORITHM,scoreFangTable5} from './fang-table5-policy.mjs';
import {HAMD17_SIMULATION_ALGORITHM,scoreHAMD17Simulation} from './hamd17-simulation-policy.mjs';
const presentationKeys=new Set(['title','recallPeriodPrompt','instruction','attribution']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=code=>{throw new Error(code);};

/** ResearchHub-only additions. Answers remain numeric; existing forms retain their scoring rule. */
export function createResearchFormPolicy(legacy){
 function normalizeFormSchema(value){
  const schema=legacy.normalizeFormSchema(value);
  if(value.presentation!==undefined){
   const presentation=value.presentation;
   if(!object(presentation)||Object.entries(presentation).some(([key,text])=>!presentationKeys.has(key)||typeof text!=='string'||!text.trim()))fail('FORM_SCHEMA_INVALID_PRESENTATION');
   schema.presentation={...presentation};
  }
  schema.fields=schema.fields.map(field=>{
   if(field.choices===undefined)return field;
   if(!['number','integer'].includes(field.type)||!Array.isArray(field.choices)||!field.choices.length)fail('FORM_SCHEMA_INVALID_CHOICES');
   const seen=new Set();
   const choices=field.choices.map(choice=>{
    if(!object(choice)||Object.keys(choice).some(key=>!['value','label'].includes(key))||typeof choice.value!=='number'||!Number.isFinite(choice.value)||field.type==='integer'&&!Number.isInteger(choice.value)||typeof choice.label!=='string'||!choice.label.trim()||seen.has(choice.value)||field.min!==undefined&&choice.value<field.min||field.max!==undefined&&choice.value>field.max)fail('FORM_SCHEMA_INVALID_CHOICES');
    seen.add(choice.value);return {value:choice.value,label:choice.label};
   });
   return {...field,choices};
  });
  return schema;
 }
 function normalizeAndValidateAnswers(schemaValue,answersValue){
  const schema=normalizeFormSchema(schemaValue),answers=legacy.normalizeAndValidateAnswers(schema,answersValue);
  for(const field of schema.fields){
   const value=answers[field.key];
   if(field.choices&&value!==null&&value!==undefined&&value!==''&&!field.choices.some(choice=>choice.value===value))fail('FORM_ANSWER_INVALID_OPTION');
  }
  return answers;
 }
 function scoreFormResponse(schemaValue,answersValue){
  const schema=normalizeFormSchema(schemaValue),answers=normalizeAndValidateAnswers(schema,answersValue);
  return legacy.scoreFormResponse(schema,answers);
 }
 function scorePublishedFormResponse(schemaValue,scoringValue,answersValue){
  const schema=normalizeFormSchema(schemaValue),answers=normalizeAndValidateAnswers(schema,answersValue);
  if(scoringValue?.algorithm===FANG_TABLE5_ALGORITHM)return scoreFangTable5(schema,scoringValue,answers);
  if(scoringValue?.algorithm===HAMD17_SIMULATION_ALGORITHM)return scoreHAMD17Simulation(schema,scoringValue,answers);
  return legacy.scorePublishedFormResponse(schema,scoringValue,answers);
 }
 return {...legacy,normalizeFormSchema,normalizeAndValidateAnswers,scoreFormResponse,scorePublishedFormResponse};
}
