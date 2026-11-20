#!/usr/bin/env python3
"""Activate only the approved independent Hub API; Python 3.6+, no migrations."""
import argparse,fcntl,hashlib,importlib.util,json,os,pathlib,re,secrets,shutil,socket,subprocess,sys,time,signal,tarfile
from urllib.parse import urlsplit
OPS=pathlib.Path('/srv/researchhub/ops');PACKAGE=pathlib.Path(__file__).resolve().parent
TENANT='rh-kb-local-b0e2af9d-tenant'
class Stop(Exception):pass

def need(ok,code):
 if not ok:raise Stop(code)

_spec=importlib.util.spec_from_file_location('hub_execution',str(PACKAGE/('execution-profile.py' if (PACKAGE/'execution-profile.py').exists() else 'hub-execution-profile.py')))
execution=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(execution);execution.need=need
EXECUTION_SAVED={}

def unquote(value):
 value=value.strip()
 return value[1:-1] if len(value)>1 and value[0] in ('"',"'") and value[-1]==value[0] else value

def plan_configuration(existing,release,target,inherited):
 global EXECUTION_SAVED
 EXECUTION_SAVED=dict(existing)
 state=execution.support(release,execution.proposed(release,existing))
 if 'executionPolicy' in release:
  policy=release['executionPolicy'];need(policy.get('profile')==state['HUB_EXECUTION_PROFILE'] and (state['HUB_EXECUTION_PROFILE'] in ('disabled',execution.STANDARD_PROFILE) or policy.get('admissionSha256')==state['HUB_CHAT_ADMISSION_SHA256']),'HUB_EXECUTION_POLICY_MISMATCH')
 expected={'HUB_DATABASE_NAME':target['database'],'HUB_DATABASE_APP_ROLE':'researchhub_demo_app','HUB_DATABASE_OWNER_ROLE':'researchhub_demo_owner','HUB_DATABASE_MARKER_SHA256':target['markerSha256'],'HUB_SCHEMA_FINGERPRINT':target['schemaFingerprint'],'DEFAULT_TENANT_ID':TENANT,'ALLOWED_TENANT_IDS':TENANT,'DEPLOYMENT_PRODUCT':'researchhub','VITE_AUTH_TENANT_SLUG':release['tenantSlug']}
 need(target.get('database')=='researchhub' and target.get('tenantId')==TENANT,'HUB_RUNTIME_TARGET_REJECTED')
 need(all(existing.get(k)==v for k,v in expected.items()),'HUB_RUNTIME_SAVED_BINDING_MISMATCH')
 need(existing.get('DEPLOYMENT_ID')=='researchhub-demo-20261119' and existing.get('HUB_SOURCE_REVIEWER_ACCOUNT_ID')=='rh-kb-local-b0e2af9d-admin','HUB_RUNTIME_SCOPE_REJECTED')
 need(re.fullmatch('[a-f0-9]{64}',release.get('coreDigest','')),'HUB_RUNTIME_CORE_DIGEST_REJECTED')
 need(re.fullmatch(r'hub-runtime-[a-f0-9]{8}-[0-9]+',release.get('tag','')) and release.get('backendImage')=='researchhub-backend:'+release['tag'],'HUB_RUNTIME_IMAGE_REJECTED')
 out={'NODE_ENV':'production','HUB_RUNTIME_PROFILE':'full','HUB_REQUIRE_PRIVATE_CORE':'true','HUB_CORE_DIR':'/opt/researchhub/core','HUB_CORE_MANIFEST_SHA256':release['coreDigest'],'HUB_APP_ORIGIN':'https://hub.pengxc.com','HUB_AUTH_COOKIE_SECURE':'true','HUB_API_HOST':'0.0.0.0','HUB_API_PORT':'19612','HUB_API_AUTHORITY':'hub.pengxc.com','HUB_API_UPSTREAM':'http://researchhub-api:19612','CONTROL_PLANE_ENABLED':'false','ENABLED_WORKER_KINDS':'','OFFICIAL_JOB_KINDS':'','HUB_PAID_AI_ENABLED':'false','HUB_EMBEDDING_MODE':'keyword-only','HUB_MAIL_MODE':'disabled','HUB_ASSET_MARKDOWN_EXPORT_ENABLED':'false','HUB_BACKEND_IMAGE':release['backendImage']}
 out.update(state)
 jwt=unquote(existing.get('JWT_SECRET',''))
 if jwt:need(len(jwt)>=32 and jwt.strip()==jwt and not any(ord(c)<32 for c in jwt),'HUB_EXISTING_JWT_INVALID')
 else:out['JWT_SECRET']=secrets.token_urlsafe(48)
 cookie=unquote(existing.get('AUTH_COOKIE_NAME',''))
 if cookie:need(re.fullmatch('[A-Za-z0-9_-]{1,128}',cookie) and cookie!='aisci_session' and not cookie.startswith('__'),'HUB_EXISTING_COOKIE_INVALID')
 else:out['AUTH_COOKIE_NAME']='researchhub_demo_session'
 keys=('S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY');present=[bool(unquote(existing.get(k,''))) for k in keys]
 need(not any(present) or all(present),'HUB_STORAGE_PARTIAL_CONFIGURATION')
 storage={k:unquote(existing[k]) for k in keys} if all(present) else {k:inherited.get(k,'') for k in keys}
 need(all(storage.values()),'HUB_EXISTING_STORAGE_REQUIRED')
 endpoint=urlsplit(storage['S3_ENDPOINT']);need(endpoint.scheme in ('http','https') and endpoint.hostname and not endpoint.username and not endpoint.password and endpoint.path in ('','/') and not endpoint.query and not endpoint.fragment,'HUB_STORAGE_ENDPOINT_REJECTED')
 need(re.fullmatch('[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]',storage['S3_BUCKET']),'HUB_STORAGE_BUCKET_REJECTED')
 if not all(present):out.update(storage)
 if not unquote(existing.get('S3_REGION','')):
  if inherited.get('S3_REGION'):out['S3_REGION']=inherited['S3_REGION']
  elif endpoint.hostname.endswith('.aliyuncs.com'):out['S3_REGION']=endpoint.hostname.split('.')[0].replace('-internal','')
 return out

