import {materialDigest} from './session-material-contract.mjs';
import {GENERAL_TABULAR_RULES,bindingColumn,parseColumnHeader,describeColumn,normalizedColumn} from './research-data-tabular.mjs';
export const preflightError=code=>Object.assign(Error(code),{code,status:code==='DATA_PREFLIGHT_CAPACITY'?413:['DATA_PREFLIGHT_INPUT','DATA_PREFLIGHT_FORMAT','DATA_PREFLIGHT_HEADER'].includes(code)?400:409});
const fail=code=>{throw preflightError(code);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const normalized=x=>String(x??'').trim().toLowerCase().replace(/[\s_-]/g,'');
const subjectNames=new Set(['subjectid','subjectcode','participantid','被试编号','受试者编号','sid']);
const visitNames=new Set(['visit','visitcode','访视','访视编号']);
const studyNames=new Set(['studyid','研究编号']);
const directIdentifier=x=>/^(姓名|被试姓名|受试者姓名|身份证(号)?|手机号|电话|病历号|门诊号|住院号|participantname|subjectname|patientname|name|email|phone|mobile|idcard)$/i.test(normalized(x));
// Internal trusted facts only. A controller must reload these from current
// authority; a client's role/canImport value must never reach this function.
export function selectImportDestination(principal,destinations,{targetStudyId,trustedStudyId}={}){
 if(!Array.isArray(destinations)||destinations.length>100||!id(principal?.tenantId)||!id(principal.accountId))fail('DATA_PREFLIGHT_INPUT');
 const allowed=destinations.filter(d=>d?.tenantId===principal.tenantId&&d.canImport===true&&id(d.studyId)&&id(d.studyGroupId)&&id(d.executionProjectId)&&Number.isSafeInteger(d.version)&&d.version>0);
 if(new Set(allowed.map(d=>d.studyId)).size!==allowed.length)fail('DATA_PREFLIGHT_INPUT');
 const selected=targetStudyId??trustedStudyId;
 const destination=selected===undefined?(allowed.length===1?allowed[0]:null):allowed.find(d=>d.studyId===selected);
 if(selected!==undefined&&!destination)fail('DATA_PREFLIGHT_DESTINATION_UNAVAILABLE');
 return{destination:destination??null,destinations:allowed,selectionRequired:!destination&&allowed.length>1};
}
export function createResearchDataPreflight({inspect,readWorkbook,classify,triage}){
 if([inspect,readWorkbook,classify,triage].some(fn=>typeof fn!=='function'))fail('DATA_PREFLIGHT_DEPENDENCIES');
 return{preview(principal,{files,destinations,targetStudyId,trustedStudyId,rulesVersion='legacy.v1'}){
  if(!['legacy.v1',GENERAL_TABULAR_RULES].includes(rulesVersion))fail('DATA_PREFLIGHT_INPUT');const general=rulesVersion===GENERAL_TABULAR_RULES,checkIdentifier=name=>directIdentifier(general?String(name).normalize('NFKC'):name);
  if(!id(principal?.sessionId)||!Number.isSafeInteger(principal.authVersion)||!Array.isArray(files)||files.length<1||files.length>20||new Set(files.map(f=>f.fileId)).size!==files.length)fail('DATA_PREFLIGHT_INPUT');
  const target=selectImportDestination(principal,destinations,{targetStudyId,trustedStudyId}),issues=new Set(['MAPPING_REQUIRED']);
  if(!target.destination)issues.add(target.selectionRequired?'STUDY_SELECTION_REQUIRED':'NO_IMPORT_DESTINATION');
  let totalRows=0;const seen=new Set();
  const items=files.map(file=>{
   if(!id(file?.fileId)||typeof file.filename!=='string'||!Buffer.isBuffer(file.buffer)||file.buffer.length===0||file.buffer.length>25*1024*1024)fail('DATA_PREFLIGHT_INPUT');
   if(!/\.(csv|xlsx)$/i.test(file.filename))fail('DATA_PREFLIGHT_FORMAT');
   const inspected=inspect(file),sheets=readWorkbook(file.buffer);if(!sheets.length||sheets.length>5)fail('DATA_PREFLIGHT_CAPACITY');
   const contracts=sheets.map(s=>({name:s.name,headers:s.headers})),legacyClassification=classify(contracts),legacyTriage=triage(legacyClassification,contracts);
   const classification={...legacyClassification,directIdentifierColumnDetected:sheets.some(s=>s.headers.some(checkIdentifier))},effectiveTriage=triage(classification,contracts);
   const fileIssues=new Set(),fields=[],rows=[];
   for(const sheet of sheets){
    const {headers}=sheet,sheetIssues=new Set();
    if(headers.some(x=>!x))sheetIssues.add('UNNAMED_COLUMN');
    const keys=headers.map(general?normalizedColumn:normalized);if(new Set(keys).size!==keys.length)sheetIssues.add('DUPLICATE_HEADERS');
    const identity=headers.some(checkIdentifier);if(identity)sheetIssues.add('DIRECT_IDENTIFIER_COLUMNS');
    const columns=(kind,names)=>keys.flatMap((k,i)=>(general?bindingColumn(headers[i])===kind:names.has(k))?[i]:[]);
    const subjectColumns=columns('subjectCode',subjectNames),visitColumns=columns('visitCode',visitNames),studyColumns=columns('studyId',studyNames);
    if(subjectColumns.length!==1)sheetIssues.add('SUBJECT_COLUMN_REQUIRED');
    if(visitColumns.length>1||studyColumns.length>1)sheetIssues.add('AMBIGUOUS_BINDING_COLUMNS');
    for(const issue of sheetIssues)fileIssues.add(issue);
    if(visitColumns.length)issues.add('VISIT_BINDING_REQUIRED');
    fields.push(...headers.map((name,i)=>({sheet:sheet.name,column:i+1,name,unit:general?parseColumnHeader(name).unit:null,...(general?{profile:describeColumn(sheet.rows.map(row=>row.values[i]))}:{})})));
    for(const row of sheet.rows){
     if(++totalRows>10000)fail('DATA_PREFLIGHT_CAPACITY');
     const rowIssues=[...sheetIssues],subjectCode=String(row.values[subjectColumns[0]]??'').trim(),visit=String(row.values[visitColumns[0]]??'').trim()||null;
     if(!/^[A-Za-z0-9_-]{1,64}$/.test(subjectCode))rowIssues.push('SUBJECT_CODE_INVALID');
     if(row.formulaColumns.length)rowIssues.push('FORMULA_CELL');
     const sourceStudy=String(row.values[studyColumns[0]]??'').trim();
     if(target.destination&&sourceStudy&&sourceStudy!==target.destination.studyId)rowIssues.push('STUDY_MISMATCH');
     const key=materialDigest([target.destination?.studyId??sourceStudy,subjectCode,visit]);
     if(!rowIssues.length){if(seen.has(key))rowIssues.push('DUPLICATE_SUBJECT_VISIT');else seen.add(key);}
     rows.push({sheet:sheet.name,rowNumber:row.rowNumber,subjectCode,visit,values:identity?[]:row.values,issues:[...new Set(rowIssues)]});
    }
   }
   return{fileId:file.fileId,sha256:inspected.sha256,format:inspected.extension,classification,triage:effectiveTriage,legacyClassification,legacyTriage,fields,rows,issues:[...fileIssues],rowsRead:rows.length,rejectedRows:rows.filter(r=>r.issues.length).length};
  });
  const value={schema:'hub-research-data-preflight.v1',...(general?{rulesVersion}:{}),principal:{tenantId:principal.tenantId,accountId:principal.accountId,authVersion:principal.authVersion,sessionId:principal.sessionId},...target,files:items,issues:[...issues],confirmationReady:false,modelCalls:0,operatorCalls:0,formalWrites:0};
  return{...value,previewHash:materialDigest(value)};
 }};
}
