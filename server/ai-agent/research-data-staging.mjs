import {createHash,randomUUID} from 'node:crypto';import {materialDigest} from './session-material-contract.mjs';
import {GENERAL_TABULAR_RULES} from './research-data-tabular.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),sha=b=>createHash('sha256').update(b).digest('hex');
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
const scope=(u,sid)=>[u.tenantId,u.studyGroupId,u.researchProjectId,u.accountId,sid];
const where='tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5';
const project=row=>({kind:'research-data',id:row.id,version:row.version,name:row.filename,state:row.state,summary:{rowsRead:row.summary.rowsRead,rejectedRows:row.summary.rejectedRows,issues:row.summary.issues},createdAt:row.created_at.toISOString()});
const planView=row=>({id:row.id,version:row.version,state:row.state,files:row.source_refs.map(({id,version})=>({id,version})),result:row.state==='previewed'?row.result:{schema:row.result.schema,confirmationReady:false,destination:null,issues:row.result.issues,files:row.result.files.map(({fileId,format,rowsRead,rejectedRows})=>({fileId,format,rowsRead,rejectedRows,fields:[],issues:[],sampleRows:[],exceptions:[]}))},createdAt:row.created_at.toISOString()});
export function summarizeResearchData(preview){return{schema:'hub-research-data-summary.v1',...(preview.rulesVersion?{rulesVersion:preview.rulesVersion}:{}),confirmationReady:false,destination:null,issues:preview.issues,files:preview.files.map(f=>({fileId:f.fileId,format:f.format,rowsRead:f.rowsRead,rejectedRows:f.rejectedRows,fields:f.fields,issues:f.issues,classification:f.classification.skillKey,sampleRows:f.rows.slice(0,8).map(r=>({...r,subjectCode:r.issues.some(i=>['DIRECT_IDENTIFIER_COLUMNS','SUBJECT_CODE_INVALID'].includes(i))?null:r.subjectCode,values:r.issues.some(i=>['DIRECT_IDENTIFIER_COLUMNS','SUBJECT_CODE_INVALID'].includes(i))?[]:r.values})),exceptions:f.rows.filter(r=>r.issues.length).slice(0,30).map(r=>({sheet:r.sheet,rowNumber:r.rowNumber,issues:r.issues}))}))};}
export async function assertNoResearchDataQuestion(tx,user,sid){
 await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,user.accountId);
 const rows=await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.research_data_uploads WHERE ${where} LIMIT 1 FOR SHARE`,...scope(user,sid));
 if(rows.length)throw Object.assign(Error('本会话的研究数据AI分析暂不可用，可先查看数据预检或导入结果。'),{code:'DATA_ANALYSIS_UNAVAILABLE',status:409,publicMessage:'本会话的研究数据AI分析暂不可用，可先查看数据预检或导入结果。'});
}
export function createResearchDataStaging({access,storage,engine,assertCancellation}){
 const refsInput=files=>{if(!Array.isArray(files)||!files.length||files.length>20||files.some(f=>!f||Array.isArray(f)||Object.keys(f).sort().join(',')!=='id,version'||!id(f.id)||!Number.isSafeInteger(f.version)||f.version<1)||new Set(files.map(f=>f.id)).size!==files.length)fail('DATA_INPUT_INVALID',400);return files;};
 const checkResult=result=>{if(Buffer.byteLength(JSON.stringify(result))>250000)fail('DATA_PREFLIGHT_CAPACITY',400);return result;};
 const audit=(tx,u,sid,action,target)=>tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId,action:'researchhub.data.'+action,target,meta:{sessionId:sid}}});
 async function rowsFor(tx,u,sid,refs){const rows=[];for(const ref of refs){const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_uploads WHERE ${where} AND id=$6 FOR SHARE`,...scope(u,sid),ref.id);if(!row||row.version!==ref.version||row.state!=='ready'||ref.sha256&&ref.sha256!==row.source_sha256)fail('DATA_SOURCE_CHANGED');rows.push(row);}return rows;}
 async function bytesFor(rows){let total=0;const files=[];for(const row of rows){total+=row.byte_size;if(total>50*1024*1024)fail('DATA_PREFLIGHT_CAPACITY',400);const buffer=await storage.getBuffer(row.storage_key,25*1024*1024);if(buffer.length!==row.byte_size||sha(buffer)!==row.source_sha256)fail('DATA_SOURCE_CHANGED');files.push({fileId:row.id,filename:row.filename,buffer});}return files;}
 async function currentPlan(tx,u,sid,row){if(!row)return null;if(row.state==='previewed'){await bytesFor(await rowsFor(tx,u,sid,row.source_refs));}return planView(row);}
 async function upload(u,sid,{requestKey,filename,buffer}){
  if(!id(requestKey)||typeof filename!=='string'||filename.length>240||!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>25*1024*1024)fail('DATA_INPUT_INVALID',400);
  await access.transaction(u,sid,async()=>{});
  const uploadId='rh-data-'+randomUUID(),sourceHash=sha(buffer),fingerprint=materialDigest({filename,sha256:sourceHash,size:buffer.length});
  const detected=engine.preview({...u,sessionId:sid},{files:[{fileId:uploadId,filename,buffer}],destinations:[],rulesVersion:GENERAL_TABULAR_RULES}),summary=checkResult(summarizeResearchData(detected)).files[0];
  return access.transaction(u,sid,async(tx,current)=>{
   await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',materialDigest([...scope(current,sid),requestKey]));
   const [existing]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_uploads WHERE ${where} AND request_key=$6 FOR UPDATE`,...scope(current,sid),requestKey);
   if(existing){if(existing.fingerprint!==fingerprint)fail('DATA_REQUEST_CONFLICT');return project(existing);}
   const storageKey='researchhub-private-data/'+current.tenantId+'/'+current.accountId+'/'+uploadId;
   await storage.put(storageKey,buffer,detected.files[0].format==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
   await tx.$executeRawUnsafe(`INSERT INTO rh_ai.research_data_uploads(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,fingerprint,source_sha256,byte_size,format,filename,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,uploadId,...scope(current,sid),requestKey,fingerprint,sourceHash,buffer.length,detected.files[0].format,filename,storageKey);
   const [row]=await tx.$queryRawUnsafe(`UPDATE rh_ai.research_data_uploads SET state='ready',summary=$1::jsonb,version=version+1 WHERE id=$2 AND version=1 RETURNING *`,JSON.stringify(summary),uploadId);
   if(!row)fail('DATA_VERSION_CONFLICT');await audit(tx,current,sid,'staged',row.id);return project(row);
  });
 }
 return{
  upload,
  receipt:(u,sid,key)=>{if(!id(key))fail('DATA_INPUT_INVALID',400);return access.transaction(u,sid,async(tx,current)=>{const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_uploads WHERE ${where} AND request_key=$6`,...scope(current,sid),key);return row?{found:true,item:project(row)}:{found:false};});},
  list:(u,sid,{limit=20,cursor}={})=>{limit=Number(limit);if(!Number.isSafeInteger(limit)||limit<1||limit>50||cursor!==undefined&&!id(cursor))fail('DATA_INPUT_INVALID',400);return access.transaction(u,sid,async(tx,current)=>{
   const rows=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_uploads WHERE ${where} AND ($6::text IS NULL OR id<$6) ORDER BY id DESC LIMIT $7`,...scope(current,sid),cursor??null,limit+1);return{items:rows.slice(0,limit).map(project),nextCursor:rows.length>limit?rows[limit-1].id:null};
  });},
  preview:(u,sid,body)=>{
   if(!body||Object.keys(body).sort().join(',')!=='files,requestKey'||!id(body.requestKey))fail('DATA_INPUT_INVALID',400);const refs=refsInput(body.files);
   return access.transaction(u,sid,async(tx,current)=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',materialDigest([...scope(current,sid),'plan',body.requestKey]));
    const [saved]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_preflights WHERE ${where} AND request_key=$6 FOR UPDATE`,...scope(current,sid),body.requestKey);
    if(saved){if(materialDigest(saved.source_refs.map(({id,version})=>({id,version})))!==materialDigest(refs))fail('DATA_REQUEST_CONFLICT');return currentPlan(tx,current,sid,saved);}
    const sources=await rowsFor(tx,current,sid,refs),files=await bytesFor(sources),preview=engine.preview({...current,sessionId:sid},{files,destinations:[],rulesVersion:GENERAL_TABULAR_RULES});
    const result=checkResult(summarizeResearchData(preview)),sourceRefs=sources.map(r=>({id:r.id,version:r.version,sha256:r.source_sha256})),planId='rh-data-plan-'+randomUUID();
    const [row]=await tx.$queryRawUnsafe(`INSERT INTO rh_ai.research_data_preflights(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,source_refs,preview_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb) RETURNING *`,planId,...scope(current,sid),body.requestKey,JSON.stringify(sourceRefs),preview.previewHash,JSON.stringify(result));
    await audit(tx,current,sid,'previewed',row.id);return planView(row);
   });
  },
  current:(u,sid)=>access.transaction(u,sid,async(tx,current)=>{const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_preflights WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 1`,...scope(current,sid));return{item:await currentPlan(tx,current,sid,row)};}),
  planReceipt:(u,sid,key)=>{if(!id(key))fail('DATA_INPUT_INVALID',400);return access.transaction(u,sid,async(tx,current)=>{const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_preflights WHERE ${where} AND request_key=$6`,...scope(current,sid),key);return{found:Boolean(row),item:await currentPlan(tx,current,sid,row)};});},
  cancel:(u,sid,pid,{version})=>{if(!id(pid)||!Number.isSafeInteger(version)||version<1)fail('DATA_INPUT_INVALID',400);return access.transaction(u,sid,async(tx,current)=>{
   const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_preflights WHERE ${where} AND id=$6 FOR UPDATE`,...scope(current,sid),pid);if(!row)fail('DATA_NOT_FOUND',404);
   if(assertCancellation)await assertCancellation(tx,current,sid,pid);
   if(row.state==='cancelled'&&row.version===version+1)return planView(row);if(row.state!=='previewed'||row.version!==version)fail('DATA_VERSION_CONFLICT');
   const [updated]=await tx.$queryRawUnsafe(`UPDATE rh_ai.research_data_preflights SET state='cancelled',version=version+1 WHERE id=$1 AND version=$2 RETURNING *`,pid,version);if(!updated)fail('DATA_VERSION_CONFLICT');await audit(tx,current,sid,'cancelled',pid);return planView(updated);
  });},
 };
}
