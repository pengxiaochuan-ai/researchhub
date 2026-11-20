#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';
let prisma;try{const config=readResearchRuntimeConfig(process.env),tenant='rh-kb-local-b0e2af9d-tenant';assert(config.identity.database==='researchhub'&&config.identity.tenantId===tenant);const{load}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:config.identity});const result=await withDeploymentTransaction(env,'direct',async tx=>{const job=await tx.knowledgeChatJob.findUnique({where:{id:'cmwp2d1dz0008oi077zie5a6q'},select:{id:true,tenantId:true,accountId:true,sessionId:true,requestKey:true,status:true,attempts:true,assistantMessageId:true}});assert(job.tenantId===tenant&&job.accountId===tenant.replace(/-tenant$/,'-admin')&&job.status==='completed');const reservation=await tx.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:tenant,requestKey:'chat:'+job.sessionId+':'+job.requestKey}},select:{id:true,status:true,actualTokens:true}});assert(reservation.status==='settled');const events=await tx.auditLog.findMany({where:{tenantId:tenant,target:reservation.id,action:{in:['hub.token.attempt.started','hub.token.attempt.completed','hub.token.attempt.unknown']}},select:{action:true,meta:true}});const counts=Object.fromEntries(['started','completed','unknown'].map(k=>[k,events.filter(e=>e.action==='hub.token.attempt.'+k).length]));assert(counts.started===1&&counts.completed===1&&counts.unknown===0);const old=JSON.parse(fs.readFileSync('/run/researchhub-admission/admission.json'));assert(old.historicalChatIds.length===623);const[history]=await tx.$queryRaw`SELECT count(*)::int AS count,count(*) FILTER(WHERE status='queued')::int AS queued,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=${tenant} AND id=ANY(${old.historicalChatIds}::text[])`;assert(history.count===623&&history.queued===175&&history.hash==='735bdccbbc401c67285f0dd9714a2bed');const ledgerSha256=createHash('sha256').update(fs.readFileSync('/run/researchhub-ai-ledger/budget.json')).digest('hex');assert(ledgerSha256==='8c4840344ddc553ac1436ae59f2da336eb2480bbec0633050e55588cf38aedd1');return{job,reservation:{status:reservation.status,actualTokens:String(reservation.actualTokens)},attempts:counts,history,ledgerSha256};},{readOnly:true});console.log(JSON.stringify({status:'hub-production-inspected',databaseWrites:0,modelCalls:0,workersStarted:0,...result}));}catch(e){console.log(JSON.stringify({status:'stopped',code:'INSPECT_ARTICLE_FINAL_FAILED'}));process.exitCode=1}finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect()}

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
