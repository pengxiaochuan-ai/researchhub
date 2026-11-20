import contextlib,copy,hashlib,importlib.util,io,json,os,pathlib,sys,tempfile,unittest
from unittest.mock import MagicMock,patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,str(ROOT/'scripts'/file));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
release=module('p002_release','hub-release.py');pair=module('p002_pair','hub-release-pair.py')

def manifest(tag,front):
 return {'tag':tag,'controlGit':'a'*40,'coreDigest':'b'*64,'hubDigest':'c'*64,'backendImage':'researchhub-backend:hub-runtime-aaaaaaaa-1','frontendImage':'front:'+front,
  'components':{'backend':{'sourceGit':'d'*40,'built':False}},
  'images':{'backend':{'id':'sha256:'+'e'*64,'configId':'sha256:'+'e'*64,'architecture':'amd64'}},
  'files':{'backend-image.tar.gz':{'bytes':5,'sha256':'f'*64},'backend-compose.yml':{'bytes':7,'sha256':'1'*64}},'supportedExecutionProfiles':['disabled']}

class FrontendReleaseTests(unittest.TestCase):
 def setUp(self):
  old=dict(pair.m.EXECUTION_SAVED);self.addCleanup(setattr,pair.m,'EXECUTION_SAVED',old);pair.m.EXECUTION_SAVED={}
 def active_state(self):
  return {'HUB_EXECUTION_PROFILE':pair.m.execution.KNOWLEDGE_PROFILE,'HUB_CHAT_ADMISSION_SHA256':'a'*64,'HUB_CHAT_ADMISSION_FILE':'/run/researchhub-admission/admission.json','HUB_CHAT_LEDGER_DIR':'/run/researchhub-ai-ledger','HUB_PAID_AI_ENABLED':'true','ENABLED_WORKER_KINDS':'knowledge-chat,knowledge-import'}
 def validation_inputs(self):
  state=self.active_state();tenant=pair.m.TENANT
  state.update({'HUB_DATABASE_NAME':'researchhub','HUB_DATABASE_APP_ROLE':'researchhub_demo_app','HUB_DATABASE_OWNER_ROLE':'researchhub_demo_owner','HUB_DATABASE_MARKER_SHA256':'b'*64,'HUB_SCHEMA_FINGERPRINT':'c'*32,'DEFAULT_TENANT_ID':tenant,'ALLOWED_TENANT_IDS':tenant,'DEPLOYMENT_PRODUCT':'researchhub','VITE_AUTH_TENANT_SLUG':tenant,'DEPLOYMENT_ID':'researchhub-demo-20261119','HUB_SOURCE_REVIEWER_ACCOUNT_ID':'rh-kb-local-b0e2af9d-admin','S3_ENDPOINT':'https://oss-cn-hangzhou.aliyuncs.com','S3_BUCKET':'synthetic-researchhub','S3_ACCESS_KEY':'synthetic','S3_SECRET_KEY':'synthetic','JWT_SECRET':'s'*40,'AUTH_COOKIE_NAME':'researchhub_demo_session'})
  old=manifest('hub-runtime-bbbbbbbb-2','old');old.update(coreDigest=pair.m.execution.KNOWLEDGE_CORE,tenantSlug=tenant,supportedExecutionProfiles=[pair.m.execution.KNOWLEDGE_PROFILE]);new=copy.deepcopy(old);new['tag']='hub-runtime-cccccccc-3';new['executionPolicy']={'profile':pair.m.execution.PROFILE,'admissionSha256':'f'*64}
  target={'database':'researchhub','tenantId':tenant,'markerSha256':'b'*64,'schemaFingerprint':'c'*32};return old,new,state,target
 def test_frontend_only_validation_uses_current_supported_policy_and_original_backend_tag(self):
  old,new,state,target=self.validation_inputs();original=copy.deepcopy(new)
  context=pair.backend_configuration_context(old,new,state,True)
  result=pair.m.plan_configuration(state,context,target,{})
  self.assertEqual(context['tag'],'hub-runtime-aaaaaaaa-1');self.assertEqual(context['backendImage'],old['backendImage'])
  self.assertEqual(context['executionPolicy'],{'profile':pair.m.execution.KNOWLEDGE_PROFILE,'admissionSha256':'a'*64})
  self.assertEqual(result['HUB_CHAT_ADMISSION_SHA256'],state['HUB_CHAT_ADMISSION_SHA256']);self.assertEqual(new,original)
 def test_backend_changing_validation_keeps_strict_proposed_policy(self):
  old,new,state,target=self.validation_inputs();context=pair.backend_configuration_context(old,new,state,False)
  self.assertIs(context,new)
  with self.assertRaisesRegex(pair.m.Stop,'EXECUTION_POLICY_MISMATCH'):pair.m.plan_configuration(state,context,target,{})
 def test_unknown_or_inconsistent_current_execution_is_never_adopted(self):
  old,new,state,_=self.validation_inputs()
  for changes in [{'HUB_EXECUTION_PROFILE':'unknown'},{'ENABLED_WORKER_KINDS':'research-agent'},{'HUB_PAID_AI_ENABLED':'false'},{'HUB_CHAT_ADMISSION_SHA256':'not-a-digest'}]:
   with self.assertRaises(pair.m.Stop):pair.backend_configuration_context(old,new,dict(state,**changes),True)
  old['supportedExecutionProfiles']=[]
  with self.assertRaisesRegex(pair.m.Stop,'EXECUTION_UNSUPPORTED'):pair.backend_configuration_context(old,new,state,True)
 def test_reused_backend_reference_remains_exactly_original(self):
  old=manifest('old','old');self.assertEqual(release.backend_reference(old,'hub-runtime-bbbbbbbb-2',False),old['backendImage'])
  self.assertEqual(release.backend_reference(old,'hub-runtime-bbbbbbbb-2',True),'researchhub-backend:hub-runtime-bbbbbbbb-2')
 def test_unchanged_backend_requires_the_complete_original_identity(self):
  old=manifest('old','old');new=manifest('new','new');self.assertTrue(pair.backend_unchanged(old,new))
  for key in ('backendImage','coreDigest','hubDigest'):
   bad=copy.deepcopy(new);bad[key]='changed'
   with self.assertRaises(pair.m.Stop):pair.backend_unchanged(old,bad)
  for path in [('images','backend','configId'),('files','backend-image.tar.gz','sha256'),('files','backend-compose.yml','sha256'),('components','backend','sourceGit')]:
   bad=copy.deepcopy(new);target=bad
   for key in path[:-1]:target=target[key]
   target[path[-1]]='changed'
   with self.assertRaises(pair.m.Stop):pair.backend_unchanged(old,bad)
 def test_missing_reuse_metadata_fails_closed_and_legacy_changed_backend_uses_original_path(self):
  old=manifest('old','old');new=manifest('new','new');del new['files']['backend-image.tar.gz']
  with self.assertRaises(pair.m.Stop):pair.backend_unchanged(old,new)
  new['components']['backend']['built']=True;self.assertFalse(pair.backend_unchanged(old,new))
 def test_reverse_frontend_restore_keeps_same_backend_despite_original_built_flag(self):
  old=manifest('old','old');new=manifest('new','new');old['components']['backend']['built']=True
  self.assertTrue(pair.backend_unchanged(new,old))
 def test_apply_frontend_does_not_stop_up_or_write_backend(self):
  helper=MagicMock();commands=[]
  with patch.object(pair.m,'command',side_effect=lambda args,*a,**k:commands.append(args)),patch.object(pair,'healthy'):
   pair.apply_images(helper,manifest('new','new'),keep_backend=True)
  self.assertEqual([call.args[0].name for call in helper.save_config.call_args_list],['current.env'])
  self.assertFalse(any('researchhub-api' in command or 'researchhub-backend' in command for command in commands))
  self.assertTrue(any(command[-1]=='researchhub' and 'up' in command for command in commands))
 def test_snapshot_is_secret_free_and_detects_restart_and_configuration_change(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);(root/'.env.prod').write_text('SECRET=synthetic-only\n')
   row={'Id':'original-container','Image':'sha256:'+'e'*64,'Config':{'Image':'old-ref','Env':['SECRET=synthetic-only']},'State':{'Running':True,'StartedAt':'first'},'RestartCount':0}
   with patch.object(pair.m,'OPS',root),patch.object(pair.m,'live_api',return_value=row):
    first=pair.backend_snapshot([],manifest('new','new'),{})
    self.assertNotIn('synthetic-only',json.dumps(first));self.assertNotIn('Env',first)
    self.assertEqual(first['containerId'],'original-container')
    row['State']['StartedAt']='restarted';self.assertNotEqual(first,pair.backend_snapshot([],manifest('new','new'),{}))
    row['State']['StartedAt']='first';(root/'.env.prod').write_text('SECRET=changed\n');self.assertNotEqual(first,pair.backend_snapshot([],manifest('new','new'),{}))
 def exercise_pair(self,fail_front=False,finalize=False,drift=False,explicit_rollback=False):
  with tempfile.TemporaryDirectory() as d,contextlib.ExitStack() as stack:
   root=pathlib.Path(d);ops=root/'ops';package=root/'control';ops.mkdir();package.mkdir();compose=b'services:\n  researchhub:\n    image: ${RESEARCHHUB_IMAGE}\n'
   for file in [ops/'docker-compose.ecs.yml',package/'frontend-compose.yml',package/'previous-frontend-compose.yml']:file.write_bytes(compose)
   for file in [package/'backend-compose.yml',package/'previous-backend-compose.yml']:file.write_bytes(b'backend')
   (ops/'.env.prod').write_text('HUB_BACKEND_IMAGE=researchhub-backend:hub-runtime-aaaaaaaa-1\nSECRET=synthetic\n');initial_env=(ops/'.env.prod').read_bytes()
   (ops/'current.env').write_text('RESEARCHHUB_IMAGE=front:old\nRESEARCHHUB_PORT=8083\n')
   old=manifest('old','old');new=manifest('new','new')
   for value,char in [(old,'1'),(new,'2')]:
    value['images']['frontend']={'id':'sha256:'+char*64,'configId':'sha256:'+char*64};value['files']['researchhub.tar.gz']={'sha256':'3'*64};value['files']['docker-compose.ecs.yml']={'sha256':hashlib.sha256(compose).hexdigest()}
   raw=json.dumps(old).encode();(package/'previous-release.json').write_bytes(raw)
   control={'paired':True,'target':{},'previousManifestSha256':hashlib.sha256(raw).hexdigest(),'imageManifestSha256':'4'*64,'previousBackendComposeSha256':hashlib.sha256(b'backend').hexdigest()}
   backend={'Id':'original-backend','Image':old['images']['backend']['configId'],'State':{'Running':True,'StartedAt':'original-start'},'RestartCount':0,'Config':{'Image':old['backendImage'],'Env':['SECRET=synthetic'],'Labels':{'com.docker.compose.project':'researchhub-backend','com.docker.compose.service':'researchhub-api'}}}
   front={'Id':'front-container','Image':old['images']['frontend']['id'],'State':{'Running':True},'Config':{'Image':old['frontendImage'],'Env':[],'Labels':{'com.docker.compose.project':'researchhub','com.docker.compose.service':'researchhub'}}}
   commands=[];failed=False;publisher=MagicMock();helper=MagicMock()
   def read_config(file):return dict(line.split('=',1) for line in file.read_text().splitlines())
   def save_config(file,changes):
    self.assertNotEqual(file.name,'.env.prod');values=read_config(file);values.update(changes);file.write_text(''.join(key+'='+value+'\n' for key,value in values.items()))
   helper.read_config.side_effect=read_config;helper.save_config.side_effect=save_config
   def command(args,*a,**k):
    nonlocal failed
    commands.append(args)
    if 'config' in args:return 'researchhub-api' if 'researchhub-backend' in args else 'researchhub'
    self.assertNotIn('researchhub-api',args);self.assertNotIn('researchhub-backend',args)
    if 'up' in args:
     front['Config']['Image']=read_config(ops/'current.env')['RESEARCHHUB_IMAGE'];front['Image']=new['images']['frontend']['id'] if front['Config']['Image']=='front:new' else old['images']['frontend']['id']
     if fail_front and not failed:failed=True;raise pair.m.Stop('SYNTHETIC_FRONT_FAILED')
    return ''
   patches=[patch.object(pair,'HERE',package),patch.object(pair,'FRONT_TEMPLATE',package/'frontend-compose.yml'),patch.object(pair.m,'OPS',ops),patch.object(pair.m.os,'geteuid',return_value=0),patch.object(pair.m,'load_release',return_value=(control,new)),patch.object(pair.m,'helper_module',return_value=helper),patch.object(pair.m,'plan_configuration'),patch.object(pair.m,'containers',side_effect=lambda:[backend,front]),patch.object(pair.m,'baseline',return_value=[]),patch.object(pair.m,'task_snapshot',return_value={'tasks':{'same':'tasks'}}),patch.object(pair.m,'canonical_image_id',return_value=new['images']['frontend']['id']),patch.object(pair.m,'live_api',side_effect=lambda *args:backend),patch.object(pair.m,'command',side_effect=command),patch.object(pair,'validate_templates'),patch.object(pair,'preflight_pointer'),patch.object(pair,'healthy'),patch.object(pair,'publish_pointer',publisher),patch.object(pair,'load_image',return_value={'Config':{'Env':[]}})]
   for item in patches:stack.enter_context(item)
   if fail_front:
    with self.assertRaises(pair.m.Stop):pair.run('pair-release','5'*64)
   else:pair.run('pair-release','5'*64)
   if finalize:
    if drift:backend['State']['StartedAt']='unauthorized-restart'
    if drift:
     with self.assertRaisesRegex(pair.m.Stop,'BACKEND_BASELINE_CHANGED'):pair.run('pair-finalize','5'*64)
    else:pair.run('pair-finalize','5'*64)
   if explicit_rollback:pair.run('pair-rollback','5'*64)
   self.assertEqual((ops/'.env.prod').read_bytes(),initial_env)
   receipt=json.loads((package/'pair-receipt.json').read_text());self.assertEqual(receipt['backendPreserved']['containerId'],'original-backend')
   return receipt,publisher.call_count,front['Config']['Image'],commands
 def test_real_pair_control_flow_preserves_backend_and_still_finalizes_pointer(self):
  receipt,published,front,_=self.exercise_pair(finalize=True);self.assertEqual(receipt['status'],'promoted');self.assertEqual(published,1);self.assertEqual(front,'front:new')
 def test_failed_frontend_restores_only_previous_frontend(self):
  receipt,published,front,_=self.exercise_pair(fail_front=True);self.assertEqual(receipt['status'],'rolled-back');self.assertEqual(published,0);self.assertEqual(front,'front:old')
 def test_explicit_frontend_rollback_preserves_original_backend(self):
  receipt,published,front,_=self.exercise_pair(explicit_rollback=True);self.assertEqual(receipt['status'],'rolled-back');self.assertEqual(published,0);self.assertEqual(front,'front:old')
 def test_backend_restart_during_browser_blocks_pointer_promotion(self):
  receipt,published,_,_=self.exercise_pair(finalize=True,drift=True);self.assertEqual(receipt['status'],'applied');self.assertEqual(published,0)
 def collect_reused(self,tampered=False):
  with tempfile.TemporaryDirectory() as d:
   directory=pathlib.Path(d);old=manifest('old','old');original=b'synthetic-original-archive';archive=directory/'backend-image.tar.gz';archive.write_bytes(original if not tampered else b'changed')
   old['files']['backend-image.tar.gz']={'bytes':len(original),'sha256':hashlib.sha256(original).hexdigest()}
   (directory/'researchhub.tar.gz').write_bytes(b'synthetic-front');(directory/'previous-release.json').write_text(json.dumps(old));(directory/'baseline-pointer.json').write_text('{"tag":"old"}');(directory/'plan.json').write_text(json.dumps({'build':{'frontend':True,'backend':False},'databaseDigest':'f'*64,'databaseSources':[]}))
   tag='hub-runtime-cccccccc-2';front='ghcr.io/pengxiaochuan-ai/pengxc-researchhub:'+tag
   info=lambda reference:{'id':'sha256:'+('a'*64 if reference==front else 'e'*64),'architecture':'amd64'}
   with patch.object(sys,'argv',['release','collect','--directory',str(directory)]),patch.dict(os.environ,{'HUB_RELEASE_TAG':tag,'GITHUB_SHA':'c'*40,'HUB_TENANT_SLUG':'synthetic-only'}),patch.object(release.artifacts,'bucket'),patch.object(release.artifacts,'image_info',side_effect=info),patch.object(release.runtime,'canonical_image_id',side_effect=lambda file,reference,sha:info(reference)['id']):
    if tampered:
     with self.assertRaisesRegex(ValueError,'REUSED_BACKEND_ARCHIVE_MISMATCH'):release.main()
     self.assertFalse((directory/'runtime-release.json').exists());return
    release.main();result=json.loads((directory/'runtime-release.json').read_text())
   self.assertEqual(result['backendImage'],old['backendImage']);self.assertEqual(result['files']['backend-image.tar.gz'],old['files']['backend-image.tar.gz']);self.assertEqual(archive.read_bytes(),original)
   self.assertEqual(result['components']['backend']['sourceGit'],old['components']['backend']['sourceGit']);self.assertFalse(result['components']['backend']['built']);self.assertEqual(result['coreDigest'],old['coreDigest']);self.assertEqual(result['hubDigest'],old['hubDigest'])
   self.assertFalse((directory.parent/'hub-backend-context').exists())
 def test_collect_seals_original_backend_archive_and_source_without_private_context(self):self.collect_reused()
 def test_collect_rejects_resaved_or_tampered_original_backend_archive(self):self.collect_reused(tampered=True)
 def test_reuse_backend_loads_original_tag_without_retagging(self):
  with tempfile.TemporaryDirectory() as d:
   directory=pathlib.Path(d);old=manifest('old','old');original=b'original';old['files']['backend-image.tar.gz']={'bytes':len(original),'sha256':hashlib.sha256(original).hexdigest()}
   (directory/'previous-release.json').write_text(json.dumps(old));(directory/'plan.json').write_text(json.dumps({'build':{'backend':False}}));store=MagicMock();store.get_object_to_file.side_effect=lambda key,name:pathlib.Path(name).write_bytes(original)
   producer=MagicMock();producer.stdout=io.BytesIO();producer.wait.return_value=0
   with patch.object(sys,'argv',['release','reuse','--directory',str(directory),'--component','backend']),patch.object(release.artifacts,'bucket',return_value=store),patch.object(release.runtime,'canonical_image_id') as canonical,patch.object(release.subprocess,'Popen') as popen,patch.object(release.subprocess,'run') as run:
    popen.return_value.__enter__.return_value=producer;release.main()
   self.assertEqual((directory/'backend-image.tar.gz').read_bytes(),original);self.assertEqual(canonical.call_args.args[1],old['backendImage']);self.assertEqual([call.args[0] for call in run.call_args_list],[['docker','load']])

if __name__=='__main__':unittest.main()
