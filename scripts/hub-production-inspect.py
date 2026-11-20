import pathlib,os,re,json,hashlib,fcntl,shutil,subprocess,oss2
OPS=pathlib.Path('/srv/researchhub/ops')
TARGETS={
 'hub-runtime-017d2967-44682997314001':{'control':'control-d1af571da654b409','files':{'researchhub.tar.gz':(104157081,'88a6e0938f9618de925cc40af02f594f812565a91421d51dfa3e30b687b9cd82'),'backend-image.tar.gz':(307228950,'830412a5a71ccf084c0536898384d4c3f5f3ea54e166df506eacc5f271fb9d26')}},
 'hub-runtime-1546ac1a-44593900870001':{'control':'control-a40cfd7752f6b53c','files':{'researchhub.tar.gz':(105614987,'242ff07d5c53f2676da66a6b3e2f8799a4f775d1cf3bca1a0bc2798606ea4a37'),'backend-image.tar.gz':(307212529,'e4c0d68a1fba77bd2c632327af001edf6c8bd9402cb4db6a2809f5d93f35cfcd')}}}
def need(value):
 if not value:raise ValueError('HUB_EXACT_CACHE_STATE_CHANGED')
def sha_stream(f):
 h=hashlib.sha256()
 while True:
  b=f.read(1024*1024)
  if not b:break
  h.update(b)
 return h.hexdigest()
def containers():return subprocess.check_output(['docker','ps','--format','{{.ID}} {{.Image}}']).decode().strip()
locks=[]
try:
 need(OPS.resolve()==OPS and os.geteuid()==0)
 for name in ('hub-runtime-release.lock','release.lock'):
  fd=os.open(str(OPS/name),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600);locks.append(fd);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 before=containers();pointer=json.loads((OPS/'paired-current.json').read_text());need(pointer['tag']=='hub-runtime-5c3819c8-44747638591001');need(all(tag not in before for tag in TARGETS))
 current=list((OPS/'runtime-releases'/pointer['tag']).glob('control-*/runtime-release.json'));need(len(current)==1);previous=json.loads(current[0].read_text())['previousRelease']['tag'];need(previous=='hub-runtime-095b6f39-44724477247001')
 config={}
 for line in (OPS/'.env.release').read_text().splitlines():
  m=re.match(r'^\s*(?:export\s+)?(S3_ENDPOINT|S3_BUCKET|S3_ACCESS_KEY|S3_SECRET_KEY)\s*=\s*(.*?)\s*$',line)
  if m:
   k,v=m.groups();v=v.strip('"\'');need(k not in config);config[k]=v
 need(len(config)==4);endpoint=config['S3_ENDPOINT'].replace('https://','').replace('http://','').rstrip('/');need(re.fullmatch('oss-[a-z0-9-]+.aliyuncs.com',endpoint));store=oss2.Bucket(oss2.Auth(config['S3_ACCESS_KEY'],config['S3_SECRET_KEY']),'https://'+endpoint,config['S3_BUCKET'],connect_timeout=15)
 verified=[]
 for tag,entry in TARGETS.items():
  directory=OPS/'runtime-releases'/tag/entry['control'];need(directory.resolve()==directory)
  local=json.loads((directory/'runtime-release.json').read_text());remote=json.loads(store.get_object('releases/researchhub/'+tag+'/runtime-release.json').read());need(local==remote and remote['tag']==tag)
  for name,(size,sha) in entry['files'].items():
   p=directory/name;need(p.is_file() and not p.is_symlink() and p.stat().st_uid==0 and p.stat().st_size==size);need(remote['files'][name]['bytes']==size and remote['files'][name]['sha256']==sha)
   with p.open('rb') as f:need(sha_stream(f)==sha)
   object=store.get_object('releases/researchhub/'+tag+'/'+name);need(sha_stream(object)==sha);verified.append((p,size,sha,p.stat().st_ino))
 need(len(verified)==4 and containers()==before);need(json.loads((OPS/'paired-current.json').read_text())==pointer)
 before_free=shutil.disk_usage(str(OPS)).free
 for p,size,sha,inode in verified:need(p.is_file() and not p.is_symlink() and p.stat().st_ino==inode and p.stat().st_size==size)
 # Every local and remote object is verified before the first cache unlink.
 receipt={'schema':'hub-exact-cache-recovery.v1','files':[{'relative':str(p.relative_to(OPS)),'bytes':size,'sha256':sha,'ossKey':'releases/researchhub/'+p.parents[1].name+'/'+p.name} for p,size,sha,inode in verified]}
 log=OPS/'cache-recovery-20261120.json';need(not log.exists());fd=os.open(str(log),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(receipt,f);f.flush();os.fsync(f.fileno())
 for p,size,sha,inode in verified:p.unlink()
 need(containers()==before);free=shutil.disk_usage(str(OPS)).free
 print(json.dumps({'status':'hub-exact-cache-reclaimed','files':4,'bytes':sum(x[1] for x in verified),'freeBefore':before_free,'freeAfter':free,'currentAndRollbackRetained':True,'containerIdentitiesUnchanged':True,'databaseWrites':0,'modelCalls':0,'recoveryReceipt':str(log)}))
except Exception as e:
 print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,ValueError) else type(e).__name__,'automaticRetry':False}));raise SystemExit(1)
finally:
 for fd in locks:os.close(fd)
