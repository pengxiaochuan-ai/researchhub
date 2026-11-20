import importlib.util,pathlib,subprocess,os,tempfile,unittest,zlib
spec=importlib.util.spec_from_file_location('transfer',pathlib.Path(__file__).with_name('hub-article-original-transfer.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TransferTests(unittest.TestCase):
 def test_command_limit_stops_before_dispatch(self):
  self.assertLess(len(m.encode('echo bounded')),24000)
  with self.assertRaisesRegex(ValueError,'ARTICLE_COMMAND_LIMIT'):m.encode('x'*24000)
 def test_unapproved_bytes_never_reach_cloud_cli(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'bad.zlib';p.write_bytes(zlib.compress(b'not the approved original'))
   result=subprocess.run(['python3',str(pathlib.Path(__file__).with_name('hub-article-original-transfer.py')),'/must-not-be-called',str(p)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=dict(os.environ,ARTICLE_TRANSFER_DRY_RUN='true'))
   self.assertNotEqual(result.returncode,0);self.assertIn(b'ARTICLE_PAYLOAD_REJECTED',result.stdout);self.assertEqual(result.stderr,b'')
if __name__=='__main__':unittest.main()
