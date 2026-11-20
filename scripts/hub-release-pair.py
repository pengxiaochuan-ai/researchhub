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

def backend_unchanged(previous,release):
 def field(value,*path):
  for key in path:
   if not isinstance(value,dict):return None
   value=value.get(key)
  return value
 paths=[('backendImage',),('coreDigest',),('hubDigest',),('images','backend','configId'),('files','backend-image.tar.gz'),('files','backend-compose.yml')]
 same=all(field(previous,*path) is not None and field(previous,*path)==field(release,*path) for path in paths)
 same=same and (field(previous,'components','backend','sourceGit') or previous.get('controlGit'))==(field(release,'components','backend','sourceGit') or release.get('controlGit'))
 same=same and previous.get('supportedBudgetExtensions',[])==release.get('supportedBudgetExtensions',[])
 same=same and previous.get('supportedExecutionProfiles',['disabled'])==release.get('supportedExecutionProfiles',['disabled'])
 need(field(release,'components','backend','built') is not False or same,'HUB_PAIR_REUSED_BACKEND_IDENTITY_CHANGED')
 return bool(same)

def backend_snapshot(items,release,target):
 api=m.live_api(items,release,target)
 return {'containerId':api['Id'],'imageId':api['Image'],'imageRef':api['Config']['Image'],
  'configSha256':hashlib.sha256(json.dumps(api['Config'],sort_keys=True,separators=(',',':')).encode()).hexdigest(),
  'startedAt':api['State']['StartedAt'],'restartCount':api.get('RestartCount',0),'envProdSha256':m.file_sha(m.OPS/'.env.prod')}

def backend_configuration_context(previous,release,saved,keep_backend):
 if not keep_backend:return release
 # This validates the running backend, not a proposed execution-policy change.
 # support still rejects unknown profiles, inconsistent workers and unsupported
 # cores; the sealed admission/ledger and immutable runtime are checked below.
 state=m.execution.support(previous,saved)
 match=re.fullmatch(r'researchhub-backend:(hub-runtime-[a-f0-9]{8}-[0-9]+)',previous.get('backendImage',''))
 need(match is not None,'HUB_RUNTIME_IMAGE_REJECTED')
 context=dict(previous,tag=match.group(1))
 context['executionPolicy']={'profile':state['HUB_EXECUTION_PROFILE']}
 if state['HUB_EXECUTION_PROFILE']!='disabled':context['executionPolicy']['admissionSha256']=state['HUB_CHAT_ADMISSION_SHA256']
 return context

FRONT_TEMPLATE=HERE/'frontend-compose.yml';BACK_TEMPLATE=HERE/'backend-compose.yml'

def owned_pair(items,release):
 # Recovery accepts our own exited components, never an unknown project/image.
 for kind,project,service in [('backend','researchhub-backend','researchhub-api'),('frontend','researchhub','researchhub')]:
  rows=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')==project]
  need(len(rows)==1 and (rows[0]['Config'].get('Labels') or {}).get('com.docker.compose.service')==service and rows[0]['Image']==release['images'][kind]['id'] and rows[0]['Config']['Image']==release[kind+'Image'],'HUB_PAIR_RECOVERY_OWNERSHIP_REJECTED')
  if kind=='frontend':m.assert_frontend_environment(rows[0])

def front_args():return ['docker','compose','--project-name','researchhub','--env-file',str(m.OPS/'current.env'),'-f',str(FRONT_TEMPLATE)]

def back_args():return ['docker','compose','--project-name','researchhub-backend','--env-file',str(m.OPS/'.env.prod'),'-f',str(BACK_TEMPLATE)]


def check_environments(front,back,saved):
 allowed={'NODE_ENV','HOST','PORT','HUB_API_UPSTREAM','HUB_API_AUTHORITY'}
 need(set(front)<=allowed,'HUB_PAIR_FRONTEND_ENVIRONMENT_REJECTED')
 fixed=m.execution.values(saved)
 need(all(back.get(k,'disabled' if k=='HUB_EXECUTION_PROFILE' else None)==v for k,v in fixed.items()),'HUB_PAIR_UNADMITTED_CONSUMER_REJECTED')
 keys=('DATABASE_URL','DIRECT_URL','DEPLOYMENT_PRODUCT','DEFAULT_TENANT_ID','ALLOWED_TENANT_IDS','HUB_DATABASE_NAME','HUB_DATABASE_APP_ROLE','HUB_DATABASE_OWNER_ROLE','HUB_DATABASE_MARKER_SHA256','HUB_SCHEMA_FINGERPRINT','HUB_CORE_MANIFEST_SHA256')
 need(all(back.get(k)==m.unquote(saved[k]) for k in keys if k in saved),'HUB_PAIR_BACKEND_ENV_BINDING_REJECTED')

