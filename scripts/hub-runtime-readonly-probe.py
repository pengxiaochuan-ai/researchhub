#!/usr/bin/env python3
import json
import re
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
   "SELECT current_database() AS database,current_user AS role, encode(sha256(convert_to(coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database'),''),'UTF8')),'hex') AS marker_sha256,to_regnamespace('rh_hub_activity') IS NOT NULL AS activity_namespace,to_regclass('rh_hub_activity.first_public') IS NOT NULL AS activity_index,to_regclass('rh_hub_activity.evidence') IS NOT NULL AS activity_evidence,to_regclass('rh_hub.hub') IS NOT NULL AS hub_parent,to_regclass('rh_academic.version') IS NOT NULL AS publication_history,has_database_privilege(current_database(),'CREATE') AS can_create_schema"
  ),{readOnly:true});
  bindings.push({kind,...row});
 }
 console.log(JSON.stringify({schema:'hub-activity-target-preflight.v1',writes:0,bindings}));
} catch(error) {
 const code=error.code??error.message;
 console.log(JSON.stringify({status:'stopped',code:/^[A-Z][A-Z_0-9]{2,75}$/.test(code)?code:'HUB_ACTIVITY_PROBE_FAILED'}));
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
    value=json.loads(lines[-1]) if lines else {'status':'stopped','code':'HUB_ACTIVITY_PROBE_NO_RESULT'}
    print(json.dumps(value))
    return result.returncode

if __name__=='__main__':
    try: raise SystemExit(main())
    except (subprocess.SubprocessError, OSError, ValueError):
        print(json.dumps({'status':'stopped','code':'HUB_ACTIVITY_METADATA_FAILED'}))
        raise SystemExit(1)
