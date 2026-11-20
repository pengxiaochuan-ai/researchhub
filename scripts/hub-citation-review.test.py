import importlib.util,pathlib,tempfile,unittest,hashlib,json
from unittest.mock import patch,MagicMock
from contextlib import redirect_stdout
import io

def load(name,file):
 s=importlib.util.spec_from_file_location(name,str(pathlib.Path(__file__).with_name(file)));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('citation','hub-citation-review.py');h=load('helpers','hub-k01-runtime.py')
class CitationOperator(unittest.TestCase):
 def stage(self):
  with redirect_stdout(io.StringIO()):m.main('advice-stage')
 def fixture(self):
  d=tempfile.TemporaryDirectory();self.addCleanup(d.cleanup);ops=pathlib.Path(d.name).resolve();root=ops/'chat-runtime';(root/'admission').mkdir(parents=True);(root/'ledger').mkdir();(root/'admission/admission.json').write_bytes(b'original-admission');(root/'ledger/budget.json').write_bytes(b'original-ledger');original_sha=h.sha
  fake_sha=lambda raw:m.OLD if raw==b'original-admission' else original_sha(raw)
  settings={'HUB_DATABASE_NAME':'researchhub','DEFAULT_TENANT_ID':'rh-kb-local-b0e2af9d-tenant','HUB_CORE_MANIFEST_SHA256':h.CORE,'HUB_BACKEND_IMAGE':'backend:tag','HUB_CHAT_ADMISSION_SHA256':m.OLD,'HUB_EXECUTION_PROFILE':'bounded-hub-knowledge-v2','HUB_PAID_AI_ENABLED':'true','ENABLED_WORKER_KINDS':'knowledge-chat,knowledge-import'}
  live={'Config':{'Image':'backend:tag'},'Id':'own'};front={'Config':{'Image':'frontend:tag'}};release={'backendImage':'backend:tag','frontendImage':'frontend:tag','supportedBudgetExtensions':['citation-review-v1'],'hubDigest':'own-hub'}
  x={'status':'citation-extension-prepared','issuedAt':'2026-11-20T08:00:00.000Z','previousLedgerSha':original_sha(b'original-ledger'),'admissionRaw':'{"new":"admission"}\n','admissionSha':original_sha(b'{"new":"admission"}\n'),'ledgerRaw':'{"new":"ledger"}\n','prefixHash':'a'*64}
  db=MagicMock();db.read_config.return_value=settings
  patches=[patch.object(m,'H',h),patch.object(h,'OPS',ops),patch.object(h,'ROOT',root),patch.object(h.os,'geteuid',return_value=0),patch.object(h.os,'chown'),patch.object(h,'sha',side_effect=fake_sha),patch.object(h,'private',side_effect=lambda p,uid=0:pathlib.Path(p).read_bytes()),patch.object(h,'controls',return_value=(ops,{'imageManifestSha256':'manifest'},release)),patch.object(h,'load',return_value=db),patch.object(h,'old_services',return_value='unchanged'),patch.object(m,'current_pair',return_value=(live,front,'tag')),patch.object(m,'prepare',return_value=x)]
  for p in patches:p.start();self.addCleanup(p.stop)
  return root,settings,x,release
 def test_same_image_with_old_sha_missing_flag_or_wrong_mount_is_not_activated(self):
  root,_,_,_=self.fixture();sha='f'*64;env={'HUB_CHAT_ADMISSION_SHA256':sha,'HUB_CHAT_BUDGET_EXTENSION':'citation-review-v1','HUB_EXECUTION_PROFILE':'bounded-hub-knowledge-v2','HUB_PAID_AI_ENABLED':'true','ENABLED_WORKER_KINDS':'knowledge-chat,knowledge-import','HUB_CORE_MANIFEST_SHA256':h.CORE};mounts=[{'Type':'bind','Source':str(root/n),'Destination':dst,'RW':rw} for n,dst,rw in [('admission','/run/researchhub-admission',False),('ledger','/run/researchhub-ai-ledger',True)]]
  def live(values):return {'Config':{'Image':'same-image','Env':[k+'='+v for k,v in values.items()]},'Mounts':mounts}
  m.assert_live_configuration(live(env),sha)
  for changes in [{'HUB_CHAT_ADMISSION_SHA256':m.OLD},{'HUB_CHAT_BUDGET_EXTENSION':''}]:
   with self.assertRaisesRegex(ValueError,'ENV_MISMATCH'):m.assert_live_configuration(live(dict(env,**changes)),sha)
  mounts[0]['RW']=True
  with self.assertRaisesRegex(ValueError,'MOUNT_MISMATCH'):m.assert_live_configuration(live(env),sha)
 def test_stage_archives_original_bytes_without_changing_active_files_and_cannot_repeat(self):
  root,_,_,_=self.fixture();self.stage();self.assertEqual((root/'admission/admission.json').read_bytes(),b'original-admission');self.assertEqual((root/'ledger/budget.json').read_bytes(),b'original-ledger');self.assertEqual((root/'citation-review-20261120/original-budget.json').read_bytes(),b'original-ledger')
  with self.assertRaisesRegex(ValueError,'ALREADY_STAGED'):self.stage()
 def test_unexpected_ledger_or_old_image_stops_before_staging(self):
  root,_,x,r=self.fixture();x['previousLedgerSha']='f'*64
  with self.assertRaisesRegex(ValueError,'BASELINE_CHANGED'):self.stage()
  self.assertFalse((root/'citation-review-20261120').exists());r['supportedBudgetExtensions']=[]
  with self.assertRaisesRegex(ValueError,'TARGET_REJECTED'):self.stage()
 def test_started_activation_and_wrong_checkpoint_never_rewrite_files(self):
  root,_,_,_=self.fixture();self.stage();stage=root/'citation-review-20261120';(stage/'activation-started.json').write_text('{}')
  with patch.object(h,'replace') as write:
   with self.assertRaisesRegex(ValueError,'ALREADY_STARTED'):m.main('advice-activate')
   write.assert_not_called()
  (stage/'activation-started.json').unlink()
  with patch.object(h,'replace') as write:
   with self.assertRaisesRegex(ValueError,'CHECKPOINT_REJECTED'):m.main('advice-activate')
   write.assert_not_called()
if __name__=='__main__':unittest.main()
