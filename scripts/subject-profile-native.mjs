import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createRequire} from 'node:module';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {bindingColumn} from '../server/ai-agent/research-data-tabular.mjs';

const code=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(x);
const fail=(key,status=409)=>{throw Object.assign(Error(key),{code:key,status});};
export const profileRecordHash=value=>materialDigest(value==null?null:JSON.parse(JSON.stringify(value)));
export function createNativeSubjectProfileAdapter({load,root,executionLogs}){
 const inspect=load('ingest/subject-profile-import','inspectSubjectProfileWorkbook');
 const parse=load('ingest/subject-profile-import','importSubjectProfileWorkbook');
 const streamRows=load('ingest/xlsx-stream-reader','readXlsxRowsStreaming');
 const classify=load('ingest/tabular-skill-classifier','classifyTabularSkill');
 const XLSX=createRequire(root+'app/server/package.json')('xlsx');
 if(typeof inspect!=='function')throw Error('PROFILE_NATIVE_INSPECTION_REQUIRED');
 const files=['subject-profile-import.ts','xlsx-stream-reader.ts','tabular-skill-classifier.ts'];
 const revisionNow=()=>materialDigest({adapterVersion:4,sources:files.map(p=>createHash('sha256').update(readFileSync(root+'app/server/src/ingest/'+p)).digest('hex'))});
 const revision=revisionNow();
 const current=()=>{if(revisionNow()!==revision)fail('PROFILE_IMPORT_PARSER_CHANGED');};
 async function analyze(buffer,{sheetName,recordBindings=[],targetStudyId}={}){
  current();if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>25*1024*1024)fail('PROFILE_IMPORT_CAPACITY',413);
  if(!Array.isArray(recordBindings)||recordBindings.length>500||recordBindings.some(x=>!x||Object.keys(x).sort().join(',')!=='recordNumber,subjectCode'||!Number.isSafeInteger(x.recordNumber)||x.recordNumber<1||!code(x.subjectCode)))fail('PROFILE_IMPORT_INPUT_INVALID',400);
  const dir=await mkdtemp(join(tmpdir(),'hub-profile-preview-')),path=join(dir,'source.xlsx');
  try{
   await writeFile(path,buffer);
   const metadata=inspect(path,sheetName);
   const formulaSheet=XLSX.read(buffer,{type:'buffer',cellFormula:true,cellHTML:false,cellStyles:false}).Sheets[metadata.sheetName];
   if(Object.entries(formulaSheet).some(([key,value])=>!key.startsWith('!')&&typeof value?.f==='string'))fail('PROFILE_IMPORT_FORMULA_UNSUPPORTED',400);
   let headers;
   const stream=await streamRows(path,row=>{if(!headers&&row.filter(v=>String(v??'').trim()).length>=2)headers=row.map(v=>String(v??'').trim()).filter(Boolean);});
   if(!headers)fail('PROFILE_IMPORT_NO_HEADER',400);
   const actualRoute=classify([{name:stream.sheetEntries[0]?.split('/').pop()??'Sheet1',headers}]);
   if(actualRoute.skillKey!=='subject-profile-import')fail('PROFILE_IMPORT_ROUTE_UNSUPPORTED');
   if(!sheetName&&metadata.sheetNames.length>1)return{view:{kind:'sheet_required',sheetNames:metadata.sheetNames}};
   const data=metadata.rawRows.slice(metadata.headerIndex+1);
   const studyColumns=metadata.headers.flatMap((h,i)=>bindingColumn(h)==='studyId'?[i]:[]);
   if(studyColumns.length>1)fail('PROFILE_IMPORT_HEADER_AMBIGUOUS',400);
   if(targetStudyId&&studyColumns.length&&data.some(row=>String(row[studyColumns[0]]??'').trim()&&String(row[studyColumns[0]]).trim()!==targetStudyId))fail('DATA_IMPORT_STUDY_MISMATCH',400);
   if(!data.length||data.length>500)fail('PROFILE_IMPORT_CAPACITY',413);
   if(!Object.keys(metadata.columns).length)fail('PROFILE_IMPORT_NO_FIELDS',400);
   if(new Set(metadata.headers.filter(Boolean)).size!==metadata.headers.filter(Boolean).length)fail('PROFILE_IMPORT_HEADER_AMBIGUOUS',400);
   const selectedColumns=Object.values(metadata.columns);
   if(new Set(selectedColumns).size!==selectedColumns.length)fail('PROFILE_IMPORT_HEADER_AMBIGUOUS',400);
   const col=metadata.subjectHeader?metadata.headers.indexOf(metadata.subjectHeader):-1;
   const identities=data.map(row=>col<0?'':String(row[col]??'').trim());
   const records=identities.map((identity,i)=>({recordNumber:i+1,sourceSubjectCode:code(identity)?identity:null}));
   const bindings=recordBindings.length?recordBindings:records.map(r=>({recordNumber:r.recordNumber,subjectCode:r.sourceSubjectCode}));
   if(!recordBindings.length&&bindings.some(x=>!x.subjectCode))return{view:{kind:'mapping_required',sheetName:metadata.sheetName,sheetNames:metadata.sheetNames,records}};
   if(bindings.length!==data.length||new Set(bindings.map(x=>x.recordNumber)).size!==data.length||bindings.some(x=>x.recordNumber>data.length))fail('PROFILE_IMPORT_MAPPING_REQUIRED',400);
   const ordered=[...bindings].sort((a,b)=>a.recordNumber-b.recordNumber);
   if(new Set(ordered.map(x=>x.subjectCode)).size!==ordered.length)fail('PROFILE_IMPORT_DUPLICATE_SUBJECT',400);
   const map=new Map();
   for(const b of ordered){const identity=identities[b.recordNumber-1];if(map.has(identity)&&map.get(identity)!==b.subjectCode)fail('PROFILE_IMPORT_IDENTITY_AMBIGUOUS',400);map.set(identity,b.subjectCode);}
   if(!metadata.subjectHeader&&data.length!==1)fail('PROFILE_IMPORT_IDENTITY_AMBIGUOUS',400);
   const options={sheetName:metadata.sheetName,...(metadata.subjectHeader?{identityMap:Object.fromEntries(map)}:{defaultSubjectId:ordered[0].subjectCode})};
   const parsed=parse(path,options);
   if(parsed.unmappedIdentityCount||parsed.rows.length!==data.length)fail('PROFILE_IMPORT_MAPPING_REQUIRED',400);
   for(let i=0;i<parsed.rows.length;i++){
    if(parsed.rows[i].subjectId!==ordered[i].subjectCode)fail('PROFILE_IMPORT_MAPPING_CHANGED');
    const row=Object.fromEntries(metadata.headers.map((name,c)=>[name,data[i][c]]));
    for(const [field,header]of Object.entries(metadata.columns))if(row[header]!==null&&row[header]!==undefined&&String(row[header]).trim()&&!Object.hasOwn(parsed.rows[i].values,field))fail('PROFILE_IMPORT_FIELD_INVALID',400);
   }
   return{view:{kind:'ready',sheetName:metadata.sheetName,sheetNames:metadata.sheetNames,records,recordBindings:ordered,rows:parsed.rows.map(r=>({subjectCode:r.subjectId,values:r.values})),qualityWarnings:parsed.qualityWarnings},options};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 return{
  revision,inspect:async(buffer,options)=>(await analyze(buffer,options)).view,
  async detectProfileCandidate(buffer){
   current();if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>25*1024*1024)fail('PROFILE_IMPORT_CAPACITY',413);
   const dir=await mkdtemp(join(tmpdir(),'hub-profile-route-')),path=join(dir,'source.xlsx');
   try{await writeFile(path,buffer);const first=inspect(path),sheets=first.sheetNames.map(sheet=>inspect(path,sheet));if(sheets.some(s=>s.headers.some(h=>bindingColumn(h)==='visitCode')))return false;return sheets.some(sheet=>Object.keys(sheet.columns).length>0);}finally{await rm(dir,{recursive:true,force:true});}
  },
  async executeInTx(tx,user,target,snapshot,source){
   current();if(snapshot.parserRevision!==revision||snapshot.source.refs[0]?.sha256!==source.sha256||createHash('sha256').update(source.buffer).digest('hex')!==source.sha256)fail('PROFILE_IMPORT_SOURCE_CHANGED');
   const checked=await analyze(source.buffer,{sheetName:snapshot.source.sheetName,recordBindings:snapshot.recordBindings,targetStudyId:snapshot.target.studyId});
   if(checked.view.kind!=='ready'||materialDigest(checked.view.rows)!==materialDigest(snapshot.rows.map(r=>({subjectCode:r.subjectCode,values:r.values}))))fail('PROFILE_IMPORT_MAPPING_CHANGED');
   const sameScope=(tenant,group,project)=>{if(tenant!==user.tenantId||group!==target.studyGroupId||project!==target.researchProjectId)fail('PROFILE_IMPORT_NATIVE_SCOPE_MISMATCH',403);};
   const setScope=()=>tx.$queryRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)",user.tenantId,target.studyGroupId,target.researchProjectId,user.accountId);
   const prisma={forTenant:(t,g,p)=>{sameScope(t,g,p);return tx;},withTenantTransaction:async(t,g,p,fn)=>{sameScope(t,g,p);await setScope();return fn(tx);},elevated:{$transaction:async fn=>{await setScope();return fn(tx);}}};
   const storage=new Proxy({downloadToFile:async(key,path)=>{if(key!==source.storageKey)fail('PROFILE_IMPORT_CACHE_KEY_REJECTED',403);await writeFile(path,source.buffer);}}, {get:(object,key)=>{if(Object.hasOwn(object,key))return object[key];throw Error('PROFILE_IMPORT_STORAGE_OPERATION_REJECTED');}});
   const nativeUser={...user,studyGroupId:target.studyGroupId,researchProjectId:target.researchProjectId};
   const scope={deploymentId:'hub-profile-import-v1',product:'researchhub',allowedTenantIds:[user.tenantId],enabledWorkerKinds:['raw-processing'],controlPlaneEnabled:false,officialJobKinds:[]};
   const Raw=load('ingest/raw-processing.service','RawProcessingService'),Ingest=load('ingest/ingest.service','IngestService');
   const worker=new Raw(prisma,storage,executionLogs,scope);
   const ingest=new Ingest(prisma,storage,{kick:()=>{}},{ensureUngrouped:()=>{throw Error('PROFILE_IMPORT_SUBJECT_CREATION_FORBIDDEN');}},executionLogs);
   try{
    await setScope();const carrier=snapshot.rows[0];
    const duplicate=await tx.processingTask.findFirst({where:{tenantId:user.tenantId,studyGroupId:target.studyGroupId,researchProjectId:target.researchProjectId,modalityFile:{storageKey:source.storageKey}}});
    if(duplicate)fail('PROFILE_IMPORT_SOURCE_ALREADY_REGISTERED');
    const registered=await ingest.ingestStoredRaw(nativeUser,{subjectId:carrier.subjectCode,modality:'tabular',bindMode:'existing'}, {storageKey:source.storageKey,filename:source.filename,mimetype:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size:source.buffer.length,sha256:source.sha256});
    if(registered.duplicate||registered.subjectCard.created||registered.task.status!=='queued'||registered.task.skillKey!=='raw-tabular-orchestration')fail('PROFILE_IMPORT_NATIVE_REGISTRATION_CHANGED');
    const ref=await load('common/worker-claim','claim')(tx,scope,'raw-processing',registered.task.id,'hub-profile:'+randomUUID());
    if(!ref||ref.taskId!==registered.task.id)fail('PROFILE_IMPORT_CLAIM_REJECTED');
    await worker.executeClaimed(ref);
    const task=await tx.processingTask.findUnique({where:{id:registered.task.id}});
    if(task?.skillKey!=='subject-profile-import'||task.status!=='needs_review')fail('PROFILE_IMPORT_NATIVE_ROUTE_CHANGED');
    await ingest.confirmProfileImport(nativeUser,task.id,checked.options);
    const actualTask=await tx.processingTask.findUnique({where:{id:task.id}});
    if(actualTask?.status!=='complete'||actualTask.result?.valuesImported!==true)fail('PROFILE_IMPORT_NATIVE_RESULT_CHANGED');
    const subjects=[];
    for(const row of snapshot.rows){
     const profile=await tx.subjectProfile.findUnique({where:{subjectId:row.subjectId}});
     if(!profile||Object.entries(row.values).some(([key,value])=>profile[key]!==value))fail('PROFILE_IMPORT_SAVED_VALUES_CHANGED');
     subjects.push({id:row.subjectId,subjectCode:row.subjectCode,profileHash:profileRecordHash(profile),profileUpdatedAt:profile.updatedAt.toISOString()});
    }
    return{taskId:task.id,fileId:registered.file.id,subjects};
   }finally{worker.onModuleDestroy();await executionLogs?.flush();}
  },
 };
}
