#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''
import assert from'node:assert/strict';import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';import{storageSettings,createRuntimeStorage}from'./server/research-runtime/storage.mjs';import{listVisiblePmc,getCurrentPmcAiHit}from'./server/hub-sources/pmc-visible.mjs';
let prisma;try{const c=readResearchRuntimeConfig(process.env),tenant='rh-kb-local-b0e2af9d-tenant';assert(c.identity.database==='researchhub'&&c.identity.tenantId===tenant);const{load,require}=runtimeDependencies(c.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:c.identity}),actor=await withDeploymentTransaction(env,'direct',tx=>tx.account.findUnique({where:{id:tenant.replace(/-tenant$/,'-admin')},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}}),{readOnly:true}),user={tenantId:tenant,accountId:actor.id,role:actor.role,isTenantAdmin:actor.isTenantAdmin,authVersion:actor.authVersion,studyGroupId:tenant.replace(/-tenant$/,'-group'),researchProjectId:tenant.replace(/-tenant$/,'-project')};const rows=await withDeploymentTransaction(env,'app',async db=>{await db.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.account_id',$2,true),set_config('app.auth_version',$3,true),set_config('app.study_group_id',$4,true),set_config('app.research_project_id',$5,true)",tenant,user.accountId,String(user.authVersion),user.studyGroupId,user.researchProjectId);const scope={db,tenantId:tenant,hubKey:'lingshu-xinyu',principal:user},items=await listVisiblePmc(scope);assert(items.length<=20);const result=[];for(const row of items){const hit=await getCurrentPmcAiHit({...scope,recordId:row.id});if(!hit?.body)continue;const[a]=await db.$queryRaw`SELECT a.local_object_key AS key,a.object_sha256 AS sha,a.byte_count AS bytes FROM rh_source.pmc_asset a JOIN rh_source.pmc_candidate_version v ON v.id=a.version_id AND v.tenant_id=a.tenant_id AND v.hub_key=a.hub_key WHERE a.tenant_id=${tenant} AND a.hub_key='lingshu-xinyu' AND v.pmcid=${row.id.slice(4)} AND v.article_version=${hit.articleVersion} AND v.raw_sha256=${hit.rawSha256} AND a.asset_kind='jats' AND a.object_sha256=${hit.rawSha256} ORDER BY (a.component_ref='jats') DESC,a.component_ref LIMIT 1`;if(a)result.push({id:row.id,title:row.title,articleVersion:hit.articleVersion,reviewVersion:hit.reviewVersion,sha256:a.sha,bytes:Number(a.bytes),key:a.key});}return result},{readOnly:true});const storage=createRuntimeStorage({load,require,settings:storageSettings(process.env)});await storage.onModuleInit();storage.client.retryOptions.disableRetry=true;for(const row of rows){assert(row.key==='objects/'+row.sha256);try{const stat=await storage.statObject(tenant+'/hub-pmc/'+row.key);row.objectStatus=stat.size===row.bytes?'present':'size-mismatch'}catch(e){row.objectStatus=e.code==='NoSuchKey'?'missing':e.code||'read-failed'}}console.log(JSON.stringify({status:'hub-production-inspected',databaseWrites:0,objectWrites:0,modelCalls:0,workersStarted:0,rows}));}catch(e){console.log(JSON.stringify({status:'stopped',code:'INSPECT_ARTICLE_AUDIT_FAILED'}));process.exitCode=1}finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect()}

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
    value['containerIdentitiesUnchanged'] = True
    print(json.dumps(value, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.match(r'^INSPECT_[A-Z_]+$', str(error)) else 'INSPECT_FAILED'
        print(json.dumps({'status': 'stopped', 'code': code, 'automaticRetry': False}))
        raise SystemExit(1)
