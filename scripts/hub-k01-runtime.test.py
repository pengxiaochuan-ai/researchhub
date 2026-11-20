import importlib.util,pathlib,tempfile,unittest,json,hashlib,io
from unittest.mock import patch,MagicMock
from contextlib import redirect_stdout
s=importlib.util.spec_from_file_location('k01',str(pathlib.Path(__file__).with_name('hub-k01-runtime.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class K01Tests(unittest.TestCase):
 def test_private_replacements_are_atomic_and_preserve_unrelated_files(self):
  with tempfile.TemporaryDirectory() as d,patch.object(m.os,'chown'):
   p=pathlib.Path(d)/'budget.json';p.write_bytes(b'old ledger');other=pathlib.Path(d)/'.env.prod';other.write_bytes(b'KEEP=existing\n');m.replace(p,b'new inherited ledger',0,0,0o600)
   self.assertEqual(p.read_bytes(),b'new inherited ledger');self.assertEqual(other.read_bytes(),b'KEEP=existing\n');self.assertEqual(sorted(x.name for x in p.parent.iterdir()),['.env.prod','budget.json'])
 def test_exclusive_archive_never_overwrites_an_old_ledger(self):
  with tempfile.TemporaryDirectory() as d,patch.object(m.os,'chown'):
   p=pathlib.Path(d)/'original.json';m.exclusive(p,b'original')
   with self.assertRaises(FileExistsError):m.exclusive(p,b'reset')
   self.assertEqual(p.read_bytes(),b'original')
 def test_failed_docker_command_never_echoes_secret_stderr(self):
  result=MagicMock(returncode=1,stdout='',stderr='postgresql://secret@host/db')
  with patch.object(m.subprocess,'run',return_value=result):
   with self.assertRaisesRegex(ValueError,'^K01_COMMAND_FAILED_RECHECK_REQUIRED$'):m.run(['docker','exec','fixture'])
 def test_snapshot_excludes_only_the_two_named_imports_and_keeps_all_old_tasks(self):
  server=MagicMock();server.task_snapshot.return_value={'knowledge_import_task':{'old':'hash','one':'changing','two':'changing'},'knowledge_chat_job':{'original':'immutable'}}
  value=m.snapshot(server,None,{},['one','two']);self.assertEqual(value,{'knowledge_import_task':{'old':'hash'},'knowledge_chat_job':{'original':'immutable'}})
 def test_inspect_never_takes_the_budget_lock(self):
  with patch.object(m.os,'open',return_value=42) as opened,patch.object(m.os,'close'),patch.object(m.fcntl,'flock'),patch.object(m,'main') as main:
   m.execute('inspect');main.assert_called_once_with('inspect');self.assertEqual(len(opened.call_args_list),2);self.assertTrue(all('budget.lock' not in str(c.args[0]) for c in opened.call_args_list))
 def test_wrong_saved_database_stops_before_stage_or_restart(self):
  with tempfile.TemporaryDirectory() as d,patch.object(m,'OPS',pathlib.Path(d).resolve()),patch.object(m.os,'geteuid',return_value=0),patch.object(m,'current',return_value={'Config':{'Image':'backend:hub-runtime-aaaaaaaa-1'}}),patch.object(m,'controls',return_value=(pathlib.Path(d),{},{})),patch.object(m,'load') as load,patch.object(m,'run') as run:
   load.return_value.read_config.return_value={'HUB_DATABASE_NAME':'aisci'}
   with self.assertRaisesRegex(ValueError,'K01_SAVED_TARGET_REJECTED'):m.main('stage')
   run.assert_not_called()
if __name__=='__main__':unittest.main()
