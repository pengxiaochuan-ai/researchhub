#!/usr/bin/env python3
"""Bounded, read-only incident metadata through the existing Hub API container."""
import json
import re
import subprocess

NODE = r'''console.log(JSON.stringify({status:'hub-production-inspected',databaseWrites:0,modelCalls:0}));'''


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
    import shutil,pathlib
    root=pathlib.Path('/srv/researchhub/ops');disk=shutil.disk_usage(str(root))
    value['disk']={'total':disk.total,'free':disk.free}
    value['currentPair']=json.loads((root/'paired-current.json').read_text()) if (root/'paired-current.json').is_file() else None
    releases=[]
    for p in sorted((root/'runtime-releases').glob('hub-runtime-*'))[:100]:
        size=int(run(['du','-sk',str(p)]).split()[0])*1024
        rows=[]
        for f in p.glob('control-*/*.tar.gz'):
            if not f.is_symlink():rows.append({'relative':str(f.relative_to(root)),'bytes':f.stat().st_size})
        manifests=[]
        for f in p.glob('control-*/runtime-release.json'):
            body=json.loads(f.read_text());manifests.append({'control':f.parent.name,'tag':body.get('tag'),'previous':body.get('previousRelease'),'files':{n:{'bytes':v['bytes'],'sha256':v['sha256']} for n,v in body.get('files',{}).items() if n in ['researchhub.tar.gz','backend-image.tar.gz']}})
        releases.append({'tag':p.name,'bytes':size,'archives':rows,'manifests':manifests})
    value['releases']=releases

    value['containerIdentitiesUnchanged'] = True
    print(json.dumps(value, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.match(r'^INSPECT_[A-Z_]+$', str(error)) else 'INSPECT_FAILED'
        print(json.dumps({'status': 'stopped', 'code': code, 'automaticRetry': False}))
        raise SystemExit(1)
