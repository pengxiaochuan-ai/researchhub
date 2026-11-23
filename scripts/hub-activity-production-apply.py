#!/usr/bin/env python3
"""Apply exactly the approved Hub activity schema using the owned production API container."""
import json
import re
import subprocess

NODE = r"""
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readResearchRuntimeConfig} from './server/research-runtime/config.mjs';
import {runtimeDependencies} from './server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,verifyRuntimeSchema,withDeploymentTransaction} from './server/database/transactions.mjs';
const sha='f286f89677336dc4c2846a47b889afdc28cb6f4bef4ebea150edd544b943af59';
const sql=Buffer.from('__APPROVED_SCHEMA_BASE64__','base64');
const app='researchhub_demo_app',owner='researchhub_demo_owner',hub='lingshu-xinyu';
let stage='initial',prisma,committed=false;
try {
 assert.equal(createHash('sha256').update(sql).digest('hex'),sha);
 const config=readResearchRuntimeConfig(process.env);
 const {database,tenantId,markerDigest}=config.identity;
 assert.equal(database,'researchhub');
 assert.equal(tenantId,'rh-kb-local-b0e2af9d-tenant');
 assert.equal(markerDigest,'cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523');
 const {load}=runtimeDependencies(config.core);
 prisma=new (load('prisma/prisma.service','PrismaService'))();
 const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const baseline={fingerprint:process.env.HUB_SCHEMA_FINGERPRINT,schemas:process.env.HUB_MANAGED_SCHEMAS.split(',')};
 assert(!baseline.schemas.includes('rh_hub_activity'));
 stage='baseline';
 await verifyRuntimeSchema(env,baseline);
 stage='transaction';
 const result=await withDeploymentTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='3s'");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('rh-hub-activity-schema-v1',0))");
  const [identity]=await tx.$queryRawUnsafe("SELECT current_user AS role,to_regnamespace('rh_hub_activity') IS NULL AS absent");
  assert.equal(identity.role,owner);assert.equal(identity.absent,true);
  for(const statement of sql.toString('utf8').split('-- statement').map(s=>s.trim()).filter(Boolean)){
   await tx.$executeRawUnsafe(statement);
  }
  const tables=await tx.$queryRawUnsafe("SELECT relname,relrowsecurity AS rls,relforcerowsecurity AS forced FROM pg_class WHERE relnamespace='rh_hub_activity'::regnamespace AND relkind='r' ORDER BY relname");
  assert.deepEqual(tables,[{relname:'evidence',rls:true,forced:true},{relname:'first_public',rls:true,forced:true}]);
  const [privileges]=await tx.$queryRawUnsafe("SELECT has_table_privilege($1,'rh_hub_activity.first_public','SELECT') AS index_read,has_table_privilege($1,'rh_hub_activity.first_public','INSERT,UPDATE,DELETE') AS index_mutate,has_table_privilege($1,'rh_hub_activity.evidence','SELECT,INSERT,UPDATE,DELETE') AS evidence_access",app);
  assert.deepEqual(privileges,{index_read:true,index_mutate:false,evidence_access:false});
  return {tables,privileges};
 });
 committed=true;
 stage='application';
 const appRows=await withDeploymentTransaction(env,'app',async tx=>{
  const [role]=await tx.$queryRawUnsafe('SELECT current_user AS role');
  assert.equal(role.role,app);
  await tx.$queryRawUnsafe("SELECT set_config('app.hub_key',$1,true)",hub);
  const [row]=await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM rh_hub_activity.first_public');
  return row.count;
 },{readOnly:true});
 assert.equal(appRows,0);
 await verifyRuntimeSchema(env,baseline);
 console.log(JSON.stringify({status:'applied_and_verified',database,sha,appRows,...result}));
} catch(error) {
 const code=error.code??error.message;
 console.log(JSON.stringify({status:'stopped',stage,committed,code:/^[A-Z][A-Z_0-9]{2,75}$/.test(code)?code:'HUB_ACTIVITY_MIGRATION_FAILED',databaseCode:typeof error.meta?.code==='string'&&/^[0-9A-Z]{5}$/.test(error.meta.code)?error.meta.code:undefined}));
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
    result=subprocess.run(['docker','exec','-i',ids[0],'node','--input-type=module','-'],input=NODE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=60)
    lines=result.stdout.splitlines()
    value=json.loads(lines[-1]) if lines else {'status':'stopped','code':'HUB_ACTIVITY_NO_RECEIPT'}
    print(json.dumps(value))
    return result.returncode

if __name__=='__main__':
    try: raise SystemExit(main())
    except (subprocess.SubprocessError, OSError, ValueError):
        print(json.dumps({'status':'stopped','code':'HUB_ACTIVITY_NO_RECEIPT'}))
        raise SystemExit(1)
