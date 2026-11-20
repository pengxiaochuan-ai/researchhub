"""Existing Cloud Assistant: Hub deployment metadata only, no DB/service writes."""
import json,pathlib,platform,subprocess,shutil,os,re,hashlib,tarfile

def command(args):
    return subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=20,check=True).stdout

def container_metadata(item):
    cfg=item['Config'];labels=cfg.get('Labels') or {};env={line.partition('=')[0] for line in cfg.get('Env') or []}
    return {'name':item['Name'],'image':cfg.get('Image'),'imageId':item.get('Image'),'project':labels.get('com.docker.compose.project'),'service':labels.get('com.docker.compose.service'),'status':item['State'].get('Status'),'ports':item.get('NetworkSettings',{}).get('Ports',{}),'networks':list(item.get('NetworkSettings',{}).get('Networks',{})),'memoryLimit':item.get('HostConfig',{}).get('Memory'),'storageKeysPresent':sorted(env&{'S3_ENDPOINT','S3_ACCESS_KEY','S3_SECRET_KEY','S3_BUCKET'}),'hubProxyConfigured':'HUB_API_UPSTREAM' in env}

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


def image_transfer_metadata():
    tag='hub-runtime-1e0d7087-44502950789';result={}
    r=command(['docker','image','inspect','researchhub-backend:'+tag]);image=json.loads(r)[0]
    result.update(loadedId=image['Id'],architecture=image['Architecture'])
    directory=pathlib.Path('/srv/researchhub/ops/runtime-releases')/tag
    for folder in directory.glob('control-*'):
        archive=folder/'backend-image.tar.gz';manifest=folder/'runtime-release.json'
        if not archive.is_file() or not manifest.is_file():continue
        release=json.loads(manifest.read_text());result['buildId']=release['images']['backend']['id'];configs={};entries=[]
        with tarfile.open(str(archive),'r|gz') as source:
            for member in source:
                if not member.isfile() or member.size>2*1024*1024:continue
                if member.name=='manifest.json' or re.fullmatch(r'(?:blobs/sha256/)?[a-f0-9]{64}(?:.json)?',member.name):
                    raw=source.extractfile(member).read()
                    try:body=json.loads(raw)
                    except ValueError:continue
                    if member.name=='manifest.json':entries=body
                    elif isinstance(body,dict) and 'rootfs' in body and body.get('os')=='linux':configs[member.name]='sha256:'+hashlib.sha256(raw).hexdigest()
        result['archiveConfigs']=[{'id':configs.get(x.get('Config')),'tags':x.get('RepoTags')} for x in entries]
        break
    return result

def vector_metadata(items):
    own=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub-backend' and (x['Config'].get('Labels') or {}).get('com.docker.compose.service')=='researchhub-api']
    if len(own)!=1:raise ValueError('owned api required')
    code="""const {createRequire}=require('node:module');(async()=>{const req=createRequire(process.env.HUB_CORE_DIR+'/package.json'),{PrismaClient}=req('@prisma/client'),out=[];for(const key of ['DATABASE_URL','DIRECT_URL']){const url=process.env[key];if(new URL(url).pathname!=='/researchhub')throw Error('target');const db=new PrismaClient({datasources:{db:{url}}});try{const rows=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5000ms'");return tx.$queryRawUnsafe("SELECT current_database() AS database,current_user AS role,current_setting('search_path') AS search_path,to_regtype('vector') IS NOT NULL AS type_visible,(SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector') AS extension_schema")});out.push({binding:key,...rows[0]})}finally{await db.$disconnect()}}console.log(JSON.stringify(out))})().catch(()=>{console.error('HUB_VECTOR_METADATA_FAILED');process.exitCode=1})"""
    return json.loads(command(['docker','exec',own[0]['Id'],'node','-e',code]))

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
    result={'imageTransfer':image_transfer_metadata(),'schema':'hub-runtime-preflight.v1','architecture':platform.machine(),'python':platform.python_version(),'memory':mem,'diskFreeBytes':disk.free,'containers':containers,'databaseConfig':config_metadata(pathlib.Path('/srv/researchhub/ops/.env.prod')),'releaseStorageKeysPresent':keys,'releaseTransferPresent':pathlib.Path('/srv/researchhub/ops/oss-release-transfer.py').is_file(),'vectorMetadata':vector_metadata(items),'databaseQueries':2,'writes':0}
    print(json.dumps(result))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'status':'stopped','code':'HUB_RUNTIME_METADATA_FAILED','kind':type(error).__name__ if isinstance(error,(OSError,ValueError,KeyError,subprocess.SubprocessError)) else 'UnexpectedError'}));raise SystemExit(1)
