#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''

import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';
import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';
import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';
import{storageSettings,createRuntimeStorage}from'./server/research-runtime/storage.mjs';
import{createRuntimeArticle}from'./server/research-runtime/article-runtime.mjs';
import{createPmcObjectReader}from'./server/research-runtime/pmc-storage.mjs';
import{loadArticleEvidence}from'./server/hub-sources/article-evidence.mjs';
const config=readResearchRuntimeConfig(process.env),tenant='rh-kb-local-b0e2af9d-tenant';let prisma;
try{
 if(config.identity.database!=='researchhub'||config.identity.tenantId!==tenant)throw Error('INSPECT_TARGET_REJECTED');
 const{load,require}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const a=await withDeploymentTransaction(env,'direct',tx=>tx.account.findUnique({where:{id:tenant.replace(/-tenant$/,'-admin')},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}}),{readOnly:true});
 const user={tenantId:tenant,accountId:a.id,role:a.role,isTenantAdmin:a.isTenantAdmin,authVersion:a.authVersion,studyGroupId:tenant.replace(/-tenant$/,'-group'),researchProjectId:tenant.replace(/-tenant$/,'-project')};
 const storage=createRuntimeStorage({load,require,settings:storageSettings(process.env)});await storage.onModuleInit();const readPmcAsset=createPmcObjectReader(storage,tenant),result={status:'hub-production-inspected',databaseWrites:0,modelCalls:0,workersStarted:0};
 for(const kind of['source','runtime'])try{
  let pack;
  if(kind==='source')pack=(await withDeploymentTransaction(env,'app',async tx=>{await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.account_id',$2,true),set_config('app.auth_version',$3,true),set_config('app.study_group_id',$4,true),set_config('app.research_project_id',$5,true)",tenant,user.accountId,String(user.authVersion),user.studyGroupId,user.researchProjectId);return loadArticleEvidence({db:tx,tenantId:tenant,hubKey:'lingshu-xinyu',principal:user,recordId:'pmc-PMC13691533',readPmcAsset})},{readOnly:true})).pack;
  else pack=(await createRuntimeArticle({config,prisma,load,services:{storage,pool:{},provider:{},billing:{},tools:{},grounding:{}},status:async()=>({enabled:true,quota:{canStart:true}}),readPmcAsset}).context(user,'pmc-PMC13691533')).evidence;
  result[kind]={status:'current',binding:pack.binding,fragments:pack.fragments.length};
 }catch(e){result[kind]={status:'failed',code:/^[A-Za-z][A-Za-z0-9_:.-]{0,100}$/.test(e.code||e.message||'')?(e.code||e.message):e.name||'ARTICLE_READ_FAILED'};}
 console.log(JSON.stringify(result));
}catch(e){console.log(JSON.stringify({status:'stopped',code:'INSPECT_ARTICLE_FAILED'}));process.exitCode=1;}finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect();}

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
