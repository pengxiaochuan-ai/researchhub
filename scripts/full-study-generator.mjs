// Deterministic software fixtures, not inferred clinical values or diagnoses.
export const GENERATOR={version:'full-study-synthetic-generator-v1',seed:20261113};
export const ARMS=['MDD_TARGET','MDD_NON_TARGET','HEALTHY_REFERENCE'];
export const stages=['V1','V2','V3','V4'];
export function generateSubjectData(armCode,index,profiles){
 if(!ARMS.includes(armCode)||![0,1].includes(index))throw Error('GENERATOR_SCOPE_INVALID');
 const patient=armCode!=='HEALTHY_REFERENCE',data={armCode,index,baselineDesignLabel:armCode,visits:{}};
 for(const [stageIndex,stage]of stages.entries()){
  if(!patient&&stageIndex>0)continue;
  const n=ARMS.indexOf(armCode)*2+index;
  const phq=Object.fromEntries(profiles.phq.schema.fields.slice(0,9).map((field,j)=>[field.key,!patient&&index===0?0:(GENERATOR.seed+n*5+j+stageIndex)%4]));phq.functional_difficulty='difficulty_1';
  const row={phq,modalities:{}};
  if(patient){
   const positive=new Set(['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_emotional_trigger','tongue_pale_red','pulse_wiry']);
   row.fang=Object.fromEntries(profiles.fang.schema.fields.map(f=>[f.key,f.key.endsWith('_category')?(armCode==='MDD_TARGET'?'met':'not_met'):armCode==='MDD_TARGET'&&positive.has(f.key)?'present':'absent']));
   if(armCode==='MDD_TARGET'&&index===1&&stage==='V3')row.fang.secondary_irregular_menses='not_applicable';
   if(armCode==='MDD_TARGET'&&index===0&&stage==='V1')row.fangInitial={...row.fang,pulse_deep_wiry:'present'};
   if(stage!=='V2')row.hamd=Object.fromEntries(profiles.hamd.schema.fields.map((field,j)=>{const choices=field.choices.filter(c=>c.value!==9);return [field.key,choices[(GENERATOR.seed+n+j+stageIndex)%choices.length].value];}));
   if(armCode==='MDD_NON_TARGET'&&index===1&&stage==='V3')row.hamd.hamd17_q14=9;
  }
  for(const modality of ['tongue','voice','eeg']){
   if(stage==='V2'||modality==='eeg'&&stage==='V3')continue;
   const value=((GENERATOR.seed+n*31+stageIndex*7+modality.length)%101)/100;
   row.modalities[modality]={filename:`synthetic-${modality}-${n}-${stage}.csv`,csv:`feature_key,value,unit\r\nsynthetic.${modality}.feature,${value},arbitrary_unit\r\n`,syntheticOnly:true,preprocessed:true,rawExtractionClaim:false};
  }
  data.visits[stage]=row;
 }
 return data;
}
