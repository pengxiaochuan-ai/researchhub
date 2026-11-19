import importlib.util,pathlib,unittest
s=importlib.util.spec_from_file_location('execution',str(pathlib.Path(__file__).with_name('hub-execution-profile.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ProfileTests(unittest.TestCase):
 def enabled(self):return {'HUB_EXECUTION_PROFILE':m.PROFILE,'HUB_CHAT_ADMISSION_SHA256':'a'*64,'HUB_CHAT_ADMISSION_FILE':'/run/researchhub-admission/admission.json','HUB_CHAT_LEDGER_DIR':'/run/researchhub-ai-ledger'}
 def test_old_disabled_configuration_remains_disabled(self):self.assertEqual(m.values({})['HUB_PAID_AI_ENABLED'],'false')
 def test_enabled_is_exact_and_rejects_other_workers(self):
  state=self.enabled();self.assertEqual(m.values(state)['ENABLED_WORKER_KINDS'],'knowledge-chat')
  for key,value in [('ENABLED_WORKER_KINDS','research-agent'),('HUB_PAID_AI_ENABLED','false'),('HUB_CHAT_LEDGER_DIR','/tmp/reset')]:
   with self.assertRaises(ValueError):m.values(dict(state,**{key:value}))
 def test_old_image_cannot_be_used_as_on_rollback(self):
  with self.assertRaises(ValueError):m.support({'coreDigest':m.CORE},self.enabled())
  self.assertEqual(m.support({'coreDigest':m.CORE,'supportedExecutionProfiles':[m.PROFILE]},self.enabled())['HUB_PAID_AI_ENABLED'],'true')
 def test_only_tiny_fixed_private_bind_mounts_are_accepted(self):
  rows=[{'type':'bind','source':str(m.ROOT/name),'target':target,'read_only':ro,'bind':{'create_host_path':False}} for name,target,ro in [('admission','/run/researchhub-admission',True),('ledger','/run/researchhub-ai-ledger',False)]]
  m.mounts({'volumes':rows},self.enabled());rows[1]['source']='/srv/researchhub/ops'
  with self.assertRaises(ValueError):m.mounts({'volumes':rows},self.enabled())
if __name__=='__main__':unittest.main()
