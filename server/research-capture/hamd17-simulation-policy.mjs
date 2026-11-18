export const HAMD17_SIMULATION_ALGORITHM='hamd17-simulation-sum-v1';
export const HAMD17_SOURCE_SHA256='da9bbbe2da775cacaaab5825659d56566bef066c4d0834e07b5b4ea23719c968';
export const HAMD17_SIMULATION_POLICY='ordinary17-sum-special9-or-missing-no-total-v1';
// Ordinary domains from the user-supplied depression CRF, tables 10–11.
export const HAMD17_SIMULATION_ITEMS=Object.freeze([4,4,4,2,2,2,4,4,4,4,4,2,2,2,4,2,2].map((maximum,index)=>Object.freeze({key:'hamd17_q'+(index+1),ordinaryMaximum:maximum,codes:Object.freeze([...Array.from({length:maximum+1},(_,value)=>value),...(index===13?[9]:[])])})));
const fail=code=>{throw new Error(code);};
const missing=value=>value===null||value===undefined||value==='';

/** Simulation-only arithmetic convention; not an original-author scoring manual or clinical cutoff. */
export function scoreHAMD17Simulation(schema,scoring,answers){
 if(scoring?.sourceSha256!==HAMD17_SOURCE_SHA256)fail('FORM_SCORING_SOURCE_MISMATCH');
 if(scoring.algorithm!==HAMD17_SIMULATION_ALGORITHM||scoring.simulationPolicy!==HAMD17_SIMULATION_POLICY)fail('FORM_SIMULATION_POLICY_UNSUPPORTED');
 const fields=schema?.fields;
 if(!Array.isArray(fields)||fields.length!==17||fields.some(field=>!field||typeof field!=='object')||new Set(fields.map(field=>field.key)).size!==17)fail('FORM_SCHEMA_HAMD17_INVALID');
 for(const item of HAMD17_SIMULATION_ITEMS){
  const field=fields.find(f=>f.key===item.key);
  if(field?.type!=='integer'||field.required!==true||field.score!==true||field.min!==0||field.max!==Math.max(...item.codes)||!Array.isArray(field.choices)||field.choices.length!==item.codes.length||new Set(field.choices.map(choice=>choice.value)).size!==item.codes.length||field.choices.some(choice=>!item.codes.includes(choice.value)))fail('FORM_SCHEMA_HAMD17_INVALID');
 }
 if(!answers||typeof answers!=='object'||Array.isArray(answers))fail('FORM_ANSWERS_INVALID');
 if(Object.keys(answers).some(key=>!HAMD17_SIMULATION_ITEMS.some(item=>item.key===key)))fail('FORM_ANSWER_UNKNOWN_FIELD');
 for(const item of HAMD17_SIMULATION_ITEMS)if(!missing(answers[item.key])&&!item.codes.includes(answers[item.key]))fail('FORM_ANSWER_INVALID_OPTION');
 const missingItems=HAMD17_SIMULATION_ITEMS.filter(item=>missing(answers[item.key])).map(item=>({key:item.key,status:'missing'}));
 const special9=answers.hamd17_q14===9,unresolvedItems=[...missingItems,...(special9?[{key:'hamd17_q14',status:'source_code_9'}]:[])];
 const complete=missingItems.length===0,scoreComplete=complete&&!special9;
 const total=scoreComplete?HAMD17_SIMULATION_ITEMS.reduce((sum,item)=>sum+answers[item.key],0):null;
 return {algorithm:HAMD17_SIMULATION_ALGORITHM,total,complete,scoreComplete,processingStatus:scoreComplete?'scored':'incomplete_data',scoredCount:HAMD17_SIMULATION_ITEMS.length-unresolvedItems.length,missingCount:missingItems.length,missingRequired:missingItems.length,unresolvedItems,special9,classification:null,diagnosis:null,simulationOnly:true,sourceSha256:HAMD17_SOURCE_SHA256,simulationPolicy:HAMD17_SIMULATION_POLICY};
}
