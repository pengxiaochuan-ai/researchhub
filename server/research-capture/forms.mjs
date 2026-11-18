import {FANG_TABLE5_ALGORITHM} from './fang-table5-policy.mjs';
import {HAMD17_SIMULATION_ALGORITHM} from './hamd17-simulation-policy.mjs';
const allowedModes=scoring=>[FANG_TABLE5_ALGORITHM,HAMD17_SIMULATION_ALGORITHM].includes(scoring?.algorithm)?['researcher']:['researcher','patient_h5'];
export async function listCaptureCandidates(tx,ctx){
 const scope={tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};
 const [forms,scales,outcomes]=await Promise.all([
  tx.formVersion.findMany({where:{...scope,status:{in:['published','locked']}},include:{template:true},orderBy:{createdAt:'asc'}}),
  tx.scaleVersion.findMany({where:{status:'published'},include:{definition:true},orderBy:{versionNumber:'asc'}}),
  tx.outcomeDefinition.findMany({where:{...scope,status:'published'},orderBy:{versionNumber:'asc'}})
 ]);
 return {forms:forms.map(x=>({id:x.id,templateId:x.templateId,templateKey:x.template.key,name:x.template.name,versionNumber:x.versionNumber,status:x.status,schema:x.schema,scoring:x.scoring,allowedCaptureModes:allowedModes(x.scoring)})),scales:scales.map(x=>({id:x.id,definitionId:x.scaleDefinitionId,code:x.definition.code,name:x.definition.name,versionNumber:x.versionNumber,versionLabel:x.versionLabel,status:x.status})),outcomes:outcomes.map(({id,key,versionNumber,name,role,sourceType,scaleVersionId,scoreKey,dataFieldKey,unit,direction,timepointCode,status})=>({id,key,versionNumber,name,role,sourceType,scaleVersionId,scoreKey,dataFieldKey,unit,direction,timepointCode,status}))};
}
