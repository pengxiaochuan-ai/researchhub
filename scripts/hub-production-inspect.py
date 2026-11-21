#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''
import assert from'node:assert/strict';import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';let prisma;try{const c=readResearchRuntimeConfig(process.env),tenant='rh-kb-local-b0e2af9d-tenant';assert(c.identity.database==='researchhub'&&c.identity.tenantId===tenant);const{load}=runtimeDependencies(c.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:c.identity});const result=await withDeploymentTransaction(env,'direct',async tx=>{const tables=await tx.$queryRawUnsafe(`SELECT c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,
ARRAY(SELECT conname||':'||contype::text||':'||convalidated::text FROM pg_constraint WHERE conrelid=c.oid ORDER BY conname) AS constraints,
ARRAY(SELECT polname||':'||polcmd::text FROM pg_policy WHERE polrelid=c.oid ORDER BY polname) AS policies,
ARRAY(SELECT tgname FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal ORDER BY tgname) AS triggers,
ARRAY(SELECT permission FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) permission WHERE has_table_privilege('researchhub_demo_app',c.oid,permission)) AS grants
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relkind='r' AND c.relname ~ '^(research_data_|subject_profile_|session_media_|session_materials$)' ORDER BY c.relname`);return {tables};},{readOnly:true});console.log(JSON.stringify({status:'hub-production-inspected',databaseWrites:0,modelCalls:0,runtime:c.executionProfile,...result}));}catch(e){console.log(JSON.stringify({status:'stopped',code:'INSPECT_CAPABILITY_FAILED'}));process.exitCode=1}finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect()}

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
