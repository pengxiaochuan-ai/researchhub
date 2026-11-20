import test from 'node:test';
import assert from 'node:assert/strict';
const {createSubjectDataService}=await import('./subject-data.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const user={tenantId:'tenant',accountId:'actor',authVersion:1},ctx={tenantId:'tenant',studyId:'study',studyGroupId:'group',executionProjectId:'project'};
function fixture({menus=['subjects','data'],limited,admin=false}={}){
 const subject={id:'subject',subjectId:'S01',group:null,syndrome:null,sex:null,age:0,clinicalLabelSource:null,consentScope:null};
 const files=[{id:'file-a',subjectId:'subject',subjectVisitId:null,modality:'tabular',kind:'raw',status:'ingested',filename:'synthetic.xlsx',collectedAt:null,createdAt:new Date('2026-01-01'),meta:{sha256:'a'.repeat(64),storageVerifiedSha256:'a'.repeat(64)},storageKey:'private-key'},{id:'file-b',subjectId:'subject',subjectVisitId:null,modality:'eye',kind:'raw',status:'needs_review',filename:'next.csv',collectedAt:null,createdAt:new Date('2026-01-02'),meta:null,storageKey:'never-expose'}];
 const task={id:'task',subjectId:'subject',modalityFileId:'file-a',status:'complete',skillKey:'subject-profile-import',progress:100,createdAt:new Date('2026-01-01'),updatedAt:new Date('2026-01-02'),completedAt:new Date('2026-01-02'),result:{private:'never-expose'}};
 const calls=[],tx={tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},account:{findFirst:async()=>({role:admin?'tenant_admin':'researcher',isTenantAdmin:admin,status:'active',authVersion:1,tenant:{status:'active'}})},studyGroup:{findFirst:async()=>({status:'active'})},researchProject:{findFirst:async()=>({status:'active'})},researchProjectMembership:{findFirst:async()=>({status:'active'})},studyGroupMembership:{findFirst:async()=>({status:'active',role:{tenantId:'tenant',status:'active',menuPermissions:menus,buttonPermissions:[]}})},subject:{findFirst:async q=>{calls.push(q);return q.where.id===subject.id&&q.where.researchProjectId==='project'?subject:null;}},subjectProfile:{findFirst:async()=>({onsetAge:0,familyHistory:false,onMedication:null,otherNote:'private',extra:{secret:true},updatedAt:new Date('2026-01-02')})},modalityFile:{findMany:async q=>{assert.equal(q.where.subjectVisitId,null);return files.filter(f=>!q.where.id?.gt||f.id>q.where.id.gt).slice(0,q.take);},findFirst:async q=>files.find(f=>f.id===q.where.id)},processingTask:{count:async()=>1,findFirst:async q=>q.where.id===task.id?task:null,findMany:async()=>[task]},feature:{count:async()=>1,findMany:async()=>[{id:'feature',featureKey:'eye.test',modality:'eye',value:17,unit:'unit',timeWindow:'static',sourcePipeline:'native',extractionVersion:'1',collectedAt:null,private:'never-expose'}]}};
 tx.processingTask.groupBy=async q=>q.where.modalityFileId.in.map(id=>({modalityFileId:id,_count:{_all:1}}));
 tx.$queryRawUnsafe=async(_sql,_tenant,_subject,fileIds)=>fileIds.map(fileId=>({fileId,count:1}));
 return{tx,calls,service:createSubjectDataService({studies:{withResearchStudyTransaction:async(_u,_id,_mode,fn)=>fn(tx,ctx)},limitedImportRead:limited,cursorSecret:'test-secret'})};
}
test('data menu projects whitelist values without imputation and excludes transport/private payloads',async()=>{
 const {service}=fixture(),r=await service.read(user,'study','subject',{limit:'1'});
 assert.equal(r.schema,'hub-subject-data.v1');assert.equal(r.clinical.subject.age,0);assert.equal(r.clinical.profile.values.onsetAge,0);assert.equal(r.clinical.profile.values.familyHistory,false);assert.equal(r.clinical.profile.values.onMedication,null);assert.equal(r.clinical.profile.values.otherNote,undefined);assert.equal(r.clinical.profile.values.extra,undefined);
 assert.equal(r.data.items.length,1);assert(r.data.nextCursor);assert.equal(r.data.items[0].taskCount,1);assert.equal(r.data.items[0].sourceRef.sha256,'a'.repeat(64));assert(!JSON.stringify(r).includes('private-key'));
 const next=await service.read(user,'study','subject',{limit:'1',cursor:r.data.nextCursor});assert.equal(next.data.items[0].id,'file-b');assert.equal(next.data.nextCursor,null);
 const tasks=await service.read(user,'study','subject',{section:'tasks',fileId:'file-a'});assert.equal(tasks.data.items[0].id,'task');assert.equal(tasks.data.items[0].result,undefined);
 const features=await service.read(user,'study','subject',{section:'features',fileId:'file-a',taskId:'task'});assert.equal(features.data.items[0].value,undefined);assert.equal(features.data.items[0].unit,undefined);assert.equal(features.data.taskId,'task');
});
test('subjects visibility and precise source object visibility never grant clinical data',async()=>{
 for(const options of [{menus:['subjects']},{menus:[],limited:async()=>({subjectIds:['subject'],visitIds:[]})}]){
  const {service,tx}=fixture(options);tx.subjectProfile.findFirst=async()=>assert.fail('restricted profile queried');tx.modalityFile.findMany=async()=>assert.fail('restricted files queried');
  const r=await service.read(user,'study','subject');assert.equal(r.capabilities.canReadClinicalData,false);assert.equal(r.clinical.status,'restricted');assert.equal(r.clinical.subject,null);assert.deepEqual(r.data.items,[]);
 }
});
test('tenant admin data authority does not require membership; absent profile is explicit',async()=>{
 const {service,tx}=fixture({menus:[],admin:true});tx.researchProjectMembership.findFirst=async()=>null;tx.studyGroupMembership.findFirst=async()=>null;tx.subjectProfile.findFirst=async()=>null;
 const r=await service.read(user,'study','subject');assert.equal(r.capabilities.canReadClinicalData,true);assert.equal(r.clinical.profile.status,'missing');assert.deepEqual(r.clinical.profile.values,{});
});
test('invalid object, query parent, foreign cursor, and revoked data access fail closed',async()=>{
 const {service,tx}=fixture();await assert.rejects(service.read(user,'study','missing'),e=>e.status===404);
 for(const q of [{section:'tasks'},{section:'features',fileId:'file-a'},{fileId:'file-a'},{section:'files',taskId:'task'},{section:'files',extra:'x'}])await assert.rejects(service.read(user,'study','subject',q),e=>e.code==='RESEARCH_INPUT_INVALID');
 const r=await service.read(user,'study','subject',{limit:'1'});await assert.rejects(service.read({...user,accountId:'other'},'study','subject',{cursor:r.data.nextCursor}),e=>e.code==='RESEARCH_INPUT_INVALID');
 tx.account.findFirst=async()=>({role:'researcher',isTenantAdmin:false,status:'active',authVersion:2,tenant:{status:'active'}});await assert.rejects(service.read(user,'study','subject'),e=>e.status===401);
});
test('data menu alone can read the same native subject; an inactive role or project cannot grant data',async()=>{
 const onlyData=fixture({menus:['data']});assert.equal((await onlyData.service.read(user,'study','subject')).capabilities.canReadClinicalData,true);
 for(const change of ['role','member','project','group']){
  const {service,tx}=fixture();
  if(change==='role')tx.studyGroupMembership.findFirst=async()=>({status:'active',role:{tenantId:'tenant',status:'disabled',menuPermissions:['subjects','data']}});
  if(change==='member')tx.researchProjectMembership.findFirst=async()=>null;
  if(change==='project')tx.researchProject.findFirst=async()=>null;
  if(change==='group')tx.studyGroup.findFirst=async()=>null;
  if(['role','member'].includes(change))await assert.rejects(service.read(user,'study','subject'),e=>e.status===403);
  else{const r=await service.read(user,'study','subject');assert.equal(r.capabilities.canReadClinicalData,false);assert.equal(r.clinical.subject,null);}
 }
});
test('limited source access is bound to exact creator and subject; no carrier-derived cross-subject access',async()=>{
 const {service,tx,calls}=fixture({menus:[],limited:async()=>({subjectIds:['subject'],visitIds:[]})});
 await service.read(user,'study','subject');assert.equal(calls[0].where.createdBy,user.accountId);
 await assert.rejects(service.read(user,'study','other-subject'),e=>e.status===404);
 tx.modalityFile.findFirst=async()=>null;
 const full=fixture();full.tx.modalityFile.findFirst=async()=>null;await assert.rejects(full.service.read(user,'study','subject',{section:'features',fileId:'visit-bound-file',taskId:'task'}),e=>e.status===404);
});
test('a file page batches counts and requires feature/task/file equality instead of matching unrelated files',async()=>{
 const {service,tx}=fixture();let grouped=0,features=0;
 tx.processingTask.count=async()=>assert.fail('per-file task count');tx.feature.count=async()=>assert.fail('per-file feature count');
 tx.processingTask.groupBy=async q=>{grouped++;assert.deepEqual(q.where.modalityFileId.in,['file-a','file-b']);return[{modalityFileId:'file-a',_count:{_all:2}}];};
 tx.$queryRawUnsafe=async(sql,...args)=>{features++;assert(sql.includes('t."modalityFileId"=x."sourceModalityFileId"'));assert(sql.includes('t."subjectId"=x."subjectId"'));assert.deepEqual(args,['tenant','subject',['file-a','file-b'],'group','project']);return[{fileId:'file-a',count:3}];};
 const r=await service.read(user,'study','subject');assert.equal(grouped,1);assert.equal(features,1);assert.deepEqual(r.data.items.map(x=>[x.taskCount,x.featureCount]),[[2,3],[0,0]]);
});
