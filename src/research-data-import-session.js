const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const researchDataColumnKey=c=>JSON.stringify([c.fileId,c.sheet,c.column]);
export function assertResearchDataMapping(p,{preflightId,studyId,version}={}){
 const fail=()=>{throw Error('字段对应无法核对，请重新获取；原文件仍保留。');},d=p?.mapping;
 if(p?.state!=='mapping_required'||p.confirmationReady!==false||!id(p.requestKey)||!id(p.preflight?.id)||!Number.isSafeInteger(p.preflight.version)||p.preflight.version<1||!id(p.study?.id)||typeof p.study.name!=='string'||d?.schema!=='hub-data-mapping-choice.v1'||!hash(d.hash)||d.mode!=='visit_form'||!Array.isArray(d.fields)||!Array.isArray(d.columns)||!d.columns.length||!Array.isArray(d.automatic)||!Array.isArray(d.requiredKeys))fail();
 if(preflightId&&p.preflight.id!==preflightId||studyId&&p.study.id!==studyId||version&&p.preflight.version!==version)fail();
 const fields=new Set(['subjectCode','visitCode',...d.fields.map(f=>f.key)]),sources=new Set();
 for(const f of d.fields)if(!id(f.key)||typeof f.label!=='string'||typeof f.required!=='boolean'||!['number','integer','boolean','text','select'].includes(f.type)||f.unit!==null&&typeof f.unit!=='string')fail();
 for(const c of [...d.automatic,...d.columns]){const key=researchDataColumnKey(c);if(!id(c.fileId)||typeof c.sheet!=='string'||!c.sheet||!Number.isSafeInteger(c.column)||c.column<1||sources.has(key))fail();sources.add(key);if(c.targetKeys){if(typeof c.name!=='string'||!Array.isArray(c.targetKeys)||c.targetKeys.some(k=>!fields.has(k)))fail();}else if(!fields.has(c.targetKey))fail();}
 if(d.requiredKeys.some(k=>!fields.has(k)))fail();return p;
}
export function researchDataMappingSelection(choice,selections){
 const d=assertResearchDataMapping(choice).mapping,mapping=[...d.automatic];
 for(const c of d.columns){const targetKey=selections[researchDataColumnKey(c)];if(!targetKey)continue;if(!c.targetKeys.includes(targetKey))throw Error('请选择当前表单中可用的字段。');mapping.push({fileId:c.fileId,sheet:c.sheet,column:c.column,targetKey});}
 const targets=new Set();for(const m of mapping){const key=JSON.stringify([m.fileId,m.sheet,m.targetKey]);if(targets.has(key))throw Error('同一字段被重复选择，请每个字段只保留一列。');targets.add(key);}
 const groups=[...new Map([...d.automatic,...d.columns].map(c=>[JSON.stringify([c.fileId,c.sheet]),c])).values()];
 for(const c of groups)for(const key of d.requiredKeys)if(!mapping.some(m=>m.fileId===c.fileId&&m.sheet===c.sheet&&m.targetKey===key))throw Error('请为必填字段“'+(d.fields.find(f=>f.key===key)?.label??key)+'”选择对应列。');return mapping;
}
export const researchDataImportRequestAllowed=(method,path)=>method==='GET'&&/^\/sessions\/[A-Za-z0-9_-]+\/research-data-imports\/[A-Za-z0-9_-]+\/analysis$/.test(path)||method==='GET'&&(/^\/sessions\/[A-Za-z0-9_-]+\/research-data-import-targets$/.test(path)||/^\/sessions\/[A-Za-z0-9_-]+\/research-data-imports(?:\/[A-Za-z0-9_-]+|\/receipts\/[A-Za-z0-9_-]+)?$/.test(path))||method==='POST'&&/^\/sessions\/[A-Za-z0-9_-]+\/research-data-imports(?:\/[A-Za-z0-9_-]+\/(?:confirmations|cancellation))?$/.test(path);
export function assertResearchDataImport(p,{preflightId,studyId}={}){
 const fail=()=>{throw Error('导入状态无法核对，请保留文件并重新获取。');};
 if(!p||!id(p.id)||!id(p.requestKey)||!Number.isSafeInteger(p.version)||p.version<1||!hash(p.hash)||!['planned','committed','cancelled','invalid'].includes(p.state)||p.confirmationReady!==(p.state==='planned')||!['subjects','visit_form'].includes(p.mode)||!id(p.preflight?.id)||!Number.isSafeInteger(p.preflight.version)||p.preflight.version<1||!id(p.study?.id)||typeof p.study.name!=='string'||!p.summary||!Number.isSafeInteger(p.summary.subjects)||p.summary.subjects<1||!Number.isSafeInteger(p.summary.visits)||p.summary.visits<0||!Array.isArray(p.summary.fields)||!Array.isArray(p.summary.unmapped))fail();
 if(preflightId&&p.preflight.id!==preflightId||studyId&&p.study.id!==studyId)fail();
 if(p.state==='committed'){
  if(p.receipt?.schema!=='hub-data-import-receipt.v1'||p.receipt.confirmationHash!==p.hash||p.receipt.studyId!==p.study.id||!Array.isArray(p.receipt.subjects)||!p.receipt.subjects.length||p.receipt.subjects.some(s=>!id(s.id)||!id(s.subjectCode))||!Array.isArray(p.receipt.visits)||p.receipt.visits.some(v=>!id(v.id)||!id(v.subjectId)||!id(v.assignmentId)||!id(v.ref?.responseId)||v.ref.assignmentId!==v.assignmentId||!Number.isSafeInteger(v.ref.revisionNo)||v.ref.revisionNo<1||!hash(v.ref.contentHash)))fail();
 }else if(p.receipt)fail();
 return p;
}
