"""Existing Cloud Assistant: Hub deployment metadata only, no DB/service writes."""
import json,pathlib,platform,subprocess,shutil,os,re

def command(args):
    return subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=20,check=True).stdout

def container_metadata(item):
    cfg=item['Config'];labels=cfg.get('Labels') or {};env={line.partition('=')[0] for line in cfg.get('Env') or []}
    return {'name':item['Name'],'image':cfg.get('Image'),'project':labels.get('com.docker.compose.project'),'service':labels.get('com.docker.compose.service'),'status':item['State'].get('Status'),'ports':item.get('NetworkSettings',{}).get('Ports',{}),'networks':list(item.get('NetworkSettings',{}).get('Networks',{})),'memoryLimit':item.get('HostConfig',{}).get('Memory'),'storageKeysPresent':sorted(env&{'S3_ENDPOINT','S3_ACCESS_KEY','S3_SECRET_KEY','S3_BUCKET'}),'hubProxyConfigured':'HUB_API_UPSTREAM' in env}

def config_metadata(path):
    out={'exists':path.exists()}
    if not out['exists']:return out
    out['private']=not path.is_symlink() and path.is_file() and path.stat().st_mode&0o077==0
    if not out['private'] or path.stat().st_size>65536:return out
    patterns={'VITE_AUTH_TENANT_SLUG':r'[a-z0-9-]{1,100}','HUB_DATABASE_NAME':r'researchhub','HUB_DATABASE_MARKER_SHA256':r'[a-f0-9]{64}','HUB_SCHEMA_FINGERPRINT':r'[a-f0-9]{32}','DEFAULT_TENANT_ID':r'[A-Za-z0-9_-]{1,160}','HUB_SOURCE_REVIEWER_ACCOUNT_ID':r'[A-Za-z0-9_-]{1,160}'}
    for line in path.read_text(encoding='utf-8').splitlines():
        key,sep,value=line.partition('=')
        if sep and key in patterns and re.fullmatch(patterns[key],value):out[key]=value
    return out

def main():
    ids=command(['docker','ps','-q']).split();items=json.loads(command(['docker','inspect']+ids)) if ids else []
    containers=[container_metadata(c) for c in items if (c['Config'].get('Labels') or {}).get('com.docker.compose.project') in ('researchhub','ops','official-site','researchhub-backend')]
    mem={}
    for line in pathlib.Path('/proc/meminfo').read_text().splitlines():
        key,_,value=line.partition(':')
        if key in ('MemTotal','MemAvailable'):mem[key+'KB']=int(value.split()[0])
    disk=shutil.disk_usage('/srv/researchhub');source=pathlib.Path('/srv/researchhub/ops/.env.release')
    keys=[]
    if source.is_file() and not source.is_symlink() and source.stat().st_size<65536:
        keys=sorted({line.partition('=')[0] for line in source.read_text().splitlines()}&{'S3_ENDPOINT','S3_ACCESS_KEY','S3_SECRET_KEY','S3_BUCKET'})
    result={'schema':'hub-runtime-preflight.v1','architecture':platform.machine(),'python':platform.python_version(),'memory':mem,'diskFreeBytes':disk.free,'containers':containers,'databaseConfig':config_metadata(pathlib.Path('/srv/researchhub/ops/backend-private/database.env')),'releaseStorageKeysPresent':keys,'releaseTransferPresent':pathlib.Path('/srv/researchhub/ops/oss-release-transfer.py').is_file(),'databaseQueries':0,'writes':0}
    print(json.dumps(result))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'status':'stopped','code':'HUB_RUNTIME_METADATA_FAILED','kind':type(error).__name__ if isinstance(error,(OSError,ValueError,KeyError,subprocess.SubprocessError)) else 'UnexpectedError'}));raise SystemExit(1)
