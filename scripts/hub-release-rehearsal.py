#!/usr/bin/env python3
"""Real Docker/HTTP/PostgreSQL orchestration rehearsal; synthetic fixtures only."""
import contextlib,copy,hashlib,importlib.util,json,os,pathlib,secrets,shutil,subprocess,tempfile,time,urllib.request,urllib.error
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('pair',str(ROOT/'scripts/hub-release-pair.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p);m=p.m
key=secrets.token_hex(4);label='researchhub.release-rehearsal='+key;network='rh-release-fixture-'+key
base=os.environ['HUB_FIXTURE_NODE_IMAGE'];pgimage=os.environ.get('HUB_FIXTURE_POSTGRES_IMAGE','postgres:16');output=pathlib.Path(os.environ.get('HUB_REHEARSAL_OUTPUT',str(ROOT/'.tmp/unified-release-20261119/docker-rehearsal')));output.mkdir(parents=True,exist_ok=True)

def cmd(args,timeout=120):return subprocess.check_output(args,stderr=subprocess.PIPE,timeout=timeout).decode()
def docker(*a):return cmd(['docker',*a])
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,body):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(body);path.chmod(0o600)
def port_status(project,path):
 rows=inspect()
 for row in rows:
  if (row['Config'].get('Labels') or {}).get('com.docker.compose.project')!=project or not row['State']['Running']:continue
  ports=row['NetworkSettings']['Ports'];bound=next((v[0]['HostPort'] for v in ports.values() if v),None)
  if bound:
   try:
    with urllib.request.urlopen('http://127.0.0.1:'+bound+path,timeout=2) as r:return str(r.status)
   except urllib.error.HTTPError as e:return str(e.code)
   except OSError:return 'unavailable'
 return 'unavailable'
def inspect():
 ids=docker('ps','-aq','--filter','label='+label).split();return json.loads(docker('inspect',*ids)) if ids else []

passed=[];pg=None;images=[]
with tempfile.TemporaryDirectory(prefix='release-fixture-',dir=str(output)) as d:
 root=pathlib.Path(d);ops=root/'ops';package=root/'control';build=root/'build';ops.mkdir();package.mkdir();build.mkdir()
 projects={kind:'rh-release-'+kind+'-'+key for kind in ('api','front','ops','site')};canonical={};real_to_canonical={}
 try:
  arch=json.loads(docker('image','inspect',base))[0]['Architecture'];docker('network','create',network)
  write(build/'api.mjs',"import http from 'node:http';http.createServer((q,s)=>{s.setHeader('content-type','application/json');if(q.url==='/api/auth/me'){s.statusCode=401;s.end('{}')}else if(q.url==='/api/version'){s.end(JSON.stringify({version:process.env.FIXTURE_VERSION}))}else{s.end(JSON.stringify({synthetic:true,records:3}))}}).listen(19612,'0.0.0.0');")
  write(build/'static.mjs',(ROOT/'server/static.mjs').read_text());write(build/'api-proxy.mjs',(ROOT/'server/api-proxy.mjs').read_text());write(build/'index.html','<html><body>synthetic release fixture</body></html>')
  for kind in ('api','front'):
   for version in ('old','new'):
    tag=('researchhub-backend:' if kind=='api' else 'ghcr.io/pengxiaochuan-ai/pengxc-researchhub:')+'hub-runtime-'+key+'-'+('1' if version=='old' else '2');images.append(tag)
    body='FROM '+base+'\nLABEL fixture.version='+version+'\n'
    body+=('COPY --chown=node:node api.mjs /fixture.mjs\nENV FIXTURE_VERSION='+version+'\nCMD ["node","/fixture.mjs"]\n') if kind=='api' else 'WORKDIR /app\nCOPY --chown=node:node static.mjs api-proxy.mjs ./server/\nCOPY --chown=node:node index.html ./dist/index.html\nENV HOST=0.0.0.0 PORT=3000 HUB_API_UPSTREAM=http://researchhub-api:19612 HUB_API_AUTHORITY=hub.pengxc.com\nCMD ["node","server/static.mjs"]\n'
    write(build/'Dockerfile',body);cmd(['docker','build','-q','-t',tag,str(build)],180)
    archive=package/(kind+'-'+version+'.tar.gz')
    with archive.open('wb') as f:
     producer=subprocess.Popen(['docker','save',tag],stdout=subprocess.PIPE);r=subprocess.run(['gzip','-1'],stdin=producer.stdout,stdout=f,check=True);producer.stdout.close();assert producer.wait()==0
    cid=m.canonical_image_id(archive,tag,sha(archive),architecture=arch);canonical[tag]=cid;real_to_canonical[json.loads(docker('image','inspect',tag))[0]['Id']]=cid
  pg=docker('run','-d','--label',label,'--network','none','--memory','256m','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust',pgimage).strip()
  ready=False
  for _ in range(80):
   try:docker('exec',pg,'psql','-h','127.0.0.1','-U','postgres','-Atqc','SELECT 1');ready=True;break
   except subprocess.CalledProcessError:time.sleep(.5)
  assert ready,'Synthetic PostgreSQL TCP listener did not become ready'
  tables=['knowledge_import_task','processing_task','research_agent_run','research_artifact_export_job','knowledge_chat_job','research_method_run']
  sql=';'.join("CREATE TABLE "+t+"(id text primary key,status text);INSERT INTO "+t+" VALUES('synthetic-old','queued')" for t in tables)
  docker('exec',pg,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-qc',sql)
  def tasks(*args):
   parts=["'"+t+"',(SELECT json_object_agg(id,md5(row_to_json(t)::text)) FROM "+t+" t)" for t in tables]
   return json.loads(docker('exec',pg,'psql','-h','127.0.0.1','-U','postgres','-Atqc','SELECT json_build_object('+','.join(parts)+')'))
  policy=json.loads((ROOT/'deploy/release-policy.json').read_text());target=policy['target'];tag0='hub-runtime-'+key+'-1';tag1='hub-runtime-'+key+'-2'
  settings={'HUB_DATABASE_NAME':'researchhub','HUB_DATABASE_APP_ROLE':'researchhub_demo_app','HUB_DATABASE_OWNER_ROLE':'researchhub_demo_owner','HUB_DATABASE_MARKER_SHA256':target['markerSha256'],'HUB_SCHEMA_FINGERPRINT':target['schemaFingerprint'],'DEFAULT_TENANT_ID':m.TENANT,'ALLOWED_TENANT_IDS':m.TENANT,'DEPLOYMENT_PRODUCT':'researchhub','DEPLOYMENT_ID':'researchhub-demo-20261119','HUB_SOURCE_REVIEWER_ACCOUNT_ID':'rh-kb-local-b0e2af9d-admin','VITE_AUTH_TENANT_SLUG':m.TENANT,'HUB_CORE_MANIFEST_SHA256':policy['coreDigest'],'CONTROL_PLANE_ENABLED':'false','ENABLED_WORKER_KINDS':'','OFFICIAL_JOB_KINDS':'','HUB_PAID_AI_ENABLED':'false','HUB_EMBEDDING_MODE':'keyword-only','HUB_MAIL_MODE':'disabled','JWT_SECRET':'synthetic-only-'+'x'*40,'AUTH_COOKIE_NAME':'rh_fixture','S3_ENDPOINT':'https://oss-cn-hangzhou.aliyuncs.com','S3_BUCKET':'synthetic-only-bucket','S3_ACCESS_KEY':'synthetic','S3_SECRET_KEY':'synthetic'}
  settings['HUB_BACKEND_IMAGE']=images[0];write(ops/'.env.prod',''.join(k+'='+v+'\n' for k,v in settings.items()));write(ops/'current.env','RESEARCHHUB_IMAGE='+images[2]+'\nRESEARCHHUB_PORT=8083\n')
  front='services:\n  researchhub:\n    init: true\n    image: ${RESEARCHHUB_IMAGE}\n    labels: ["'+label+'"]\n    ports: ["127.0.0.1::3000"]\n    networks: [fixture]\nnetworks:\n  fixture:\n    external: true\n    name: '+network+'\n'
  back='services:\n  researchhub-api:\n    init: true\n    image: ${HUB_BACKEND_IMAGE}\n    labels: ["'+label+'"]\n    env_file: ["'+str(ops/'.env.prod')+'"]\n    ports: ["127.0.0.1::19612"]\n    networks:\n      fixture:\n        aliases: [researchhub-api]\nnetworks:\n  fixture:\n    external: true\n    name: '+network+'\n'
  for name,text in [('frontend-compose.yml',front),('backend-compose.yml',back),('previous-frontend-compose.yml',front),('previous-backend-compose.yml',back)]:write(package/name,text)
  write(ops/'docker-compose.ecs.yml',front)
  def compose(kind,template):return ['docker','compose','--project-name',projects[kind],'--env-file',str(ops/('.env.prod' if kind=='api' else 'current.env')),'-f',str(template)]
  cmd(compose('api',package/'backend-compose.yml')+['up','-d']);cmd(compose('front',package/'frontend-compose.yml')+['up','-d'])
  for kind,project in [('ops','ops'),('site','official-site')]:docker('run','-d','--label',label,'--label','com.docker.compose.project='+projects[kind],'--entrypoint','node',base,'-e','setInterval(()=>{},10000)')
  helper_spec=importlib.util.spec_from_file_location('dbhelper',str(ROOT/'deploy/demo-database-config.py'));helper=importlib.util.module_from_spec(helper_spec);helper_spec.loader.exec_module(helper)
  def inventory():
   rows=inspect()
   for row in rows:
    labels=row['Config'].get('Labels') or {};value=labels.get('com.docker.compose.project');labels['com.docker.compose.project']={projects['api']:'researchhub-backend',projects['front']:'researchhub',projects['ops']:'ops',projects['site']:'official-site'}.get(value,value)
    row['Image']=real_to_canonical.get(row['Image'],row['Image'])
    if network in row['NetworkSettings'].get('Networks',{}):row['NetworkSettings']['Networks']['researchhub_default']=row['NetworkSettings']['Networks'][network]
   return rows
  original_command=m.command
  def command(args,*a,**kw):
   text=original_command(args,*a,**kw)
   if args[:3]==['docker','image','inspect']:
    rows=json.loads(text)
    for row in rows:row['Id']=real_to_canonical.get(row['Id'],row['Id'])
    return json.dumps(rows)
   return text
  canonical_fn=m.canonical_image_id;load_fn=p.load_image
  def wait():
   for _ in range(30):
    if port_status(projects['api'],'/api/auth/me')=='401':return
    time.sleep(.1)
   raise m.Stop('HUB_PAIR_API_NOT_READY')
  def healthy():
   wait()
   for _ in range(30):
    if port_status(projects['front'],'/api/auth/me')=='401' and port_status(projects['front'],'/api/hubs/lingshu-xinyu/overview')=='200':return
    time.sleep(.1)
   raise m.Stop('HUB_PAIR_FRONTEND_OR_DATA_NOT_READY')
  def release(tag,version):
   return {'schema':'researchhub-runtime-images.v1','architecture':arch,'tag':tag,'controlGit':'a'*40,'coreDigest':policy['coreDigest'],'tenantSlug':m.TENANT,'backendImage':images[0 if version=='old' else 1],'frontendImage':images[2 if version=='old' else 3],'images':{k:{'id':canonical[images[i]],'configId':canonical[images[i]]} for k,i in [('backend',0 if version=='old' else 1),('frontend',2 if version=='old' else 3)]},'files':{'docker-compose.ecs.yml':{'sha256':sha(package/'frontend-compose.yml')},'researchhub.tar.gz':{'sha256':sha(package/('front-'+version+'.tar.gz'))}}}
  old=release(tag0,'old');new=release(tag1,'new');raw=json.dumps(old).encode();(package/'previous-release.json').write_bytes(raw);shutil.copyfile(package/'front-new.tar.gz',package/'researchhub.tar.gz');shutil.copyfile(package/'api-new.tar.gz',package/'backend-image.tar.gz')
  docker('image','rm',images[1],images[3])
  control={'paired':True,'target':target,'previousManifestSha256':hashlib.sha256(raw).hexdigest(),'previousBackendComposeSha256':sha(package/'previous-backend-compose.yml'),'imageManifestSha256':'f'*64}
  with contextlib.ExitStack() as stack:
   patches=[patch.object(p,'HERE',package),patch.object(m,'OPS',ops),patch.object(p,'FRONT_TEMPLATE',package/'frontend-compose.yml'),patch.object(p,'BACK_TEMPLATE',package/'backend-compose.yml'),patch.object(p,'front_args',side_effect=lambda:compose('front',p.FRONT_TEMPLATE)),patch.object(p,'back_args',side_effect=lambda:compose('api',p.BACK_TEMPLATE)),patch.object(p,'preflight_pointer'),patch.object(m,'helper_module',return_value=helper),patch.object(m,'containers',side_effect=inventory),patch.object(m,'command',side_effect=command),patch.object(m,'task_snapshot',side_effect=tasks),patch.object(m,'load_release',side_effect=lambda _: (copy.deepcopy(control),copy.deepcopy(new))),patch.object(m,'canonical_image_id',side_effect=lambda *a,**kw:canonical_fn(*a,architecture=arch)),patch.object(p,'load_image',side_effect=lambda *a:load_fn(*a,architecture=arch)),patch.object(p,'wait_api',side_effect=wait),patch.object(p,'healthy',side_effect=healthy),patch.object(p,'need',side_effect=lambda ok,code:m.need(ok or code=='HUB_PAIR_ROOT_REQUIRED',code))]
   for item in patches:stack.enter_context(item)
   healthy();before=m.baseline(inventory());before_tasks=tasks()
   # A changed, broken backend template must not infect rollback.
   write(package/'backend-compose.yml',back.replace('    labels:', '    command: [node, /missing-synthetic-fixture.mjs]\n    labels:'))
   try:p.run('pair-release','e'*64);raise AssertionError('broken API template accepted')
   except m.Stop:pass
   p.pair_matches(inventory(),old,target);healthy();passed.append('broken-new-backend-template-restores-old-API-and-frontend')
   write(package/'backend-compose.yml',back)
   # A frontend route failure also restores both components.
   write(package/'frontend-compose.yml',front.replace('    labels:', '    environment: {HUB_API_UPSTREAM: "http://127.0.0.1:1"}\n    labels:'));new['files']['docker-compose.ecs.yml']['sha256']=sha(package/'frontend-compose.yml')
   try:p.run('pair-release','e'*64);raise AssertionError('broken frontend accepted')
   except m.Stop:pass
   p.pair_matches(inventory(),old,target);healthy();passed.append('broken-new-frontend-restores-both-components')
   write(package/'frontend-compose.yml',front);new['files']['docker-compose.ecs.yml']['sha256']=sha(package/'frontend-compose.yml');p.run('pair-release','e'*64);p.pair_matches(inventory(),new,target);passed.append('successful-real-paired-upgrade')
   api=next(x for x in inventory() if (x['Config'].get('Labels') or {}).get('com.docker.compose.project')=='researchhub-backend');docker('stop',api['Id']);p.run('pair-rollback','e'*64);p.pair_matches(inventory(),old,target);healthy();passed.append('exited-new-API-can-roll-back-the-whole-pair')
   assert before==m.baseline(inventory());m.assert_task_snapshot(before_tasks,tasks());passed.append('sentinel-projects-and-six-real-PG-task-tables-unchanged')
  (output/'result.json').write_text(json.dumps({'passed':True,'cases':passed,'realDocker':True,'realHttp':True,'realPostgreSQL':True,'syntheticOnly':True,'applicationBusinessCapabilitiesTested':False,'imageIdentityAdapter':'normalize container-store IDs and fixture project names only','rdsAccess':False,'paidCalls':0},indent=2));print(json.dumps({'rehearsalPassed':True,'cases':passed}))
 except BaseException as error:
  diagnostics=[{'name':r['Name'],'status':r['State']['Status'],'log':docker('logs','--tail','5',r['Id'])[-800:] if r['Id']!=pg else 'synthetic PG'} for r in inspect()]
  print(json.dumps({'rehearsalPassed':False,'kind':type(error).__name__,'stderr':error.stderr.decode(errors='replace')[-800:] if isinstance(error,subprocess.CalledProcessError) and error.stderr else '', 'cases':passed,'fixtures':diagnostics}),flush=True)
  (output/('failure-'+key+'.json')).write_text(json.dumps({'passed':False,'kind':type(error).__name__,'stderr':error.stderr.decode(errors='replace')[-800:] if isinstance(error,subprocess.CalledProcessError) and error.stderr else '', 'cases':passed,'fixtures':diagnostics},indent=2));raise
 finally:
  for row in inspect():
   try:docker('rm','-f',row['Id'])
   except Exception:pass
  try:docker('network','rm',network)
  except Exception:pass
  for image in images:
   try:docker('image','rm',image)
   except Exception:pass
