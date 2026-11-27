import json
import pathlib
import re
import subprocess

KEYS=('SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM','SMTP_VERIFY_ON_START','HUB_MAIL_MODE')
def fields(lines):
    values={}
    for line in lines:
        key, sep, value=line.partition('=')
        key=key.strip()
        if key.startswith('export '):
            key=key[7:].strip()
        if sep and key in KEYS:
            values[key]=value.strip().strip("'").strip('"')
    result={key:('set' if values.get(key) else 'empty' if key in values else 'absent') for key in KEYS}
    mode=values.get('HUB_MAIL_MODE')
    if mode in ('disabled','capture','smtp'):
        result['HUB_MAIL_MODE']=mode
    return result
def file_fields(path):
    p=pathlib.Path(path)
    return fields(p.read_text().splitlines()) if p.is_file() else None
try:
    ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api'],universal_newlines=True).split()
    if len(ids)!=1 or not re.fullmatch('[a-f0-9]{12,64}',ids[0]):
        raise ValueError('unique container required')
    live=json.loads(subprocess.check_output(['docker','inspect',ids[0]],universal_newlines=True))[0]['Config']
    if not re.fullmatch(r'researchhub-backend:hub-runtime-[0-9a-f]{8}-[0-9]+',live['Image']):
        raise ValueError('unexpected image')
    print(json.dumps({'status':'smtp-config-metadata','image':live['Image'],
        'hubFile':file_fields('/srv/researchhub/ops/.env.prod'),
        'legacyFile':file_fields('/srv/aisci/ops/.env.prod'),
        'hubContainer':fields(live['Env'])}))
except Exception:
    print(json.dumps({'status':'smtp-metadata-unavailable'}))
    raise SystemExit(1)
