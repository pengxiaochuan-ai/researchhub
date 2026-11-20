import importlib.util,pathlib,tempfile,hashlib,unittest,json
from unittest.mock import patch
s=importlib.util.spec_from_file_location('bootstrap',str(pathlib.Path(__file__).with_name('hub-runtime-bootstrap.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class BootstrapTests(unittest.TestCase):
 def test_v2_checkpoint_is_the_current_bridge_pair_and_exact_staged_admission(self):
  release={'tag':'bridge','backendImage':'backend:bridge','frontendImage':'frontend:bridge','coreDigest':'55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669','supportedBudgetExtensions':['citation-review-v1'],'supportedExecutionProfiles':['bounded-hub-knowledge-v2']};raw=json.dumps(release).encode();control={'previousManifestSha256':hashlib.sha256(raw).hexdigest(),'executionPolicy':{'profile':'bounded-hub-knowledge-v2','admissionSha256':'a'*64}}
  m.knowledge_checkpoint(release,control,raw,'a'*64)
  for old,sha in [(dict(release,coreDigest='85'*32),'a'*64),(dict(release,tag='old'),'a'*64),(release,'b'*64)]:
   prior=json.dumps(old).encode();bound=dict(control,previousManifestSha256=hashlib.sha256(prior).hexdigest())
   with self.assertRaises(ValueError):m.knowledge_checkpoint(release,bound,prior,sha)
  with self.assertRaises(ValueError):m.knowledge_checkpoint(release,dict(control,previousManifestSha256='f'*64),raw,'a'*64)
 def test_fetch_verifies_content_and_reuses_only_exact_existing_bytes(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'control';body=b'approved public control';sha=hashlib.sha256(body).hexdigest()
   class Store:
    calls=0
    def get_object_to_file(self,key,path):self.calls+=1;pathlib.Path(path).write_bytes(body)
   store=Store();m.fetch(store,'fixed-key',p,sha);m.fetch(store,'fixed-key',p,sha)
   self.assertEqual(store.calls,1);self.assertEqual(p.read_bytes(),body)
   with self.assertRaises(ValueError):m.fetch(store,'fixed-key',p,'f'*64)
 def test_failed_download_digest_leaves_no_file(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'control'
   class Store:
    def get_object_to_file(self,key,path):pathlib.Path(path).write_bytes(b'wrong')
   with self.assertRaises(ValueError):m.fetch(Store(),'key',p,'a'*64)
   self.assertEqual(list(pathlib.Path(d).iterdir()),[])
 def test_release_config_is_data_and_rejects_duplicate_keys(self):
  with tempfile.TemporaryDirectory() as d,patch.object(m,'OPS',pathlib.Path(d)):
   p=pathlib.Path(d)/'.env.release';p.write_text('S3_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com\nS3_BUCKET=bucket\nS3_ACCESS_KEY=key\nS3_SECRET_KEY=$(not executed)\n');p.chmod(0o600)
   self.assertEqual(m.read_release_storage()['S3_SECRET_KEY'],'$(not executed)')
   p.write_text(p.read_text()+'S3_BUCKET=other\n')
   with self.assertRaises(ValueError):m.read_release_storage()
class CitationCheckpoint(unittest.TestCase):
 def test_new_sha_rejects_old_capability_but_original_sha_remains_supported(self):
  release={'tag':'same','coreDigest':'55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669','supportedExecutionProfiles':['bounded-hub-knowledge-v2'],'backendImage':'b','frontendImage':'f'};raw=json.dumps(release).encode();old='6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492';control={'previousManifestSha256':__import__('hashlib').sha256(raw).hexdigest(),'executionPolicy':{'profile':'bounded-hub-knowledge-v2','admissionSha256':old}}
  m.knowledge_checkpoint(release,control,raw,old)
  control['executionPolicy']['admissionSha256']='f'*64
  with self.assertRaises(ValueError):m.knowledge_checkpoint(release,control,raw,'f'*64)
if __name__=='__main__':unittest.main()
