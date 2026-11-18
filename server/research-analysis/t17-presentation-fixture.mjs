// Test-only accepted Run and trusted schema/manifest; never a Worker execution claim.
import {canonicalReportJson,reportDigest} from './t17-report-content.mjs';
export const basis={type:'study-analysis-snapshot',studyId:'study',snapshotId:'snapshot',manifestHash:'a'.repeat(64),qualityGateId:'gate',qualityGateVersion:1};
export const schema={schemaVersion:'form-schema.v1',fields:[{key:'value',label:'观察值',type:'number',required:true,unit:'分'},{key:'optional_value',label:'选填观察值',type:'number',required:false},{key:'completed',label:'是否完成',type:'boolean',required:true}]};
export const digest=x=>reportDigest(canonicalReportJson(x));
export const form={id:'form',status:'published',schema,scoring:null};
export const variables=[{key:'v1',formVersionId:'form',fieldKey:'value',valueType:'number',unit:'分'},{key:'v2',formVersionId:'form',fieldKey:'optional_value',valueType:'number',unit:null},{key:'v3',formVersionId:'form',fieldKey:'completed',valueType:'boolean',unit:null}];
export const presentation={schemaVersion:'formal-report-presentation-v1',variables:variables.map(v=>({...v,label:schema.fields.find(f=>f.key===v.fieldKey).label,formDefinitionHash:digest({schema,scoring:null})}))};
export const manifest={variables,rows:[{cells:variables.map(v=>({key:v.key,source:{formVersionId:v.formVersionId,fieldKey:v.fieldKey,formDefinitionHash:digest({schema,scoring:null})}}))}]};
export function run(){
 const outputs={manifestHash:basis.manifestHash,rowCount:3,statisticalUnit:'subject',columns:{v1:{type:'number',total:3,observed:3,missing:0,status:'available',min:0,max:4,mean:2,median:2,sampleStdDev:2},v2:{type:'number',total:3,observed:1,missing:2,status:'single_observation',min:0,max:0,mean:0,median:0,sampleStdDev:null},v3:{type:'boolean',total:3,observed:3,missing:0,status:'available',trueCount:2,falseCount:1}}};
 const numericEvidence=[];for(const[k,v]of Object.entries(outputs)){if(typeof v==='number')numericEvidence.push({name:k,value:v,assumptions:['manifestHash:'+basis.manifestHash]});}for(const[k,c]of Object.entries(outputs.columns))for(const[n,v]of Object.entries(c))if(typeof v==='number')numericEvidence.push({name:'columns.'+k+'.'+n,value:v,assumptions:['manifestHash:'+basis.manifestHash]});
 return {id:'run',skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'descriptive-v1',inputHash:'b'.repeat(64),status:'completed',reviewStatus:'confirmed',dataSources:{analysisBasis:basis},artifactRefs:{outputs},numericEvidence,environment:{llm:false,workerVersion:'t19-1'}};
}