def command(args,timeout=60,env=None):
 r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=timeout,env=env)
 need(r.returncode==0,'HUB_RUNTIME_COMMAND_FAILED');return r.stdout

def containers():
 ids=command(['docker','ps','-aq']).split()
 return json.loads(command(['docker','inspect']+ids)) if ids else []

def baseline(items):
 return sorted([{'name':x['Name'],'id':x['Id'],'image':x['Image'],'status':x['State']['Status']} for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project') in ('ops','official-site')],key=lambda x:x['name'])

def legacy_storage(items):
 choices=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='ops' and (x['Config'].get('Labels') or {}).get('com.docker.compose.service')=='server' and x['State']['Running']]
 need(len(choices)==1,'HUB_STORAGE_SOURCE_NOT_UNIQUE')
 allowed={'S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY','S3_REGION'};result={}
 for line in choices[0]['Config'].get('Env') or []:
  key,sep,value=line.partition('=')
  if sep and key in allowed and value:result[key]=value
 return result

def helper_module():
 spec=importlib.util.spec_from_file_location('hub_db_helper',str(PACKAGE/'database-config.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def load_json(path):return json.loads(path.read_text(encoding='utf-8'))

def load_release(control_sha):
 control_file=PACKAGE/'control-manifest.json';need(re.fullmatch('[a-f0-9]{64}',control_sha or '') and hashlib.sha256(control_file.read_bytes()).hexdigest()==control_sha,'HUB_RUNTIME_CONTROL_DIGEST_MISMATCH')
 control=load_json(control_file);need(control.get('schema')=='researchhub-runtime-controls.v1','HUB_RUNTIME_CONTROL_REJECTED')
 for name,item in control['files'].items():
  need(pathlib.Path(name).name==name and '/' not in name and '\\' not in name,'HUB_RUNTIME_CONTROL_PATH_REJECTED')
  path=PACKAGE/name;need(path.is_file() and not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256'],'HUB_RUNTIME_CONTROL_FILE_MISMATCH')
 release=load_json(PACKAGE/'runtime-release.json');need(release.get('schema')=='researchhub-runtime-images.v1' and release.get('tag')==control.get('tag') and release.get('architecture')=='amd64' and release.get('workersEnabled') is False and release.get('modelsEnabled') is False and release.get('mailEnabled') is False,'HUB_RUNTIME_RELEASE_REJECTED')
 release['executionPolicy']=control.get('executionPolicy',{'profile':'disabled'})
 need(release.get('images',{}).get('backend',{}).get('architecture')=='amd64','HUB_RUNTIME_IMAGE_ARCH_REJECTED')
 release['images']['backend']['buildId']=release['images']['backend']['id']
 release['images']['backend']['id']=canonical_image_id(backend_archive(release),release['backendImage'],release['files']['backend-image.tar.gz']['sha256'])
 return control,release

def file_sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()


def canonical_image_id(archive,reference,expected_sha,architecture='amd64'):
 need(archive.is_file() and not archive.is_symlink() and file_sha(archive)==expected_sha,'HUB_RUNTIME_IMAGE_DIGEST_MISMATCH')
 configs={};entries=None;seen=set()
 with tarfile.open(str(archive),'r|gz') as source:
  for member in source:
   name=member.name;path=pathlib.PurePosixPath(name)
   need(not path.is_absolute() and '..' not in path.parts and not member.issym() and not member.islnk() and name not in seen and len(seen)<50000,'HUB_RUNTIME_IMAGE_MEMBER_REJECTED');seen.add(name)
   if name!='manifest.json' and not re.fullmatch(r'(?:[a-f0-9]{64}\.json|blobs/sha256/[a-f0-9]{64})',name):continue
   if member.size>2*1024*1024 and name!='manifest.json':continue
   need(member.isfile() and member.size<=2*1024*1024,'HUB_RUNTIME_IMAGE_METADATA_REJECTED')
   raw=source.extractfile(member).read()
   try:body=json.loads(raw.decode('utf-8'))
   except (ValueError,UnicodeError):continue
   if name=='manifest.json':entries=body
   elif isinstance(body,dict) and 'rootfs' in body:
    digest=hashlib.sha256(raw).hexdigest();need(name.split('/')[-1].split('.')[0]==digest,'HUB_RUNTIME_IMAGE_CONFIG_DIGEST_MISMATCH');configs[name]={'id':'sha256:'+digest,'architecture':body.get('architecture'),'os':body.get('os')}
 need(isinstance(entries,list) and len(entries)==1,'HUB_RUNTIME_IMAGE_MANIFEST_REJECTED')
 entry=entries[0];tags=entry.get('RepoTags') or []
 need(tags.count(reference)==1,'HUB_RUNTIME_IMAGE_TAG_REJECTED')
 config=entry.get('Config');need(config in configs,'HUB_RUNTIME_IMAGE_CONFIG_MISSING');selected=configs[config];need(selected['architecture']==architecture and selected['os']=='linux','HUB_RUNTIME_IMAGE_CONFIG_ARCH_REJECTED');return selected['id']

def backend_archive(release):
 local=PACKAGE/'backend-image.tar.gz'
 if local.is_file():return local
 choices=sorted(PACKAGE.parent.glob('control-*/backend-image.tar.gz'));need(0<len(choices)<=20,'HUB_RUNTIME_VERIFIED_BACKEND_ARCHIVE_REQUIRED')
 for candidate in choices:
  if not candidate.is_symlink() and file_sha(candidate)==release['files']['backend-image.tar.gz']['sha256']:return candidate
 raise Stop('HUB_RUNTIME_IMAGE_DIGEST_MISMATCH')

def task_snapshot(helper,values):
 cfg,password=helper.check_url(values['DIRECT_URL'],'researchhub_demo_owner')
 tables=('knowledge_import_task','processing_task','research_agent_run','research_artifact_export_job','knowledge_chat_job','research_method_run')
 parts=["'"+name+"',COALESCE((SELECT json_object_agg(id,md5(row_to_json(t)::text)) FROM public."+name+" t),'{}'::json)" for name in tables]
 parts[tables.index('knowledge_chat_job')]="'knowledge_chat_job',COALESCE((SELECT json_object_agg(id,json_build_object('hash',md5(row_to_json(t)::text),'status',status,'binding',json_build_object('tenantId',\"tenantId\",'accountId',\"accountId\",'sessionId',\"sessionId\",'requestKey',\"requestKey\",'createdAtMillis',floor(extract(epoch from \"createdAt\")*1000)::bigint))) FROM public.knowledge_chat_job t),'{}'::json)"
 parts[tables.index('knowledge_import_task')]="'knowledge_import_task',COALESCE((SELECT json_object_agg(id,json_build_object('hash',md5(row_to_json(t)::text),'status',status,'binding',json_build_object('tenantId',\"tenantId\",'accountId',\"createdBy\",'kbId',\"kbId\",'createdAtMillis',floor(extract(epoch from \"createdAt\")*1000)::bigint))) FROM public.knowledge_import_task t),'{}'::json)"
 return helper.query('psql',cfg,'researchhub_demo_owner',password,'SELECT json_build_object('+','.join(parts)+');')[0]

def assert_standard_tasks(old,current,kind):
 terminal={'completed','complete','failed','cancelled'}
 def binding(row):
  value=dict(row.get('binding',{}));value.pop('status',None);return value
 def status(row):return row.get('status',row.get('binding',{}).get('status'))
 for key,value in old.items():
  newer=current.get(key);need(newer is not None,'HUB_RUNTIME_HISTORICAL_TASK_CHANGED')
  if not isinstance(value,dict):need(newer==value,'HUB_RUNTIME_HISTORICAL_TASK_CHANGED');continue
  need(isinstance(newer,dict) and binding(newer)==binding(value),'HUB_RUNTIME_TASK_BINDING_CHANGED')
  fixture=str(binding(value).get('sessionId','')).startswith('rh-aiq-')
  if fixture or status(value) in terminal or status(value) is None:
   need(newer.get('hash')==value.get('hash'),'HUB_RUNTIME_HISTORICAL_TASK_CHANGED')
 for key,value in current.items():
  need(isinstance(value,dict) and value.get('hash') and isinstance(value.get('binding'),dict),'HUB_RUNTIME_TASK_METADATA_REQUIRED')
  need(status(value) in ({'queued','processing','completed','failed'} if kind=='knowledge_chat_job' else {'queued','processing','complete','failed','blocked','cancelled'}),'HUB_RUNTIME_TASK_STATUS_REJECTED')
  if key not in old:
   anchor=binding(value)
   need(anchor.get('tenantId')==TENANT and not str(anchor.get('sessionId','')).startswith('rh-aiq-'),'HUB_RUNTIME_NEW_TASK_SCOPE_REJECTED')

def assert_task_snapshot(before,after,allow_new=False,standard=False):
 need(set(before)==set(after),'HUB_RUNTIME_TASK_TABLES_CHANGED')
 standard=standard or EXECUTION_SAVED.get('HUB_EXECUTION_PROFILE')==execution.STANDARD_PROFILE
 admitted={} if standard else execution.admitted_jobs(EXECUTION_SAVED)
 for name,old in before.items():
  if standard and name in ('knowledge_chat_job','knowledge_import_task'):
   assert_standard_tasks(old,after[name],name);continue
  exempt=set(admitted) if name=='knowledge_chat_job' else set()
  for key in exempt:
   need(isinstance(after[name].get(key),dict) and after[name][key].get('binding')==admitted[key],'HUB_RUNTIME_ADMITTED_TASK_BINDING_CHANGED')
   if key in old:need(isinstance(old[key],dict) and old[key].get('binding')==admitted[key],'HUB_RUNTIME_ADMITTED_TASK_BINDING_CHANGED')
  need(all(after[name].get(key)==value for key,value in old.items() if key not in exempt),'HUB_RUNTIME_HISTORICAL_TASK_CHANGED')
  if not allow_new or EXECUTION_SAVED.get('HUB_EXECUTION_PROFILE') in (execution.PROFILE,execution.KNOWLEDGE_PROFILE):need(set(old)-exempt==set(after[name])-exempt,'HUB_RUNTIME_UNEXPECTED_NEW_TASK')

def live_api(items,release,target):
 own=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub-backend' and (x['Config'].get('Labels') or {}).get('com.docker.compose.service')=='researchhub-api']
 need(len(own)==1 and own[0]['State']['Running'] and own[0]['Image']==release['images']['backend']['id'],'HUB_RUNTIME_NEW_CONTAINER_MISMATCH')
 values=dict(line.split('=',1) for line in own[0]['Config'].get('Env') or [] if '=' in line)
 expected={'HUB_DATABASE_NAME':'researchhub','HUB_DATABASE_APP_ROLE':'researchhub_demo_app','HUB_DATABASE_OWNER_ROLE':'researchhub_demo_owner','HUB_DATABASE_MARKER_SHA256':target['markerSha256'],'HUB_SCHEMA_FINGERPRINT':target['schemaFingerprint'],'DEFAULT_TENANT_ID':TENANT,'ALLOWED_TENANT_IDS':TENANT,'HUB_CORE_MANIFEST_SHA256':release['coreDigest'],'ENABLED_WORKER_KINDS':'','OFFICIAL_JOB_KINDS':'','CONTROL_PLANE_ENABLED':'false','HUB_PAID_AI_ENABLED':'false','HUB_EMBEDDING_MODE':'keyword-only','HUB_MAIL_MODE':'disabled'}
 if EXECUTION_SAVED:expected.update(execution.support(release,EXECUTION_SAVED))
 if expected.get('HUB_EXECUTION_PROFILE')=='disabled' and 'bounded-hub-chat-v1' not in release.get('supportedExecutionProfiles',[]):expected.pop('HUB_EXECUTION_PROFILE',None)
 if expected.get('HUB_EXECUTION_PROFILE') in (execution.PROFILE,execution.KNOWLEDGE_PROFILE):
  execution.sealed(EXECUTION_SAVED)
  mounts={x.get('Destination'):x for x in own[0].get('Mounts',[])}
  for target_path,name,rw in [('/run/researchhub-admission','admission',False),('/run/researchhub-ai-ledger','ledger',True)]:
   row=mounts.get(target_path,{});need(row.get('Type')=='bind' and row.get('Source')==str(execution.ROOT/name) and row.get('RW') is rw,'HUB_CHAT_LIVE_MOUNT_MISMATCH')
 need(all(values.get(k)==v for k,v in expected.items()),'HUB_RUNTIME_CONTAINER_BINDING_MISMATCH')
 aliases=own[0].get('NetworkSettings',{}).get('Networks',{}).get('researchhub_default',{}).get('Aliases') or [];need('researchhub-api' in aliases,'HUB_RUNTIME_NETWORK_ALIAS_MISSING')
 return own[0]

def stop_owned_api(image_id):
 for x in containers():
  labels=x['Config'].get('Labels') or {}
  if labels.get('com.docker.compose.project')=='researchhub-backend' and labels.get('com.docker.compose.service')=='researchhub-api' and x['Image']==image_id and x['State']['Running']:
   command(['docker','stop','--time','20',x['Id']],40)

def compose_args():return ['docker','compose','--project-name','researchhub-backend','--env-file',str(OPS/'.env.prod'),'-f',str(PACKAGE/'backend-compose.yml')]

def api_status():
 r=subprocess.run(['curl','--silent','--show-error','--max-time','5','--output','/dev/null','--write-out','%{http_code}','--header','Host: hub.pengxc.com','http://127.0.0.1:19612/api/auth/me'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 return r.stdout.decode() if r.returncode==0 else 'unavailable'

def diagnostic(image):
 js="""import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';let p;try{const c=readResearchRuntimeConfig(process.env),{load}=runtimeDependencies(c.core);p=new(load('prisma/prisma.service','PrismaService'))();await p.app.$connect();await p.elevated.$connect();const env=bindRuntimeTransactions({prisma:p,expected:c.identity});await withDeploymentTransaction(env,'app',tx=>tx.$queryRawUnsafe('SELECT 1'),{readOnly:true});console.log('HUB_DIAG:'+JSON.stringify({code:'HUB_RUNTIME_DIAGNOSTIC_READY',kind:'Ready'}));}catch(e){const x=String(e.message||''),m=x.match(/^(CORE_[A-Z_]+|RESEARCH_[A-Z_]+|RUNTIME_[A-Z_]+)(?::([A-Z0-9_]+))?$/);console.log('HUB_DIAG:'+JSON.stringify({code:m?m[0]:/^P[0-9]{4}$/.test(e.code||'')?e.code:'HUB_RUNTIME_STARTUP_UNCLASSIFIED',kind:e.name||'Error'}));}finally{if(p)await p.onModuleDestroy();}"""
 name='hub-runtime-diagnostic-'+image.split(':')[-1]
 args=['docker','run','--name',name,'--label','researchhub.runtime-diagnostic=true','--rm','--network','researchhub_default','--read-only','--tmpfs','/tmp:rw,size=128m,mode=1777','--memory','768m','--cpus','0.75','--cap-drop','ALL','--env-file',str(OPS/'.env.prod'),'--env','HUB_EXECUTION_PROFILE=disabled','--env','HUB_PAID_AI_ENABLED=false','--env','ENABLED_WORKER_KINDS=','--env','OFFICIAL_JOB_KINDS=','--env','CONTROL_PLANE_ENABLED=false','--entrypoint','node',image,'--input-type=module','-e',js]
 try:
  text=command(args,90)
  for line in text.splitlines():
   if line.startswith('HUB_DIAG:'):
    row=json.loads(line[9:]);code=row.get('code','');kind=row.get('kind','Error')
    if re.fullmatch(r'(?:CORE_|RESEARCH_|RUNTIME_|CONFIG_|HUB_RUNTIME_)[A-Z0-9_]+(?::[A-Z0-9_]+)?|P[0-9]{4}',code):
     return {'code':code,'kind':kind if kind in ('Error','TypeError','Ready','PrismaClientInitializationError','PrismaClientKnownRequestError') else 'Error'}
 except Exception:pass
 finally:
  for row in containers():
   if row['Name']=='/'+name and (row['Config'].get('Labels') or {}).get('researchhub.runtime-diagnostic')=='true' and row['Config']['Image']==image:
    command(['docker','rm','-f',row['Id']],30)
 return {'code':'HUB_RUNTIME_DIAGNOSTIC_UNAVAILABLE'}


def frontend_container(items,image_id=None):
 own=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub']
 need(len(own)==1 and own[0]['State']['Running'],'HUB_FRONTEND_CONTAINER_NOT_UNIQUE')
 if image_id:need(own[0]['Image']==image_id,'HUB_FRONTEND_IMAGE_MISMATCH')
 return own[0]

def assert_frontend_environment(container):
 keys={line.split('=',1)[0] for line in container['Config'].get('Env') or []}
 need(not any(k in ('DATABASE_URL','DIRECT_URL','JWT_SECRET') or k.startswith(('S3_','OSS_','SMTP_')) for k in keys),'HUB_FRONTEND_SECRET_ENV_REJECTED')

def frontend_status(path):
 r=subprocess.run(['curl','--silent','--show-error','--max-time','10','--output','/dev/null','--write-out','%{http_code}','--header','Host: hub.pengxc.com','http://127.0.0.1:8083'+path],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 return r.stdout.decode() if r.returncode==0 else 'unavailable'

def activate_front(helper,saved,control,release,items,before):
 release['images']['frontend']['buildId']=release['images']['frontend']['id']
 release['images']['frontend']['id']=canonical_image_id(PACKAGE/'researchhub.tar.gz',release['frontendImage'],release['files']['researchhub.tar.gz']['sha256'])
 live_api(items,release,control['target']);need(api_status()=='401','HUB_API_REQUIRED_BEFORE_FRONTEND')
 old=frontend_container(items);states=task_snapshot(helper,saved)
 current=OPS/'current.env';need(current.is_file() and not current.is_symlink(),'HUB_FRONTEND_CURRENT_ENV_REQUIRED')
 need(current.stat().st_size<65536,'HUB_FRONTEND_CURRENT_ENV_REJECTED')
 recorded=helper.read_config(current)
 need(recorded.get('RESEARCHHUB_IMAGE')==old['Config']['Image'] and recorded.get('RESEARCHHUB_PORT')=='8083','HUB_FRONTEND_CURRENT_IMAGE_BINDING_MISMATCH')
 if old['Image']==release['images']['frontend']['id']:
  assert_frontend_environment(old);need(frontend_status('/api/auth/me')=='401' and frontend_status('/health')=='200','HUB_FRONTEND_ROUTE_NOT_READY')
 else:
  child=dict(os.environ,RESEARCHHUB_RELEASE_MODE='deploy',RESEARCHHUB_RELEASE_TAG=release['tag'],RESEARCHHUB_IMAGE=release['frontendImage'],RESEARCHHUB_OSS_RELEASE_PREFIX='releases/researchhub',RESEARCHHUB_PORT='8083',HUB_EXPECTED_FRONTEND_SHA256=release['files']['researchhub.tar.gz']['sha256'],HUB_EXPECTED_COMPOSE_SHA256=release['files']['docker-compose.ecs.yml']['sha256'],HUB_EXPECTED_FRONTEND_IMAGE_ID=release['images']['frontend']['id'])
  try:
   command(['bash',str(PACKAGE/'ecs-release.sh')],600,env=child)
   current_front=frontend_container(containers(),release['images']['frontend']['id']);assert_frontend_environment(current_front)
   need(frontend_status('/api/auth/me')=='401' and frontend_status('/health')=='200','HUB_FRONTEND_ROUTE_NOT_READY')
   live_api(containers(),release,control['target']);need(baseline(containers())==before,'HUB_OTHER_SERVICES_CHANGED');assert_task_snapshot(states,task_snapshot(helper,saved))
  except BaseException:
   fronts=[x for x in containers() if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub']
   need(len(fronts)<=1,'HUB_FRONTEND_ROLLBACK_STATE_AMBIGUOUS')
   if not fronts or not fronts[0]['State']['Running'] or fronts[0]['Image']!=old['Image']:
    compose=OPS/'docker-compose.ecs.yml'
    need(compose.is_file() and not re.search(r'^\s*env_file:',compose.read_text(),re.M),'HUB_FRONTEND_SAFE_ROLLBACK_TEMPLATE_REQUIRED')
    helper.save_config(current,{'RESEARCHHUB_IMAGE':old['Config']['Image'],'RESEARCHHUB_PORT':'8083'})
    command(['docker','compose','--project-name','researchhub','--env-file',str(current),'-f',str(compose),'up','-d','researchhub'],120)
    frontend_container(containers(),old['Image'])
   raise
 need(baseline(containers())==before,'HUB_OTHER_SERVICES_CHANGED');assert_task_snapshot(states,task_snapshot(helper,saved))
 print(json.dumps({'status':'hub-frontend-api-connected','tag':release['tag'],'apiStatus':401,'healthStatus':200,'frontendSecretsAbsent':True,'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'workersStarted':False}))

def run(action,control_sha):
 global EXECUTION_SAVED
 need(os.geteuid()==0,'HUB_RUNTIME_ROOT_REQUIRED');control,release=load_release(control_sha);helper=helper_module();config=OPS/'.env.prod';saved=helper.read_config(config);items=containers();before=baseline(items)
 EXECUTION_SAVED=dict(saved)
 if action=='activate-front':return activate_front(helper,saved,control,release,items,before)
 need(any((x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub' and x['State']['Running'] for x in items),'HUB_FRONTEND_NOT_RUNNING')
 own=[x for x in items if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub-backend' and (x['Config'].get('Labels') or {}).get('com.docker.compose.service')=='researchhub-api']
 if action=='verify' or own and len(own)==1 and own[0]['State']['Running']:
  live_api(items,release,control['target']);need(api_status()=='401','HUB_RUNTIME_LIVE_VERIFICATION_FAILED')
  state_path=PACKAGE/'worker-before.json'
  if state_path.is_file():assert_task_snapshot(load_json(state_path),task_snapshot(helper,saved),allow_new=True)
  print(json.dumps({'status':'hub-api-ready','apiStatus':401,'tag':release['tag'],'workersStarted':False}));return
 need(not own or len(own)==1 and not own[0]['State']['Running'] and own[0]['Image']==release['images']['backend']['id'],'HUB_RUNTIME_EXISTING_BACKEND_STOP_RECHECK')
 need(shutil.disk_usage(str(OPS)).free>4*1024*1024*1024,'HUB_RUNTIME_DISK_SPACE_REQUIRED')
 with socket.socket() as port:
  try:port.bind(('127.0.0.1',19612))
  except OSError:raise Stop('HUB_RUNTIME_PORT_ALREADY_USED')
 net=json.loads(command(['docker','network','inspect','researchhub_default']))[0];need((net.get('Labels') or {}).get('com.docker.compose.project')=='researchhub','HUB_RUNTIME_NETWORK_REJECTED')
 inherited={} if any(unquote(saved.get(k,'')) for k in ('S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY')) else legacy_storage(items)
 updates=plan_configuration(saved,release,control['target'],inherited);helper.save_config(config,updates);saved=helper.read_config(config);states_before=task_snapshot(helper,saved)
 state_path=PACKAGE/'worker-before.json'
 if state_path.exists():assert_task_snapshot(load_json(state_path),states_before,allow_new=True)
 else:
  fd=os.open(str(state_path),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:json.dump(states_before,f)
 image_file=PACKAGE/'backend-image.tar.gz';need(image_file.is_file() and file_sha(image_file)==release['files']['backend-image.tar.gz']['sha256'],'HUB_RUNTIME_IMAGE_DIGEST_MISMATCH')
 command(['gzip','-t',str(image_file)],120)
 producer=subprocess.Popen(['gzip','-dc',str(image_file)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 try:
  command_input=subprocess.run(['docker','load'],stdin=producer.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=300);producer.stdout.close();need(producer.wait(timeout=30)==0 and command_input.returncode==0,'HUB_RUNTIME_IMAGE_LOAD_FAILED')
 finally:
  if producer.poll() is None:producer.kill();producer.wait()
 image=json.loads(command(['docker','image','inspect',release['backendImage']]))[0];need(image['Architecture']=='amd64' and image['Id']==release['images']['backend']['id'],'HUB_RUNTIME_LOADED_IMAGE_MISMATCH')
 need(command(compose_args()+['config','--services']).split()==['researchhub-api'],'HUB_RUNTIME_COMPOSE_SCOPE_REJECTED')
 accepted=False
 try:
  command(compose_args()+['up','-d','researchhub-api'],120)
  ready=False
  for _ in range(40):
   if api_status()=='401':ready=True;break
   time.sleep(2)
  if not ready:
   stop_owned_api(release['images']['backend']['id']);detail=diagnostic(release['backendImage']);print(json.dumps({'status':'hub-api-not-ready','diagnostic':detail}));need(baseline(containers())==before,'HUB_OTHER_SERVICES_CHANGED');raise Stop('HUB_RUNTIME_STARTUP_FAILED_STOPPED')
  after=containers();live_api(after,release,control['target'])
  need(baseline(after)==before,'HUB_OTHER_SERVICES_CHANGED');assert_task_snapshot(states_before,task_snapshot(helper,saved))
  receipt={'status':'hub-api-ready','tag':release['tag'],'apiStatus':401,'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'workersStarted':False,'modelsEnabled':False,'mailEnabled':False,'config':str(config)}
  fd=os.open(str(PACKAGE/'api-receipt.json'),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:json.dump(receipt,f)
  print(json.dumps(receipt));accepted=True
 finally:
  if not accepted:stop_owned_api(release['images']['backend']['id'])

def main():
 signal.signal(signal.SIGTERM,lambda *_:sys.exit(130))
 p=argparse.ArgumentParser();p.add_argument('action',choices=['activate','verify','activate-front']);p.add_argument('--control-sha',required=True);args=p.parse_args()
 lock_path=OPS/'hub-runtime-release.lock';fd=os.open(str(lock_path),os.O_WRONLY|os.O_CREAT,0o600)
 with os.fdopen(fd,'w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:raise Stop('HUB_RUNTIME_RELEASE_ALREADY_ACTIVE')
  run(args.action,args.control_sha)
if __name__=='__main__':
 try:main()
 except Exception as error:
  print(json.dumps({'status':'stopped','code':str(error) if isinstance(error,Stop) else 'HUB_RUNTIME_RELEASE_FAILED_RECHECK_STATE','kind':type(error).__name__,'automaticRetry':False}));raise SystemExit(1)
