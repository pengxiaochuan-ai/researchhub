import json,subprocess
with open('/proc/meminfo') as f:
 m={l.split(':')[0]:int(l.split()[1]) for l in f if l.split(':')[0] in ('MemTotal','MemAvailable','SwapTotal','SwapFree')}
print(json.dumps({'memoryKiB':m,'containerMemory':subprocess.check_output(['docker','stats','--no-stream','--format','{{.Name}} {{.MemUsage}}'],universal_newlines=True).splitlines()}))

api=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api'],universal_newlines=True).strip()
assert len(api.splitlines())==1
node="import assert from'node:assert/strict';import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';let prisma;try{const c=readResearchRuntimeConfig(process.env),tenant='rh-kb-local-b0e2af9d-tenant';assert(c.identity.database==='researchhub'&&c.identity.tenantId===tenant);const{load}=runtimeDependencies(c.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:c.identity});const result=await withDeploymentTransaction(env,'direct',async tx=>{return {now:new Date().toISOString(),workers:c.scope.enabledWorkerKinds,task:await tx.knowledgeImportTask.findMany({where:{tenantId:tenant,sourceFile:{sha256:'733d37edf8b6de15fcf8b35ce70cc094293a2eae11ce4e8ec14582728e9e800e'}},orderBy:{createdAt:'desc'},take:4,select:{id:true,createdAt:true,startedAt:true,docId:true,status:true,sourceFile:{select:{sha256:true,filename:true}},errorCode:true,errorMessage:true,stage:true,progress:true,leaseExpiresAt:true,executionToken:true,workerOwner:true,updatedAt:true}}).then(rows=>rows.map(t=>({...t,executionToken:Boolean(t.executionToken),workerOwner:Boolean(t.workerOwner)})))};},{readOnly:true});console.log(JSON.stringify({status:'hub-production-inspected',databaseWrites:0,modelCalls:0,runtime:c.executionProfile,...result}));}catch(e){console.log(JSON.stringify({status:'stopped',code:'INSPECT_CAPABILITY_FAILED'}));process.exitCode=1}finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect()}\n"
print(subprocess.check_output(['docker','exec',api,'node','--input-type=module','-e',node],universal_newlines=True))

import re
parser=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-doc-parser'],universal_newlines=True).strip()
print(subprocess.check_output(['docker','inspect','--format','{{.RestartCount}} {{.State.OOMKilled}} {{.State.StartedAt}} {{.State.Health.Status}}',parser],universal_newlines=True).strip())
probe = '''
import glob,json,time
for sample in range(4):
 rows=[]
 for path in glob.glob('/proc/[0-9]*/cmdline'):
  try:
   with open(path,'rb') as f: args=f.read().split(bytes([0]))
   if len(args)>4 and args[1].endswith(b'/run.py') and args[2:4]==[b'pdf-range',b'--start']:
    rows.append({'startPage':int(args[4])})
  except (OSError,ValueError): pass
 print(json.dumps({'activeRanges':rows,'utcEpoch':int(time.time())}),flush=True)
 if sample < 3: time.sleep(25)
'''
print(subprocess.check_output(['docker','exec',parser,'python','-c',probe],universal_newlines=True,timeout=90))
