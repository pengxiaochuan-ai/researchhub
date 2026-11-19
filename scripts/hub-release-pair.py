#!/usr/bin/env python3
"""Bounded paired replacement of Hub only. Never run a migration or old worker."""
import argparse,fcntl,hashlib,importlib.util,json,os,pathlib,re,signal,subprocess,sys,tempfile,time
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('runtime',str(HERE/('server.py' if (HERE/'server.py').exists() else 'hub-runtime-server.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
need=m.need

def save(path,body):
 with tempfile.NamedTemporaryFile(mode='w',dir=str(path.parent),prefix='.pair-',delete=False) as f:
  temporary=pathlib.Path(f.name);f.write(json.dumps(body,indent=2)+'\n');f.flush();os.fsync(f.fileno())
 try:os.replace(str(temporary),str(path))
 finally:
  if temporary.exists():temporary.unlink()

def identities(release):
 for kind,name in [('backend','backend-image.tar.gz'),('frontend','researchhub.tar.gz')]:
  value=release['images'][kind].get('configId')
  if value is None:
   choices=sorted((m.OPS/'runtime-releases'/release['tag']).glob('control-*/'+name));need(0<len(choices)<=20,'HUB_PAIR_BASELINE_ARCHIVE_REQUIRED')
   for archive in choices:
    if not archive.is_symlink() and m.file_sha(archive)==release['files'][name]['sha256']:
     value=m.canonical_image_id(archive,release[kind+'Image'],release['files'][name]['sha256']);break
  need(re.fullmatch('sha256:[a-f0-9]{64}',value or ''),'HUB_PAIR_CANONICAL_ID_REQUIRED');release['images'][kind]['id']=value
 return release

def pair_matches(items,release,target):
 api=m.live_api(items,release,target);front=m.frontend_container(items,release['images']['frontend']['id']);m.assert_frontend_environment(front)
 need(api['Config']['Image']==release['backendImage'] and front['Config']['Image']==release['frontendImage'],'HUB_PAIR_IMAGE_TAG_MISMATCH')
 return api,front

FRONT_TEMPLATE=HERE/'frontend-compose.yml';BACK_TEMPLATE=HERE/'backend-compose.yml'

def owned_pair(items,release):
 # Recovery accepts our own exited components, never an unknown project/image.
 for kind,project,service in [('backend','researchhub-backend','researchhub-api'),('frontend','researchhub','researchhub')]:
  rows=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')==project]
  need(len(rows)==1 and (rows[0]['Config'].get('Labels') or {}).get('com.docker.compose.service')==service and rows[0]['Image']==release['images'][kind]['id'] and rows[0]['Config']['Image']==release[kind+'Image'],'HUB_PAIR_RECOVERY_OWNERSHIP_REJECTED')
  if kind=='frontend':m.assert_frontend_environment(rows[0])

def front_args():return ['docker','compose','--project-name','researchhub','--env-file',str(m.OPS/'current.env'),'-f',str(FRONT_TEMPLATE)]

def back_args():return ['docker','compose','--project-name','researchhub-backend','--env-file',str(m.OPS/'.env.prod'),'-f',str(BACK_TEMPLATE)]

def wait_api():
 for _ in range(40):
  if m.api_status()=='401':return
  time.sleep(2)
 raise m.Stop('HUB_PAIR_API_NOT_READY')

def healthy():
 wait_api()
 for _ in range(30):
  if m.frontend_status('/health')=='200' and m.frontend_status('/api/auth/me')=='401' and m.frontend_status('/api/hubs/lingshu-xinyu/overview')=='200':return
  time.sleep(2)
 raise m.Stop('HUB_PAIR_FRONTEND_OR_DATA_NOT_READY')

def load_image(path,reference,expected,architecture='amd64'):
 try:
  resident=json.loads(m.command(['docker','image','inspect',reference]))[0]
  if resident['Architecture']==architecture and resident['Id']==expected:return resident
 except m.Stop:pass
 producer=subprocess.Popen(['gzip','-dc',str(path)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 try:
  r=subprocess.run(['docker','load'],stdin=producer.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=300);producer.stdout.close();need(producer.wait(timeout=30)==0 and r.returncode==0,'HUB_PAIR_LOAD_FAILED')
 finally:
  if producer.poll() is None:producer.kill();producer.wait()
 image=json.loads(m.command(['docker','image','inspect',reference]))[0];need(image['Architecture']==architecture and image['Id']==expected,'HUB_PAIR_LOADED_IMAGE_MISMATCH')
 return image

def apply_images(helper,release,template=None,backend_template=None):
 global FRONT_TEMPLATE,BACK_TEMPLATE
 FRONT_TEMPLATE=template or HERE/'frontend-compose.yml';BACK_TEMPLATE=backend_template or HERE/'backend-compose.yml'
 m.command(front_args()+['stop','researchhub'],60)
 m.command(back_args()+['stop','researchhub-api'],60)
 helper.save_config(m.OPS/'.env.prod',{'HUB_BACKEND_IMAGE':release['backendImage']})
 helper.save_config(m.OPS/'current.env',{'RESEARCHHUB_IMAGE':release['frontendImage'],'RESEARCHHUB_PORT':'8083'})
 m.command(back_args()+['up','-d','--no-deps','researchhub-api'],120);wait_api()
 m.command(front_args()+['up','-d','--no-deps','researchhub'],120);healthy()


def release_storage():
 import oss2
 values={}
 for line in (m.OPS/'.env.release').read_text().splitlines():
  key,sep,value=line.partition('=')
  if sep and key in ('S3_ACCESS_KEY','S3_SECRET_KEY','S3_ENDPOINT','S3_BUCKET'):
   need(key not in values,'HUB_PAIR_STORAGE_DUPLICATE');values[key]=m.unquote(value)
 need(len(values)==4,'HUB_PAIR_STORAGE_REQUIRED')
 return oss2.Bucket(oss2.Auth(values['S3_ACCESS_KEY'],values['S3_SECRET_KEY']),values['S3_ENDPOINT'],values['S3_BUCKET'],connect_timeout=15)

def preflight_pointer(control,release,previous):
 store=release_storage()
 try:current=json.loads(store.get_object('releases/researchhub/current-release.json').read())
 except Exception as error:
  if getattr(error,'status',None)!=404:raise
  current=None
 need(current is None and previous['tag']=='hub-runtime-1e0d7087-44502950789' or current and current.get('tag')==previous['tag'] and current.get('manifestSha256')==control['previousManifestSha256'],'HUB_PAIR_SUCCESS_POINTER_CHANGED')
 key='releases/researchhub/'+release['tag']+'/storage-preflight-'+control['imageManifestSha256'][:16]+'.json';raw=json.dumps({'syntheticDeploymentProbe':True,'tag':release['tag']}).encode()
 try:
  store.put_object(key,raw,headers={'x-oss-object-acl':'private'});need(store.get_object(key).read()==raw,'HUB_PAIR_STORAGE_PROBE_MISMATCH')
 except Exception as error:
  if getattr(error,'status',None)==403:raise m.Stop('HUB_PAIR_STORAGE_WRITE_NOT_AUTHORIZED')
  raise

def publish_pointer(control,release,previous):
 store=release_storage();key='releases/researchhub/current-release.json'
 desired={'schema':'researchhub-release-pointer.v1','tag':release['tag'],'manifestSha256':control['imageManifestSha256'],'releaseGit':release.get('releaseGit',release['controlGit']),'components':release.get('components',{})}
 try:current=json.loads(store.get_object(key).read())
 except Exception as error:
  if getattr(error,'status',None)!=404:raise
  current=None
 if current and current.get('manifestSha256')==desired['manifestSha256']:save(m.OPS/'paired-current.json',desired);return
 need(current is None and previous['tag']=='hub-runtime-1e0d7087-44502950789' or current and current.get('tag')==previous['tag'] and current.get('manifestSha256')==control['previousManifestSha256'],'HUB_PAIR_SUCCESS_POINTER_CHANGED')
 raw=(json.dumps(desired,indent=2)+'\n').encode()
 try:store.put_object(key,raw,headers={'x-oss-object-acl':'private'})
 except Exception:
  # A timed-out response does not prove the object write failed.
  need(store.get_object(key).read()==raw,'HUB_PAIR_POINTER_WRITE_STATE_UNKNOWN')
 need(store.get_object(key).read()==raw,'HUB_PAIR_POINTER_READBACK_MISMATCH');save(m.OPS/'paired-current.json',desired)

def run(action,sha):
 need(os.geteuid()==0,'HUB_PAIR_ROOT_REQUIRED');control,release=m.load_release(sha)
 need(control.get('paired') is True,'HUB_PAIR_CONTROL_REQUIRED')
 raw=(HERE/'previous-release.json').read_bytes();need(hashlib.sha256(raw).hexdigest()==control.get('previousManifestSha256'),'HUB_PAIR_BASELINE_DIGEST_MISMATCH');previous=identities(json.loads(raw))
 need(previous['coreDigest']==release['coreDigest'],'HUB_PAIR_CORE_OR_DATABASE_REAPPROVAL_REQUIRED')
 release['images']['frontend']['id']=m.canonical_image_id(HERE/'researchhub.tar.gz',release['frontendImage'],release['files']['researchhub.tar.gz']['sha256'])
 for kind in ('frontend','backend'):
  if release['images'][kind].get('configId'):need(release['images'][kind]['configId']==release['images'][kind]['id'],'HUB_PAIR_MANIFEST_CANONICAL_MISMATCH')
 helper=m.helper_module();saved=helper.read_config(m.OPS/'.env.prod');m.plan_configuration(saved,release,control['target'],{})
 items=m.containers();old_services=m.baseline(items);states=m.task_snapshot(helper,saved)
 need(not re.search(r'^\s*env_file:',(HERE/'frontend-compose.yml').read_text(),re.M),'HUB_PAIR_FRONTEND_ENV_FILE_REJECTED')
 need(m.command(front_args()+['config','--services']).split()==['researchhub'],'HUB_PAIR_FRONTEND_SCOPE_REJECTED');need(m.command(back_args()+['config','--services']).split()==['researchhub-api'],'HUB_PAIR_BACKEND_SCOPE_REJECTED')
 target=control['target'];journal=HERE/'pair-receipt.json';baseline_file=HERE/'pair-baseline.json';previous_template=HERE/'previous-frontend-compose.yml';previous_backend=HERE/'previous-backend-compose.yml'
 if action=='pair-finalize':
  pair_matches(items,release,target);healthy();need(baseline_file.is_file(),'HUB_PAIR_BASELINE_RECEIPT_REQUIRED');baseline=json.loads(baseline_file.read_text());need(m.baseline(m.containers())==baseline['services'],'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(baseline['tasks'],m.task_snapshot(helper,saved));need(journal.is_file() and json.loads(journal.read_text()).get('status') in ('applied','promoted'),'HUB_PAIR_APPLIED_RECEIPT_REQUIRED');publish_pointer(control,release,previous);save(journal,{'status':'promoted','tag':release['tag']});print(json.dumps({'status':'paired-release-complete','tag':release['tag'],'databaseMigrationExecuted':False}));return
 if action=='pair-verify':pair_matches(items,release,target);healthy();print(json.dumps({'status':'paired-release-verified','tag':release['tag']}));return
 need(previous_backend.is_file() and m.file_sha(previous_backend)==control['previousBackendComposeSha256'],'HUB_PAIR_PREVIOUS_BACKEND_TEMPLATE_MISMATCH')
 if action=='pair-rollback':
  try:pair_matches(items,previous,target);healthy();print(json.dumps({'status':'paired-rollback-complete','tag':previous['tag'],'alreadyRestored':True}));return
  except m.Stop:pass
  owned_pair(items,release);need(previous_template.is_file() and m.file_sha(previous_template)==previous['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_ROLLBACK_TEMPLATE_REQUIRED');apply_images(helper,previous,previous_template,previous_backend);(m.OPS/'docker-compose.ecs.yml').write_bytes(previous_template.read_bytes());pair_matches(m.containers(),previous,target)
  need(m.baseline(m.containers())==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(states,m.task_snapshot(helper,saved));save(journal,{'status':'rolled-back','tag':previous['tag']});print(json.dumps({'status':'paired-rollback-complete','tag':previous['tag']}));return
 pair_matches(items,previous,target)
 preflight_pointer(control,release,previous)
 recorded=helper.read_config(m.OPS/'current.env');need(recorded.get('RESEARCHHUB_IMAGE')==previous['frontendImage'] and saved.get('HUB_BACKEND_IMAGE')==previous['backendImage'],'HUB_PAIR_CURRENT_REFERENCE_MISMATCH')
 compose=m.OPS/'docker-compose.ecs.yml';need(compose.is_file() and not compose.is_symlink() and m.file_sha(compose)==previous['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_PREVIOUS_FRONTEND_TEMPLATE_MISMATCH')
 need(previous_template.is_file() and m.file_sha(previous_template)==previous['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_PREVIOUS_FRONTEND_TEMPLATE_MISMATCH')
 need(m.file_sha(HERE/'frontend-compose.yml')==release['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_FRONTEND_TEMPLATE_DIGEST_MISMATCH')
 for kind,name in [('backend','backend-image.tar.gz'),('frontend','researchhub.tar.gz')]:
  image=load_image(HERE/name,release[kind+'Image'],release['images'][kind]['id'])
  if kind=='frontend':m.assert_frontend_environment(image)
 if baseline_file.exists():
  baseline=json.loads(baseline_file.read_text());need(baseline['services']==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(baseline['tasks'],states)
 else:save(baseline_file,{'services':old_services,'tasks':states})
 save(journal,{'status':'prepared','tag':release['tag'],'previousTag':previous['tag'],'manifestSha256':control['imageManifestSha256']})
 accepted=False
 try:
  apply_images(helper,release);pair_matches(m.containers(),release,target)
  need(m.baseline(m.containers())==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(states,m.task_snapshot(helper,saved))
  # Keep the established operator-facing Compose path aligned without secrets.
  with tempfile.NamedTemporaryFile(dir=str(m.OPS),prefix='.front-compose-',delete=False) as f:f.write((HERE/'frontend-compose.yml').read_bytes());temporary=pathlib.Path(f.name)
  os.replace(str(temporary),str(compose));save(journal,{'status':'applied','tag':release['tag'],'previousTag':previous['tag'],'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'databaseMigrationExecuted':False})
  accepted=True;print(json.dumps({'status':'paired-release-applied','tag':release['tag'],'frontendStatus':200,'apiStatus':401,'publicDataStatus':200,'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'databaseMigrationExecuted':False}))
 finally:
  if not accepted:
   try:
    apply_images(helper,previous,previous_template,previous_backend);compose.write_bytes(previous_template.read_bytes());pair_matches(m.containers(),previous,target);need(m.baseline(m.containers())==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(states,m.task_snapshot(helper,saved));save(journal,{'status':'rolled-back','tag':previous['tag']});print(json.dumps({'status':'paired-rollback-complete','tag':previous['tag']}))
   except BaseException:save(journal,{'status':'unknown','tag':release['tag'],'previousTag':previous['tag']});raise m.Stop('HUB_PAIR_ROLLBACK_STATE_UNKNOWN_RECHECK_REQUIRED')

def main():
 signal.signal(signal.SIGTERM,lambda *_:sys.exit(130));p=argparse.ArgumentParser();p.add_argument('action',choices=['pair-release','pair-rollback','pair-verify','pair-finalize']);p.add_argument('--control-sha',required=True);a=p.parse_args()
 locks=[]
 try:
  for name in ('hub-runtime-release.lock','release.lock'):
   fd=os.open(str(m.OPS/name),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600);locks.append(fd);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  run(a.action,a.control_sha)
 finally:
  for fd in locks:os.close(fd)
if __name__=='__main__':
 try:main()
 except BaseException as e:
  print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,m.Stop) else 'HUB_PAIR_FAILED_RECHECK_STATE','kind':type(e).__name__,'automaticRetry':False}));raise SystemExit(1)
