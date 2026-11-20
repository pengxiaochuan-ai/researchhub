#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readResearchRuntimeConfig} from './server/research-runtime/config.mjs';
import {runtimeDependencies} from './server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,withDeploymentTransaction} from './server/database/transactions.mjs';
import {storageSettings,createRuntimeStorage} from './server/research-runtime/storage.mjs';
import {createChatBudget} from './server/research-runtime/chat-budget.mjs';
const expectedTenant='rh-kb-local-b0e2af9d-tenant';
let prisma;
try {
 const config=readResearchRuntimeConfig(process.env);
 if(config.identity.database!=='researchhub'||config.identity.tenantId!==expectedTenant)throw Error('INSPECT_TARGET_REJECTED');
 const {load,require}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();
 await prisma.app.$connect();await prisma.elevated.$connect();
 const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const result=await withDeploymentTransaction(env,'direct',async tx=>{
  const tenant=expectedTenant,agentId=tenant+'-kb-research';
  const assets=await tx.$queryRawUnsafe(`SELECT r.asset_id AS id,r.asset_kind AS kind,r.working_state AS state,r.release_state AS release,r.approved_version_no AS "approvedVersion",r.working_version_no AS version,r.owner_account_id AS owner,r.study_group_id AS "groupId",r.research_project_id AS "projectId",r.deleted_at IS NOT NULL AS deleted,EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.tenant_id=r.tenant_id AND b.execution_project_id=r.research_project_id) AS bound FROM rh_asset.asset_registry r WHERE r.tenant_id=$1 ORDER BY r.asset_id LIMIT 101`,tenant);
  if(assets.length>100)throw Error('INSPECT_ASSET_LIMIT_REACHED');
  const counts=await tx.$queryRawUnsafe(`SELECT count(*)::int AS total,count(*) FILTER(WHERE asset_id LIKE 'rhab-%')::int AS business,count(*) FILTER(WHERE asset_id NOT LIKE 'rhab-%')::int AS legacy FROM rh_asset.asset_registry WHERE tenant_id=$1`,tenant);
  const jobs=await tx.$queryRawUnsafe(`SELECT status,count(*)::int AS count FROM public.knowledge_chat_job WHERE "tenantId"=$1 GROUP BY status ORDER BY status`,tenant);
  const [snapshot]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=$1`,tenant);
  let historicalQueueSnapshot=null,chatBudget=null,historicalQueueClassification=null;const nativeReservations=[],knowledgeImports=[];
  if(process.env.HUB_CHAT_ADMISSION_SHA256){
   const raw=fs.readFileSync('/run/researchhub-admission/admission.json');if(createHash('sha256').update(raw).digest('hex')!==process.env.HUB_CHAT_ADMISSION_SHA256)throw Error('INSPECT_ADMISSION_CHANGED');
   const admission=JSON.parse(raw);if(admission.database!=='researchhub'||admission.tenantId!==tenant||admission.campaignId!=='prod-ai-assets-20261120'||!Array.isArray(admission.historicalChatIds)||admission.historicalChatIds.length!==623)throw Error('INSPECT_ADMISSION_REJECTED');
   [historicalQueueSnapshot]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=$1 AND id=ANY($2::text[])`,tenant,admission.historicalChatIds);
   const classificationSql=`WITH queued AS (
    SELECT j.*,s."contextKey",s.title AS session_title,s.status AS session_status,s."deletedAt" AS session_deleted,
     a.status AS account_status,a.role,a."isTenantAdmin",g.status AS group_status,p.status AS project_status,
     r.status AS reservation_status,r."actualTokens" IS NOT NULL AS has_actual_usage
    FROM public.knowledge_chat_job j
    LEFT JOIN public.session s ON s.id=j."sessionId" AND s."tenantId"=j."tenantId" AND s."accountId"=j."accountId" AND s."studyGroupId"=j."studyGroupId" AND s."researchProjectId"=j."researchProjectId"
    LEFT JOIN public.account a ON a.id=j."accountId" AND a."tenantId"=j."tenantId"
    LEFT JOIN public.study_group g ON g.id=j."studyGroupId" AND g."tenantId"=j."tenantId"
    LEFT JOIN public.research_project p ON p.id=j."researchProjectId" AND p."tenantId"=j."tenantId" AND p."studyGroupId"=j."studyGroupId"
    LEFT JOIN public.token_quota_reservation r ON r."tenantId"=j."tenantId" AND r."requestKey"='chat:'||j."sessionId"||':'||j."requestKey"
    WHERE j."tenantId"=$1 AND j.id=ANY($2::text[]) AND j.status='queued'
   ), classified AS (SELECT *,
    CASE WHEN "contextKey" LIKE 'kb:%' THEN 'knowledge-base' WHEN "contextKey" LIKE 'hub:%' THEN 'hub' WHEN "contextKey" LIKE 'article:%' OR "contextKey" LIKE 'hub-article:v1:%' THEN 'article' WHEN "contextKey" LIKE 'rh-asset-applicability:%' THEN 'asset-applicability' WHEN "contextKey" LIKE 'asset:%' THEN 'asset' ELSE 'other-or-missing' END AS family,
    coalesce(session_title ~* 'synthetic|合成|验收|演练|fixture|smoke',false) AS synthetic_signal,
    (attempts<>0 OR "startedAt" IS NOT NULL OR "assistantMessageId" IS NOT NULL OR result IS NOT NULL) AS execution_evidence,
    ("executionToken" IS NOT NULL OR "workerOwner" IS NOT NULL OR "leaseExpiresAt" IS NOT NULL) AS claim_evidence,
    coalesce("sessionId" LIKE 'rh-aiq-%' AND "requestKey" LIKE 'rh-aiq-%' AND payload#>>'{hubCommand,schema}'='hub-conversation-command.v1',false) AS contract_fixture,
    (account_status='active' AND group_status='active' AND project_status='active' AND session_status='active' AND session_deleted IS NULL) IS TRUE AS parents_active
    FROM queued)
   SELECT family,contract_fixture AS "contractFixture",synthetic_signal AS "syntheticSignal",execution_evidence AS "executionEvidence",claim_evidence AS "claimEvidence",parents_active AS "parentsActive",coalesce(reservation_status,'none') AS "reservationStatus",coalesce(has_actual_usage,false) AS "hasActualUsage",count(*)::int AS count,
    count(DISTINCT "accountId")::int AS accounts,count(DISTINCT "studyGroupId")::int AS "studyGroups",count(DISTINCT "researchProjectId")::int AS projects,count(DISTINCT "sessionId")::int AS sessions,
    min("createdAt") AS "createdFrom",max("createdAt") AS "createdTo",min("updatedAt") AS "updatedFrom",max("updatedAt") AS "updatedTo"
   FROM classified GROUP BY family,contract_fixture,synthetic_signal,execution_evidence,claim_evidence,parents_active,reservation_status,has_actual_usage
   ORDER BY count(*) DESC,family`;
   const groups=await tx.$queryRawUnsafe(classificationSql,tenant,admission.historicalChatIds);
   const provenance=await tx.$queryRawUnsafe(`SELECT j.id,j."accountId",j."sessionId",j."studyGroupId",j."researchProjectId",j."requestKey",md5(j.text) AS "questionHash",length(j.text)::int AS "questionLength",ARRAY(SELECT k FROM jsonb_object_keys(CASE WHEN jsonb_typeof(j.payload)='object' THEN j.payload ELSE '{}'::jsonb END) keys(k) WHERE k IN ('kbIds','attachments','kbAgent','networkIntent','articleInputHash','articleBinding','requestKey','sourcePackHash','assetApplicabilityInputHash','assetId','version','kind','skillKey','executionPlan','contextKey','sourcePolicy') ORDER BY k) AS "payloadKeys",(SELECT count(*)::int FROM jsonb_object_keys(CASE WHEN jsonb_typeof(j.payload)='object' THEN j.payload ELSE '{}'::jsonb END) keys(k) WHERE k NOT IN ('kbIds','attachments','kbAgent','networkIntent','articleInputHash','articleBinding','requestKey','sourcePackHash','assetApplicabilityInputHash','assetId','version','kind','skillKey','executionPlan','contextKey','sourcePolicy')) AS "unknownKeyCount",j."createdAt" FROM public.knowledge_chat_job j WHERE j."tenantId"=$1 AND j.id=ANY($2::text[]) AND j.status='queued' ORDER BY j."createdAt",j.id LIMIT 5`,tenant,admission.historicalChatIds);
   const repeatedQuestions=await tx.$queryRawUnsafe(`SELECT md5(j.text) AS "questionHash",count(*)::int AS count,length(j.text)::int AS "questionLength" FROM public.knowledge_chat_job j WHERE j."tenantId"=$1 AND j.id=ANY($2::text[]) AND j.status='queued' GROUP BY j.text ORDER BY count(*) DESC,md5(j.text) LIMIT 10`,tenant,admission.historicalChatIds);
   historicalQueueClassification={at:new Date().toISOString(),basis:'sealed-historical-ids-and-current-queued-state',total:groups.reduce((sum,g)=>sum+g.count,0),groups,provenance,repeatedQuestions,classificationOnly:true,automaticDisposition:false};
   const ledgerRaw=fs.readFileSync('/run/researchhub-ai-ledger/budget.json'),ledger=JSON.parse(ledgerRaw);if(ledger.admissionSha!==process.env.HUB_CHAT_ADMISSION_SHA256)throw Error('INSPECT_LEDGER_CHANGED');
   chatBudget={sessions:ledger.sessions.map(x=>({accountId:x.accountId,id:x.sessionId})),jobs:ledger.jobs.map(x=>({id:x.id,accountId:x.accountId})),dispatches:ledger.dispatches.map(x=>({id:x.id,jobId:x.jobId,state:x.state,usage:x.usage??null,reservedMicros:x.reservedMicros,feeUpperMicros:x.feeUpperMicros??null})),ledgerSha256:createHash('sha256').update(ledgerRaw).digest('hex')};
   const checked=createChatBudget({admission,admissionSha:process.env.HUB_CHAT_ADMISSION_SHA256,directory:'/run/researchhub-ai-ledger'}).snapshot();
   if(JSON.stringify(checked)!==JSON.stringify(ledger))throw Error('INSPECT_LEDGER_SNAPSHOT_MOVED');
   if(ledger.jobs.length>admission.limits.jobs)throw Error('INSPECT_JOB_LIMIT_REACHED');
   if(admission.schema==='hub-chat-admission.v2')for(const b of admission.k01.bindings){
    const task=await tx.knowledgeImportTask.findFirst({where:{id:b.importTaskId,tenantId:tenant,kbId:b.kbId,createdBy:b.accountId},select:{id:true,status:true,stage:true,progress:true,docId:true,errorCode:true,sourceFile:{select:{sha256:true}}}});
    const doc=task?.docId?await tx.knowledgeDoc.findFirst({where:{id:task.docId,kbId:b.kbId},select:{id:true,title:true,version:true,status:true,reviewed:true}}):null;
    knowledgeImports.push({accountId:b.accountId,kbId:b.kbId,task,doc});
   }
   for(const j of ledger.jobs){
    if(!admission.accounts.includes(j.accountId)||!['id','sessionId','requestKey'].every(k=>typeof j[k]==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(j[k])))throw Error('INSPECT_JOB_SCOPE_REJECTED');
    const job=await tx.knowledgeChatJob.findFirst({where:{id:j.id,tenantId:tenant,accountId:j.accountId,sessionId:j.sessionId,requestKey:j.requestKey},select:{id:true}});if(!job)throw Error('INSPECT_JOB_BINDING_CHANGED');
    const reservation=await tx.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:tenant,requestKey:'chat:'+j.sessionId+':'+j.requestKey}},select:{status:true,reconciliationUsageRecordId:true}});
    nativeReservations.push({jobId:j.id,accountId:j.accountId,status:reservation?.status??'not_found',hasReconciledUsage:Boolean(reservation?.reconciliationUsageRecordId)});
   }

  }
  const legacySnapshot=await tx.$queryRawUnsafe(`WITH ids AS(SELECT asset_id FROM rh_asset.asset_registry WHERE tenant_id=$1 AND asset_id NOT LIKE 'rhab-%'), hashes AS(SELECT 'registry' AS kind,md5(to_jsonb(r)::text) AS hash FROM rh_asset.asset_registry r JOIN ids ON ids.asset_id=r.asset_id UNION ALL SELECT 'policy',md5(to_jsonb(v)::text) FROM rh_asset.version_policy v JOIN ids ON ids.asset_id=v.asset_id UNION ALL SELECT 'event',md5(to_jsonb(e)::text) FROM rh_asset.asset_event e JOIN ids ON ids.asset_id=e.asset_id UNION ALL SELECT 'access',md5(to_jsonb(x)::text) FROM rh_asset.access_request x JOIN ids ON ids.asset_id=x.asset_id UNION ALL SELECT 'artifact',md5(to_jsonb(a)::text) FROM public.research_artifact a JOIN ids ON ids.asset_id=a.id UNION ALL SELECT 'body',md5(to_jsonb(v)::text) FROM public.research_artifact_version v JOIN ids ON ids.asset_id=v."artifactId") SELECT kind,count(*)::int AS count,md5(string_agg(hash,'' ORDER BY hash)) AS hash FROM hashes GROUP BY kind ORDER BY kind`,tenant);
  const accounts=await tx.account.findMany({where:{tenantId:tenant,id:{in:['rh-kb-local-b0e2af9d-admin','rh-kb-local-b0e2af9d-owner']}},select:{id:true,status:true,role:true,isTenantAdmin:true}});
  const access=await tx.agentAccess.findMany({where:{tenantId:tenant,agentId,scopeKey:{in:['*',...accounts.map(a=>a.id)]}},select:{accountId:true,enabled:true,scopeKey:true}});
  const model=await tx.agentConfig.findFirst({where:{tenantId:tenant,agentId,active:true,archivedAt:null},orderBy:{version:'desc'},select:{id:true,version:true,model:true,tools:true}});
  let route={configured:false},resolvedModel;
  if(model)try{const r=await load('common/model-route-resolver','resolveConfiguredDeepSeekModelRoute')(tx,tenant,model.model);resolvedModel=r;route={configured:true,provider:r.provider,model:r.model,secretRef:r.secretRef||'DEEPSEEK_API_KEY',keyPresent:Boolean(process.env[r.secretRef||'DEEPSEEK_API_KEY'])};}catch{}
  const tokenQuota=[];
  if(model&&route.configured){
   const billing=new(load('billing/billing.service','BillingService'))(prisma,{});
   const required=load('billing/token-quota-policy','estimateRunTokenBudget')(Number(resolvedModel.maxTokens??4096));
   for(const a of accounts){const q=await billing.quotaSnapshotFrom(tx,tenant,a.id);tokenQuota.push({accountId:a.id,requiredTokens:required.toString(),tenantReady:q.tenantRemaining>=required,accountMode:q.accountAllocated===0n?'inherits-tenant':'account-limit',accountReady:q.accountAllocated===0n||q.accountRemaining>=required,effectiveReady:q.effectiveRemaining>=required,hasReservations:q.tenantReserved>0n||q.accountReserved>0n});}
  }
  return {database:config.identity.database,tenant,accounts,access,tokenQuota,assetCounts:counts[0],assets,jobs,queueSnapshot:snapshot,historicalQueueSnapshot,historicalQueueClassification,chatBudget,nativeReservations,knowledgeImports,legacySnapshot,model:model?{id:model.id,version:model.version,hasKnowledgeSearch:Array.isArray(model.tools)&&model.tools.includes('knowledge.search'),route}:null};
 },{readOnly:true});
 result.runtime={paidEnabled:process.env.HUB_PAID_AI_ENABLED==='true',workerKinds:config.scope.enabledWorkerKinds,coreDigest:process.env.HUB_CORE_MANIFEST_SHA256};
 // HeadBucket only: never enumerate or read stored objects, never create a bucket.
 let available=false;try{const storage=createRuntimeStorage({load,require,settings:storageSettings(process.env)});await storage.onModuleInit();available=storage.available;}catch{}
 result.storage={available,probe:'HeadBucket',objectReads:0,objectWrites:0};
 console.log(JSON.stringify({status:'hub-production-inspected',databaseWrites:0,modelCalls:0,workersStarted:0,...result}));
}catch(error){console.log(JSON.stringify({status:'stopped',code:/^(INSPECT_|RUNTIME_)/.test(error?.message||'')?error.message:'INSPECT_DATABASE_READ_FAILED'}));process.exitCode=1;}
finally{if(prisma)await prisma.onModuleDestroy();}
'''


def run(args, stdin=None):
    result = subprocess.run(args, input=stdin, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, universal_newlines=True, timeout=100)
    if result.returncode:
        # Never echo stderr: database libraries may include connection details.
        raise ValueError('INSPECT_COMMAND_FAILED')
    return result.stdout.strip()


def legacy_key_presence():
    # Read only this already-authorized model field; do not source shell config.
    try:
        with open('/srv/aisci/ops/.env.prod', encoding='utf-8') as file:
            matches = [line.partition('=')[2].strip().strip('"\'') for line in file
                       if re.match(r'^(?:export\s+)?DEEPSEEK_API_KEY\s*=', line)]
        return len(matches) == 1 and bool(matches[0])
    except (IOError, OSError):
        return False


def main():
    ids = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=researchhub-backend',
               '--filter', 'label=com.docker.compose.service=researchhub-api']).splitlines()
    if len(ids) != 1 or not re.match(r'^[a-f0-9]{12,64}$', ids[0]):
        raise ValueError('INSPECT_HUB_CONTAINER_REQUIRED')
    before = run(['docker', 'ps', '--format', '{{.ID}} {{.Image}} {{.Status}}'])
    raw = run(['docker', 'exec', '-i', ids[0], 'node', '--input-type=module', '-'], NODE)
    value = json.loads(raw.splitlines()[-1])
    if value.get('status') != 'hub-production-inspected':
        raise ValueError('INSPECT_DATABASE_READ_FAILED')
    # Only identity/image/state, not uptime text, are relevant for a read-only probe.
    after_ids = run(['docker', 'ps', '--format', '{{.ID}} {{.Image}}'])
    if [' '.join(line.split()[:2]) for line in before.splitlines()] != after_ids.splitlines():
        raise ValueError('INSPECT_CONTAINER_IDENTITY_CHANGED')
    value['legacyDeepSeekKeyPresent'] = legacy_key_presence()
    value['containerIdentitiesUnchanged'] = True
    print(json.dumps(value, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.match(r'^INSPECT_[A-Z_]+$', str(error)) else 'INSPECT_FAILED'
        print(json.dumps({'status': 'stopped', 'code': code, 'automaticRetry': False}))
        raise SystemExit(1)
