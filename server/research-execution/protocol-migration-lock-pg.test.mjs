import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {collectMigrationSnapshot} from './protocol-migration.mjs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {StudyFormsService}=require('./src/study-operations/study-forms.service.ts');
const {ScalesService}=require('./src/scales/scales.service.ts');
const {ProfilesService}=require('./src/profiles/profiles.service.ts');
const {SubjectsService}=require('./src/subjects/subjects.service.ts');
const {PhotosService}=require('./src/photos/photos.service.ts');
const {RawProcessingService}=require('./src/ingest/raw-processing.service.ts');
const {StudyOperationsService}=require('./src/study-operations/study-operations.service.ts');
const {claim}=require('./src/common/worker-claim.ts');
const {IngestService}=require('./src/ingest/ingest.service.ts');
const {StudyOutreachService}=require('./src/study-operations/study-outreach.service.ts');
const {hashInvitationToken}=require('./src/study-operations/study-outreach-policy.ts');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const direct=fn=>withFixtureTransaction(env,'direct',fn);
test('real PG: writer waits and rejects migrated enrollment and canceled visit',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const prefix=validateFixtureConfig(env).runId+'__migration_lock_'+randomUUID().slice(0,8);
 const id=Object.fromEntries(['tenant','group','project','subject','old','new','enrollment','plan','visit','template','version','assignment','scale','participant','invitation','session','file','processing','account','role','subject2','enrollment2','taskSource','taskTarget'].map(k=>[k,prefix+'_'+k]));
 const scope={tenantId:id.tenant,studyGroupId:id.group,researchProjectId:id.project};
 try{
  await direct(async tx=>{
   await tx.tenant.create({data:{id:id.tenant,slug:id.tenant,name:'Synthetic migration lock'}});
   await tx.studyGroup.create({data:{id:id.group,tenantId:id.tenant,slug:'synthetic',name:'Synthetic'}});
   await tx.account.create({data:{id:id.account,tenantId:id.tenant,username:'synthetic',displayName:'Synthetic',passwordHash:'test'}});
   await tx.permissionRole.create({data:{id:id.role,tenantId:id.tenant,key:'synthetic',name:'Synthetic',menuPermissions:['data'],buttonPermissions:['data.upload']}});
   await tx.researchProject.create({data:{id:id.project,tenantId:id.tenant,studyGroupId:id.group,code:'SYNTHETIC',name:'Synthetic'}});
   await tx.studyGroupMembership.create({data:{tenantId:id.tenant,studyGroupId:id.group,accountId:id.account,roleId:id.role}});
   await tx.researchProjectMembership.create({data:{...scope,accountId:id.account,roleKey:'researcher'}});
   await tx.subject.create({data:{id:id.subject,...scope,subjectId:'SYNTHETIC'}});
   for(const [protocol,n] of [[id.old,1],[id.new,2]]) await tx.studyProtocolVersion.create({data:{id:protocol,...scope,versionNumber:n,title:'Synthetic',purpose:'Synthetic',primaryOutcomes:[]}});
   await tx.studyEnrollment.create({data:{id:id.enrollment,...scope,subjectId:id.subject,protocolVersionId:id.old,status:'enrolled',enrolledAt:new Date()}});
   await tx.visitPlan.create({data:{id:id.plan,...scope,protocolVersionId:id.old,code:'V1',name:'Synthetic',sequence:1}});
   await tx.subjectVisit.create({data:{id:id.visit,...scope,enrollmentId:id.enrollment,subjectId:id.subject,visitPlanId:id.plan,protocolVersionId:id.old}});
   await tx.formTemplate.create({data:{id:id.template,...scope,key:'synthetic',name:'Synthetic'}});
   await tx.formVersion.create({data:{id:id.version,...scope,templateId:id.template,versionNumber:1,schema:{}}});
   await tx.formAssignment.create({data:{id:id.assignment,...scope,subjectId:id.subject,enrollmentId:id.enrollment,subjectVisitId:id.visit,formVersionId:id.version,mode:'researcher'}});
   await tx.formResponse.create({data:{...scope,assignmentId:id.assignment,status:'draft',answers:{}}});
   await tx.scaleDefinition.create({data:{id:id.scale,tenantId:id.tenant,code:'SYNTHETIC',name:'Synthetic'}});
  });
  let unlock;const release=new Promise(r=>unlock=r);let locked;const acquired=new Promise(r=>locked=r);
  const migrator=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});await tx.subjectVisit.update({where:{id:id.visit},data:{status:'cancelled'}});locked();await release;});
  await acquired;
  let requested;const requesting=new Promise(r=>requested=r);let writerPid;
  const prisma={forTenant:()=>({}),forTenantTransaction:(_tenant,_group,_project,fn)=>direct(async tx=>{writerPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{requested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})};
  const forms=new StudyFormsService(prisma,{});
  const writer=forms.saveDraft({...scope,accountId:'synthetic',role:'researcher'},id.assignment,{x:1});
  await requesting;
  let waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${writerPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'writer must actually wait on database lock');unlock();await migrator;
  await assert.rejects(writer,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');
  const response=await direct(tx=>tx.formResponse.findUnique({where:{assignmentId:id.assignment}}));assert.deepEqual(response.answers,{});
  await direct(async tx=>{await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}});await tx.subjectVisit.update({where:{id:id.visit},data:{status:'planned'}});});
  let unlockScale;const scaleRelease=new Promise(r=>unlockScale=r);let scaleLocked;const scaleAcquired=new Promise(r=>scaleLocked=r);
  const secondMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});scaleLocked();await scaleRelease;});
  await scaleAcquired;
  let scaleRequested;const scaleRequesting=new Promise(r=>scaleRequested=r);let scalePid;
  const outside=new Proxy({},{get(_t,model){return new Proxy({},{get(_m,operation){return args=>direct(tx=>tx[model][operation](args));}});}});
  const scalePrisma={forTenant:()=>outside,app:{$transaction:fn=>direct(async tx=>{scalePid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{scaleRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})}};
  const scaleWriter=new ScalesService(scalePrisma).createResult({...scope,accountId:'synthetic',role:'researcher'},'SYNTHETIC',{scaleCode:'SYNTHETIC',itemScores:[]});
  await scaleRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${scalePid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'scale writer must wait on database lock');unlockScale();await secondMigration;
  await assert.rejects(scaleWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');
  assert.equal(await direct(tx=>tx.scaleResult.count({where:{subjectId:id.subject}})),0);
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  const preparedSubject=await direct(tx=>tx.subject.findUnique({where:{id:id.subject}}));
  let unlockFile;const fileRelease=new Promise(r=>unlockFile=r);let fileLocked;const fileAcquired=new Promise(r=>fileLocked=r);
  const thirdMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});await tx.subjectVisit.update({where:{id:id.visit},data:{status:'cancelled'}});fileLocked();await fileRelease;});
  await fileAcquired;let fileRequested;const fileRequesting=new Promise(r=>fileRequested=r);let filePid,published=false;
  const ingest=new IngestService({}, {}, {}, {});
  ingest.withIngestAuthorization=(_user,fn)=>direct(async tx=>{filePid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{fileRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);});
  const fileWriter=ingest.withUploadPublication({...scope,accountId:'synthetic'},{subjectId:'SYNTHETIC',subjectVisitId:id.visit},{subject:preparedSubject,subjectVisitId:id.visit,expectedEnrollment:{id:id.enrollment,protocolVersionId:id.old,status:'enrolled'}},async()=>{published=true;});
  await fileRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${filePid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'file publication must wait on database lock');unlockFile();await thirdMigration;
  await assert.rejects(fileWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(published,false);
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  let unlockUnbound;const unboundRelease=new Promise(r=>unlockUnbound=r);let unboundLocked;const unboundAcquired=new Promise(r=>unboundLocked=r);
  const unboundMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});unboundLocked();await unboundRelease;});
  await unboundAcquired;let unboundRequested;const unboundRequesting=new Promise(r=>unboundRequested=r);let unboundPid,unboundPublished=false;
  const unboundIngest=new IngestService({}, {}, {}, {});unboundIngest.withIngestAuthorization=(_user,fn)=>direct(async tx=>{unboundPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{unboundRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);});
  const unboundWriter=unboundIngest.withUploadPublication({...scope,accountId:'synthetic'},{subjectId:'SYNTHETIC'},{subject:preparedSubject,subjectVisitId:null,expectedEnrollment:{id:id.enrollment,protocolVersionId:id.old,status:'enrolled'}},async()=>{unboundPublished=true;});
  await unboundRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${unboundPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'unbound file must wait on database lock');unlockUnbound();await unboundMigration;
  await assert.rejects(unboundWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(unboundPublished,false);

  const token='synthetic-session-token-01234567890123456789';
  await direct(async tx=>{await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}});await tx.subjectVisit.update({where:{id:id.visit},data:{status:'planned'}});await tx.participant.create({data:{id:id.participant,...scope,subjectId:id.subject,code:'synthetic'}});await tx.formAssignment.update({where:{id:id.assignment},data:{mode:'patient_h5',participantId:id.participant}});await tx.questionnaireInvitation.create({data:{id:id.invitation,...scope,assignmentId:id.assignment,participantId:id.participant,tokenHash:hashInvitationToken('synthetic-invitation-token-012345678901234'),expiresAt:new Date(Date.now()+60000)}});await tx.questionnaireSession.create({data:{id:id.session,...scope,assignmentId:id.assignment,invitationId:id.invitation,sessionTokenHash:hashInvitationToken(token),expiresAt:new Date(Date.now()+60000)}});});
  let unlockH5;const h5Release=new Promise(r=>unlockH5=r);let h5Locked;const h5Acquired=new Promise(r=>h5Locked=r);
  const fourthMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});await tx.subjectVisit.update({where:{id:id.visit},data:{status:'cancelled'}});h5Locked();await h5Release;});
  await h5Acquired;let h5Requested;const h5Requesting=new Promise(r=>h5Requested=r);let h5Pid;
  const h5Prisma={elevated:{$transaction:fn=>direct(async tx=>{h5Pid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{h5Requested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})}};
  const h5Writer=new StudyOutreachService(h5Prisma,{assertEnabled:async()=>{}}).saveH5Session(token,{x:1},true);
  await h5Requesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${h5Pid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'H5 writer must wait on database lock');unlockH5();await fourthMigration;
  await assert.rejects(h5Writer,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');
  const h5State=await direct(tx=>tx.questionnaireSession.findUnique({where:{id:id.session}}));assert.equal(h5State.status,'active');assert.deepEqual((await direct(tx=>tx.formResponse.findUnique({where:{assignmentId:id.assignment}}))).answers,{});
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  let unlockProfile;const profileRelease=new Promise(r=>unlockProfile=r);let profileLocked;const profileAcquired=new Promise(r=>profileLocked=r);
  const fifthMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});profileLocked();await profileRelease;});
  await profileAcquired;let profileRequested;const profileRequesting=new Promise(r=>profileRequested=r);let profilePid;
  const profilePrisma={forTenant:()=>outside,forTenantTransaction:(_tenant,_group,_project,fn)=>direct(async tx=>{profilePid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{profileRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})};
  const profileWriter=new ProfilesService(profilePrisma,{}).upsertProfile({...scope,accountId:'synthetic',role:'researcher'},'SYNTHETIC',{episodeCount:0});
  await profileRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${profilePid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'profile writer must wait on database lock');unlockProfile();await fifthMigration;
  await assert.rejects(profileWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(await direct(tx=>tx.subjectProfile.count({where:{subjectId:id.subject}})),0);
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  let unlockManifest;const manifestRelease=new Promise(r=>unlockManifest=r);let manifestLocked;const manifestAcquired=new Promise(r=>manifestLocked=r);
  const sixthMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});manifestLocked();await manifestRelease;});
  await manifestAcquired;let manifestRequested;const manifestRequesting=new Promise(r=>manifestRequested=r);let manifestPid;
  const manifestPrisma={forTenant:()=>outside,forTenantTransaction:(_tenant,_group,_project,fn)=>direct(async tx=>{manifestPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{manifestRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})};
  const manifestWriter=new SubjectsService(manifestPrisma,{}).upsertManifest({...scope,accountId:'synthetic',role:'researcher'},'SYNTHETIC',{availableModalities:['synthetic']});
  await manifestRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${manifestPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'manifest writer must wait on database lock');unlockManifest();await sixthMigration;
  await assert.rejects(manifestWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(await direct(tx=>tx.manifest.count({where:{subjectId:id.subject}})),0);
  await direct(async tx=>{await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}});await tx.modalityFile.create({data:{id:id.file,tenantId:id.tenant,subjectId:id.subject,kind:'raw',modality:'tabular',storageKey:'synthetic',filename:'synthetic'}});await tx.processingTask.create({data:{id:id.processing,...scope,subjectId:id.subject,modalityFileId:id.file,skillKey:'tabular-schema',idempotencyKey:id.processing,status:'queued',createdBy:id.account}});});
  const importTask=await direct(tx=>tx.processingTask.findUnique({where:{id:id.processing},include:{modalityFile:true}}));
  let unlockImport;const importRelease=new Promise(r=>unlockImport=r);let importLocked;const importAcquired=new Promise(r=>importLocked=r);
  const seventhMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});importLocked();await importRelease;});
  await importAcquired;let importRequested;const importRequesting=new Promise(r=>importRequested=r);let importPid,importPublished=false;
  const importer=new IngestService({}, {}, {}, {});importer.withIngestAuthorization=(_user,fn)=>direct(async tx=>{importPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{importRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);});
  const importWriter=importer.withManualImportPublication({...scope,accountId:'synthetic'},importTask,[{id:id.subject,subjectId:'SYNTHETIC',expectedEnrollment:{id:id.enrollment,protocolVersionId:id.old,status:'enrolled'}}],async()=>{importPublished=true;});
  await importRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${importPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'profile import must wait on database lock');unlockImport();await seventhMigration;
  await assert.rejects(importWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(importPublished,false);
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  let unlockPhoto;const photoRelease=new Promise(r=>unlockPhoto=r);let photoLocked;const photoAcquired=new Promise(r=>photoLocked=r);
  const photoMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});photoLocked();await photoRelease;});
  await photoAcquired;let photoRequested;const photoRequesting=new Promise(r=>photoRequested=r);let photoPid,removed=0;
  const photoPrisma={forTenant:()=>outside,forTenantTransaction:(_tenant,_group,_project,fn)=>direct(async tx=>{photoPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{photoRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})};
  const buffer=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const photoWriter=new PhotosService(photoPrisma,{put:async()=>{},remove:async()=>{removed++;}}).upload({...scope,accountId:'synthetic',role:'researcher'},'SYNTHETIC',{originalname:'synthetic.png',mimetype:'image/png',size:8,buffer},{kind:'tongue',tags:[]});
  await photoRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${photoPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'photo writer must wait on database lock');unlockPhoto();await photoMigration;
  await assert.rejects(photoWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(removed,1);assert.equal(await direct(tx=>tx.subjectPhoto.count({where:{subjectId:id.subject}})),0);
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  const workerScope={deploymentId:'synthetic',product:'researchhub',allowedTenantIds:[id.tenant],enabledWorkerKinds:['raw-processing'],controlPlaneEnabled:false,officialJobKinds:[]};
  const claimRef=await direct(tx=>claim(tx,workerScope,'raw-processing',id.processing,'synthetic-worker'));assert(claimRef);
  const rawSnapshot=await direct(tx=>tx.processingTask.findUnique({where:{id:id.processing},include:{modalityFile:true,subject:{select:{subjectId:true}}}}));
  let releaseScan;const scanRelease=new Promise(r=>releaseScan=r);let scanReady;const scanAcquired=new Promise(r=>scanReady=r);
  const scan=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;const target=await tx.studyProtocolVersion.findFirst({where:{id:id.new},include:{visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}}});const snapshot=await collectMigrationSnapshot(tx,{tenantId:id.tenant,studyGroupId:id.group,executionProjectId:id.project},target,[id.enrollment],{});assert(snapshot.items[0].evidenceCounts.files>0);assert(snapshot.items[0].evidenceCounts.processingTasks>0);assert(snapshot.items[0].blockingReasons.includes('existing_evidence'));scanReady();await scanRelease;});
  await scanAcquired;let workerStarted;const workerStarting=new Promise(r=>workerStarted=r);let workerPid,workerPublished=false;
  const workerPrisma={elevated:{$transaction:fn=>direct(async tx=>{workerPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{workerStarted();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})}};
  const worker=new RawProcessingService(workerPrisma,{},undefined,workerScope);const workerPublication=worker.withRawPublication(claimRef,rawSnapshot,async()=>{workerPublished=true;});
  await workerStarting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${workerPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'raw worker publication must wait on subject lock');releaseScan();await scan;await workerPublication;assert.equal(workerPublished,true);
  await direct(async tx=>{await tx.subject.create({data:{id:id.subject2,...scope,subjectId:'SYNTHETIC2'}});await tx.studyEnrollment.create({data:{id:id.enrollment2,...scope,subjectId:id.subject2,protocolVersionId:id.old,status:'enrolled',enrolledAt:new Date()}});for(const [task,subject,enrollment] of [[id.taskSource,id.subject2,id.enrollment2],[id.taskTarget,id.subject,id.enrollment]])await tx.studyTask.create({data:{id:task,...scope,subjectId:subject,enrollmentId:enrollment,source:'manual',taskType:'data_capture',status:'open'}});});
  let unlockDependency;const dependencyRelease=new Promise(r=>unlockDependency=r);let dependencyLocked;const dependencyAcquired=new Promise(r=>dependencyLocked=r);
  const dependencyMigration=direct(async tx=>{await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${id.subject} FOR UPDATE`;await tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.new}});dependencyLocked();await dependencyRelease;});
  await dependencyAcquired;let dependencyRequested;const dependencyRequesting=new Promise(r=>dependencyRequested=r);let dependencyPid;
  const taskPrisma={withTenantTransaction:(_tenant,_group,_project,fn)=>direct(async tx=>{dependencyPid=(await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;const proxy=new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw')return (...args)=>{dependencyRequested();return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});return fn(proxy);})};
  const taskService=new StudyOperationsService(taskPrisma);const dependencyWriter=taskService.assignTask({...scope,accountId:id.account,role:'researcher'},id.taskSource,{assigneeAccountId:id.account,collaboratorAccountIds:[],dependencyTaskIds:[id.taskTarget],expectedVersion:0});
  await dependencyRequesting;waiting=false;for(let i=0;i<80&&!waiting;i++){waiting=await direct(async tx=>Boolean((await tx.$queryRaw`SELECT cardinality(pg_blocking_pids(${dependencyPid}::int)) AS count`)[0].count));if(!waiting)await new Promise(r=>setTimeout(r,25));}
  assert.equal(waiting,true,'dependency writer must wait on target subject lock');unlockDependency();await dependencyMigration;
  await assert.rejects(dependencyWriter,e=>e?.response?.code==='PROTOCOL_BINDING_CHANGED');assert.equal(await direct(tx=>tx.studyTaskDependency.count({where:{studyTaskId:id.taskSource}})),0);
  await direct(tx=>tx.studyEnrollment.update({where:{id:id.enrollment},data:{protocolVersionId:id.old}}));
  const assigned=await taskService.assignTask({...scope,accountId:id.account,role:'researcher'},id.taskSource,{assigneeAccountId:id.account,collaboratorAccountIds:[],dependencyTaskIds:[id.taskTarget],expectedVersion:0});assert.equal(assigned.dependencies.length,1);









 } finally {
  await direct(async tx=>{await tx.studyTaskDependency.deleteMany({where:{studyTaskId:id.taskSource}});await tx.studyTask.deleteMany({where:{id:{in:[id.taskSource,id.taskTarget]}}});await tx.studyEnrollment.deleteMany({where:{id:id.enrollment2}});await tx.subject.deleteMany({where:{id:id.subject2}});await tx.processingTask.deleteMany({where:{id:id.processing}});await tx.modalityFile.deleteMany({where:{id:id.file}});await tx.questionnaireSession.deleteMany({where:{id:id.session}});await tx.questionnaireInvitation.deleteMany({where:{id:id.invitation}});await tx.scaleResult.deleteMany({where:{subjectId:id.subject}});await tx.scaleDefinition.deleteMany({where:{id:id.scale}});await tx.formResponse.deleteMany({where:{assignmentId:id.assignment}});await tx.formAssignment.deleteMany({where:{id:id.assignment}});await tx.participant.deleteMany({where:{id:id.participant}});await tx.formVersion.deleteMany({where:{id:id.version}});await tx.formTemplate.deleteMany({where:{id:id.template}});await tx.subjectVisit.deleteMany({where:{id:id.visit}});await tx.studyEnrollment.deleteMany({where:{id:id.enrollment}});await tx.visitPlan.deleteMany({where:{id:id.plan}});await tx.studyProtocolVersion.deleteMany({where:{id:{in:[id.old,id.new]}}});await tx.subject.deleteMany({where:{id:id.subject}});await tx.researchProjectMembership.deleteMany({where:{researchProjectId:id.project}});await tx.studyGroupMembership.deleteMany({where:{studyGroupId:id.group}});await tx.permissionRole.deleteMany({where:{id:id.role}});await tx.account.deleteMany({where:{id:id.account}});await tx.researchProject.deleteMany({where:{id:id.project}});await tx.studyGroup.deleteMany({where:{id:id.group}});await tx.tenant.deleteMany({where:{id:id.tenant}});});
 }
});
