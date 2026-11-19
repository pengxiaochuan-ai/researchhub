import importlib.util,pathlib,json,hashlib,unittest
s=importlib.util.spec_from_file_location('release',str(pathlib.Path(__file__).with_name('hub-release.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ReleaseTests(unittest.TestCase):
 def test_component_reuse_keeps_real_source_not_the_new_release_sha(self):
  previous={'tag':'hub-runtime-aaaaaaaa-1','controlGit':'a'*40,'components':{'backend':{'sourceGit':'b'*40}}}
  self.assertEqual(m.provenance(previous,'backend',False,'c'*40),{'sourceGit':'b'*40,'built':False,'reusedFrom':previous['tag']})
  self.assertEqual(m.provenance(previous,'frontend',True,'c'*40),{'sourceGit':'c'*40,'built':True,'reusedFrom':None})
 def test_seed_and_pointer_require_exact_manifest_hash_and_core(self):
  body={'tag':'hub-runtime-aaaaaaaa-1','architecture':'amd64','schema':'researchhub-runtime-images.v1','coreDigest':'b'*64};raw=json.dumps(body).encode();sha=hashlib.sha256(raw).hexdigest();policy={'seedTag':body['tag'],'seedManifestSha256':sha,'coreDigest':body['coreDigest']}
  class Missing(Exception):status=404
  class Response:
   headers={'ETag':'checked-etag'}
   def __init__(self,data):self.data=data
   def read(self):return self.data
  class Store:
   pointer=None
   def get_object(self,key):
    if key==m.POINTER:
     if self.pointer is None:raise Missing()
     return Response(json.dumps(self.pointer).encode())
    return Response(raw)
  store=Store();self.assertEqual(m.read_current(store,policy)[2]['etag'],None)
  store.pointer={'schema':'researchhub-release-pointer.v1','tag':body['tag'],'manifestSha256':sha};self.assertEqual(m.read_current(store,policy)[2]['etag'],'checked-etag')
  store.pointer['manifestSha256']='c'*64
  with self.assertRaisesRegex(ValueError,'MANIFEST_MISMATCH'):m.read_current(store,policy)
  store.pointer['manifestSha256']=sha
  with self.assertRaisesRegex(ValueError,'CORE_REAPPROVAL'):m.read_current(store,dict(policy,coreDigest='d'*64))
 def test_failed_or_skipped_backend_changes_accumulate_to_last_success(self):
  import tempfile,subprocess
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as d:
   def git(*a):return subprocess.check_output(['git','-C',d,*a],stderr=subprocess.DEVNULL).decode().strip()
   git('init');git('config','user.email','synthetic@example.test');git('config','user.name','Synthetic release test')
   root=pathlib.Path(d);(root/'server').mkdir();(root/'pages').mkdir();(root/'server/api.mjs').write_text('old');(root/'pages/index.html').write_text('old');git('add','.');git('commit','-m','baseline');baseline=git('rev-parse','HEAD')
   (root/'server/api.mjs').write_text('new backend whose previous release failed');git('add','.');git('commit','-m','failed backend release')
   (root/'pages/index.html').write_text('new frontend');git('add','.');git('commit','-m','next frontend');current=git('rev-parse','HEAD')
   previous={'controlGit':baseline,'tag':'hub-runtime-aaaaaaaa-1'}
   with patch.object(m.plan_module,'git',side_effect=lambda *a:subprocess.check_output(['git','-C',d,*a]).decode()):
    plan=m.plan_module.make_plan(previous,current);self.assertEqual(plan['build'],{'frontend':True,'backend':True})
    (root/'schema.prisma').write_text('model Synthetic {}');git('add','.');git('commit','-m','database change');revision=git('rev-parse','HEAD');blocked=m.plan_module.make_plan(previous,revision)
    self.assertFalse(blocked['databaseApproved']);self.assertFalse(blocked['databaseMigrationExecuted']);self.assertTrue(m.plan_module.make_plan(previous,revision,blocked['databaseDigest'])['databaseApproved'])
    (root/'server/setup.mjs').write_text("const ddl = 'CREATE TABLE newly_hidden(id text)'");git('add','.');git('commit','-m','embedded ddl');hidden=m.plan_module.make_plan(previous,git('rev-parse','HEAD'),blocked['databaseDigest']);self.assertIn('server/setup.mjs',hidden['databasePaths']);self.assertFalse(hidden['databaseApproved'])
    for statement in ['CREATE SEQUENCE synthetic_seq','CREATE ROLE synthetic_role','CREATE DATABASE synthetic_db','CREATE UNIQUE INDEX synthetic_ix ON newly_hidden(id)']:
     (root/'server/setup.mjs').write_text('const ddl = '+repr(statement));git('add','.');git('commit','-m','DDL variant');guarded=m.plan_module.make_plan(previous,git('rev-parse','HEAD'));self.assertIn('server/setup.mjs',guarded['databasePaths']);self.assertFalse(guarded['databaseApproved'])
 def test_private_core_adapter_changes_cannot_silently_reuse_a_frozen_core(self):
  import tempfile
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);(root/'adapter.mjs').write_text('approved adapter');(root/'package.json').write_text('{}');policy={'coreSourceGuards':{'adapter.mjs':hashlib.sha256(b'approved adapter').hexdigest()}}
   m.validate_core_policy(policy,root);(root/'adapter.mjs').write_text('unreviewed adapter')
   with self.assertRaisesRegex(ValueError,'CORE_SOURCE_REAPPROVAL'):m.validate_core_policy(policy,root)
if __name__=='__main__':unittest.main()
