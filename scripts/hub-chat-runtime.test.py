import importlib.util,pathlib,tempfile,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('chat',str(pathlib.Path(__file__).with_name('hub-chat-runtime.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class RuntimeTests(unittest.TestCase):
 def test_exclusive_files_cannot_reset_an_existing_ledger(self):
  with tempfile.TemporaryDirectory() as d,patch.object(m.os,'chown'):
   p=pathlib.Path(d)/'budget.json';m.exclusive(p,b'original',mode=0o600)
   with self.assertRaises(FileExistsError):m.exclusive(p,b'renewed',mode=0o600)
   self.assertEqual(p.read_bytes(),b'original')
 def test_incomplete_control_inventory_never_imports_a_helper(self):
  import hashlib,json
  with tempfile.TemporaryDirectory() as d,patch.object(m,'OPS',pathlib.Path(d)):
   root=pathlib.Path(d)/'runtime-releases'/'hub-runtime-aaaaaaaa-1';root.mkdir(parents=True)
   raw=json.dumps({'schema':'researchhub-runtime-controls.v1','tag':root.name,'files':{}}).encode();p=root/('control-'+hashlib.sha256(raw).hexdigest()[:16]);p.mkdir();(p/'control-manifest.json').write_bytes(raw)
   for name in ('database-config.py','run-server.py','backend-compose.yml','runtime-release.json'):(p/name).write_text('raise RuntimeError("must never import")')
   with self.assertRaisesRegex(ValueError,'CHAT_VERIFIED_RELEASE_REQUIRED'):m.helper(root.name)
 def test_remote_errors_never_echo_private_stderr(self):
  import subprocess
  with patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],1,'','private-key')):
   with self.assertRaisesRegex(ValueError,'^CHAT_COMMAND_FAILED$'):m.run(['test'])
if __name__=='__main__':unittest.main()
