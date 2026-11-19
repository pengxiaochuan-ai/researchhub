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
const expectedTenant='rh-kb-local-b0e2af9d-tenant';
let prisma;
try {
 const config=readResearchRuntimeConfig(process.env);
 if(config.identity.database!=='researchhub'||config.identity.tenantId!==expectedTenant)throw Error('INSPECT_TARGET_REJECTED');
 const {load}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();
 await prisma.app.$connect();await prisma.elevated.$connect();
 const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const result=await withDeploymentTransaction(env,'direct',async tx=>{
  const tenant=expectedTenant,agentId=tenant+'-kb-research';
  const assets=await tx.$queryRawUnsafe(`SELECT r.asset_id AS id,r.asset_kind AS kind,r.working_state AS state,r.release_state AS release,r.approved_version_no AS "approvedVersion",r.working_version_no AS version,r.owner_account_id AS owner,r.study_group_id AS "groupId",r.research_project_id AS "projectId",r.deleted_at IS NOT NULL AS deleted,EXISTS(SELECT 1 FROM rh_research.study_binding b WHERE b.tenant_id=r.tenant_id AND b.execution_project_id=r.research_project_id) AS bound FROM rh_asset.asset_registry r WHERE r.tenant_id=$1 ORDER BY r.asset_id LIMIT 101`,tenant);
  if(assets.length>100)throw Error('INSPECT_ASSET_LIMIT_REACHED');
  const counts=await tx.$queryRawUnsafe(`SELECT count(*)::int AS total,count(*) FILTER(WHERE asset_id LIKE 'rhab-%')::int AS business,count(*) FILTER(WHERE asset_id NOT LIKE 'rhab-%')::int AS legacy FROM rh_asset.asset_registry WHERE tenant_id=$1`,tenant);
  const jobs=await tx.$queryRawUnsafe(`SELECT status,count(*)::int AS count FROM public.knowledge_chat_job WHERE "tenantId"=$1 GROUP BY status ORDER BY status`,tenant);
  const [snapshot]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=$1`,tenant);
  let historicalQueueSnapshot=null,chatBudget=null;
  if(process.env.HUB_CHAT_ADMISSION_SHA256){
   const raw=fs.readFileSync('/run/researchhub-admission/admission.json');if(createHash('sha256').update(raw).digest('hex')!==process.env.HUB_CHAT_ADMISSION_SHA256)throw Error('INSPECT_ADMISSION_CHANGED');
   const admission=JSON.parse(raw);if(admission.database!=='researchhub'||admission.tenantId!==tenant||admission.campaignId!=='prod-ai-assets-20261120'||!Array.isArray(admission.historicalChatIds)||admission.historicalChatIds.length!==623)throw Error('INSPECT_ADMISSION_REJECTED');
   [historicalQueueSnapshot]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=$1 AND id=ANY($2::text[])`,tenant,admission.historicalChatIds);
   const ledgerRaw=fs.readFileSync('/run/researchhub-ai-ledger/budget.json'),ledger=JSON.parse(ledgerRaw);if(ledger.admissionSha!==process.env.HUB_CHAT_ADMISSION_SHA256)throw Error('INSPECT_LEDGER_CHANGED');
   chatBudget={sessions:ledger.sessions.map(x=>({accountId:x.accountId,id:x.sessionId})),jobs:ledger.jobs.map(x=>({id:x.id,accountId:x.accountId})),dispatches:ledger.dispatches.map(x=>({id:x.id,jobId:x.jobId,state:x.state,usage:x.usage??null,reservedMicros:x.reservedMicros,feeUpperMicros:x.feeUpperMicros??null})),ledgerSha256:createHash('sha256').update(ledgerRaw).digest('hex')};
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
  return {database:config.identity.database,tenant,accounts,access,tokenQuota,assetCounts:counts[0],assets,jobs,queueSnapshot:snapshot,historicalQueueSnapshot,chatBudget,legacySnapshot,model:model?{id:model.id,version:model.version,hasKnowledgeSearch:Array.isArray(model.tools)&&model.tools.includes('knowledge.search'),route}:null};
 },{readOnly:true});
 result.runtime={paidEnabled:process.env.HUB_PAID_AI_ENABLED==='true',workerKinds:config.scope.enabledWorkerKinds,coreDigest:process.env.HUB_CORE_MANIFEST_SHA256};
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
