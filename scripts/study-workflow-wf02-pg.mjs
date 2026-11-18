// Root-injected, rollback-only PG prediction. Importing performs no fixture/credential/PG/HTTP I/O.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {bodyHash,save,requireWindow,validateManifest,verifyReceipt} from './study-workflow-wf02-qa.mjs';

export function parsePgArgs(args,env=process.env){
 if(args.length===1&&args[0]==='--help')return{help:true};
 requireWindow(env);assert.deepEqual(args.slice(0,3),['--local-synthetic','--rollback-predict','--case']);
 assert.equal(args.length,6,'ONE_ROLLBACK_PREDICTION_ONLY');assert.equal(args[4],'--mode');
 const code=args[3],mode=args[5];assert(['A','B','D'].includes(code));assert(['success','partial-failure','stale-source','stale-target','denied'].includes(mode));return{code,mode};
}
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const pick=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]??null]));
const include={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};
const outcomeFields=['key','versionNumber','name','role','sourceType','scaleVersionId','scoreKey','dataFieldKey','unit','direction','timepointCode'];
const planFields=['code','name','sequence','anchor','anchorEventKey','targetDayOffset','windowBeforeDays','windowAfterDays','required','allowRepeat'];
const transientKeys=['protocolVersions','visitPlans','visitRequirements','formTemplates','formVersions','outcomeDefinitions','operations','audits'];
const emptyIds=()=>Object.fromEntries(transientKeys.map(k=>[k,[]]));
const flipDigest=x=>(x[0]==='0'?'1':'0')+x.slice(1);
async function targetRows(tx,ctx){const where=scope(ctx);return{protocols:await tx.studyProtocolVersion.findMany({where,include}),forms:await tx.formVersion.findMany({where,include:{template:true}}),outcomes:await tx.outcomeDefinition.findMany({where}),templates:await tx.formTemplate.findMany({where})};}
async function protectedRows(tx,ctx){
 const out={};
 // Fixed identifiers only. Clinical and policy rows must remain unchanged even within the prediction.
 for(const table of ['subject','study_enrollment','subject_visit','form_assignment','form_response','study_execution_policy_version','scale_version_applicability'])out[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM public."${table}" t WHERE "tenantId"=$1 AND "studyGroupId"=$2 AND "researchProjectId"=$3 ORDER BY id`,ctx.tenantId,ctx.studyGroupId,ctx.executionProjectId);
 return out;
}
function collectIds(before,after,ids){
 for(const [key,field]of [['protocolVersions','protocols'],['formVersions','forms'],['formTemplates','templates'],['outcomeDefinitions','outcomes']])ids[key]=after[field].filter(r=>!before[field].some(b=>b.id===r.id)).map(r=>r.id);
 ids.visitPlans=after.protocols.flatMap(p=>p.visitPlans).filter(v=>!before.protocols.flatMap(p=>p.visitPlans).some(b=>b.id===v.id)).map(v=>v.id);
 ids.visitRequirements=after.protocols.flatMap(p=>p.visitPlans.flatMap(v=>v.requirements)).filter(q=>!before.protocols.flatMap(p=>p.visitPlans.flatMap(v=>v.requirements)).some(b=>b.id===q.id)).map(q=>q.id);
}
export function assertExactProtocolCopy(source,target,origin){
 const fm=new Map(origin.forms.map(x=>[x.sourceVersionId,x.targetVersionId])),om=new Map(origin.outcomes.map(x=>[x.sourceOutcomeId,x.targetOutcomeId]));
 assert.equal(origin.forms.length,source.forms.length);assert.equal(origin.outcomes.length,source.outcomes.length);assert.equal(fm.size,source.forms.length);assert.equal(om.size,source.outcomes.length);
 for(const s of source.forms){const t=target.forms.find(f=>f.id===fm.get(s.id));assert(t,'COPIED_FORM_REQUIRED');assert.equal(t.status,'locked');assert(t.lockedAt);assert.equal(t.versionNumber,s.versionNumber);
  assert.equal(bodyHash(t.schema),bodyHash(s.schema),'EXACT_SCHEMA_REQUIRED');assert.equal(bodyHash(t.scoring),bodyHash(s.scoring),'EXACT_SCORING_INCLUDING_NULL_REQUIRED');
  assert.deepEqual(pick(t.template,['name','description']),pick(s.template,['name','description']));assert.equal(t.template.sourceKind,'tenant_published');assert.equal(t.template.sourceTemplateId,s.templateId);assert.equal(t.template.sourceVersionId,s.id);
 }
 for(const s of source.outcomes){const t=target.outcomes.find(o=>o.id===om.get(s.id));assert(t);assert.equal(t.status,'published');assert(t.publishedAt);assert.deepEqual(pick(t,outcomeFields),pick(s,outcomeFields),'EXACT_OUTCOME_UNITS_DIRECTION_TIMEPOINT_SCALE_REQUIRED');}
 const p=source.protocol,q=target.protocol;assert.equal(q.status,'draft');assert.notEqual(q.id,p.id);
 assert.deepEqual(pick(q,['title','purpose','methodsSummary','populationSummary','statisticsSummary']),pick(p,['title','purpose','methodsSummary','populationSummary','statisticsSummary']));
 for(const key of ['primaryOutcomes','secondaryOutcomes'])assert.deepEqual(q[key],p[key].map(o=>({...o,outcomeDefinitionId:om.get(o.outcomeDefinitionId)})));
 assert.equal(q.visitPlans.length,p.visitPlans.length);
 for(const sv of p.visitPlans){const tv=q.visitPlans.find(v=>v.code===sv.code);assert(tv);assert.notEqual(tv.id,sv.id);assert.deepEqual(pick(tv,planFields),pick(sv,planFields),'EXACT_VISIT_ZERO_NULL_FALSE_REQUIRED');assert.equal(tv.requirements.length,sv.requirements.length);
  for(const sr of sv.requirements){const tr=tv.requirements.find(r=>r.kind===sr.kind&&r.code===sr.code);assert(tr);assert.notEqual(tr.id,sr.id);assert.deepEqual(pick(tr,['kind','code','name','required']),pick(sr,['kind','code','name','required']));const config=structuredClone(sr.config);if(sr.kind==='form_response')config.formVersionId=fm.get(sr.config.formVersionId);assert.deepEqual(tr.config,config,'EXACT_REQUIREMENT_CONFIG_REMAP_REQUIRED');}
 }
 return{forms:source.forms.length,outcomes:source.outcomes.length,plans:p.visitPlans.length,requirements:p.visitPlans.reduce((n,v)=>n+v.requirements.length,0),schemaScoringHash:bodyHash(source.forms.map(f=>({id:f.id,schema:f.schema,scoring:f.scoring}))),configurationHash:bodyHash(pick(q,['primaryOutcomes','secondaryOutcomes','visitPlans']))};
}

export async function runWF02PgPrediction({args,env,manifest,principals,StudyOperationsService,lockAuthorizationMutation,withFixtureTransaction,readProtection,outputPath,negativePrincipal,windowEnv=process.env}){
 const options=parsePgArgs(args,windowEnv);assert(!options.help,'CALL_PARSE_FOR_HELP_ONLY');validateManifest(manifest);
 const {code,mode}=options,c=manifest.cases[code],s=manifest.sources[c?.sourceId];assert(c&&s);assert(outputPath?.startsWith('/'));
 assert.equal(typeof StudyOperationsService,'function');assert.equal(typeof lockAuthorizationMutation,'function');assert.equal(typeof withFixtureTransaction,'function');assert.equal(typeof readProtection,'function');assert(env&&typeof env==='object');
 const principal=mode==='denied'?negativePrincipal:principals?.[code];assert(principal,'EXISTING_CURRENT_PRINCIPAL_REQUIRED');
 assert.equal(principal.tenantId,manifest.tenantId);assert(Number.isInteger(principal.authVersion)&&principal.authVersion>=0);assert.equal(typeof principal.accountId,'string');
 if(mode!=='denied'){assert.equal(principal.accountId,c.actorId);assert.equal(principal.authVersion,c.authVersion);}
 const requestKey='wf02-pg-predict-'+code+'-'+mode+'-'+randomUUID(),transientIds=emptyIds();
 const body={requestKey,sourceStudyId:s.studyId,sourceProtocolId:s.protocolId,sourceFingerprint:mode==='stale-source'?flipDigest(s.fingerprint):s.fingerprint,targetFingerprint:mode==='stale-target'?flipDigest(c.targetFingerprint):c.targetFingerprint};
 const report={schema:1,at:new Date().toISOString(),...options,actorId:principal.accountId,authVersion:principal.authVersion,requestKey,requestHash:bodyHash(body),passed:false,expectedPersistentWrites:0,persistentWrites:null,rls:[],transientIds,checks:[],receiptGetExecuted:false};
 const rollback=Error('WF02_PREDICTION_ROLLBACK'),partial=Error('WF02_AFTER_FIXED_DEFINITIONS_ROLLBACK');
 let physicalTransactions=0,active=false,completed=false,partialObserved=false,fixedCoreCalls=0,createCoreCalls=0,sourceRows,before,targetContext,protectedBefore,stage='outside-before';
 const persist=()=>save(outputPath,report);
 const outside=phase=>readProtection({phase,case:code,requestKey,transientIds,expectedPersistentWrites:0});
 async function rls(tx,label,expected){
  const [row]=await tx.$queryRaw`SELECT current_user AS role,current_setting('app.tenant_id',true) AS "tenantId",current_setting('app.account_id',true) AS "accountId",current_setting('app.auth_version',true) AS "authVersion",current_setting('app.study_group_id',true) AS "studyGroupId",current_setting('app.research_project_id',true) AS "researchProjectId"`;
  assert.equal(row.role,'aisci_app','REAL_APP_ROLE_REQUIRED');if(expected){for(const k of ['tenantId','studyGroupId','researchProjectId'])assert.equal(row[k],expected[k]);assert.equal(row.accountId,principal.accountId);assert.equal(row.authVersion,String(principal.authVersion));}report.rls.push({label,...row});persist();
 }
 try{
  await outside('before');
  const [{createLocalResearchPrisma},{createResearchStudiesService},{createProtocolTemplateService}]=await Promise.all([import('./research-creation-local-integration.mjs'),import('../server/research-studies/commands.mjs'),import('../server/research-execution/protocol-templates.mjs')]);
  const prisma=createLocalResearchPrisma({tenantId:manifest.tenantId,transaction:callback=>{
   assert(!active,'NESTED_PHYSICAL_TRANSACTION_FORBIDDEN');assert.equal(++physicalTransactions,1,'ONE_NATIVE_TRANSACTION_PER_PREDICTION');
   return withFixtureTransaction(env,'app',async tx=>{active=true;try{await rls(tx,'physical-entry');const value=await callback(tx);await rls(tx,'native-callback-return',scope(targetContext));await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');completed=true;report.checks.push('all-native-deferred-constraints-immediate');throw rollback;}finally{active=false;}});
  }});
  const nativeStudies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[manifest.tenantId]},lockAuthorization:lockAuthorizationMutation,createResearchProject:()=>{throw Error('WF02_STUDY_CREATION_FORBIDDEN');}});
  const studies={...nativeStudies,withResearchStudyTransaction:(user,studyId,operation,callback,options)=>nativeStudies.withResearchStudyTransaction(user,studyId,operation,async(tx,ctx)=>{
   targetContext=ctx;assert.equal(ctx.executionProjectId,c.executionProjectId);await rls(tx,'target-before-copy',scope(ctx));before=await targetRows(tx,ctx);assert.equal(before.protocols.length,0,'EMPTY_FROZEN_TARGET_REQUIRED');protectedBefore=await protectedRows(tx,ctx);
   const result=await callback(tx,ctx),after=await targetRows(tx,ctx);stage='verify-native-copy';collectIds(before,after,transientIds);await rls(tx,'target-after-copy',scope(ctx));
   assert.deepEqual(await protectedRows(tx,ctx),protectedBefore,'NO_PATIENT_POLICY_OR_APPLICABILITY_COPY');
   const q=after.protocols.find(p=>p.id===result.protocol.id);assert(q);assert.equal(after.protocols.length,before.protocols.length+1);
   assert.equal(q.acceptanceFixture,false);for(const field of ['approvedBy','approvedPolicyVersionId','approvedPolicyHash','effectiveFrom','effectiveTo','lockedAt'])assert.equal(q[field],null,'NO_APPROVAL_POLICY_OR_ACTIVATION_COPY');
   assert.equal(after.forms.length-before.forms.length,result.origin.forms.filter(f=>!f.reused).length);assert.equal(after.templates.length-before.templates.length,result.origin.forms.filter(f=>!f.reused).length);assert.equal(after.outcomes.length-before.outcomes.length,result.origin.outcomes.filter(o=>!o.reused).length);
   report.exactCopy=assertExactProtocolCopy(sourceRows,{...after,protocol:q},result.origin);
   const metadata={...body,action:'protocol.template.import',requestHash:bodyHash(body),actorId:principal.accountId,authVersion:principal.authVersion,studyId:c.studyId,sourceRevision:s.revision,sourceVersionNumber:s.versionNumber,sourceFormVersionIds:s.formVersionIds,sourceOutcomeDefinitionIds:s.outcomeDefinitionIds};
   verifyReceipt(metadata,{found:true,...result},{actorId:principal.accountId,authVersion:principal.authVersion});
   const operations=await tx.$queryRaw`SELECT id,actor_id,request_key,request_hash,action,target_id,audit_id,result FROM rh_research.operation WHERE tenant_id=${manifest.tenantId} AND actor_id=${principal.accountId} AND request_key=${requestKey}`;
   assert.equal(operations.length,1);const op=operations[0];assert.equal(op.id,result.receipt.id);assert.equal(op.request_hash,bodyHash(body));assert.equal(op.action,'protocol.template.import');assert.equal(op.target_id,q.id);assert.deepEqual(op.result.receipt,result.receipt);
   const audits=await tx.auditLog.findMany({where:{...scope(ctx),target:q.id},orderBy:{id:'asc'}});assert(audits.some(a=>a.id===op.audit_id&&a.action==='researchhub.protocol.template.import'&&a.accountId===principal.accountId));assert(audits.some(a=>a.action==='study_protocol_create'&&a.accountId===principal.accountId));
   transientIds.operations=operations.map(o=>o.id);transientIds.audits=audits.map(a=>a.id);report.operation={id:op.id,auditId:op.audit_id,targetId:op.target_id,requestHash:op.request_hash};report.audit=audits.map(a=>({id:a.id,action:a.action,actorId:a.accountId,metaHash:bodyHash(a.meta)}));report.checks.push('native-draft-exact-fixed-definitions-remap-operation-audit');persist();return result;
  },options)};
  const realCore=new StudyOperationsService(prisma);assert.equal(typeof realCore.fixedReferenceStatusInTransaction,'function');assert.equal(typeof realCore.createProtocolVersionInTransaction,'function');
  const core={
   fixedReferenceStatusInTransaction:async(tx,tenantId,studyGroupId,researchProjectId,protocolId)=>{
    const expected={tenantId,studyGroupId,researchProjectId};stage=protocolId===s.protocolId?'source-fixed-reference':'target-fixed-reference';await rls(tx,stage,expected);
    if(protocolId===s.protocolId){const protocol=await tx.studyProtocolVersion.findFirst({where:{...expected,id:protocolId},include});assert(protocol);const forms=await tx.formVersion.findMany({where:{...expected,id:{in:s.formVersionIds}},include:{template:true}}),outcomes=await tx.outcomeDefinition.findMany({where:{...expected,id:{in:s.outcomeDefinitionIds}}});assert.equal(forms.length,s.formVersionIds.length);assert.equal(outcomes.length,s.outcomeDefinitionIds.length);sourceRows={protocol,forms,outcomes};}
    fixedCoreCalls++;return realCore.fixedReferenceStatusInTransaction(tx,tenantId,studyGroupId,researchProjectId,protocolId);
   },
   createProtocolVersionInTransaction:async(user,dto,tx,group,project)=>{
    stage='target-native-create-entry';await rls(tx,stage,{tenantId:manifest.tenantId,studyGroupId:group,researchProjectId:project});
    if(mode==='partial-failure'){const after=await targetRows(tx,targetContext);collectIds(before,after,transientIds);assert(transientIds.formVersions.length>0,'REAL_FIXED_FORM_CREATION_REQUIRED_BEFORE_FAULT');assert.equal(transientIds.formVersions.length,sourceRows.forms.length);assert.equal(transientIds.outcomeDefinitions.length,sourceRows.outcomes.length);partialObserved=true;report.checks.push('actual-fixed-definitions-present-before-injected-native-create-fault');persist();throw partial;}
    createCoreCalls++;return realCore.createProtocolVersionInTransaction(user,dto,tx,group,project);
   }
  };
  stage='native-import';const service=createProtocolTemplateService({studies,core});let caught;
  try{await service.import(principal,c.studyId,body);assert.fail('ROLLBACK_SENTINEL_MUST_LEAVE_PHYSICAL_TRANSACTION');}catch(error){caught=error;}
  report.rejection={name:caught?.name??null,status:caught?.status??caught?.getStatus?.()??null,code:caught?.code??caught?.response?.code??null};
  if(mode==='success')assert(caught===rollback&&completed,'SUCCESS_MUST_END_WITH_SENTINEL_ROLLBACK');
  else if(mode==='partial-failure')assert(caught===partial&&partialObserved&&!completed,'PARTIAL_COPY_MUST_THROW_AND_ROLL_BACK');
  else if(mode.startsWith('stale-'))assert(caught?.status===409&&(caught.code??caught.response?.code)==='PROTOCOL_TEMPLATE_STALE'&&!completed,'REAL_NATIVE_STALE_REJECTION_REQUIRED');
  else assert([403,404].includes(caught?.status??caught?.getStatus?.())&&!completed,'EXISTING_PRINCIPAL_MUST_REALLY_BE_DENIED');
  assert.equal(physicalTransactions,1);report.rollbackKind=mode==='success'?'success-sentinel':mode==='partial-failure'?'after-definitions-fault':'native-rejection';stage='outside-after';await outside('after');report.persistentWrites=0;report.passed=true;report.checks.push('external-readonly-original-hashes-and-zero-transient-residue');
 }catch(error){const first=String(error.message??'').split('\n')[0];report.failureStage=stage;report.error={name:error.name??'Error',code:error.code??null,tag:/^[A-Z][A-Z0-9_]+$/.test(first)?first:null};await outside('failure-after').catch(()=>{});
 }finally{report.physicalTransactions=physicalTransactions;report.deferredConstraintsChecked=completed;report.partialDefinitionsObserved=partialObserved;report.realCoreCalls={fixedReferenceStatusInTransaction:fixedCoreCalls,createProtocolVersionInTransaction:createCoreCalls};report.finishedAt=new Date().toISOString();persist();}
 assert.equal(report.passed,true,'WF02_PG_PREDICTION_FAILED_READ_EVIDENCE');return report;
}
