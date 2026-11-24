#!/usr/bin/env python3
import json
import re
import subprocess

NODE = r"""
import assert from 'node:assert/strict';
import {readResearchRuntimeConfig} from './server/research-runtime/config.mjs';
import {runtimeDependencies} from './server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,withDeploymentTransaction} from './server/database/transactions.mjs';
import {createHash} from 'node:crypto';
const data=JSON.parse(Buffer.from('eyJzdHVkeSI6IHsiaWQiOiAicmgtc3R1ZHktYmNhOWE5OTEtNWZmMy00NTllLWJkZTMtNzQyYTkwNzFhZmE2IiwgImV4ZWN1dGlvblByb2plY3RJZCI6ICJjbXd1cTlmeXEwMDA0cWcwN3V0ZDJpYW9lIiwgInN0dWR5R3JvdXBJZCI6ICJyaC1ncm91cC1ibjAxLXByb2QtYWI2M2M2ZjMifSwgImludGVudCI6IHsiaWQiOiAicmgtcHJvamVjdC0yZTI0NTY2Ni03NDUyLTRlOTgtOTMzNC00YjY2NTRhMjA0NzIiLCAidGl0bGUiOiAiQk4tMDEgXHU3NTFmXHU0ZWE3XHU1NDA4XHU2MjEwXHU5YThjXHU2NTM2IFx1MDBiNyBibjAxLXByb2QtYWI2M2M2ZjMiLCAicXVlc3Rpb24iOiAiXHU0ZWM1XHU3NTI4XHU0ZThlXHU4ZjZmXHU0ZWY2XHU5YThjXHU2NTM2XHVmZjBjXHU2NWUwXHU3NzFmXHU1YjllXHU1M2Q3XHU4YmQ1XHU4MDA1XHUzMDAyIiwgInBpY28iOiB7ImMiOiAiIiwgImkiOiAiIiwgIm8iOiAiIiwgInAiOiAiIn0sICJyZXNlYXJjaFR5cGUiOiAiIiwgImh1YktleSI6ICJsaW5nc2h1LXhpbnl1IiwgIm93bmVySWQiOiAicmgta2ItbG9jYWwtYjBlMmFmOWQtYWRtaW4iLCAidmVyc2lvbiI6IDEsICJzdGF0dXMiOiAiZHJhZnQiLCAiY3JlYXRlZEF0IjogIjIwMjYtMTEtMjRUMTM6MjU6NDAuNjI3WiIsICJ1cGRhdGVkQXQiOiAiMjAyNi0xMS0yNFQxMzoyNTo0MC42MjdaIiwgInN0dWR5IjogbnVsbH0sICJncm91cCI6IHsiaWQiOiAicmgtZ3JvdXAtYm4wMS1wcm9kLWFiNjNjNmYzIiwgIm5hbWUiOiAiQk4tMDEgXHU1NDA4XHU2MjEwXHU5YThjXHU2NTM2XHU3ZWM0IFx1MDBiNyBibjAxLXByb2QtYWI2M2M2ZjMifSwgInJ1bklkIjogImJuMDEtcHJvZC1hYjYzYzZmMyJ9','base64').toString());
const tenant='rh-kb-local-b0e2af9d-tenant';
let prisma,stage='scope';
try {
 const configuration=readResearchRuntimeConfig(process.env);
 assert.equal(configuration.identity.database,'researchhub');
 assert.equal(configuration.identity.tenantId,tenant);
 assert.equal(configuration.identity.markerDigest,'cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523');
 assert.match(data.runId,/^bn01-prod-[a-f0-9]{8}$/);
 assert.match(data.study.id,/^rh-study-[0-9a-f-]{36}$/);
 const {load}=runtimeDependencies(configuration.core);
 prisma=new (load('prisma/prisma.service','PrismaService'))();
 const env=bindRuntimeTransactions({prisma,expected:configuration.identity});
 const refs=await withDeploymentTransaction(env,'direct',async tx=>{
  stage='binding';
  const [row]=await tx.$queryRaw`SELECT b.id,b.study_group_id,b.execution_project_id,i.title,i.question,i.owner_id
   FROM rh_research.study_binding b JOIN rh_research.project_intent i
   ON (i.tenant_id,i.id)=(b.tenant_id,b.project_intent_id)
   WHERE b.tenant_id=${tenant} AND b.id=${data.study.id} AND i.id=${data.intent.id}`;
  assert.equal(row?.title,'BN-01 生产合成验收 · '+data.runId);
  assert.equal(row.question,'仅用于软件验收，无真实受试者。');
  assert.equal(row.owner_id,tenant.replace(/-tenant$/,'-admin'));
  assert.equal(row.study_group_id,data.group.id);
  assert.equal(row.execution_project_id,data.study.executionProjectId);
  const scope={tenantId:tenant,studyGroupId:row.study_group_id,researchProjectId:row.execution_project_id};
  assert(await tx.researchProject.findFirst({where:{tenantId:tenant,studyGroupId:row.study_group_id,id:row.execution_project_id,name:row.title}}));
  stage='membership';
  const member=await tx.account.findFirst({where:{tenantId:tenant,id:tenant.replace(/-tenant$/,'-owner'),username:'owner@example.org',status:'active',role:'researcher',isTenantAdmin:false},select:{id:true}});
  assert(member,'SYNTHETIC_EXECUTOR_ACCOUNT_MISSING');
  const membership=await tx.studyGroupMembership.findFirst({where:{tenantId:tenant,studyGroupId:scope.studyGroupId,accountId:member.id,status:'active'},include:{role:true}});
  const role=membership?.role;
  assert(role?.status==='active'&&role.tenantId===tenant&&
   ['workbench','subjects'].every(menu=>role.menuPermissions.includes(menu))&&role.buttonPermissions.includes('study.execute'),'SYNTHETIC_EXECUTOR_GROUP_NOT_ELIGIBLE');
  const previous=await tx.researchProjectMembership.findFirst({where:{...scope,accountId:member.id}});
  if(!previous)await tx.researchProjectMembership.create({data:{...scope,accountId:member.id,roleKey:'researcher'}});
  else assert.equal(previous.roleKey,'researcher');
  stage='form-and-outcome';
  const template=await tx.formTemplate.create({data:{...scope,key:data.runId,name:'BN-01 合成观察记录'}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'合成观察值',type:'number',required:true},{key:'completed',label:'已完成',type:'boolean',required:true}]}}});
  const outcome=await tx.outcomeDefinition.create({data:{...scope,key:data.runId,versionNumber:1,name:'BN-01 合成观察值',role:'primary',sourceType:'data_field',dataFieldKey:'value',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:row.owner_id}});
  return {form:form.id,outcome:outcome.id,studyId:row.id,scopeDigest:createHash('sha256').update(JSON.stringify(scope)).digest('hex')};
 });
 console.log(JSON.stringify({status:'hub-center-synthetic-references-ready',...refs}));
} catch(error) {
 const code=error.code??error.message;
 console.log(JSON.stringify({status:'stopped',stage,code:/^[A-Z][A-Z_0-9]{2,75}$/.test(code)?code:'HUB_CENTER_SYNTHETIC_PREP_FAILED'}));
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
    print(json.dumps(value))
    return result.returncode

if __name__=='__main__':
    try: raise SystemExit(main())
    except (subprocess.SubprocessError, OSError, ValueError):
        print(json.dumps({'status':'stopped','code':'HUB_CENTER_METADATA_FAILED'}))
        raise SystemExit(1)
