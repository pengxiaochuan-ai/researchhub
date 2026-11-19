import importlib.util,pathlib,json,hashlib,unittest,tempfile,contextlib
from unittest.mock import patch,MagicMock
s=importlib.util.spec_from_file_location('pair',str(pathlib.Path(__file__).with_name('hub-release-pair.py')));p=importlib.util.module_from_spec(s);s.loader.exec_module(p);m=p.m
class PairTests(unittest.TestCase):
 def exercise(self,failure=None,wrong_baseline=False,action='pair-release',drift=False):
  with tempfile.TemporaryDirectory() as d,contextlib.ExitStack() as stack:
   root=pathlib.Path(d);ops=root/'ops';package=root/'control';ops.mkdir();package.mkdir();compose=b'services:\n  researchhub:\n    image: ${RESEARCHHUB_IMAGE}\n';(ops/'docker-compose.ecs.yml').write_bytes(compose);(package/'frontend-compose.yml').write_bytes(compose);(package/'previous-frontend-compose.yml').write_bytes(compose);(package/'previous-backend-compose.yml').write_bytes(b'old-backend');(package/'backend-compose.yml').write_bytes(b'new-backend')
   def release(tag,char):return {'tag':tag,'controlGit':'a'*40,'coreDigest':'b'*64,'frontendImage':'front:'+tag,'backendImage':'back:'+tag,'images':{k:{'id':'sha256:'+char*64,'configId':'sha256:'+char*64} for k in ('frontend','backend')},'files':{'docker-compose.ecs.yml':{'sha256':hashlib.sha256(compose).hexdigest()},'researchhub.tar.gz':{'sha256':'c'*64}}}
   old=release('old','1');new=release('new','2');raw=json.dumps(old).encode();(package/'previous-release.json').write_bytes(raw);control={'paired':True,'previousBackendComposeSha256':hashlib.sha256(b'old-backend').hexdigest(),'target':{},'previousManifestSha256':hashlib.sha256(raw).hexdigest(),'imageManifestSha256':'d'*64};state={'tag':'unknown' if wrong_baseline else 'old','calls':[]};helper=MagicMock();publisher=MagicMock();
   if action=='pair-finalize':
    state['tag']='new';(package/'pair-receipt.json').write_text(json.dumps({'status':'applied'}));(package/'pair-baseline.json').write_text(json.dumps({'services':[],'tasks':{'tasks':{'old':'same'}}}))
   helper.read_config.side_effect=lambda path:{'RESEARCHHUB_IMAGE':old['frontendImage']} if path.name=='current.env' else {'HUB_BACKEND_IMAGE':old['backendImage']}
   def matches(items,release,target):
    if state['tag']!=release['tag']:raise m.Stop('HUB_PAIR_WRONG_CURRENT')
    return {},{}
   def apply(helper,release,template=None,backend_template=None):
    if release['tag']=='old':self.assertEqual(backend_template.read_bytes(),b'old-backend')
    state['calls'].append(release['tag']);state['tag']=release['tag']
    if release['tag']=='new' and failure=='interrupt':raise SystemExit(130)
    if release['tag']=='new' and failure:raise m.Stop('HUB_PAIR_SIMULATED_API_FAILURE')
   patches=[patch.object(p,'HERE',package),patch.object(p,'FRONT_TEMPLATE',package/'frontend-compose.yml'),patch.object(m,'OPS',ops),patch.object(m.os,'geteuid',return_value=0),patch.object(m,'load_release',return_value=(control,new)),patch.object(m,'helper_module',return_value=helper),patch.object(m,'plan_configuration'),patch.object(m,'containers',return_value=[]),patch.object(m,'baseline',return_value=[]),patch.object(m,'task_snapshot',return_value={'tasks':{'old':'changed' if drift else 'same'}}),patch.object(m,'canonical_image_id',return_value='sha256:'+'2'*64),patch.object(p,'back_args',return_value=['docker','compose','researchhub-api']),patch.object(m,'command',side_effect=lambda args,*a,**k:'researchhub-api' if 'researchhub-api' in args else 'researchhub'),patch.object(p,'preflight_pointer',side_effect=m.Stop('HUB_PAIR_STORAGE_WRITE_NOT_AUTHORIZED') if failure=='storage' else None),patch.object(p,'healthy'),patch.object(p,'publish_pointer',publisher),patch.object(p,'pair_matches',side_effect=matches),patch.object(p,'apply_images',side_effect=apply),patch.object(p,'load_image',return_value={'Config':{'Env':[]}})]
   for item in patches:stack.enter_context(item)
   if failure or wrong_baseline or drift:
    with self.assertRaises(BaseException):p.run(action,'e'*64)
   else:p.run(action,'e'*64)
   receipt=json.loads((package/'pair-receipt.json').read_text()) if (package/'pair-receipt.json').exists() else None
   state['publishCalls']=publisher.call_count;return state,receipt
 def test_success_applies_the_pair_and_records_truthful_scope(self):
  state,receipt=self.exercise();self.assertEqual(state['calls'],['new']);self.assertEqual(receipt['status'],'applied');self.assertFalse(receipt['databaseMigrationExecuted'])
 def test_failed_api_restores_both_previous_components(self):
  state,receipt=self.exercise('api');self.assertEqual(state['calls'],['new','old']);self.assertEqual(state['tag'],'old');self.assertEqual(receipt['status'],'rolled-back')
 def test_process_interrupt_uses_the_same_paired_restore(self):
  state,receipt=self.exercise('interrupt');self.assertEqual(state['calls'],['new','old']);self.assertEqual(receipt['status'],'rolled-back')
 def test_unknown_live_pair_is_rejected_before_any_mutation(self):
  state,receipt=self.exercise(wrong_baseline=True);self.assertEqual(state['calls'],[]);self.assertIsNone(receipt)
 def test_recovery_accepts_exited_own_pair_but_never_unknown_images(self):
  release={'backendImage':'back:new','frontendImage':'front:new','images':{k:{'id':'sha256:new'} for k in ('backend','frontend')}}
  rows=[{'Image':'sha256:new','State':{'Running':False,'Status':'exited'},'Config':{'Image':ref,'Env':[],'Labels':{'com.docker.compose.project':project,'com.docker.compose.service':service}}} for ref,project,service in [('back:new','researchhub-backend','researchhub-api'),('front:new','researchhub','researchhub')]]
  p.owned_pair(rows,release);rows[0]['Image']='sha256:unknown'
  with self.assertRaises(m.Stop):p.owned_pair(rows,release)
 def test_finalize_never_advances_pointer_if_historical_tasks_changed_during_browser(self):
  state,receipt=self.exercise(action='pair-finalize',drift=True);self.assertEqual(state['publishCalls'],0);self.assertEqual(receipt['status'],'applied');self.assertEqual(state['calls'],[])
 def test_finalize_advances_only_after_persisted_baseline_matches(self):
  state,receipt=self.exercise(action='pair-finalize');self.assertEqual(state['publishCalls'],1);self.assertEqual(receipt['status'],'promoted')
 def test_missing_existing_storage_write_authority_stops_before_any_service_change(self):
  state,receipt=self.exercise('storage');self.assertEqual(state['calls'],[]);self.assertEqual(state['publishCalls'],0);self.assertIsNone(receipt)
if __name__=='__main__':unittest.main()
