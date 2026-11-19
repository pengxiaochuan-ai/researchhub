"""Cloud Assistant bootstrap. Only Hub files and reviewed Hub components."""
import hashlib,json,os,pathlib,re,subprocess,sys,tempfile
OPS=pathlib.Path('/srv/researchhub/ops')

def need(ok,code):
 if not ok:raise ValueError(code)

def read_release_storage():
 p=OPS/'.env.release';need(p.is_file() and not p.is_symlink() and p.stat().st_mode&0o022==0 and p.stat().st_size<65536,'HUB_RELEASE_STORAGE_CONFIG_REJECTED');values={}
 for line in p.read_text().splitlines():
  m=re.match(r'^\s*(?:export\s+)?(S3_ENDPOINT|S3_BUCKET|S3_ACCESS_KEY|S3_SECRET_KEY)\s*=\s*(.*?)\s*$',line)
  if m:
   key,value=m.groups()
   if len(value)>1 and value[0] in ('"',"'") and value[-1]==value[0]:value=value[1:-1]
   need(key not in values,'HUB_RELEASE_STORAGE_DUPLICATE');values[key]=value
 need(len(values)==4 and all(values.values()),'HUB_RELEASE_STORAGE_MISSING');return values

def file_sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()

def fetch(store,key,path,sha):
 if path.exists():need(path.is_file() and not path.is_symlink() and file_sha(path)==sha,'HUB_CONTROL_EXISTING_FILE_MISMATCH');return
 temporary=None
 try:
  with tempfile.NamedTemporaryFile(prefix='.download-',dir=str(path.parent),delete=False) as f:temporary=pathlib.Path(f.name)
  store.get_object_to_file(key,str(temporary));need(file_sha(temporary)==sha,'HUB_DOWNLOAD_DIGEST_MISMATCH');os.link(str(temporary),str(path))
 finally:
  if temporary is not None:temporary.unlink()

def main():
 import oss2
 os.umask(0o077);need(os.geteuid()==0,'HUB_BOOTSTRAP_ROOT_REQUIRED');need(OPS.resolve()==OPS,'HUB_RUNTIME_OPS_PATH_REJECTED');tag=os.environ['HUB_RUNTIME_TAG'];sha=os.environ['HUB_RUNTIME_CONTROL_SHA256'];action=os.environ['HUB_RUNTIME_ACTION']
 need(re.fullmatch('hub-runtime-[a-f0-9]{8}-[0-9]+',tag) and re.fullmatch('[a-f0-9]{64}',sha) and action in ('activate','verify','activate-front'),'HUB_BOOTSTRAP_INPUT_REJECTED')
 v=read_release_storage();endpoint=v['S3_ENDPOINT'].replace('https://','').replace('http://','').rstrip('/');need(re.fullmatch(r'oss-[a-z0-9-]+\.aliyuncs\.com',endpoint),'HUB_RELEASE_ENDPOINT_REJECTED')
 store=oss2.Bucket(oss2.Auth(v['S3_ACCESS_KEY'],v['S3_SECRET_KEY']),'https://'+endpoint,v['S3_BUCKET'],connect_timeout=15)
 directory=OPS/'runtime-releases'/tag/('control-'+sha[:16])
 for part in (OPS/'runtime-releases',OPS/'runtime-releases'/tag,directory):
  if not part.exists():part.mkdir(mode=0o700)
  need(part.is_dir() and not part.is_symlink() and part.stat().st_uid==0 and part.stat().st_mode&0o077==0,'HUB_RUNTIME_DIRECTORY_NOT_PRIVATE')
 prefix='releases/researchhub/'+tag+'/runtime-controls-'+sha[:16]+'/'
 fetch(store,prefix+'control-manifest.json',directory/'control-manifest.json',sha);control=json.loads((directory/'control-manifest.json').read_text())
 expected={'server.py','database-config.py','run-server.py','backend-compose.yml','runtime-release.json','ecs-release.sh'}
 need(control.get('schema')=='researchhub-runtime-controls.v1' and control.get('tag')==tag and set(control.get('files',{}))==expected,'HUB_RUNTIME_CONTROL_INVENTORY_REJECTED')
 for name,item in control['files'].items():
  need(re.fullmatch('[a-f0-9]{64}',item.get('sha256','')) and 0<item.get('bytes',0)<2*1024*1024,'HUB_RUNTIME_CONTROL_ENTRY_REJECTED')
  fetch(store,prefix+name,directory/name,item['sha256'])
 release=json.loads((directory/'runtime-release.json').read_text());need(release.get('tag')==tag and file_sha(directory/'runtime-release.json')==control.get('imageManifestSha256'),'HUB_RUNTIME_IMAGE_MANIFEST_MISMATCH')
 if action=='activate':fetch(store,'releases/researchhub/'+tag+'/backend-image.tar.gz',directory/'backend-image.tar.gz',release['files']['backend-image.tar.gz']['sha256'])
 for name in ('server.py','ecs-release.sh'):(directory/name).chmod(0o750)
 child=subprocess.Popen([sys.executable,str(directory/'server.py'),action,'--control-sha',sha],stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True)
 try:output,_=child.communicate(timeout=720)
 except subprocess.TimeoutExpired:
  child.terminate()
  try:output,_=child.communicate(timeout=45)
  except subprocess.TimeoutExpired:
   child.kill();child.communicate();raise ValueError('HUB_RUNTIME_TIMEOUT_STATE_UNKNOWN_RECHECK_REQUIRED')
  raise ValueError('HUB_RUNTIME_TIMEOUT_CLEANUP_REQUESTED_RECHECK_REQUIRED')
 for line in output.splitlines():
  if line.startswith('{'):
   try:print(json.dumps(json.loads(line)),flush=True)
   except ValueError:pass
 need(child.returncode==0,'HUB_RUNTIME_CHILD_FAILED_RECHECK_STATE')
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,ValueError) and str(e).startswith('HUB_') else 'HUB_RUNTIME_BOOTSTRAP_FAILED','kind':type(e).__name__,'automaticRetry':False}));raise SystemExit(1)
