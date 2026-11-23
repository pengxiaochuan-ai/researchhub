import fcntl,hashlib,json,os,pathlib,re,shutil,subprocess
import oss2
OPS=pathlib.Path('/srv/researchhub/ops')
plan=json.loads('{"targets":[{"path":"runtime-releases/hub-runtime-1582f4ba-44873983076001/control-a5f91d2ad4ddc56e/backend-image.tar.gz","size":368851467,"blocksBytes":368857088,"sha":"780392e57e1296985e71124f389b5d9fd9dad4dc3d04e5ee3b6d27a255f86388"}],"protected":["hub-runtime-33a9ffd3-45155206512001","hub-runtime-48f935ad-45144932245001","hub-runtime-be32ffdb-45145871325001"],"required":6187951972}')
candidate_tag='hub-runtime-33a9ffd3-45155206512001'
prefix='releases/researchhub/'
candidate=OPS/'runtime-releases'/candidate_tag/'control-bdb3f76d4f1a580e'
names={'researchhub.tar.gz','backend-image.tar.gz'}
def require(ok):
 if not ok:raise ValueError('HUB_EXACT_CACHE_STATE_CHANGED')
def read(path):
 require(path.resolve()==path and path.is_file() and path.stat().st_uid==0 and path.stat().st_size<2097152)
 return path.read_bytes()
def hashfile(file):
 digest=hashlib.sha256()
 for block in iter(lambda:file.read(1048576),b''):digest.update(block)
 return digest.hexdigest()
def containers():
 return subprocess.check_output(['docker','ps','-a','--format','{{.ID}} {{.Image}} {{.State}}'],universal_newlines=True).splitlines()
def identity(path):
 require(path.resolve()==path and path.is_file())
 s=path.stat()
 require(s.st_uid==0 and s.st_nlink==1)
 return s.st_ino,s.st_size,s.st_mtime_ns
def store_for_hub():
 config={}
 envpath=OPS/'.env.release'
 require(envpath.stat().st_mode&0o022==0)
 for line in read(envpath).decode().splitlines():
  m=re.match(r'^\s*(?:export\s+)?(S3_ENDPOINT|S3_BUCKET|S3_ACCESS_KEY|S3_SECRET_KEY)\s*=\s*(.*?)\s*$',line)
  if m:
   key,value=m.groups()
   require(key not in config)
   config[key]=value.strip('"\'')
 require(len(config)==4 and all(config.values()))
 endpoint=config['S3_ENDPOINT'].replace('https://','',1).replace('http://','',1).rstrip('/')
 require(re.fullmatch(r'oss-[a-z0-9-]+\.aliyuncs\.com',endpoint))
 return oss2.Bucket(oss2.Auth(config['S3_ACCESS_KEY'],config['S3_SECRET_KEY']),'https://'+endpoint,config['S3_BUCKET'],connect_timeout=15)

locks=[]
try:
 require(OPS.resolve()==OPS and os.geteuid()==0)
 for name in ('hub-runtime-release.lock','release.lock'):
  fd=os.open(OPS/name,os.O_WRONLY|os.O_CREAT|os.O_NOFOLLOW,0o600)
  locks.append(fd)
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 pointer_path=OPS/'paired-current.json'
 pointer_raw=read(pointer_path)
 pointer=json.loads(pointer_raw)
 before_containers=containers()
 controls_raw=read(candidate/'control-manifest.json')
 controls=json.loads(controls_raw)
 require(hashlib.sha256(controls_raw).hexdigest()=='bdb3f76d4f1a580ebd392faabf041271fdf4542d8d921c74adb87374d4d8f637')
 candidate_raw=read(candidate/'runtime-release.json')
 require(hashlib.sha256(candidate_raw).hexdigest()==controls['imageManifestSha256'])
 candidate_release=json.loads(candidate_raw)
 prev_raw=read(candidate/'previous-release.json')
 require(hashlib.sha256(prev_raw).hexdigest()==pointer['manifestSha256']==controls['previousManifestSha256'])
 prev=json.loads(prev_raw)
 require(candidate_release['tag']==candidate_tag and candidate_release['previousRelease']['tag']==pointer['tag']==prev['tag'])
 protected={candidate_tag,pointer['tag'],prev['previousRelease']['tag']}
 require(protected==set(plan['protected']))
 required=4*1024**3+4*sum(candidate_release['files'][name]['bytes'] for name in names)
 require(required==plan['required'])
 store=store_for_hub()
 require(json.loads(store.get_object(prefix+'current-release.json').read())==pointer)
 verified=[]
 if shutil.disk_usage(OPS).free<=required:
  for item in plan['targets']:
   relative=pathlib.PurePosixPath(item['path'])
   root,tag,control,name=relative.parts
   require(root=='runtime-releases' and re.fullmatch(r'hub-runtime-[a-f0-9]{8}-\d+',tag) and re.fullmatch(r'control-[a-f0-9]{16}',control))
   require(name in names and tag not in protected and all(tag not in row for row in before_containers))
   path=OPS.joinpath(*relative.parts)
   local=read(path.parent/'runtime-release.json')
   require(store.get_object(prefix+tag+'/runtime-release.json').read()==local)
   manifest=json.loads(local)
   file=manifest['files'][name]
   require(manifest['tag']==tag and file['bytes']==item['size'] and file['sha256']==item['sha'])
   key=prefix+tag+'/'+name
   stamp=identity(path)
   require(stamp[1]==item['size'])
   with path.open('rb') as stream:require(hashfile(stream)==item['sha'])
   require(hashfile(store.get_object(key))==item['sha'])
   verified.append((path,stamp,{**item,'ossKey':key}))
 before_free=shutil.disk_usage(OPS).free
 if before_free>required:
  print(json.dumps({'status':'space-available','free':before_free,'required':required}))
 else:
  require(verified and all(identity(p)==stamp for p,stamp,_ in verified))
  require(read(pointer_path)==pointer_raw and containers()==before_containers and json.loads(store.get_object(prefix+'current-release.json').read())==pointer)
  require(before_free+sum(v[2]['blocksBytes'] for v in verified)>required)
  receipt=OPS/'cache-recovery-p01-h01-20261123.json'
  fd=os.open(receipt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'w') as file:
   json.dump({'schema':'hub-exact-cache-recovery.v1','files':[v[2] for v in verified],'protected':sorted(protected),'required':required},file)
   file.flush()
   os.fsync(file.fileno())
  for path,_,_ in verified:path.unlink()
  free=shutil.disk_usage(OPS).free
  require(free>required and containers()==before_containers and read(pointer_path)==pointer_raw)
  print(json.dumps({'status':'cache-recovered','count':len(verified),'freeBefore':before_free,'freeAfter':free,'required':required,'rollbackRetained':True,'receipt':str(receipt)}))
except Exception as error:
 print(json.dumps({'status':'stopped','code':str(error) if isinstance(error,ValueError) and str(error).startswith('HUB_EXACT_') else type(error).__name__}))
 raise SystemExit(1)
finally:
 for fd in locks:os.close(fd)
