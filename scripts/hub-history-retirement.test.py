import copy,importlib.util,json,os,pathlib,tempfile,unittest
from unittest.mock import Mock,patch
spec=importlib.util.spec_from_file_location('retire',pathlib.Path(__file__).with_name('hub-history-retirement.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class RetirementTest(unittest.TestCase):
 def snapshot(self):return {'database':'researchhub','role':'hub_owner','marker':'a'*64,'historicalCount':623,'historicalHash':m.SNAPSHOT,'reservations':0,'rows':[{'id':'old-'+str(i),'tenantId':m.TENANT,'status':'queued','attempts':0} for i in range(175)]}
 def test_exact_original_snapshot_and_no_execution_or_billing_evidence(self):
  m.validate_snapshot(self.snapshot(),'hub_owner','a'*64)
  for key,value in [('database','aisci'),('role','other'),('marker','b'*64),('historicalCount',622),('historicalHash','0'*32),('reservations',1),('rows',[])]:
   state=self.snapshot();state[key]=value
   with self.assertRaises(ValueError):m.validate_snapshot(state,'hub_owner','a'*64)
  for key,value in [('attempts',1),('workerOwner','running'),('executionToken','token'),('leaseExpiresAt','expired-or-current'),('startedAt','old'),('result',{}),('assistantMessageId','answer'),('tenantId','other'),('status','processing')]:
   state=self.snapshot();state['rows'][0][key]=value
   with self.assertRaises(ValueError):m.validate_snapshot(state,'hub_owner','a'*64)
 def test_private_archive_is_exclusive_and_symlinks_are_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'backup';m.exclusive(p,b'original');self.assertEqual(p.stat().st_mode&0o777,0o600)
   with self.assertRaises(FileExistsError):m.exclusive(p,b'replacement')
   alias=pathlib.Path(d)/'alias';alias.symlink_to(p)
   with self.assertRaises(ValueError):m.private(alias)
   self.assertEqual(p.read_bytes(),b'original')
 def test_sealed_admission_uses_existing_root_and_runtime_group_read_only_mode(self):
  path=Mock();path.is_file.return_value=True;path.is_symlink.return_value=False;path.stat.return_value=Mock(st_uid=0,st_gid=1000,st_mode=0o100440);path.read_bytes.return_value=b'sealed'
  with patch.object(m,'ADMISSION_SHA',m.digest(b'sealed')):
   self.assertEqual(m.sealed_admission(path),b'sealed')
   for field,value in [('st_uid',1000),('st_gid',0),('st_mode',0o100444)]:
    original=getattr(path.stat.return_value,field);setattr(path.stat.return_value,field,value)
    with self.assertRaises(ValueError):m.sealed_admission(path)
    setattr(path.stat.return_value,field,original)
 def test_configuration_uses_only_hub_existing_env_and_keeps_password_out_of_arguments(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'.env.prod';p.write_text('HUB_DATABASE_NAME=researchhub\nHUB_DATABASE_OWNER_ROLE=hub_owner\nHUB_EXECUTION_PROFILE=bounded-hub-knowledge-v2\nHUB_CHAT_ADMISSION_SHA256='+m.ADMISSION_SHA+'\nHUB_DATABASE_MARKER_SHA256='+'a'*64+'\nDIRECT_URL=postgresql://hub_owner:synthetic%21password@127.0.0.1:5432/researchhub?sslmode=disable\n');p.chmod(0o600)
   values,env,_=m.settings(p);self.assertEqual(env['PGDATABASE'],'researchhub');self.assertEqual(env['PGPASSWORD'],'synthetic!password');self.assertEqual(env['PGSSLMODE'],'disable')
   p.write_text(p.read_text().replace('/researchhub?','/aisci?'))
   with self.assertRaises(ValueError):m.settings(p)
if __name__=='__main__':unittest.main()
