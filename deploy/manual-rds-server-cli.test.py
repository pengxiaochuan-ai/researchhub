import pathlib,tempfile,unittest,subprocess,json,hashlib,os,fcntl,sys
ROOT=pathlib.Path(__file__).resolve().parent
SOURCE='5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c'
NAMES=['00-check-postgres.sql','01-create-roles.sql','02-create-database.sql','03-init-researchhub.sql','04-pre-data.sql']
class CliTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.p=pathlib.Path(self.tmp.name);self.pkg=self.p/'package';self.pkg.mkdir(mode=0o700)
  self.config=self.p/'config.env';self.config.write_text('IGNORED=$(touch '+str(self.p/'injected')+')\nDIRECT_URL=postgresql://aisci_control:secret%3Aunique%5Cvalue@known-rds.internal:5432/aisci?schema=public&sslmode=disable\n');self.config.chmod(0o600)
  files=[]
  for i,name in enumerate(NAMES):
   content='-- STAGE='+str(i).zfill(2)+'\nSELECT 1;\n';(self.pkg/name).write_text(content);files.append({'file':name,'sha256':hashlib.sha256(content.encode()).hexdigest()})
  (self.pkg/'manifest.json').write_text(json.dumps({'schema':'researchhub-manual-rds-sql.v1','sourceSchemaSha256':SOURCE,'database':'researchhub','tables':182,'dataIncluded':False,'files':files}))
  self.driver=self.p/'driver.py';self.driver.write_text("import importlib.util,hashlib,sys\ns=importlib.util.spec_from_file_location('runner',"+repr(str(ROOT/'manual-rds-server.py'))+");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.EXPECTED_HOST_SHA256=hashlib.sha256(b'known-rds.internal').hexdigest();sys.exit(m.main())\n")
  self.client=self.p/'psql';self.client.write_text('''#!'''+sys.executable+'''
import sys,os,pathlib,json,stat,re
base=pathlib.Path(__file__).parent
if '--version' in sys.argv: print('psql (PostgreSQL) 18.3');sys.exit(0)
args=sys.argv[1:];sql=sys.stdin.read();database=args[args.index('--dbname')+1];pgpass=pathlib.Path(os.environ['PGPASSFILE'])
assert pgpass.stat().st_mode&0o777==0o600
assert not any(k in os.environ for k in ('PGPASSWORD','PGOPTIONS','PGSERVICE','DIRECT_URL'))
assert 'secret:unique\\\\value' not in ' '.join(args)
with (base/'calls').open('a') as f:f.write(json.dumps({'database':database,'args':args,'passfile':str(pgpass),'sslmode':os.environ['PGSSLMODE']})+'\\n')
state=json.loads((base/'state').read_text()) if (base/'state').exists() else {'roles':[],'target':None}
if 'newRoleMemberships' in sql:
 print(json.dumps(dict(state,database='postgres',operator='aisci_control',version=180003,createdb=True,createrole=True,superuser=False,ssl=os.environ['PGSSLMODE']!='disable',newRoleMemberships=0)));sys.exit(0)
if "'tables'" in sql:
 print(json.dumps({'database':'researchhub','operator':'aisci_control','marker':state['target']['marker'],'tables':182,'vector':'0.8.1.2'}));sys.exit(0)
stage=re.search(r'STAGE=(\\d+)',sql).group(1)
with (base/'stages').open('a') as f:f.write(stage+'\\n')
if (base/'fail').exists() and (base/'fail').read_text()==stage:
 print('secret:unique\\\\value intentional rejection',file=sys.stderr);sys.exit(9)
if stage=='01':
 state['roles']=[dict(name='researchhub_demo_'+name,login=False,superuser=False,createdb=False,createrole=False,bypass=name=='owner',inherit=False,replication=False,canSet=True) for name in ('owner','app','analysis_reader','pmc_collector')]
if stage=='02':state['target']={'owner':'researchhub_demo_owner','marker':None}
if stage in ('03','04'):state['target']['marker']=json.dumps({'purpose':'researchhub-manual-demo','syntheticOnly':True,'sourceSchemaSha256':'SOURCE_SHA','state':'initialized' if stage=='03' else 'pre-data-complete'})
(base/'state').write_text(json.dumps(state))
'''.replace('SOURCE_SHA',SOURCE));self.client.chmod(0o700)
 def call(self,stage='check',extra=()):
  env=dict(os.environ,PGPASSWORD='old-password',PGOPTIONS='-c role=evil',PGSERVICE='evil',DIRECT_URL='must-not-inherit')
  return subprocess.run([sys.executable,str(self.driver),stage,'--package',str(self.pkg),'--config',str(self.config),'--psql',str(self.client)]+list(extra),env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True)
 def assert_clean(self,r):
  self.assertNotIn('secret:unique',r.stdout+r.stderr);self.assertFalse((self.p/'injected').exists())
  self.assertFalse(list(self.pkg.glob('.server-run/run-*/pgpass')))
 def test_default_check_never_connects_and_does_not_source_env(self):
  r=self.call();self.assertEqual(r.returncode,0,r.stderr);self.assertFalse((self.p/'calls').exists());self.assert_clean(r)
 def test_all_stops_at04_and_credentials_are_cleaned(self):
  r=self.call('all');self.assertEqual(r.returncode,0,r.stderr);self.assertEqual((self.p/'stages').read_text().splitlines(),['00','01','02','03','04']);self.assert_clean(r)
  calls=[json.loads(x) for x in (self.p/'calls').read_text().splitlines()];self.assertTrue(all(c['database'] in ('postgres','researchhub') for c in calls));self.assertTrue(all(c['sslmode']=='require' for c in calls))
 def test_verified_legacy_client_1323_runs_same_guarded_flow(self):
  self.client.write_text(self.client.read_text().replace('psql (PostgreSQL) 18.3','psql (PostgreSQL) 13.23'))
  r=self.call('all');self.assertEqual(r.returncode,0,r.stderr);self.assertIn('"clientMajor": 13',r.stdout);self.assertEqual((self.p/'stages').read_text().splitlines(),['00','01','02','03','04']);self.assert_clean(r)
 def test_failure_no_retry_no_next_stage_then_explicit_resume(self):
  (self.p/'fail').write_text('02');r=self.call('all');self.assertEqual(r.returncode,1);self.assertEqual((self.p/'stages').read_text().splitlines(),['00','01','02']);self.assert_clean(r)
  for f in self.pkg.glob('.server-run/*.log'):self.assertNotIn('secret:unique',f.read_text())
  (self.p/'fail').unlink()
  for stage in ('02','03','04'):
   r=self.call(stage);self.assertEqual(r.returncode,0,r.stderr);self.assert_clean(r)
  before=(self.p/'stages').read_text();r=self.call('all');self.assertEqual(r.returncode,1);self.assertIn('LIVE_FRESH_TARGET_REQUIRED',r.stderr);self.assertEqual((self.p/'stages').read_text(),before)
 def test_tampered_sql_stops_before_client_or_db(self):
  (self.pkg/NAMES[4]).write_text('tampered');r=self.call('all');self.assertEqual(r.returncode,1);self.assertIn('PACKAGE_HASH_MISMATCH',r.stderr);self.assertFalse((self.p/'calls').exists())
 def test_same_package_concurrency_rejected(self):
  d=self.pkg/'.server-run';d.mkdir(mode=0o700)
  with (d/'lock').open('w') as f:
   fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);r=self.call('all')
  self.assertEqual(r.returncode,1);self.assertIn('ANOTHER_RUN_IS_ACTIVE',r.stderr);self.assertFalse((self.p/'calls').exists())
 def test_05_rejected_before_any_connection(self):
  r=self.call('05');self.assertNotEqual(r.returncode,0);self.assertFalse((self.p/'calls').exists())
 def test_missing_client_does_not_install_or_connect(self):
  r=self.call(extra=['--psql',str(self.p/'not-installed')]);self.assertEqual(r.returncode,1);self.assertIn('PSQL_NOT_INSTALLED_NO_AUTOMATIC_INSTALL',r.stderr);self.assertFalse((self.p/'calls').exists())
 def test_invalid_inventory_is_safe_failure_without_traceback(self):
  m=json.loads((self.pkg/'manifest.json').read_text());m['files']=[{'file':None}];(self.pkg/'manifest.json').write_text(json.dumps(m));r=self.call();self.assertEqual(r.returncode,1);self.assertNotIn('Traceback',r.stderr);self.assertIn('PACKAGE_INVENTORY_INVALID',r.stderr)
if __name__=='__main__':unittest.main()
