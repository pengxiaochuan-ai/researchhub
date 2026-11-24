#!/usr/bin/env python3
import json
import re
import glob
import os
import hashlib
import shutil
import subprocess

NODE = r"""
import {readResearchRuntimeConfig} from './server/research-runtime/config.mjs';
import {runtimeDependencies} from './server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,withDeploymentTransaction} from './server/database/transactions.mjs';
let prisma;
try {
 const config=readResearchRuntimeConfig(process.env);
 if(config.identity.database!=='researchhub'||config.identity.tenantId!=='rh-kb-local-b0e2af9d-tenant')throw Error('HUB_TARGET_REJECTED');
 const {load}=runtimeDependencies(config.core);
 prisma=new (load('prisma/prisma.service','PrismaService'))();
 const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const bindings=[];
 for(const kind of ['direct','app']) {
  const [row]=await withDeploymentTransaction(env,kind,tx=>tx.$queryRawUnsafe(
   `SELECT current_database() AS database,current_user AS role,
     current_setting('server_version_num')::int/10000 AS server_major,
     pg_database_size(current_database())::text AS database_bytes,
     current_setting('transaction_read_only')='on' AS transaction_read_only,
     to_regnamespace('rh_center') IS NOT NULL AS center_schema,
     (SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='rh_center') AS migration_revision,
     to_regclass('rh_research.study_binding') IS NOT NULL AS study_parent,
     to_regclass('public.enrollment_target') IS NOT NULL AS study_target,
     to_regclass('public.study_enrollment') IS NOT NULL AS enrollment_parent,
     EXISTS(SELECT FROM pg_constraint WHERE conrelid=to_regclass('rh_research.study_binding')
      AND contype IN ('p','u') AND pg_get_constraintdef(oid)='UNIQUE (tenant_id, id)') AS study_tenant_key,
     has_database_privilege(current_database(),'CREATE') AS can_create_schema,
     COALESCE((SELECT json_agg(json_build_object('name',c.relname,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity)
       ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='rh_center' AND c.relkind='r'),'[]'::json) AS center_tables`
  ),{readOnly:true});
  bindings.push({kind,...row});
 }
 console.log(JSON.stringify({schema:'hub-center-target-preflight.v1',writes:0,bindings}));
} catch(error) {
 const code=error.code??error.message;
 console.log(JSON.stringify({status:'stopped',code:/^[A-Z][A-Z_0-9]{2,75}$/.test(code)?code:'HUB_CENTER_PROBE_FAILED'}));
 process.exitCode=1;
} finally {
 await prisma?.app?.$disconnect();
 await prisma?.elevated?.$disconnect();
}
"""

def main():
    ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api'],universal_newlines=True).split()
    if len(ids)!=1 or not re.fullmatch(r'[a-f0-9]{12,64}',ids[0]):
        raise ValueError('owned API container missing')
    result=subprocess.run(['docker','exec','-i',ids[0],'node','--input-type=module','-'],input=NODE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=45)
    lines=result.stdout.splitlines()
    value=json.loads(lines[-1]) if lines else {'status':'stopped','code':'HUB_CENTER_PROBE_NO_RESULT'}
    root='/srv/researchhub/ops'
    tag='hub-runtime-6ad32a57-45351976297001'
    with open(root+'/paired-current.json') as f:
        current=json.load(f)
    if current.get('tag')!=tag:
        raise ValueError('current tag changed')
    base=root+'/runtime-releases/'+tag
    mhash=current['manifestSha256']
    def sha(path):
        h=hashlib.sha256()
        with open(path,'rb') as f:
            for block in iter(lambda:f.read(4*1024*1024),b''):
                h.update(block)
        return h.hexdigest()
    manifests=[f for f in glob.glob(base+'/control-*/runtime-release.json') if not os.path.islink(f) and sha(f)==mhash]
    archives={}
    if manifests:
        with open(manifests[0]) as f:
            manifest=json.load(f)
        for name in ('backend-image.tar.gz','researchhub.tar.gz'):
            candidates=glob.glob(base+'/control-*/'+name)
            archives[name]=any(not os.path.islink(f) and sha(f)==manifest['files'][name]['sha256'] for f in candidates)
    bins=sorted(set(glob.glob('/usr/lib/postgresql/*/bin/pg_dump')+[p for p in [shutil.which('pg_dump')] if p]))
    value['rollback']={'tag':tag,'manifestSHA':mhash,'localManifestVerified':bool(manifests),'localArchivesVerified':archives}
    value['hostPgDumps']=[{'path':p,'version':subprocess.check_output([p,'--version'],universal_newlines=True).strip()} for p in bins]
    value['postgresImages']=[x for x in subprocess.check_output(['docker','images','--format','{{.Repository}}:{{.Tag}}'],universal_newlines=True).splitlines() if re.fullmatch(r'(?:[a-zA-Z0-9./-]+/)?postgres:[0-9][a-zA-Z0-9.-]*',x)]
    value['freeBytes']=shutil.disk_usage(root).free
    print(json.dumps(value))
    return result.returncode

if __name__=='__main__':
    try: raise SystemExit(main())
    except (subprocess.SubprocessError, OSError, ValueError):
        print(json.dumps({'status':'stopped','code':'HUB_CENTER_METADATA_FAILED'}))
        raise SystemExit(1)
