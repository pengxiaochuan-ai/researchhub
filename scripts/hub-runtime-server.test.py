import importlib.util,pathlib,unittest,json
s=importlib.util.spec_from_file_location('m',str(pathlib.Path(__file__).with_name('hub-runtime-server.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ServerPlan(unittest.TestCase):
 def current(self):return {'HUB_DATABASE_NAME':'researchhub','HUB_DATABASE_APP_ROLE':'researchhub_demo_app','HUB_DATABASE_OWNER_ROLE':'researchhub_demo_owner','HUB_DATABASE_MARKER_SHA256':'a'*64,'HUB_SCHEMA_FINGERPRINT':'b'*32,'DEFAULT_TENANT_ID':m.TENANT,'ALLOWED_TENANT_IDS':m.TENANT,'DEPLOYMENT_PRODUCT':'researchhub','DEPLOYMENT_ID':'researchhub-demo-20261119','HUB_SOURCE_REVIEWER_ACCOUNT_ID':'rh-kb-local-b0e2af9d-admin','VITE_AUTH_TENANT_SLUG':m.TENANT,'DATABASE_URL':'private-app','DIRECT_URL':'private-owner','CUSTOM_SETTING':'preserve'}
 def release(self):return {'tag':'hub-runtime-12345678-1','backendImage':'researchhub-backend:hub-runtime-12345678-1','coreDigest':'c'*64,'tenantSlug':m.TENANT}
 def target(self):return {'database':'researchhub','tenantId':m.TENANT,'markerSha256':'a'*64,'schemaFingerprint':'b'*32}
 def storage(self):return {'S3_ENDPOINT':'https://oss-cn-hangzhou-internal.aliyuncs.com','S3_BUCKET':'synthetic-existing-bucket','S3_ACCESS_KEY':'existing-key','S3_SECRET_KEY':'existing-secret'}
 def test_plan_preserves_db_values_and_disables_all_historical_consumers(self):
  old=self.current();updates=m.plan_configuration(old,self.release(),self.target(),self.storage())
  self.assertNotIn('DATABASE_URL',updates);self.assertNotIn('DIRECT_URL',updates);self.assertNotIn('CUSTOM_SETTING',updates)
  self.assertEqual(updates['ENABLED_WORKER_KINDS'],'');self.assertEqual(updates['CONTROL_PLANE_ENABLED'],'false');self.assertEqual(updates['HUB_PAID_AI_ENABLED'],'false');self.assertEqual(updates['HUB_MAIL_MODE'],'disabled');self.assertEqual(updates['S3_REGION'],'oss-cn-hangzhou');self.assertGreaterEqual(len(updates['JWT_SECRET']),32)
 def test_existing_jwt_cookie_and_storage_are_not_replaced(self):
  old=dict(self.current(),JWT_SECRET='x'*48,AUTH_COOKIE_NAME='researchhub_existing',**self.storage())
  updates=m.plan_configuration(old,self.release(),self.target(),{})
  self.assertNotIn('JWT_SECRET',updates);self.assertNotIn('AUTH_COOKIE_NAME',updates);self.assertNotIn('S3_SECRET_KEY',updates)
 def test_partial_storage_configuration_is_not_silently_mixed(self):
  old=dict(self.current(),S3_BUCKET='other')
  with self.assertRaisesRegex(m.Stop,'HUB_STORAGE_PARTIAL'):m.plan_configuration(old,self.release(),self.target(),self.storage())
 def test_wrong_target_bindings_fail_before_config_changes(self):
  for key,value in [('HUB_DATABASE_NAME','aisci'),('HUB_DATABASE_MARKER_SHA256','f'*64),('HUB_SCHEMA_FINGERPRINT','f'*32),('ALLOWED_TENANT_IDS','another')]:
   old=self.current();old[key]=value
   with self.assertRaises(m.Stop):m.plan_configuration(old,self.release(),self.target(),self.storage())
 def test_invalid_existing_jwt_is_rejected_and_not_rotated(self):
  with self.assertRaises(m.Stop):m.plan_configuration(dict(self.current(),JWT_SECRET='short'),self.release(),self.target(),self.storage())
 def test_historical_state_changes_and_deletions_are_rejected_but_new_tasks_can_be_allowed(self):
  before={'tasks':{'old-id':'digest'}}
  m.assert_task_snapshot(before,{'tasks':{'old-id':'digest','new-id':'new-digest'}},allow_new=True)
  for after in ({'tasks':{}},{'tasks':{'old-id':'changed'}}):
   with self.assertRaises(m.Stop):m.assert_task_snapshot(before,after,allow_new=True)
  with self.assertRaises(m.Stop):m.assert_task_snapshot(before,{'tasks':{'old-id':'digest','new-id':'new-digest'}})
 def test_failure_cleanup_stops_only_matching_hub_api(self):
  from unittest.mock import patch
  def c(name,project,service,image):return {'Id':name,'Config':{'Labels':{'com.docker.compose.project':project,'com.docker.compose.service':service}},'Image':image,'State':{'Running':True}}
  rows=[c('old','ops','server','same'),c('site','official-site','official-site','same'),c('different','researchhub-backend','researchhub-api','other'),c('new','researchhub-backend','researchhub-api','same')]
  def command(args,timeout=60):
   self.assertEqual(args[:2],['docker','stop'])
   row=next(x for x in rows if x['Id']==args[-1]);row['State']['Running']=False;return ''
  with patch.object(m,'containers',return_value=rows),patch.object(m,'command',side_effect=command):m.stop_owned_api('same')
  self.assertFalse(rows[-1]['State']['Running']);self.assertTrue(all(x['State']['Running'] for x in rows[:-1]))
 def test_frontend_rejects_all_sensitive_environment_fields(self):
  for field in ('DATABASE_URL','DIRECT_URL','JWT_SECRET','S3_ACCESS_KEY','OSS_SECRET_KEY','SMTP_PASSWORD'):
   with self.assertRaises(m.Stop):m.assert_frontend_environment({'Config':{'Env':[field+'=private','HOST=0.0.0.0']}})
  m.assert_frontend_environment({'Config':{'Env':['HUB_API_UPSTREAM=http://researchhub-api:19612','PORT=3000']}})
 def test_frontend_identity_never_selects_old_or_site_projects(self):
  rows=[{'Id':'old','Config':{'Labels':{'com.docker.compose.project':'ops'}},'State':{'Running':True},'Image':'old'}, {'Id':'hub','Config':{'Labels':{'com.docker.compose.project':'researchhub'}},'State':{'Running':True},'Image':'new'}]
  self.assertEqual(m.frontend_container(rows,'new')['Id'],'hub')
  with self.assertRaises(m.Stop):m.frontend_container(rows,'old')
  with self.assertRaises(m.Stop):m.frontend_container(rows+[rows[-1]])
 def test_interrupted_activation_stops_only_new_api_in_finally(self):
  from unittest.mock import patch,MagicMock
  import tempfile,contextlib
  release=dict(self.release(),images={'backend':{'id':'sha256:new'}} ,files={'backend-image.tar.gz':{'sha256':'d'*64}})
  helper=MagicMock();helper.read_config.return_value=self.current()
  producer=MagicMock();producer.wait.return_value=0;producer.poll.return_value=0
  def command(args,*a,**kw):
   if args[:3]==['docker','network','inspect']:return json.dumps([{'Labels':{'com.docker.compose.project':'researchhub'}}])
   if args[:3]==['docker','image','inspect']:return json.dumps([{'Architecture':'amd64','Id':'sha256:new'}])
   if args[-2:]==['config','--services']:return 'researchhub-api'
   if 'up' in args:raise SystemExit(130)
   return ''
  with tempfile.TemporaryDirectory() as d,contextlib.ExitStack() as stack:
   root=pathlib.Path(d);(root/'backend-image.tar.gz').write_bytes(b'fixture')
   patches={'OPS':root,'PACKAGE':root,'load_release':lambda sha:({'target':self.target()},release),'helper_module':lambda:helper,'containers':lambda:[{'Config':{'Labels':{'com.docker.compose.project':'researchhub'}},'State':{'Running':True}}],'legacy_storage':lambda items:self.storage(),'task_snapshot':lambda *a:{'tasks':{}},'file_sha':lambda *a:'d'*64,'command':command}
   for key,value in patches.items():stack.enter_context(patch.object(m,key,value))
   stack.enter_context(patch.object(m.os,'geteuid',return_value=0))
   stack.enter_context(patch.object(m.shutil,'disk_usage',return_value=MagicMock(free=10*1024**3)))
   stack.enter_context(patch.object(m.socket,'socket'))
   stack.enter_context(patch.object(m.subprocess,'Popen',return_value=producer))
   stack.enter_context(patch.object(m.subprocess,'run',return_value=MagicMock(returncode=0)))
   cleanup=stack.enter_context(patch.object(m,'stop_owned_api'))
   with self.assertRaises(SystemExit):m.run('activate','a'*64)
   cleanup.assert_called_once_with('sha256:new')
 def test_canonical_config_id_is_derived_only_from_exact_pinned_archive(self):
  import tarfile,tempfile,hashlib,io
  config=json.dumps({'architecture':'amd64','os':'linux','rootfs':{'type':'layers','diff_ids':[]}}).encode();sha=hashlib.sha256(config).hexdigest();name='blobs/sha256/'+sha
  with tempfile.TemporaryDirectory() as d:
   archive=pathlib.Path(d)/'image.tar.gz'
   def write(config_name=name,tag='researchhub-backend:approved',extra=None):
    with tarfile.open(str(archive),'w:gz') as tf:
     for filename,data in [(config_name,config),('manifest.json',json.dumps([{'Config':config_name,'RepoTags':[tag],'Layers':[]}]).encode())]:
      member=tarfile.TarInfo(filename);member.size=len(data);tf.addfile(member,io.BytesIO(data))
     if extra is not None:tf.addfile(extra,io.BytesIO(b''))
    return hashlib.sha256(archive.read_bytes()).hexdigest()
   digest=write();self.assertEqual(m.canonical_image_id(archive,'researchhub-backend:approved',digest),'sha256:'+sha)
   with self.assertRaisesRegex(m.Stop,'IMAGE_DIGEST_MISMATCH'):m.canonical_image_id(archive,'researchhub-backend:approved','0'*64)
   with self.assertRaisesRegex(m.Stop,'IMAGE_TAG_REJECTED'):m.canonical_image_id(archive,'other:tag',digest)
   for filename,kind in [('../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('manifest.json',tarfile.REGTYPE),('link',tarfile.SYMTYPE),('hardlink',tarfile.LNKTYPE)]:
    member=tarfile.TarInfo(filename);member.type=kind;member.linkname='elsewhere';digest=write(extra=member)
    with self.assertRaisesRegex(m.Stop,'MEMBER_REJECTED'):m.canonical_image_id(archive,'researchhub-backend:approved',digest)
   digest=write(config_name='blobs/sha256/'+'a'*64)
   with self.assertRaisesRegex(m.Stop,'CONFIG_DIGEST_MISMATCH'):m.canonical_image_id(archive,'researchhub-backend:approved',digest)
if __name__=='__main__':unittest.main()
