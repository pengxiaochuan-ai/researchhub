// Explicit-window root acceptance. Product writes will be dispatched only through native UI gates.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openWF03Context,wf03Private,wf03Evidence,verifyWF03Freeze} from './study-workflow-wf03-root-context.mjs';
import {requireWF03Window,bodyHash} from './study-workflow-wf03-qa.mjs';
import {json,save} from './study-workflow-wf01-qa.mjs';
import {wf03PolicySections} from './study-workflow-wf03-policy-recipe.mjs';

function output(label){return wf03Evidence+'root/'+label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,5)+'/';}
async function admit(root,out){
 const queues=await root.h.read(async tx=>({
  knowledge:await tx.knowledgeChatJob.findMany({where:{tenantId:root.h.runtime.ids.tenant,status:{in:['queued','running','processing']}},select:{id:true,status:true,workerOwner:true,leaseExpiresAt:true}}),
  imports:await tx.knowledgeImportTask.findMany({where:{tenantId:root.h.runtime.ids.tenant,status:{in:['queued','running','processing']}},select:{id:true,status:true}}),
  exports:await tx.researchArtifactExportJob.findMany({where:{tenantId:root.h.runtime.ids.tenant,status:{in:['queued','running','processing']}},select:{id:true,status:true,workerOwner:true,leaseExpiresAt:true}}),
  media:await tx.$queryRaw`SELECT r.id,r.channels->'audio'->>'state' AS "audioState",r.channels->'visual'->>'state' AS "visualState" FROM rh_ai.session_media_content_runs r WHERE r.tenant_id=${root.h.runtime.ids.tenant} AND NOT EXISTS(SELECT 1 FROM rh_ai.session_media_content_runs n WHERE n.root_id=r.root_id AND n.attempt_no>r.attempt_no) AND (r.channels->'audio'->>'state' IN('queued','running') OR r.channels->'visual'->>'state' IN('queued','running'))`,
 }));
 save(out+'owned-reload-queue-readonly.json',{at:new Date().toISOString(),runtimePid:root.h.runtime.pid,readOnly:true,queues});
 // The bounded local composition does not invoke KnowledgeChatQueueService.onModuleInit.
 // Existing unclaimed queued jobs remain dormant; never resume, clear, or cancel them.
 for(const row of queues.knowledge)assert(row.status==='queued'&&!row.workerOwner&&!row.leaseExpiresAt,'ACTIVE_KNOWLEDGE_JOB_BLOCKS_RELOAD');
 for(const [kind,rows]of Object.entries(queues))if(kind!=='knowledge')assert.equal(rows.length,0,'QUEUED_OR_ACTIVE_JOBS_REQUIRE_REVIEW_'+kind);
 const dormant=await root.h.read(tx=>tx.$queryRaw`SELECT id,md5(row_to_json(t)::text) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=${root.h.runtime.ids.tenant} ORDER BY id`);
 save(wf03Private+'dormant-knowledge-before-reload.json',dormant,{exclusive:true});
 save(out+'dormant-queue-ruling.json',{queuedUnclaimed:queues.knowledge.length,active:0,unmodifiedRows:dormant.length,hash:bodyHash(dormant),startup:'bounded composition constructs Queue only; onModuleInit recovery is not invoked',source:'scripts/local-knowledge-ai.mjs:359-420; app/server/src/sessions/knowledge-chat-queue.service.ts:229-249',resumeOrCancelPerformed:false});
 await root.captureBefore();
 const currentPrincipals={},views={};for(const role of ['admin','reviewer']){
  const me=await root.login(role);currentPrincipals[role]={accountId:me.accountId,tenantId:root.h.runtime.ids.tenant,authVersion:me.authVersion};
  const codes=role==='admin'?['A','B','D']:['B'];for(const code of codes){const c=root.cases[code],view=await root.h.get('/research-studies/'+c.studyId+'/protocols/'+c.protocolId+'/release');assert.equal(view.protocol.status,'draft');assert.equal(view.policy,null);assert.equal(view.fixedReferences.ready,true);assert.equal(view.capabilities.canManageRelease,true);views[code+':'+role]={actorId:me.accountId,authVersion:me.authVersion,revision:view.protocol.revision,canManageRelease:true,fixedReady:true};}
 }
 const resource={schema:1,task:'WF03',syntheticOnly:true,phase:'admitted-before-policy-inputs',at:new Date().toISOString(),runtimePid:root.h.runtime.pid,tenantId:root.h.runtime.ids.tenant,cases:root.cases,currentPrincipals,views,
  recipeHashes:Object.fromEntries(['A','B','D'].map(c=>[c,bodyHash(wf03PolicySections(c))])),limits:{policy:3,check:3,submit:3,approve:3,activate:3,total:15,newStudies:0,newProtocols:0,newSubjects:0,newAnswers:0,newRoles:0},baselinePath:wf03Private+'protection-before.json'};
 save(wf03Private+'admitted-resources.json',resource,{exclusive:true});save(wf03Evidence+'admitted-resources.json',resource,{exclusive:true});
 save(out+'admitted-protection.json',await root.protect('admitted-before-any-policy'));
}
async function predictionSnapshot(root,prefix){
 const tenant=root.h.runtime.ids.tenant,projects=['A','B','D'].map(c=>root.cases[c].executionProjectId),protocols=['A','B','D'].map(c=>root.cases[c].protocolId);
 return root.h.read(async tx=>{
  const rows={};for(const table of ['study_protocol_version','study_execution_policy_version','protocol_release_check','protocol_release_check_finding','remediation_case','remediation_attempt','remediation_event'])
   rows[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM public."${table}" t WHERE "tenantId"=$1 AND "researchProjectId" IN($2,$3,$4) ORDER BY id`,tenant,...projects);
  rows.operations=await tx.$queryRawUnsafe('SELECT id,md5(row_to_json(t)::text) AS hash FROM rh_research.operation t WHERE tenant_id=$1 AND target_id IN($2,$3,$4) ORDER BY id',tenant,...protocols);
  rows.businessAudits=await tx.$queryRawUnsafe("SELECT id,md5(row_to_json(t)::text) AS hash FROM public.audit_log t WHERE \"tenantId\"=$1 AND \"researchProjectId\" IN($2,$3,$4) AND (action LIKE 'researchhub.protocol.%' OR action LIKE 'study_protocol_%' OR action='protocol_release_check_run') ORDER BY id",tenant,...projects);
  const prefixOperations=await tx.$queryRaw`SELECT id FROM rh_research.operation WHERE tenant_id=${tenant} AND request_key LIKE ${prefix+'%'}`;
  const prefixAudits=await tx.$queryRaw`SELECT id FROM public.audit_log WHERE "tenantId"=${tenant} AND meta->>'requestKey' LIKE ${prefix+'%'}`;
  return{rows,prefixOperations:prefixOperations.map(x=>x.id),prefixAudits:prefixAudits.map(x=>x.id)};
 });
}
async function pgAll(root,out){
 const resources=json(wf03Private+'admitted-resources.json');assert.deepEqual(resources.cases,root.cases);assert(root.baseline);
 const {runWF03PgPrediction}=await import('./study-workflow-wf03-pg.mjs'),{withFixtureTransaction}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const before=new Map(),sectionsByCase=Object.fromEntries(['A','B','D'].map(c=>[c,wf03PolicySections(c)]));
 const readProtection=async({phase,case:code,requestKeyPrefix,transientIds,expectedPersistentWrites})=>{
  assert.equal(expectedPersistentWrites,0);const protectedRows=await root.protect('PG-'+code+'-'+phase),snapshot=await predictionSnapshot(root,requestKeyPrefix);
  if(phase==='before')before.set(requestKeyPrefix,snapshot);else{assert(before.has(requestKeyPrefix));assert.deepEqual(snapshot,before.get(requestKeyPrefix),'FULL_PREDICTION_STATE_NOT_ROLLED_BACK');assert.equal(snapshot.prefixOperations.length,0);assert.equal(snapshot.prefixAudits.length,0);
   const tableFor={policies:'study_execution_policy_version',checks:'protocol_release_check',findings:'protocol_release_check_finding',remediationCases:'remediation_case',remediationAttempts:'remediation_attempt',remediationEvents:'remediation_event',audits:'audit_log',operations:'operation'};
   await root.h.read(async tx=>{for(const [kind,ids]of Object.entries(transientIds??{})){const table=tableFor[kind];assert(table);for(const id of ids){const found=await tx.$queryRawUnsafe(`SELECT id FROM ${kind==='operations'?'rh_research':'public'}."${table}" WHERE id=$1`,id);assert.equal(found.length,0,'TRANSIENT_ID_LEFT_AFTER_PREDICTION');}}});
  }
  save(out+'protection/'+requestKeyPrefix+'-'+phase+'.json',{phase,code,expectedPersistentWrites:0,actualResidueVerified:phase!=='before',snapshotHash:bodyHash(snapshot),protectedRows});return protectedRows;
 };
 for(const [code,mode]of [['A','full'],['B','full'],['D','full'],['A','policy-race'],['A','activate-rollback'],['B','reviewer-approver']])
  await runWF03PgPrediction({args:['--local-synthetic','--rollback-predict','--case',code,'--mode',mode],env:root.h.env,cases:root.cases,currentPrincipals:resources.currentPrincipals,sectionsByCase,...root.nativeDependencies(),withFixtureTransaction,readProtection,outputPath:out+code+'-'+mode+'/pg-result.json'});
}
async function verifyAssembly(root,out){
 const before=json(wf03Private+'dormant-knowledge-before-reload.json'),after=await root.h.read(tx=>tx.$queryRaw`SELECT id,md5(row_to_json(t)::text) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=${root.h.runtime.ids.tenant} ORDER BY id`);assert.deepEqual(after,before,'DORMANT_KNOWLEDGE_JOB_CHANGED_ON_RELOAD');
 const views={};for(const code of ['A','B','D']){const c=root.cases[code],path='/research-studies/'+c.studyId+'/protocols/'+c.protocolId;const view=await root.h.get(path+'/release');assert.equal(view.protocol.status,'draft');assert.equal(view.policy,null);assert.equal(view.approvedPolicy,null);for(const key of ['canSubmitWithCheck','canApproveAndActivate'])assert.equal(typeof view.capabilities[key],'boolean');
  const strictUnknown=await root.h.get(path+'/release-receipts/'+randomUUID()+'?action=approve&requestHash='+'0'.repeat(64));assert.deepEqual(strictUnknown,{found:false});views[code]={revision:view.protocol.revision,capabilities:view.capabilities,fixedReady:view.fixedReferences.ready,strictReceiptUnknown:strictUnknown};}
 save(out+'assembly-readonly.json',{at:new Date().toISOString(),runtimePid:root.h.runtime.pid,sourceFreeze:2,dormantJobsUnchanged:after.length,views,protection:await root.protect('after-owned-v2-reload'),businessWrites:0});
}
async function main(){requireWF03Window();const args=process.argv.slice(2);assert.equal(args[0],'--local-synthetic');assert.equal(args.length,2);const mode=args[1];assert(['admit','verify','pg-all'].includes(mode));verifyWF03Freeze();const out=output(mode);let root;
 try{root=await openWF03Context();if(mode==='admit')await admit(root,out);else if(mode==='verify')await verifyAssembly(root,out);else await pgAll(root,out);save(out+'root-result.json',{at:new Date().toISOString(),mode,passed:true});process.stdout.write(JSON.stringify({mode,passed:true,evidence:out})+'\n');}
 catch(error){save(out+'root-result.json',{at:new Date().toISOString(),mode,passed:false,error:{name:error.name,code:error.code??null}});process.stderr.write(JSON.stringify({mode,passed:false,evidence:out,errorName:error.name})+'\n');process.exitCode=1;}
 finally{if(root)await root.close();}
}
await main();
