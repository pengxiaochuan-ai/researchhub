import importlib.util,pathlib,unittest,json,tempfile,hashlib,types
from unittest.mock import patch
s=importlib.util.spec_from_file_location('execution',str(pathlib.Path(__file__).with_name('hub-execution-profile.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ProfileTests(unittest.TestCase):
 def enabled(self):return {'HUB_EXECUTION_PROFILE':m.PROFILE,'HUB_CHAT_ADMISSION_SHA256':'a'*64,'HUB_CHAT_ADMISSION_FILE':'/run/researchhub-admission/admission.json','HUB_CHAT_LEDGER_DIR':'/run/researchhub-ai-ledger'}
 def test_old_disabled_configuration_remains_disabled(self):self.assertEqual(m.values({})['HUB_PAID_AI_ENABLED'],'false')
 def test_enabled_is_exact_and_rejects_other_workers(self):
  state=self.enabled();self.assertEqual(m.values(state)['ENABLED_WORKER_KINDS'],'knowledge-chat')
  for key,value in [('ENABLED_WORKER_KINDS','research-agent'),('HUB_PAID_AI_ENABLED','false'),('HUB_CHAT_LEDGER_DIR','/tmp/reset')]:
   with self.assertRaises(ValueError):m.values(dict(state,**{key:value}))
 def test_extension_requires_explicit_capability_and_rejects_unknown_flag(self):
  state=dict(self.enabled(),HUB_EXECUTION_PROFILE=m.KNOWLEDGE_PROFILE,HUB_CHAT_BUDGET_EXTENSION='citation-review-v1');release={'coreDigest':m.KNOWLEDGE_CORE,'supportedExecutionProfiles':[m.KNOWLEDGE_PROFILE]}
  with self.assertRaises(ValueError):m.support(release,state)
  self.assertEqual(m.support(dict(release,supportedBudgetExtensions=['citation-review-v1']),state)['HUB_CHAT_BUDGET_EXTENSION'],'citation-review-v1')
  with self.assertRaises(ValueError):m.values(dict(state,HUB_CHAT_BUDGET_EXTENSION='unknown'))
 def test_old_image_cannot_be_used_as_on_rollback(self):
  with self.assertRaises(ValueError):m.support({'coreDigest':m.CORE},self.enabled())
  self.assertEqual(m.support({'coreDigest':m.CORE,'supportedExecutionProfiles':[m.PROFILE]},self.enabled())['HUB_PAID_AI_ENABLED'],'true')
 def test_knowledge_profile_keeps_models_on_and_only_two_scoped_workers(self):
  state=dict(self.enabled(),HUB_EXECUTION_PROFILE=m.KNOWLEDGE_PROFILE)
  self.assertEqual(m.values(state)['ENABLED_WORKER_KINDS'],'knowledge-chat,knowledge-import')
  self.assertEqual(m.support({'coreDigest':m.KNOWLEDGE_CORE,'supportedExecutionProfiles':[m.PROFILE,m.KNOWLEDGE_PROFILE]},state)['HUB_PAID_AI_ENABLED'],'true')
  with self.assertRaises(ValueError):m.support({'coreDigest':m.CORE,'supportedExecutionProfiles':[m.PROFILE]},state)
  with self.assertRaises(ValueError):m.values(dict(state,ENABLED_WORKER_KINDS='knowledge-chat,knowledge-import,research-methods'))
 def test_bridge_core_transition_is_exact_and_never_restores_old_core_in_v2(self):
  old={'coreDigest':m.CORE};new={'coreDigest':m.KNOWLEDGE_CORE};upgrade={'sourceCoreDigest':m.CORE,'targetCoreDigest':m.KNOWLEDGE_CORE}
  m.core_transition(old,new,self.enabled(),upgrade);m.core_transition(new,old,self.enabled(),upgrade)
  for state,guard in [(self.enabled(),None),(self.enabled(),dict(upgrade,targetCoreDigest='f'*64)),(dict(self.enabled(),HUB_EXECUTION_PROFILE=m.KNOWLEDGE_PROFILE),upgrade)]:
   with self.assertRaises(ValueError):m.core_transition(old,new,state,guard)
 def test_only_tiny_fixed_private_bind_mounts_are_accepted(self):
  rows=[{'type':'bind','source':str(m.ROOT/name),'target':target,'read_only':ro,'bind':{'create_host_path':False}} for name,target,ro in [('admission','/run/researchhub-admission',True),('ledger','/run/researchhub-ai-ledger',False)]]
  m.mounts({'volumes':rows},self.enabled());rows[1]['source']='/srv/researchhub/ops'
  with self.assertRaises(ValueError):m.mounts({'volumes':rows},self.enabled())
 def test_old_compose_omission_requires_the_exact_sealed_false_bind(self):
  rows=[{'type':'bind','source':str(m.ROOT/name),'target':target,'read_only':ro,'bind':{}} for name,target,ro in [('admission','/run/researchhub-admission',True),('ledger','/run/researchhub-ai-ledger',False)]]
  with self.assertRaises(ValueError):m.mounts({'volumes':rows},self.enabled())
  template=(pathlib.Path(__file__).parent.parent/'deploy/backend-demo.compose.yml').read_text();m.mounts({'volumes':rows},self.enabled(),template)
  rows[1]['bind']['create_host_path']=True
  with self.assertRaises(ValueError):m.mounts({'volumes':rows},self.enabled(),template)
 def test_v2_validates_all_rows_but_only_new_k01_jobs_may_change(self):
  actors=sorted(m.ACCOUNTS);stamp='2026-11-20T00:00:00.000Z';sessions=[{'accountId':a,'sessionId':'old-session-'+str(i)} for i,a in enumerate(actors)];jobs=[{'id':'old-job-'+str(i),'accountId':a,'sessionId':sessions[i]['sessionId'],'requestKey':'old-key-'+str(i),'createdAt':stamp} for i,a in enumerate(actors)];dispatches=[{'state':'known','feeUpperMicros':1} for _ in actors]
  prefix={'sessions':sessions,'jobs':jobs,'dispatches':dispatches};digest=hashlib.sha256(json.dumps(prefix,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest();a={'schema':'hub-chat-admission.v2','tenantId':'tenant','campaignId':'campaign','issuedAt':stamp,'historicalChatIds':[],'limits':{'jobs':6,'sessions':4,'dispatches':4},'legacy':{'prefixHash':digest},'k01':{'issuedAt':stamp,'bindings':[{'accountId':a,'kbId':'kb-'+str(i)} for i,a in enumerate(actors)]}};ledger={'schema':'hub-chat-budget.v2','admissionSha':'a'*64,'campaignId':'campaign','revision':2,'inheritedRevision':1,**json.loads(json.dumps(prefix))};ledger['sessions'].append({'accountId':actors[0],'sessionId':'new-session','contextKey':'kb:kb-0','reservedAt':stamp});ledger['jobs'].append({'id':'new-job','accountId':actors[0],'sessionId':'new-session','requestKey':'new-key','createdAt':stamp})
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);(root/'ledger').mkdir();file=root/'ledger/budget.json';file.write_text(json.dumps(ledger));original_stat=pathlib.Path.stat
   def stat(path,*args,**kwargs):
    value=original_stat(path,*args,**kwargs)
    return types.SimpleNamespace(st_uid=1000,st_mode=0o100600,st_size=value.st_size) if path==file else value
   with patch.object(m,'ROOT',root),patch.object(m,'sealed',return_value=a),patch.object(pathlib.Path,'stat',stat):
    self.assertEqual(set(m.admitted_jobs({'HUB_EXECUTION_PROFILE':m.KNOWLEDGE_PROFILE,'HUB_CHAT_ADMISSION_SHA256':'a'*64})),{'new-job'})
if __name__=='__main__':unittest.main()
