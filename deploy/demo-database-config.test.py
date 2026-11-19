import importlib.util,pathlib,tempfile,unittest
from urllib.parse import urlsplit,unquote
p=pathlib.Path(__file__).with_name('demo-database-config.py');s=importlib.util.spec_from_file_location('m',str(p));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class ConnectionTests(unittest.TestCase):
    def test_connection_strings_encode_credentials_and_bind_new_database(self):
        secret='a:@/#? %\\z'*4;url=m.connection_url({'host':'private.invalid','port':5432},'researchhub_demo_app',secret)
        u=urlsplit(url);self.assertEqual(unquote(u.password),secret);self.assertEqual(u.path,'/researchhub');self.assertEqual(u.username,'researchhub_demo_app');self.assertIn('sslmode=disable',u.query)
    def test_identity_rejects_wrong_database_role_or_privilege(self):
        import json
        marker=json.dumps({'purpose':'researchhub-manual-demo','syntheticOnly':True,'state':'post-data-complete','sourceSchemaSha256':m.base.SOURCE_SHA})
        row={'database':'researchhub','role':'researchhub_demo_app','readonly':'on','super':False,'bypass':False,'createdb':False,'createrole':False,'owner':'researchhub_demo_owner','marker':marker}
        self.assertTrue(m.check_identity(row,'researchhub_demo_app'))
        for field,value in [('database','aisci'),('role','aisci_app'),('bypass',True),('readonly','off'),('marker','{}')]:
            bad=dict(row);bad[field]=value
            with self.assertRaises(m.base.Stop):m.check_identity(bad,'researchhub_demo_app')
    def test_config_merge_preserves_other_settings_and_private_backup(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'private/database.env';m.save_config(p,{'DATABASE_URL':'private-value','DIRECT_URL':'other-value'})
            self.assertEqual(p.stat().st_mode&0o777,0o600);self.assertEqual(p.parent.stat().st_mode&0o777,0o700)
            p.write_text('# existing settings\nUNRELATED=keep-me\nDATABASE_URL=private-value\nDIRECT_URL=other-value\n')
            m.save_config(p,{'DATABASE_URL':'replacement'})
            self.assertIn('DATABASE_URL=replacement',p.read_text())
            self.assertIn('UNRELATED=keep-me',p.read_text())
            backups=list(p.parent.glob('.env.prod.backup-*'));self.assertEqual(len(backups),1)
            self.assertIn('DATABASE_URL=private-value',backups[0].read_text())
            self.assertEqual(backups[0].stat().st_mode&0o777,0o600)
    def test_disk_failure_leaves_no_partial_config(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'private/database.env'
            with patch.object(m.os,'fsync',side_effect=OSError('synthetic disk error')):
                with self.assertRaises(OSError):m.save_config(p,{'DATABASE_URL':'private-value'})
            self.assertFalse(p.exists())
            self.assertEqual([x.name for x in p.parent.iterdir()],['.env.prod.lock'])
    def test_existing_config_stays_unchanged_if_new_write_fails(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'.env.prod';p.write_text('UNRELATED=original\n');p.chmod(0o600)
            with patch.object(m.os,'fsync',side_effect=OSError('synthetic disk error')):
                with self.assertRaises(OSError):m.save_config(p,{'DATABASE_URL':'new-value'})
            self.assertEqual(p.read_text(),'UNRELATED=original\n')
    def test_duplicate_managed_key_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'.env.prod';p.write_text('DATABASE_URL=one\nDATABASE_URL=two\n');p.chmod(0o600)
            with self.assertRaises(m.base.Stop):m.save_config(p,{'DATABASE_URL':'new-value'})
            self.assertEqual(p.read_text(),'DATABASE_URL=one\nDATABASE_URL=two\n')
    def test_competing_config_writer_is_rejected_without_losing_existing_settings(self):
        import subprocess,sys
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'.env.prod';p.write_text('OTHER=preserve\n');p.chmod(0o600)
            script="import os,fcntl,sys; f=os.open(sys.argv[1],os.O_WRONLY|os.O_CREAT,0o600); fcntl.flock(f,fcntl.LOCK_EX); print('locked',flush=True);sys.stdin.read()"
            child=subprocess.Popen([sys.executable,'-c',script,str(p.parent/'.env.prod.lock')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
            try:
                self.assertEqual(child.stdout.readline().strip(),'locked')
                with self.assertRaisesRegex(m.base.Stop,'DATABASE_CONFIG_UPDATE_ALREADY_ACTIVE'):m.save_config(p,{'DATABASE_URL':'new-value'})
                self.assertEqual(p.read_text(),'OTHER=preserve\n')
            finally:child.stdin.close();child.wait(timeout=5);child.stdout.close()
            m.save_config(p,{'DATABASE_URL':'new-value'})
            self.assertIn('OTHER=preserve',p.read_text())
    def test_save_rejects_newline_injection(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'private/database.env'
            with self.assertRaises(m.base.Stop):m.save_config(p,{'DATABASE_URL':'url\nOTHER=bad'})
            self.assertFalse(p.exists())

if __name__=='__main__':unittest.main()