def validate_templates(saved):
 front=json.loads(m.command(front_args()+['config','--format','json']))['services']['researchhub'].get('environment',{})
 service=json.loads(m.command(back_args()+['config','--format','json']))['services']['researchhub-api']
 check_environments(front,service.get('environment',{}),saved)
 if saved.get('HUB_EXECUTION_PROFILE') in (m.execution.PROFILE,m.execution.KNOWLEDGE_PROFILE):m.execution.mounts(service,saved,BACK_TEMPLATE.read_text())

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

def apply_images(helper,release,template=None,backend_template=None,keep_backend=False):
 global FRONT_TEMPLATE,BACK_TEMPLATE
 FRONT_TEMPLATE=template or HERE/'frontend-compose.yml';BACK_TEMPLATE=backend_template or HERE/'backend-compose.yml'
 m.command(front_args()+['stop','researchhub'],60)
 if not keep_backend:
  m.command(back_args()+['stop','researchhub-api'],60)
  helper.save_config(m.OPS/'.env.prod',{'HUB_BACKEND_IMAGE':release['backendImage'],'HUB_CORE_MANIFEST_SHA256':release['coreDigest']})
 helper.save_config(m.OPS/'current.env',{'RESEARCHHUB_IMAGE':release['frontendImage'],'RESEARCHHUB_PORT':'8083'})
 if not keep_backend:m.command(back_args()+['up','-d','--no-deps','researchhub-api'],120);wait_api()
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
 keep_backend=backend_unchanged(previous,release)
 release['images']['frontend']['id']=m.canonical_image_id(HERE/'researchhub.tar.gz',release['frontendImage'],release['files']['researchhub.tar.gz']['sha256'])
 for kind in ('frontend','backend'):
  if release['images'][kind].get('configId'):need(release['images'][kind]['configId']==release['images'][kind]['id'],'HUB_PAIR_MANIFEST_CANONICAL_MISMATCH')
 helper=m.helper_module();saved=helper.read_config(m.OPS/'.env.prod');backend_plan=backend_configuration_context(previous,release,saved,keep_backend);m.plan_configuration(saved,backend_plan,control['target'],{})
 m.execution.core_transition(previous,release,saved,control.get('coreUpgrade'))
 m.execution.support(previous,saved)
 if saved.get('HUB_EXECUTION_PROFILE') in (m.execution.PROFILE,m.execution.KNOWLEDGE_PROFILE):
  BACK_TEMPLATE_CHECK=HERE/'previous-backend-compose.yml'
  previous_args=['docker','compose','--project-name','researchhub-backend','--env-file',str(m.OPS/'.env.prod'),'-f',str(BACK_TEMPLATE_CHECK),'config','--format','json']
  old_service=json.loads(m.command(previous_args))['services']['researchhub-api'];check_environments({},old_service.get('environment',{}),saved);m.execution.mounts(old_service,saved,BACK_TEMPLATE_CHECK.read_text())
 items=m.containers();old_services=m.baseline(items);states=m.task_snapshot(helper,saved)
 need(not re.search(r'^\s*env_file:',(HERE/'frontend-compose.yml').read_text(),re.M),'HUB_PAIR_FRONTEND_ENV_FILE_REJECTED')
 need(m.command(front_args()+['config','--services']).split()==['researchhub'],'HUB_PAIR_FRONTEND_SCOPE_REJECTED');need(m.command(back_args()+['config','--services']).split()==['researchhub-api'],'HUB_PAIR_BACKEND_SCOPE_REJECTED')
 validate_templates(saved)
 target=control['target'];journal=HERE/'pair-receipt.json';baseline_file=HERE/'pair-baseline.json';previous_template=HERE/'previous-frontend-compose.yml';previous_backend=HERE/'previous-backend-compose.yml'
 preserved=backend_snapshot(items,release,target) if keep_backend else None
 def check_backend():
  if keep_backend:need(backend_snapshot(m.containers(),release,target)==preserved,'HUB_PAIR_REUSED_BACKEND_CHANGED')
 def replace(replacement,template=None,backend_template=None):
  if keep_backend:apply_images(helper,replacement,template,backend_template,keep_backend=True)
  else:apply_images(helper,replacement,template,backend_template)
  check_backend()
 if keep_backend and baseline_file.exists():need(json.loads(baseline_file.read_text()).get('backendPreserved')==preserved,'HUB_PAIR_REUSED_BACKEND_BASELINE_CHANGED')
 if action=='pair-finalize':
  pair_matches(items,release,target);healthy();need(baseline_file.is_file(),'HUB_PAIR_BASELINE_RECEIPT_REQUIRED');baseline=json.loads(baseline_file.read_text());need(m.baseline(m.containers())==baseline['services'],'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(baseline['tasks'],m.task_snapshot(helper,saved));need(journal.is_file() and json.loads(journal.read_text()).get('status') in ('applied','promoted'),'HUB_PAIR_APPLIED_RECEIPT_REQUIRED');check_backend();publish_pointer(control,release,previous);save(journal,{'status':'promoted','tag':release['tag'],**({'backendPreserved':preserved} if keep_backend else {})});print(json.dumps({'status':'paired-release-complete','tag':release['tag'],'databaseMigrationExecuted':False}));return
 if action=='pair-verify':pair_matches(items,release,target);healthy();check_backend();print(json.dumps({'status':'paired-release-verified','tag':release['tag']}));return
 need(previous_backend.is_file() and m.file_sha(previous_backend)==control['previousBackendComposeSha256'],'HUB_PAIR_PREVIOUS_BACKEND_TEMPLATE_MISMATCH')
 if action=='pair-rollback':
  try:pair_matches(items,previous,target);healthy();print(json.dumps({'status':'paired-rollback-complete','tag':previous['tag'],'alreadyRestored':True}));return
  except m.Stop:pass
  owned_pair(items,release);need(previous_template.is_file() and m.file_sha(previous_template)==previous['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_ROLLBACK_TEMPLATE_REQUIRED');replace(previous,previous_template,previous_backend);(m.OPS/'docker-compose.ecs.yml').write_bytes(previous_template.read_bytes());pair_matches(m.containers(),previous,target)
  need(m.baseline(m.containers())==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(states,m.task_snapshot(helper,saved));save(journal,{'status':'rolled-back','tag':previous['tag'],**({'backendPreserved':preserved} if keep_backend else {})});print(json.dumps({'status':'paired-rollback-complete','tag':previous['tag']}));return
 pair_matches(items,previous,target)
 preflight_pointer(control,release,previous)
 recorded=helper.read_config(m.OPS/'current.env');need(recorded.get('RESEARCHHUB_IMAGE')==previous['frontendImage'] and saved.get('HUB_BACKEND_IMAGE')==previous['backendImage'],'HUB_PAIR_CURRENT_REFERENCE_MISMATCH')
 compose=m.OPS/'docker-compose.ecs.yml';need(compose.is_file() and not compose.is_symlink() and m.file_sha(compose)==previous['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_PREVIOUS_FRONTEND_TEMPLATE_MISMATCH')
 need(previous_template.is_file() and m.file_sha(previous_template)==previous['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_PREVIOUS_FRONTEND_TEMPLATE_MISMATCH')
 need(m.file_sha(HERE/'frontend-compose.yml')==release['files']['docker-compose.ecs.yml']['sha256'],'HUB_PAIR_FRONTEND_TEMPLATE_DIGEST_MISMATCH')
 for kind,name in [('backend','backend-image.tar.gz'),('frontend','researchhub.tar.gz')]:
  if kind=='backend' and keep_backend:continue
  image=load_image(HERE/name,release[kind+'Image'],release['images'][kind]['id'])
  if kind=='frontend':m.assert_frontend_environment(image)
 if baseline_file.exists():
  baseline=json.loads(baseline_file.read_text());need(baseline['services']==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(baseline['tasks'],states)
 else:save(baseline_file,{'services':old_services,'tasks':states,**({'backendPreserved':preserved} if keep_backend else {})})
 save(journal,{'status':'prepared','tag':release['tag'],'previousTag':previous['tag'],'manifestSha256':control['imageManifestSha256']})
 accepted=False
 try:
  replace(release);pair_matches(m.containers(),release,target)
  need(m.baseline(m.containers())==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(states,m.task_snapshot(helper,saved))
  # Keep the established operator-facing Compose path aligned without secrets.
  with tempfile.NamedTemporaryFile(dir=str(m.OPS),prefix='.front-compose-',delete=False) as f:f.write((HERE/'frontend-compose.yml').read_bytes());temporary=pathlib.Path(f.name)
  os.replace(str(temporary),str(compose));save(journal,{'status':'applied','tag':release['tag'],'previousTag':previous['tag'],'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'databaseMigrationExecuted':False,**({'backendPreserved':preserved} if keep_backend else {})})
  accepted=True;print(json.dumps({'status':'paired-release-applied','tag':release['tag'],'frontendStatus':200,'apiStatus':401,'publicDataStatus':200,'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'databaseMigrationExecuted':False,**({'backendPreserved':preserved} if keep_backend else {})}))
 finally:
  if not accepted:
   try:
    replace(previous,previous_template,previous_backend);compose.write_bytes(previous_template.read_bytes());pair_matches(m.containers(),previous,target);need(m.baseline(m.containers())==old_services,'HUB_OTHER_SERVICES_CHANGED');m.assert_task_snapshot(states,m.task_snapshot(helper,saved));save(journal,{'status':'rolled-back','tag':previous['tag'],**({'backendPreserved':preserved} if keep_backend else {})});print(json.dumps({'status':'paired-rollback-complete','tag':previous['tag']}))
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
