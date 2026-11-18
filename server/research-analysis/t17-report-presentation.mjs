import {researchError} from '../research-studies/contract.mjs';
import {assertT17Presentation,PRESENTATION_SCHEMA} from './t17-report-content.mjs';
const fail=()=>{throw researchError(409,'REPORT_SOURCE_INVALID','报告变量的固定表单来源不可核验，请重新核对。');};
/** Caller supplies only the approved manifest rederived by analysis.assertCurrent. No client labels. */
export function deriveT17Presentation(manifest,forms,normalizeSchema,canonicalManifestHash){
 if(!Array.isArray(manifest?.variables)||!manifest.variables.length||!Array.isArray(manifest.rows)||!manifest.rows.length||!Array.isArray(forms)||new Set(forms.map(f=>f.id)).size!==forms.length)fail();
 const variables=manifest.variables.map(v=>{
  const form=forms.find(f=>f.id===v.formVersionId);if(!form||!['published','locked'].includes(form.status))fail();
  let fields;try{fields=normalizeSchema(form.schema).fields;}catch{fail();}
  const field=fields.find(f=>f.key===v.fieldKey),formDefinitionHash=canonicalManifestHash({schema:form.schema,scoring:form.scoring??null});
  if(!field||field.type!==v.valueType||(typeof field.unit==='string'&&field.unit.trim()?field.unit:null)!==v.unit)fail();
  for(const row of manifest.rows){const cells=row?.cells;if(!Array.isArray(cells)||cells.length!==manifest.variables.length||new Set(cells.map(c=>c.key)).size!==cells.length)fail();const source=cells.find(c=>c.key===v.key)?.source;if(source?.formVersionId!==v.formVersionId||source?.fieldKey!==v.fieldKey||source?.formDefinitionHash!==formDefinitionHash)fail();}
  return {key:v.key,formVersionId:v.formVersionId,fieldKey:v.fieldKey,label:field.label,valueType:field.type,unit:v.unit,formDefinitionHash};
 });
 const result={schemaVersion:PRESENTATION_SCHEMA,variables};assertT17Presentation(result);return result;
}
export async function readT17Presentation(tx,scope,manifest,{normalizeSchema,canonicalManifestHash}){
 const ids=[...new Set(manifest?.variables?.map(v=>v.formVersionId)??[])].sort();if(!ids.length)fail();
 // Source locks precede the Run/Artifact/Job locks, matching the existing formal export order.
 const rows=await tx.$queryRaw`SELECT id FROM public.form_version WHERE "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND id=ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
 if(rows.length!==ids.length)fail();
 const forms=await tx.formVersion.findMany({where:{...scope,id:{in:ids},status:{in:['published','locked']}}});
 return deriveT17Presentation(manifest,forms,normalizeSchema,canonicalManifestHash);
}
