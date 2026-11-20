import {assertSessionOrigin} from '../auth/session.mjs';
import {createResearchStudiesService} from './commands.mjs';
import {createProtocolConfigurationService} from '../research-execution/protocols.mjs';
import {createProtocolTemplateService} from '../research-execution/protocol-templates.mjs';
import {createProtocolReviewQueue} from '../research-execution/review-queue.mjs';
import {createProtocolDecisionHistory} from '../research-execution/review-history.mjs';
import {createPolicyDraftService} from '../research-execution/policy-drafts.mjs';
import {createProtocolReleaseService} from '../research-execution/protocol-release.mjs';
import {createMigrationCandidates} from '../research-execution/migration-candidates.mjs';
import {createProtocolMigrationService} from '../research-execution/protocol-migration.mjs';
import {createSubjectsService} from '../research-execution/subjects.mjs';
import {createSubjectDataService,canReadStudyDataInTx} from '../research-execution/subject-data.mjs';
import {createEnrollmentService} from '../research-execution/enrollment.mjs';
import {createFormalCaptureService} from '../research-capture/formal-capture.mjs';
import {createVisitWorkflowService} from '../research-capture/visit-workflow.mjs';
import {createCorrectionImpactService} from '../research-capture/correction-impact.mjs';
import {visitWorkflowRoutes,dispatchVisitWorkflow,visitWorkflowRejection} from './visit-workflow-routes.mjs';
import {createVisitsService} from '../research-execution/visits.mjs';
import {createDueVisitsService} from '../research-execution/due-visits.mjs';
import {createFormalDataQueryService} from '../research-capture/formal-data-query.mjs';
import {only,invalid} from './contract.mjs';
import {presentFormalDataQueries} from '../research-capture/query-source.mjs';
import {presentFormalRevisions} from '../research-capture/revision-display.mjs';
import {randomBytes} from 'node:crypto';
import {createFormalTaskService} from '../study-tasks/formal-tasks.mjs';
import {createFormalTaskSource} from '../study-tasks/formal-task-source.mjs';
import {createCaptureImportService} from '../research-capture/imports.mjs';
import {createOutreachService} from '../research-capture/outreach.mjs';
import {presentOutreachVisit} from '../research-capture/outreach-display.mjs';
import {createFileLinksService} from '../research-capture/file-links.mjs';
import {createVisitFileUploadService} from '../research-capture/file-upload.mjs';
import {createResearchFormAdapter} from '../research-capture/form-core-adapter.mjs';
import {readAnalysisMode} from './analysis-mode.mjs';
import {withAnalysisListLifetime} from '../http/analysis-list-lifetime.mjs';
export function createResearchStudiesController({require,load,prisma,scope,origin,legacyHints,studyMailer,storage,ingestService,createAnalysisServices,createSimulation,createVisitProjection,formAdapter,limitedImportRead,limitedMediaRead,cursorSecret=randomBytes(32).toString('hex')}){
 const forms=formAdapter??createResearchFormAdapter({require,load}),formLoad=forms.load;
 const {Controller,Get,Post,Patch,Put,Param,Query,Req,Res,Body,HttpException,HttpCode}=require('@nestjs/common');
 const core=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma);
 const service=createResearchStudiesService({prisma,scope,legacyHints,lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:(tx,user,group,input)=>core.createResearchProjectInTransaction(tx,user,group,input)});
 const analysisServices=createAnalysisServices?.(service),analysis=analysisServices?.analysis,analysisRuns=analysisServices?.runs,reports=analysisServices?.reports,jobs=analysisServices?.jobs,jobLifecycle=analysisServices?.jobLifecycle;
 const simulation=createSimulation?.(service);
 const simulate=(tx,user,s,fn,options)=>simulation?simulation.withExecutionTx(tx,user,s,fn,options):fn(tx);
 const presentVisit=async(tx,s,value)=>simulation?simulation.presentVisit(tx,s,await value):value;
 const visitScope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
 const remediation=new(load('remediation/remediation.service','RemediationCasesService'))(prisma);
 const operations=new(load('study-operations/study-operations.service','StudyOperationsService'))(prisma,remediation);
 const projectVisit=createVisitProjection?.(operations)??(async(_tx,_user,_s,visit)=>visit);
 const configuration=createProtocolConfigurationService({studies:service,core:operations});
 const protocolTemplates=createProtocolTemplateService({studies:service,core:operations,cursorSecret});
 const reviews=createProtocolReviewQueue({studies:service});
 const decisions=createProtocolDecisionHistory({studies:service});
 const policies=createPolicyDraftService({studies:service});
 const release=createProtocolReleaseService({studies:service,core:operations});
 const migrationCandidates=createMigrationCandidates({studies:service});
 const migration=createProtocolMigrationService({studies:service,core:operations});
 const subjectGroups=new(load('subject-groups/subject-groups.service','SubjectGroupsService'))(prisma);
 const subjectsCore=new(load('subjects/subjects.service','SubjectsService'))(prisma,subjectGroups);
 const subjects=createSubjectsService({studies:service,core:subjectsCore,limitedImportRead,limitedMediaRead});
 const subjectData=createSubjectDataService({studies:service,limitedImportRead,limitedMediaRead,cursorSecret});
 const authorizeParticipation=load('study-operations/participation-authority','authorizeParticipation');
 const authorizeFormalResponse=load('study-operations/formal-response-authority','authorizeFormalResponse');
 const correctionImpact=createCorrectionImpactService({studies:service,cursorSecret,core:{authorize:authorizeFormalResponse,readAssignment:load('study-operations/formal-response-query','readFormalResponseInTransaction'),readVisit:load('study-operations/formal-response-visits','readFormalVisitInTransaction')}});
 const dueVisits=createDueVisitsService({studies:service,core:{authorize:authorizeFormalResponse}});
 const fileCore={canReadFeatureValues:(tx,user,s)=>canReadStudyDataInTx(tx,user,{...s,executionProjectId:s.researchProjectId}),readVisit:load('study-operations/formal-response-visits','readFormalVisitInTransaction'),lockBinding:load('study-operations/protocol-migration-lock','lockCaptureBinding'),uploadConfigured:Boolean(storage&&ingestService),authorizeUpload:(tx,user,s)=>load('ingest/ingest-authorization','authorizeIngestInTransaction')(tx,user,s.studyGroupId,s.researchProjectId)};
 const files=createFileLinksService({studies:service,core:fileCore,cursorSecret});
 const fileUploads=storage&&ingestService?createVisitFileUploadService({studies:service,storage,core:{...fileCore,authorizeUpload:(tx,user,s)=>load('ingest/ingest-authorization','authorizeIngestInTransaction')(tx,user,s.studyGroupId,s.researchProjectId),ingest:ingestService.ingestPreprocessed.bind(ingestService)}}):null;
 const outreach=createOutreachService({studies:service,baseUrl:new URL('/',origin).href,mailer:studyMailer,core:{
  register:load('study-operations/formal-outreach','registerEmailRecipientInTransaction'),
  prepare:load('study-operations/formal-outreach','prepareEmailInvitationInTransaction'),
  send:load('study-operations/formal-outreach','sendEmailInvitationInTransaction'),
  read:load('study-operations/formal-outreach','readEmailInvitationInTransaction'),
 }});
 const tasks=createFormalTaskService({studies:service,cursorSecret,core:{
  authorize:load('study-operations/study-task-authority','assertStudyTaskAuthority'),
  execute:operations.executeHubTaskCommandInTransaction.bind(operations),
  listVisits:load('study-operations/formal-response-visits','listFormalVisitsInTransaction'),
  source:createFormalTaskSource({readVisit:load('study-operations/formal-response-visits','readFormalVisitInTransaction'),readResponse:load('study-operations/formal-response-query','readFormalResponseInTransaction'),readRevision:load('study-operations/formal-response-history','readFormalResponseRevisionInTransaction'),lockCaptureBinding:load('study-operations/protocol-migration-lock','lockCaptureBinding')}),
 }});
 const imports=createCaptureImportService({studies:service,core:{
  authorize:authorizeFormalResponse,
  lockScope:load('study-operations/protocol-migration-lock','lockCaptureScope'),lockBinding:load('study-operations/protocol-migration-lock','lockCaptureBinding'),
  readVisit:load('study-operations/formal-response-visits','readFormalVisitInTransaction'),readResponse:load('study-operations/formal-response-query','readFormalResponseInTransaction'),readRevision:load('study-operations/formal-response-history','readFormalResponseRevisionInTransaction'),
  assign:load('study-operations/formal-response-assignment','assignVisitFormInTransaction'),write:formLoad('study-operations/formal-response-commands','writeAnswersInTransaction'),assertMode:load('study-operations/formal-outreach-policy','assertCaptureMode'),
  normalizeSchema:forms.policy.normalizeFormSchema,normalizeAnswers:forms.policy.normalizeAndValidateAnswers,score:forms.policy.scorePublishedFormResponse,
 }});
 const visits=createVisitsService({studies:service,core:{
  list:async(tx,user,s,input)=>{const value=await load('study-operations/formal-response-visits','listFormalVisitsInTransaction')(tx,user,s,input);return {...value,items:await Promise.all(value.items.map(async v=>presentVisit(tx,s,presentOutreachVisit(tx,s,await projectVisit(tx,user,s,v)))))};},
  read:async(tx,user,s,visitId)=>presentVisit(tx,s,presentOutreachVisit(tx,s,await projectVisit(tx,user,s,await load('study-operations/formal-response-visits','readFormalVisitInTransaction')(tx,user,s,visitId)))),
  authorize:(tx,user,s,operation)=>operation==='start'?authorizeParticipation(tx,user,s.studyGroupId,s.researchProjectId):authorizeFormalResponse(tx,user,s.studyGroupId,s.researchProjectId,'study.review'),
  start:(tx,user,s,id,command)=>simulate(tx,user,s,async t=>{await simulation?.guardVisitSchedule(t,s,id,{operation:'start'});return operations.updateVisitInTransaction(t,{...user,...s},id,{...command,status:'in_progress'},s.studyGroupId,s.researchProjectId);}),
  complete:(tx,user,s,id,command)=>simulate(tx,user,s,async t=>{await simulation?.guardVisitSchedule(t,s,id,{operation:'complete'});return operations.completeVisitInTransaction(t,{...user,...s},id,command,s.studyGroupId,s.researchProjectId);}),
  reverify:load('study-operations/formal-visit-evidence','reverifyCompletedVisitInTransaction'),
 }});
 const capture=createFormalCaptureService({studies:service,core:{
  presentRevisions:presentFormalRevisions,
  authorize:authorizeFormalResponse,
  assign:load('study-operations/formal-response-assignment','assignVisitFormInTransaction'),
  read:load('study-operations/formal-response-query','readFormalResponseInTransaction'),
  receipt:load('study-operations/formal-response-query','readFormalResponseReceiptInTransaction'),
  write:formLoad('study-operations/formal-response-commands','writeAnswersInTransaction'),
  review:load('study-operations/formal-response-review','reviewFormalResponseInTransaction'),
  listRevisions:load('study-operations/formal-response-history','listFormalResponseRevisionsInTransaction'),
  readRevision:load('study-operations/formal-response-history','readFormalResponseRevisionInTransaction'),
 }});
 const visitWorkflow=createVisitWorkflowService({studies:service,core:{
  readVisit:async(tx,user,s,visitId)=>presentVisit(tx,s,presentOutreachVisit(tx,s,await projectVisit(tx,user,s,await load('study-operations/formal-response-visits','readFormalVisitInTransaction')(tx,user,s,visitId)))),
  readAssignment:load('study-operations/formal-response-query','readFormalResponseInTransaction'),
  reviewAssignment:load('study-operations/formal-response-review','reviewFormalResponseInTransaction'),
 }});
 const dataQueries=createFormalDataQueryService({studies:service,core:{
  present:presentFormalDataQueries,
  authorize:authorizeFormalResponse,
  readResponse:load('study-operations/formal-response-query','readFormalResponseInTransaction'),
  list:load('study-operations/formal-response-data-query','listFormalDataQueriesInTransaction'),
  read:load('study-operations/formal-response-data-query','readFormalDataQueryInTransaction'),
  receipt:load('study-operations/formal-response-data-query','readFormalDataQueryReceiptInTransaction'),
  create:load('study-operations/formal-response-data-query','createFormalDataQueryInTransaction'),
  mutate:load('study-operations/formal-response-data-query','mutateFormalDataQueryInTransaction'),
 }});
 const participation=createEnrollmentService({studies:service,core:{
  authorize:authorizeParticipation,
  context:load('study-operations/participation-events','participationContext'),
  evaluate:load('study-operations/participation-events','evaluateParticipation'),
  record:load('study-operations/participation-events','recordParticipationInTransaction'),
  enroll:(user,input,tx,group,project)=>simulate(tx,user,{tenantId:user.tenantId,studyGroupId:group,researchProjectId:project},t=>operations.enrollInTransaction(user,input,t,group,project),{operation:'enroll',subjectId:input.subjectId,armCode:input.armCode}),
 }});
 class ResearchStudiesController{async onModuleInit(){await jobLifecycle?.start();}async onModuleDestroy(){await jobLifecycle?.stop();}}
 Controller()(ResearchStudiesController);
 const routes=[['directory',Get,'research-directory',false],['executionDetail',Get,'research-directory/execution/:id',false],['context',Get,'research-projects/context',false],['list',Get,'research-projects',false],['projectReceipt',Get,'research-projects/receipts/:requestKey',false],['detail',Get,'research-projects/:id',false],['create',Post,'research-projects',true],['update',Patch,'research-projects/:id',true],['createStudy',Post,'research-projects/:id/studies',true],['protocolReviews',Get,'research-studies/protocol-reviews',false],['configuration',Get,'research-studies/:id/configuration',false],['createProtocol',Post,'research-studies/:id/protocols',true],['updateConfiguration',Put,'research-studies/:id/protocols/:protocolId/configuration',true],['overview',Get,'research-studies/:id',false],['setHubRole',Put,'research-hub-roles/:hubKey/:accountId',true]];
 const releaseCommands={releaseCheck:'check',releaseSubmit:'submit',releaseReturn:'returnToDraft',releaseApprove:'approve',releaseActivate:'activate'};
 routes.unshift(['protocolDecisions',Get,'research-studies/protocol-decisions',false]);
 routes.push(['protocolTemplates',Get,'research-studies/:id/protocol-templates',false],['protocolTemplatePreview',Get,'research-studies/:id/protocol-templates/:sourceStudyId/:sourceProtocolId',false],['protocolTemplateImport',Post,'research-studies/:id/protocol-template-imports',true],['protocolTemplateReceipt',Get,'research-studies/:id/protocol-template-imports/receipts/:requestKey',false]);
 routes.push(['protocolReleaseReceipt',Get,'research-studies/:id/protocols/:protocolId/release-receipts/:requestKey',false]);
 routes.push(['protocolRelease',Get,'research-studies/:id/protocols/:protocolId/release',false],['savePolicy',Put,'research-studies/:id/protocols/:protocolId/policy',true]);
 routes.push(['migrationCandidates',Get,'research-studies/:id/protocols/:protocolId/migration-candidates',false],['migrationPreview',Post,'research-studies/:id/protocols/:protocolId/activation-preview',true],['migrationExecute',Post,'research-studies/:id/protocols/:protocolId/migration',true],['migrationReceipt',Get,'research-studies/:id/protocols/:protocolId/migration-receipts/:requestKey',false]);
 routes.push(['subjectData',Get,'research-studies/:id/subjects/:subjectId/data',false]);
 routes.push(['subjects',Get,'research-studies/:id/subjects',false],['createSubject',Post,'research-studies/:id/subjects',true],['subjectReceipt',Get,'research-studies/:id/subjects/receipts/:requestKey',false],['subjectDetail',Get,'research-studies/:id/subjects/:subjectId',false],['participation',Get,'research-studies/:id/subjects/:subjectId/participation',false],['participationEvent',Post,'research-studies/:id/subjects/:subjectId/participation/events',true],['enrollSubject',Post,'research-studies/:id/subjects/:subjectId/participation/enroll',true],['participationReceipt',Get,'research-studies/:id/subjects/:subjectId/participation/receipts/:requestKey',false]);
 const captureWrites={formDraft:'draft',formSubmit:'submit',formCorrect:'correct'},captureReviews={formReview:'review',formLock:'lock',formUnlock:'unlock'};
 routes.push(['formHistory',Get,'research-studies/:id/assignments/:assignmentId/revisions',false],['formRevision',Get,'research-studies/:id/assignments/:assignmentId/revisions/:revisionNo',false]);
 routes.push(['correctionImpact',Get,'research-studies/:id/assignments/:assignmentId/correction-impact',false]);
 routes.push(['dataQueries',Get,'research-studies/:id/data-queries',false],['dataQueryReceipt',Get,'research-studies/:id/data-queries/receipts/:requestKey',false],['dataQuery',Get,'research-studies/:id/data-queries/:queryId',false],['dataQueryCreate',Post,'research-studies/:id/data-queries',true],['dataQueryReply',Post,'research-studies/:id/data-queries/:queryId/reply',true],['dataQueryClose',Post,'research-studies/:id/data-queries/:queryId/close',true]);
 routes.push(['formRead',Get,'research-studies/:id/assignments/:assignmentId',false],['formReceipt',Get,'research-studies/:id/assignments/:assignmentId/receipts/:requestKey',false],['formAssign',Post,'research-studies/:id/visits/:visitId/assignments',true],['formAssignReceipt',Get,'research-studies/:id/visits/:visitId/assignment-receipts/:requestKey',false]);
 routes.push(['visits',Get,'research-studies/:id/visits',false],['visitRead',Get,'research-studies/:id/visits/:visitId',false],['visitReceipt',Get,'research-studies/:id/visits/:visitId/receipts/:requestKey',false]);
 routes.push(['tasks',Get,'research-studies/:id/tasks',false],['taskContext',Get,'research-studies/:id/tasks/context',false],['taskParticipants',Get,'research-studies/:id/tasks/participants',false],['taskOptions',Get,'research-studies/:id/tasks/options',false],['taskSource',Get,'research-studies/:id/tasks/sources/:kind/:sourceId',false],['taskReceipt',Get,'research-studies/:id/tasks/receipts/:requestKey',false],['taskRead',Get,'research-studies/:id/tasks/:taskId',false],['taskCreate',Post,'research-studies/:id/tasks',true]);
 const taskActions={taskEdit:'edit',taskAssign:'assign',taskTransition:'transition',taskReview:'review',taskRemind:'remind',taskLink:'link'};
 routes.push(['taskEdit',Patch,'research-studies/:id/tasks/:taskId',true],['taskAssign',Post,'research-studies/:id/tasks/:taskId/assignments',true],['taskTransition',Post,'research-studies/:id/tasks/:taskId/transitions',true],['taskReview',Post,'research-studies/:id/tasks/:taskId/reviews',true],['taskRemind',Post,'research-studies/:id/tasks/:taskId/reminders',true],['taskLink',Put,'research-studies/:id/tasks/:taskId/context',true]);
 routes.push(['importPreview',Post,'research-studies/:id/imports/preview',true],['importCommit',Post,'research-studies/:id/imports',true],['importReceipt',Get,'research-studies/:id/imports/receipts/:requestKey',false]);
 routes.push(['outreachSend',Post,'research-studies/:id/visits/:visitId/email-invitations',true],['outreachRead',Get,'research-studies/:id/email-invitations/:invitationId',false],['outreachReceipt',Get,'research-studies/:id/visits/:visitId/email-invitation-receipts/:requestKey',false]);
 routes.push(['visitFiles',Get,'research-studies/:id/visits/:visitId/files',false],['visitFileUpload',Post,'research-studies/:id/visits/:visitId/files/preprocessed',true],['visitFileReceipt',Get,'research-studies/:id/visits/:visitId/files/receipts/:requestKey',false]);
 routes.push(['visitFileVerify',Post,'research-studies/:id/visits/:visitId/files/receipts/:requestKey/verify',true]);
 routes.push(['visitFileTasks',Get,'research-studies/:id/visits/:visitId/files/:fileId/tasks',false],['visitFileFeatures',Get,'research-studies/:id/visits/:visitId/files/:fileId/tasks/:processingTaskId/features',false]);
 routes.push(['analysisPlans',Get,'research-studies/:id/analysis/plans',false],['analysisPlanCreate',Post,'research-studies/:id/analysis/plans',true],['analysisPlan',Get,'research-studies/:id/analysis/plans/:planId',false],['analysisPlanReview',Post,'research-studies/:id/analysis/plans/:planId/reviews',true],['analysisPreview',Get,'research-studies/:id/analysis/plans/:planId/preview',false],['analysisRelease',Post,'research-studies/:id/analysis/plans/:planId/snapshots',true],['analysisSnapshot',Get,'research-studies/:id/analysis/snapshots/:snapshotId',false],['analysisReceipt',Get,'research-studies/:id/analysis/receipts/:requestKey',false]);
 routes.push(['analysisRuns',Get,'research-studies/:id/analysis/runs',false],['analysisRunCreate',Post,'research-studies/:id/analysis/runs',true],['analysisRun',Get,'research-studies/:id/analysis/runs/:runId',false],['analysisRunReceipt',Get,'research-studies/:id/analysis/run-receipts/:requestKey',false],['analysisRunReview',Post,'research-studies/:id/analysis/runs/:runId/reviews',true],['analysisRunReviewReceipt',Get,'research-studies/:id/analysis/runs/:runId/review-receipts/:requestKey',false],['analysisRunCancel',Post,'research-studies/:id/analysis/runs/:runId/cancel',true]);
 routes.push(['analysisJobCreate',Post,'research-studies/:id/analysis/jobs',true],['analysisJob',Get,'research-studies/:id/analysis/jobs/:jobId',false],['analysisJobReceipt',Get,'research-studies/:id/analysis/job-receipts/:requestKey',false],['analysisJobCancellation',Post,'research-studies/:id/analysis/jobs/:jobId/cancellations',true],['analysisJobCancellationReceipt',Get,'research-studies/:id/analysis/jobs/:jobId/cancellation-receipts/:requestKey',false]);
 routes.push(['analysisRunCapabilities',Get,'research-studies/:id/analysis/runs/:runId/capabilities',false]);
 routes.push(['formalReportPreview',Get,'research-studies/:id/analysis/report-preview',false]);
 routes.push(['analysisConfiguration',Get,'research-studies/:id/analysis/configuration',false],['analysisRunProcess',Post,'research-studies/:id/analysis/runs/:runId/process',true]);
 routes.push(['analysisProcessReceipt',Get,'research-studies/:id/analysis/runs/:runId/process-receipts/:requestKey',false],['analysisReviewOperationStart',Post,'research-studies/:id/analysis/runs/:runId/review-operations',true],['analysisReviewOperation',Get,'research-studies/:id/analysis/runs/:runId/review-operations/:operationId',false],['analysisReviewOperationReceipt',Get,'research-studies/:id/analysis/runs/:runId/review-operation-receipts/:requestKey',false],['analysisReviewOperationAdvance',Post,'research-studies/:id/analysis/runs/:runId/review-operations/:operationId/process',true],['analysisReviewStepReceipt',Get,'research-studies/:id/analysis/runs/:runId/review-operations/:operationId/step-receipts/:requestKey',false]);
 routes.push(['simulationContext',Get,'research-studies/:id/simulation/context',false],['simulationAdvance',Post,'research-studies/:id/simulation/advance',true]);
 routes.push(['dueVisits',Get,'research-studies/:id/due-visits',false]);
 const visitCommands={visitStart:'start',visitComplete:'complete',visitReverify:'reverify'};
 for(const[name,verb,path,write]of visitWorkflowRoutes)routes.push([name,verb==='GET'?Get:Post,path,write]);
 routes.push(['formalReports',Get,'research-studies/:id/analysis/reports',false],['formalReportCreate',Post,'research-studies/:id/analysis/reports',true],['formalReportReceipt',Get,'research-studies/:id/analysis/report-receipts/:requestKey',false],['formalReport',Get,'research-studies/:id/analysis/reports/:artifactId',false],['formalReportReview',Post,'research-studies/:id/analysis/reports/:artifactId/reviews',true],['formalReportRelease',Post,'research-studies/:id/analysis/reports/:artifactId/releases',true],['formalReportExport',Post,'research-studies/:id/analysis/reports/:artifactId/exports',true],['formalReportExportStatus',Get,'research-studies/:id/analysis/report-exports/:jobId',false],['formalReportDownload',Get,'research-studies/:id/analysis/report-exports/:jobId/file',false],['formalReportResume',Post,'research-studies/:id/analysis/report-exports/resume',true]);
 for(const [name,action]of Object.entries(visitCommands))routes.push([name,Post,'research-studies/:id/visits/:visitId/'+action,true]);
 for(const [name,action]of [...Object.entries(captureWrites),...Object.entries(captureReviews)])routes.push([name,Post,'research-studies/:id/assignments/:assignmentId/'+action,true]);
 for(const [name,action]of Object.entries(releaseCommands))routes.push([name,Post,'research-studies/:id/protocols/:protocolId/'+(action==='returnToDraft'?'return':action),true]);
 for(const[name,verb,path,write]of routes){
  ResearchStudiesController.prototype[name]=async function(req,res,body,params,query){
   res.setHeader('Cache-Control','no-store');try{
    if(write){assertSessionOrigin(req,origin);if(Buffer.byteLength(JSON.stringify(body??null),'utf8')>256*1024)throw Object.assign(new Error('课题内容超过256KiB，请缩短后重试。'),{status:413,code:'RESEARCH_INPUT_TOO_LARGE'});}
    if(name==='directory')return await service.directory(req.user,query);
    if(name==='executionDetail')return await service.executionDetail(req.user,params.id,query);
    if(name==='context')return await service.context(req.user);
    if(name==='list')return await service.list(req.user,query);
    if(name==='projectReceipt')return await service.projectReceipt(req.user,params.requestKey,query);
    if(name==='detail')return await service.detail(req.user,params.id);
    if(name==='create')return await service.create(req.user,body);
    if(name==='update')return await service.update(req.user,params.id,body);
    if(name==='createStudy')return await service.createStudy(req.user,params.id,body);
    if(name==='protocolReviews')return await reviews.list(req.user,query);
    if(name==='protocolDecisions')return await decisions.list(req.user,query);
    if(name==='protocolRelease')return await release.get(req.user,params.id,params.protocolId);
    if(name==='protocolReleaseReceipt')return await release.receipt(req.user,params.id,params.protocolId,params.requestKey,query);
    if(name==='savePolicy')return await policies.save(req.user,params.id,params.protocolId,body);
    if(name==='migrationCandidates')return await migrationCandidates.list(req.user,params.id,params.protocolId,query);
    if(name==='migrationPreview')return await migration.preview(req.user,params.id,params.protocolId,body);
    if(name==='migrationExecute')return await migration.execute(req.user,params.id,params.protocolId,body);
    if(name==='migrationReceipt')return await migration.receipt(req.user,params.id,params.protocolId,params.requestKey);
    if(name==='subjects')return await subjects.list(req.user,params.id,query);
    if(name==='createSubject')return await subjects.create(req.user,params.id,body);
    if(name==='subjectReceipt')return await subjects.receipt(req.user,params.id,params.requestKey);
    if(name==='subjectData')return await subjectData.read(req.user,params.id,params.subjectId,query);
    if(name==='subjectDetail')return await subjects.detail(req.user,params.id,params.subjectId);
    if(name==='participation')return await participation.get(req.user,params.id,params.subjectId);
    if(name==='participationEvent')return await participation.record(req.user,params.id,params.subjectId,body);
    if(name==='enrollSubject')return await participation.enroll(req.user,params.id,params.subjectId,body);
    if(name==='participationReceipt')return await participation.receipt(req.user,params.id,params.subjectId,params.requestKey,query);
    if(name==='formHistory')return await capture.historyList(req.user,params.id,params.assignmentId,query);
    if(name==='correctionImpact')return await correctionImpact.read(req.user,params.id,params.assignmentId,query);
    if(name==='formRevision'){
     only(query,['responseId','contentHash']);if(!/^[1-9]\d*$/.test(params.revisionNo))invalid();
     return await capture.historyRead(req.user,params.id,params.assignmentId,{...query,assignmentId:params.assignmentId,revisionNo:Number(params.revisionNo)});
    }
    if(name==='dataQueries')return await dataQueries.list(req.user,params.id,query);
    if(name==='dataQuery')return await dataQueries.read(req.user,params.id,params.queryId);
    if(name==='dataQueryReceipt')return await dataQueries.receipt(req.user,params.id,params.requestKey,query);
    if(name==='dataQueryCreate')return await dataQueries.create(req.user,params.id,body);
    if(name==='dataQueryReply'||name==='dataQueryClose')return await dataQueries.mutate(req.user,params.id,params.queryId,name==='dataQueryReply'?'reply':'close',body);
    if(name==='tasks')return await tasks.list(req.user,params.id,query);
    if(name==='taskContext')return await tasks.context(req.user,params.id);
    if(name==='taskParticipants')return await tasks.participants(req.user,params.id,query);
    if(name==='taskOptions')return await tasks.options(req.user,params.id,query);
    if(name==='taskSource')return await tasks.source(req.user,params.id,params.kind,params.sourceId);
    if(name==='taskReceipt')return await tasks.receipt(req.user,params.id,params.requestKey);
    if(name==='taskRead')return await tasks.detail(req.user,params.id,params.taskId);
    if(name==='taskCreate')return await tasks.command(req.user,params.id,'create',null,body);
    if(taskActions[name])return await tasks.command(req.user,params.id,taskActions[name],params.taskId,body);
    if(name==='importPreview')return await imports.preview(req.user,params.id,body);
    if(name==='importCommit')return await imports.commit(req.user,params.id,body);
    if(name==='importReceipt')return await imports.receipt(req.user,params.id,params.requestKey);
    if(name==='outreachRead')return await outreach.read(req.user,params.id,params.invitationId);
    if(name==='visitFiles')return await files.list(req.user,params.id,params.visitId,query);
    if(name==='visitFileTasks')return await files.listTasks(req.user,params.id,params.visitId,params.fileId,query);
    if(name==='visitFileFeatures')return await files.listFeatures(req.user,params.id,params.visitId,params.fileId,params.processingTaskId,query);
    if(name==='simulationContext'||name==='simulationAdvance'){
     if(!simulation)throw Object.assign(Error('当前课题没有模拟配置。'),{status:404,code:'SIMULATION_UNAVAILABLE'});
     only(query,[]);return await service.withResearchStudyTransaction(req.user,params.id,'read',async(tx,ctx)=>{
      const s=visitScope(ctx);await authorizeFormalResponse(tx,req.user,s.studyGroupId,s.researchProjectId,'read');
      return name==='simulationContext'?{studyId:params.id,simulation:await simulation.context(tx,s)}:await simulation.advance(tx,req.user,s,body);
     });
    }
    if(name.startsWith('formalReport')){
     if(!reports)throw Object.assign(Error('当前研究的报告尚不可用，请联系管理员。'),{status:503,code:'REPORT_SERVICE_UNAVAILABLE'});
     if(name==='formalReports'){only(query,[]);return await reports.list(req.user,params.id);}
     if(name==='formalReportPreview')return await reports.preview(req.user,params.id,query);
     if(name==='formalReportCreate')return await reports.create(req.user,params.id,body);
     if(name==='formalReport')return await reports.read(req.user,params.id,params.artifactId);
     if(name==='formalReportReceipt'){only(query,['action','targetId']);return await reports.receipt(req.user,params.id,params.requestKey,query);}
     if(name==='formalReportReview')return await reports.review(req.user,params.id,params.artifactId,body);
     if(name==='formalReportRelease')return await reports.release(req.user,params.id,params.artifactId,body);
     if(name==='formalReportExport'){const result=await reports.export(req.user,params.id,params.artifactId,body);await reports.processExport(req.user,params.id,result.jobId);return result;}
     if(name==='formalReportExportStatus')return await reports.readExport(req.user,params.id,params.jobId);
     if(name==='formalReportResume'){only(body,[]);return await reports.resume(req.user,params.id);}
     if(name==='formalReportDownload'){const value=await reports.download(req.user,params.id,params.jobId);res.setHeader('Content-Type',value.mimeType);res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(value.filename));res.setHeader('Content-Length',String(value.buffer.length));res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-File-SHA256',value.sha256);return new(require('@nestjs/common').StreamableFile)(value.buffer);}
    }
    if(name.startsWith('analysis')){
     if(['analysisJobCreate','analysisJob','analysisJobReceipt','analysisJobCancellation','analysisJobCancellationReceipt'].includes(name)){
      if(!jobs)throw Object.assign(Error('当前后台分析暂不可用，原任务记录仍保留。'),{status:503,code:'ANALYSIS_JOB_SERVICE_UNAVAILABLE'});
      if(!write)only(query,[]);
      if(name==='analysisJobCreate')return await jobs.create(req.user,params.id,body);
      if(name==='analysisJob')return await jobs.read(req.user,params.id,params.jobId);
      if(name==='analysisJobReceipt')return await jobs.receipt(req.user,params.id,params.requestKey);
      if(name==='analysisJobCancellation')return await jobs.cancel(req.user,params.id,params.jobId,body);
      return await jobs.cancellationReceipt(req.user,params.id,params.jobId,params.requestKey);
     }
     if(name==='analysisConfiguration'){only(query,[]);return await readAnalysisMode({analysis,studies:service,user:req.user,studyId:params.id});}
     if(!analysis)throw Object.assign(Error('当前研究的分析尚未配置，请联系管理员。'),{status:503,code:'ANALYSIS_SERVICE_UNAVAILABLE'});
     if(name==='analysisPlans')return await analysis.list(req.user,params.id,query);
     if(name==='analysisPlanCreate')return await analysis.submitPlan(req.user,params.id,body);
     if(name==='analysisPlan')return await analysis.readPlan(req.user,params.id,params.planId,query);
     if(name==='analysisPlanReview')return await analysis.reviewPlan(req.user,params.id,params.planId,body);
     if(name==='analysisPreview')return await analysis.preview(req.user,params.id,params.planId);
     if(name==='analysisRelease')return await analysis.release(req.user,params.id,params.planId,body);
     if(name==='analysisSnapshot')return await analysis.readSnapshot(req.user,params.id,params.snapshotId);
     if(name==='analysisReceipt'){only(query,['action','targetId']);return await analysis.receipt(req.user,params.id,params.requestKey,query);}
     if(!analysisRuns)throw Object.assign(Error('分析计算尚不可用，请联系管理员。'),{status:503,code:'ANALYSIS_WORKER_UNAVAILABLE'});
     if(name==='analysisRuns')return await withAnalysisListLifetime(res,signal=>analysisRuns.list(req.user,params.id,{signal}));
     if(name==='analysisRunCreate')return await analysisRuns.create(req.user,params.id,body);
     if(name==='analysisRun')return await analysisRuns.read(req.user,params.id,params.runId);
     if(name==='analysisRunProcess'){if(typeof analysisRuns.process!=='function')throw Object.assign(Error('当前分析不需要分步执行。'),{status:409,code:'ANALYSIS_PROCESS_UNAVAILABLE'});return await analysisRuns.process(req.user,params.id,params.runId,body);}
     if(name==='analysisRunCapabilities'){only(query,[]);return await analysisRuns.capabilities(req.user,params.id,params.runId);}
     if(name==='analysisRunReceipt')return await analysisRuns.receipt(req.user,params.id,params.requestKey);
     if(name==='analysisRunReview')return await analysisRuns.review(req.user,params.id,params.runId,body);
     if(name==='analysisRunReviewReceipt')return await analysisRuns.reviewReceipt(req.user,params.id,params.runId,params.requestKey);
     const stepwise={analysisProcessReceipt:'processReceipt',analysisReviewOperationStart:'startReviewOperation',analysisReviewOperation:'readReviewOperation',analysisReviewOperationReceipt:'reviewOperationReceipt',analysisReviewOperationAdvance:'advanceReviewOperation',analysisReviewStepReceipt:'reviewStepReceipt'};
     if(stepwise[name]){
      only(query,[]);const fn=analysisRuns[stepwise[name]];if(typeof fn!=='function')throw Object.assign(Error('当前分析尚不支持分步审核，请重新核对。'),{status:409,code:'ANALYSIS_STEPWISE_REVIEW_UNAVAILABLE'});
      const args=name==='analysisReviewOperationStart'?[body]:name==='analysisReviewOperationAdvance'?[params.operationId,body]:name==='analysisReviewStepReceipt'?[params.operationId,params.requestKey]:name==='analysisReviewOperation'?[params.operationId]:[params.requestKey];
      return await fn.call(analysisRuns,req.user,params.id,params.runId,...args);
     }
     if(name==='analysisRunCancel'){only(body,[]);return await analysisRuns.cancel(req.user,params.id,params.runId);}
    }
    if(name==='visitFileUpload'||name==='visitFileReceipt'||name==='visitFileVerify'){
     if(!fileUploads)throw Object.assign(Error('文件导入尚不可用，请联系管理员。'),{status:503,code:'FILE_SERVICE_UNAVAILABLE'});
     if(name==='visitFileVerify'){only(body,[]);return await fileUploads.reverify(req.user,params.id,params.visitId,params.requestKey);}
     return name==='visitFileUpload'?await fileUploads.upload(req.user,params.id,params.visitId,body):await fileUploads.receipt(req.user,params.id,params.visitId,params.requestKey);
    }
    if(name==='outreachSend'||name==='outreachReceipt'){
     const key=name==='outreachSend'?body.requestKey:params.requestKey;
     const value=name==='outreachSend'?await outreach.send(req.user,params.id,params.visitId,body):await outreach.receipt(req.user,params.id,params.visitId,key);
     return {...value,receipt:{requestKey:key,action:'outreach.email',targetId:params.visitId,studyId:params.id}};
    }
    if(visitWorkflowRoutes.some(route=>route[0]===name))return await dispatchVisitWorkflow(visitWorkflow,name,req.user,params,body,query);
    if(captureWrites[name])return await capture.write(req.user,params.id,params.assignmentId,captureWrites[name],body);
    if(captureReviews[name])return await capture.review(req.user,params.id,params.assignmentId,captureReviews[name],body);
    if(name==='formRead')return await capture.read(req.user,params.id,params.assignmentId);
    if(name==='formReceipt')return await capture.receipt(req.user,params.id,params.assignmentId,params.requestKey,query);
    if(name==='formAssign')return await capture.assign(req.user,params.id,params.visitId,body);
    if(name==='formAssignReceipt')return await capture.assignmentReceipt(req.user,params.id,params.visitId,params.requestKey);
    if(name==='dueVisits')return await dueVisits.list(req.user,params.id,query);
    if(name==='visits')return await visits.list(req.user,params.id,query);
    if(name==='visitRead')return await visits.read(req.user,params.id,params.visitId);
    if(name==='visitReceipt')return await visits.receipt(req.user,params.id,params.visitId,params.requestKey,query);
    if(visitCommands[name])return await visits.command(req.user,params.id,params.visitId,visitCommands[name],body);
    if(releaseCommands[name])return await release[releaseCommands[name]](req.user,params.id,params.protocolId,body);
    if(name==='protocolTemplates')return await protocolTemplates.list(req.user,params.id,query);
    if(name==='protocolTemplatePreview'){only(query,[]);return await protocolTemplates.preview(req.user,params.id,params.sourceStudyId,params.sourceProtocolId);}
    if(name==='protocolTemplateImport')return await protocolTemplates.import(req.user,params.id,body);
    if(name==='protocolTemplateReceipt')return await protocolTemplates.receipt(req.user,params.id,params.requestKey,query);
    if(name==='configuration')return await configuration.get(req.user,params.id);
    if(name==='createProtocol')return await configuration.create(req.user,params.id,body);
    if(name==='updateConfiguration')return await configuration.update(req.user,params.id,params.protocolId,body);
    if(name==='overview')return await service.overview(req.user,params.id);
    return await service.setHubRole(req.user,params.hubKey,params.accountId,body);
   }catch(e){if(e instanceof HttpException)throw e;if(e.status)throw new HttpException({code:e.code??'RESEARCH_FORBIDDEN',message:e.message,...visitWorkflowRejection(name,e)},e.status);throw new HttpException({code:'RESEARCH_UNAVAILABLE',message:'研究服务暂时不可用，请保留输入并重试。'},503);}
  };
  const d=Object.getOwnPropertyDescriptor(ResearchStudiesController.prototype,name);verb(path)(ResearchStudiesController.prototype,name,d);if(write)HttpCode(name==='analysisJobCreate'?202:name==='create'?201:200)(ResearchStudiesController.prototype,name,d);
  Req()(ResearchStudiesController.prototype,name,0);Res({passthrough:true})(ResearchStudiesController.prototype,name,1);Body()(ResearchStudiesController.prototype,name,2);Param()(ResearchStudiesController.prototype,name,3);Query()(ResearchStudiesController.prototype,name,4);
 }
 return ResearchStudiesController;
}
