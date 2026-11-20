import importlib.util
import pathlib
import tempfile
import os
import unittest
import hashlib

SPEC=importlib.util.spec_from_file_location('runner',str(pathlib.Path(__file__).with_name('manual-rds-server.py')))
runner=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)
runner.EXPECTED_HOST='known-rds.internal'
runner.EXPECTED_HOST_SHA256=hashlib.sha256(runner.EXPECTED_HOST.encode()).hexdigest()

class RunnerTests(unittest.TestCase):
 def config(self,text,mode=0o600):
  directory=tempfile.TemporaryDirectory();self.addCleanup(directory.cleanup)
  path=pathlib.Path(directory.name)/'config.env';path.write_text(text);path.chmod(mode);return path
 def url(self,password='a%3Ab%5Cc%40d'):
  return 'postgresql://aisci_control:'+password+'@'+runner.EXPECTED_HOST+':5432/aisci?schema=public&sslmode=disable'
 def test_read_only_direct_without_shell_and_decode_secret(self):
  p=self.config('OTHER=$(touch /tmp/never-run)\nDIRECT_URL="'+self.url()+'"\n');c=runner.load_config(p)
  self.assertEqual(c['password'],'a:b\\c@d');self.assertEqual(c['sslmode'],'disable')
 def test_config_rejects_wrong_host_role_database_duplicate_and_permissions(self):
  variants=[self.url().replace(runner.EXPECTED_HOST,'evil.example'),self.url().replace('aisci_control','aisci_app'),self.url().replace('/aisci?','/clinical?'),self.url()+'\nDIRECT_URL='+self.url()]
  for value in variants:
   with self.assertRaises(runner.Stop):runner.load_config(self.config('DIRECT_URL='+value))
  with self.assertRaises(runner.Stop):runner.load_config(self.config('DIRECT_URL='+self.url(),0o644))
 def test_password_not_in_arguments_pg_env_cleared(self):
  c=runner.load_config(self.config('DIRECT_URL='+self.url()))
  with tempfile.TemporaryDirectory() as d:
   p=runner.write_passfile(pathlib.Path(d),c)
   env=runner.client_env(c,p,False,{'PATH':'/bin','PGPASSWORD':'bad','PGOPTIONS':'-c role=evil','PGSERVICE':'evil'})
   self.assertNotIn('PGPASSWORD',env);self.assertNotIn('PGOPTIONS',env);self.assertNotIn('PGSERVICE',env)
   self.assertEqual(env['PGSSLMODE'],'require');self.assertEqual(p.stat().st_mode&0o777,0o600)
   text=p.read_text();self.assertIn('a\\:b\\\\c@d',text);self.assertEqual(len(text.splitlines()),2)
   args=runner.client_args('/usr/bin/psql',c,'postgres');self.assertNotIn(c['password'],' '.join(args))
   with self.assertRaises(runner.Stop):runner.client_args('/usr/bin/psql',c,'aisci')
 def test_stages_require_exact_live_state(self):
  empty={'database':'postgres','operator':'aisci_control','version':180003,'createdb':True,'createrole':True,'superuser':False,'roles':[],'target':None,'ssl':True}
  runner.validate_live(empty,'00',False)
  with self.assertRaises(runner.Stop):runner.validate_live(dict(empty,database='aisci'),'00',False)
  with self.assertRaises(runner.Stop):runner.validate_live(dict(empty,ssl=False),'00',False)
  with self.assertRaises(runner.Stop):runner.validate_live(empty,'02',False)
  with self.assertRaises(runner.Stop):runner.validate_live(empty,'05',False)
 def test_psql_versions_and_manifest_refuse(self):
  saved=runner.sys.version_info
  try:
   runner.sys.version_info=(3,5)
   with self.assertRaises(runner.Stop):runner.run(None)
  finally:runner.sys.version_info=saved
  self.assertEqual(runner.client_major('psql (PostgreSQL) 18.3'),18)
  self.assertEqual(runner.client_major('psql (PostgreSQL) 13.23'),13)
  for s in ['psql (PostgreSQL) 13.22','psql (PostgreSQL) 13.24','psql (PostgreSQL) 12.23','psql (PostgreSQL) 15.4','unknown']:
   with self.assertRaises(runner.Stop):runner.client_major(s)
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(runner.Stop):runner.verify_package(pathlib.Path(d))

if __name__=='__main__':unittest.main()
