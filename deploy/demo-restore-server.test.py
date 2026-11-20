import importlib.util,pathlib,unittest,tempfile,time,sys,copy
p=pathlib.Path(__file__).with_name('demo-restore-server.py')
s=importlib.util.spec_from_file_location('restore',str(p));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class ServerTests(unittest.TestCase):
    def test_import_checks_and_marker_share_one_transaction(self):
        manifest={'tables':[{'schema':'public','table':'sample','columns':['id'],'rows':1,'file':'000.jsonl'}]}
        begin=m.import_start(manifest)
        self.assertTrue(begin.startswith('BEGIN;'))
        for text in ('pg_try_advisory_xact_lock','MANUAL_RESTORE_TARGET_NOT_EMPTY','pre-data-complete','researchhub_demo_owner','SET LOCAL standard_conforming_strings=on'):
            self.assertIn(text,begin)
        end=m.import_end(manifest)
        self.assertLess(end.index('MANUAL_DATA_COUNT_MISMATCH'),end.index('COMMENT ON DATABASE'))
        self.assertIn(m.data.MANIFEST_SHA,end)
        self.assertTrue(end.endswith('COMMIT;\n'))
    def test_state_rejects_wrong_source_and_unmarked_data(self):
        live={'database':'researchhub','operator':'aisci_control','version':180003,'owner':'researchhub_demo_owner','vector':'0.8.1.2','marker':{'purpose':'researchhub-manual-demo','syntheticOnly':True,'sourceSchemaSha256':m.data.SOURCE_SHA,'state':'pre-data-complete'},'roles':[], 'memberships':0,'tables':[]}
        with self.assertRaises(m.base.Stop):m.validate(live,{'tables':[]})
    def test_live_identity_role_and_inventory_checks(self):
        tables=[{'schema':'public','table':'t'+str(i),'columns':['id']} for i in range(182)]
        roles=[{'name':name,'login':False,'super':False,'createdb':False,'createrole':False,'inherit':False,'replication':False,'bypass':i==0,'canSet':True} for i,name in enumerate(m.base.ROLES)]
        live={'database':'researchhub','operator':'aisci_control','owner':m.base.ROLES[0],'version':180003,'vector':'0.8.1.2','marker':{'purpose':'researchhub-manual-demo','syntheticOnly':True,'sourceSchemaSha256':m.data.SOURCE_SHA,'state':'pre-data-complete'},'roles':roles,'memberships':0,'tables':tables}
        manifest={'tables':tables}
        self.assertEqual(m.validate(live,manifest)['state'],'pre-data-complete')
        for mutate in (lambda v:v.update(database='aisci'),lambda v:v['marker'].update(sourceSchemaSha256='bad'),lambda v:v['roles'][1].update(login=True),lambda v:v['roles'][1].update(bypass=True),lambda v:v.update(memberships=1),lambda v:v['tables'][0].update(columns=['wrong'])):
            bad=copy.deepcopy(live);mutate(bad)
            with self.assertRaises(m.base.Stop):m.validate(bad,manifest)
    def test_password_never_enters_generated_sql(self):
        a='a'*32;b='b'*32
        for pair in ((a,a),('short',b),('a'*31+'\n',b)):
            with self.assertRaises(m.base.Stop):m.validate_passwords(*pair)
        m.validate_passwords(a,b)
    def test_stream_write_deadline_covers_a_client_that_never_reads(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/'hang.py';path.write_text('import time;time.sleep(20)')
            original=m.base.client_args;m.base.client_args=lambda *args:[sys.executable,str(path)]
            try:
                start=time.monotonic()
                with self.assertRaisesRegex(m.base.Stop,'CLIENT_DEADLINE_EXCEEDED_RECHECK_STATE'):
                    m.run_sql(sys.executable,{}, {},('x'*2097152 for _ in range(10)),None,timeout=.2)
                self.assertLess(time.monotonic()-start,3)
            finally:m.base.client_args=original
    def test_content_read_deadline_covers_a_client_that_never_finishes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/'hang.py';path.write_text('import time;time.sleep(20)')
            original=m.base.client_args;m.base.client_args=lambda *args:[sys.executable,str(path)]
            try:
                start=time.monotonic()
                with self.assertRaisesRegex(m.base.Stop,'CLIENT_DEADLINE_EXCEEDED_RECHECK_STATE'):
                    m.verify_contents(sys.executable,{}, {},{'tables':[]},[],pathlib.Path(tmp),timeout=.2)
                self.assertLess(time.monotonic()-start,3)
                self.assertFalse((pathlib.Path(tmp)/'verify.sql').exists())
            finally:m.base.client_args=original
    def test_transaction_lock_only_inserted_at_begin(self):
        sql='-- note\nBEGIN;\nSELECT 1;\nCOMMIT;'
        out=m.lock_sql(sql)
        self.assertEqual(out.count('pg_try_advisory_xact_lock'),1)
        self.assertLess(out.index('BEGIN;'),out.index('pg_try_advisory_xact_lock'))
        with self.assertRaises(m.base.Stop):m.lock_sql('SELECT 1;')

if __name__=='__main__':unittest.main()
