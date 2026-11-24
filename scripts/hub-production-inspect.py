#!/usr/bin/env python3
import json
import re
import subprocess
import hashlib
import pathlib

NODE = r"""
import assert from 'node:assert/strict';
import {readResearchRuntimeConfig} from './server/research-runtime/config.mjs';
import {runtimeDependencies} from './server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,withDeploymentTransaction} from './server/database/transactions.mjs';
const data=JSON.parse(Buffer.from('eyJydW5JZCI6ICJibjAxLXByb2QtYWI2M2M2ZjMifQ==','base64').toString());
const tenant='rh-kb-local-b0e2af9d-tenant';
let prisma,stage='scope';
try {
 const configuration=readResearchRuntimeConfig(process.env);
 assert.equal(configuration.identity.database,'researchhub');
 assert.equal(configuration.identity.tenantId,tenant);
 assert.equal(configuration.identity.markerDigest,'cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523');
 assert.match(data.runId,/^bn01-prod-[a-f0-9]{8}$/);
 const {load}=runtimeDependencies(configuration.core);
 prisma=new (load('prisma/prisma.service','PrismaService'))();
 const env=bindRuntimeTransactions({prisma,expected:configuration.identity});
 const refs=await withDeploymentTransaction(env,'direct',async tx=>{
  stage='active-migration-readback';
  const [center]=await tx.$queryRaw`SELECT obj_description(oid,'pg_namespace') AS revision FROM pg_namespace WHERE nspname='rh_center'`;
  assert.equal(center?.revision,'rh-center.v1:9db01cf1641565f46fdd21d7fc39b89637d034616ce6d295edd116403b911d6b');
  stage='isolated-group';
  const member=await tx.account.findFirst({where:{tenantId:tenant,id:tenant.replace(/-tenant$/,'-owner'),username:'owner@example.org',status:'active',role:'researcher',isTenantAdmin:false},select:{id:true}});
  assert(member,'SYNTHETIC_EXECUTOR_ACCOUNT_MISSING');
  const groupId='rh-group-'+data.runId;
  const roleId='rh-role-'+data.runId;
  const group=await tx.studyGroup.create({data:{id:groupId,tenantId:tenant,name:'BN-01 合成验收组 · '+data.runId,slug:data.runId,createdBy:tenant.replace(/-tenant$/,'-admin')}});
  const role=await tx.permissionRole.create({data:{id:roleId,tenantId:tenant,key:data.runId,name:'BN-01 合成执行人员',dataScope:'project',menuPermissions:['workbench','subjects'],buttonPermissions:['study.execute']}});
  await tx.studyGroupMembership.create({data:{tenantId:tenant,studyGroupId:group.id,roleId:role.id,accountId:member.id}});
  return {groupId,runId:data.runId};
 });
 console.log(JSON.stringify({status:'hub-center-synthetic-group-ready',...refs}));
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
    root=pathlib.Path('/srv/researchhub/ops')
    recorded=json.loads((root/'paired-current.json').read_text())
    if not re.fullmatch(r'hub-runtime-3b8b8553-[0-9]+',recorded.get('tag','')):
        raise ValueError('approved pair not active')
    backups=list((root/'database-backups').glob('researchhub-before-center-*.dump'))
    backups=[b for b in backups if not b.is_symlink() and b.stat().st_uid==0 and b.stat().st_mode&0o077==0]
    if not backups: raise ValueError('approved backup missing')
    backup=max(backups,key=lambda b:b.stat().st_mtime)
    sha=hashlib.sha256()
    with backup.open('rb') as f:
        for buf in iter(lambda:f.read(1<<20),b''): sha.update(buf)
    ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api'],universal_newlines=True).split()
    if len(ids)!=1 or not re.fullmatch(r'[a-f0-9]{12,64}',ids[0]):
        raise ValueError('owned API container missing')
    result=subprocess.run(['docker','exec','-i',ids[0],'node','--input-type=module','-'],input=NODE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=45)
    lines=result.stdout.splitlines()
    value=json.loads(lines[-1]) if lines else {'status':'stopped','code':'HUB_CENTER_PROBE_NO_RESULT'}
    if result.returncode==0:
        value['pairedTag']=recorded['tag']
        value['backup']={'name':backup.name,'bytes':backup.stat().st_size,'sha256':sha.hexdigest()}
    print(json.dumps(value))
    return result.returncode

if __name__=='__main__':
    try: raise SystemExit(main())
    except (subprocess.SubprocessError, OSError, ValueError):
        print(json.dumps({'status':'stopped','code':'HUB_CENTER_METADATA_FAILED'}))
        raise SystemExit(1)
