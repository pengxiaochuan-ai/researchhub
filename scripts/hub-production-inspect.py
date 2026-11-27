#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''

import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';
import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';
import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';
import{smtpConfigFromEnv,verifyStudySmtp}from'./server/research-capture/smtp-config.mjs';
let prisma;
try{
 const config=readResearchRuntimeConfig(process.env),tenant=config.identity.tenantId;
 if(config.identity.database!=='researchhub'||tenant!=='rh-kb-local-b0e2af9d-tenant')throw Error('F01_SCOPE');
 const{load}=runtimeDependencies(config.core);
 prisma=new(load('prisma/prisma.service','PrismaService'))();
 await prisma.app.$connect();await prisma.elevated.$connect();
 const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const {quota,used}=await withDeploymentTransaction(env,'direct',async tx=>{
  const {quotaSeats:quota}=await tx.tenant.findUnique({where:{id:tenant},select:{quotaSeats:true}});
  return {quota,used:await tx.account.count({where:{tenantId:tenant}})};
 },{readOnly:true});
 const mode=process.env.HUB_MAIL_MODE==='smtp-registration'?'smtp-registration':'other';
 const smtp=await verifyStudySmtp(smtpConfigFromEnv(process.env));
 console.log(JSON.stringify({status:'registration-readonly',quota,used,mode,smtp,mailSent:false}));
}catch(error){console.log(JSON.stringify({status:'registration-readonly-failed'}));process.exitCode=1;}
finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect();}

'''


def run(args, stdin=None):
    result = subprocess.run(args, input=stdin, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, universal_newlines=True, timeout=100)
    if result.returncode:
        # Never echo stderr: database libraries may include connection details.
        raise ValueError('INSPECT_COMMAND_FAILED')
    return result.stdout.strip()


def main():
    ids = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=researchhub-backend',
               '--filter', 'label=com.docker.compose.service=researchhub-api']).splitlines()
    if len(ids) != 1 or not re.match(r'^[a-f0-9]{12,64}$', ids[0]):
        raise ValueError('INSPECT_HUB_CONTAINER_REQUIRED')
    before = run(['docker', 'ps', '--format', '{{.ID}} {{.Image}} {{.Status}}'])
    raw = run(['docker', 'exec', '-i', ids[0], 'node', '--input-type=module', '-'], NODE)
    value = json.loads(raw.splitlines()[-1])
    if value.get('status') != 'registration-readonly':
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
