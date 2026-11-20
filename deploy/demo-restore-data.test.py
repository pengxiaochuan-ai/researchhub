import importlib.util
import pathlib
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('data',str(pathlib.Path(__file__).with_name('demo-restore-data.py')))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class DataTests(unittest.TestCase):
    def test_numbers_preserve_more_than_float_and_decimal_context(self):
        a=b'{"n":123456789012345678901234567890.1234567890123456789}'
        b=b'{"n":123456789012345678901234567890.12345678901234567890}'
        c=b'{"n":123456789012345678901234567890.1234567890123456788}'
        self.assertEqual(m.row_hash(a),m.row_hash(b))
        self.assertNotEqual(m.row_hash(a),m.row_hash(c))
        self.assertNotEqual(m.row_hash(b'{"n":9007199254740992}'),m.row_hash(b'{"n":9007199254740993}'))
    def test_order_is_canonical_but_types_arrays_and_duplicate_rows_matter(self):
        self.assertEqual(m.row_hash(b'{"x":1,"y":2}'),m.row_hash(b'{"y":2,"x":1.0}'))
        self.assertNotEqual(m.row_hash(b'{"x":"1"}'),m.row_hash(b'{"x":1}'))
        self.assertNotEqual(m.row_hash(b'[1,2]'),m.row_hash(b'[2,1]'))
        self.assertNotEqual(m.table_hash([b'a']),m.table_hash([b'a',b'a']))
    def test_json_rejects_nonfinite_duplicate_keys(self):
        for value in (b'{"x":NaN}',b'{"x":1,"x":2}'):
            with self.assertRaises(ValueError):m.row_hash(value)
    def test_insert_preserves_json_lexemes_and_escapes_quotes_backslash(self):
        table={'schema':'rh_example','table':'data','columns':['id','payload']}
        raw=b'{"id":9007199254740993,"payload":"O\'Reilly \\\\ path"}'
        sql=m.insert_sql(table,[raw])
        self.assertIn('9007199254740993',sql)
        self.assertIn("O''Reilly",sql)
        self.assertIn('OVERRIDING SYSTEM VALUE',sql)
        self.assertIn('json_populate_recordset',sql)
    def test_only_exact_binding_role_is_mapped(self):
        t={'schema':'rh_source','table':'pmc_collector_binding'}
        raw=b'{"role_name":"rh_pmc_collector_local","note":"rh_pmc_collector_local","n":123456789012345678901234567890.123456789}'
        out=m.mapped_row(t,raw)
        self.assertIn(b'"role_name":"researchhub_demo_pmc_collector"',out)
        self.assertIn(b'"note":"rh_pmc_collector_local"',out)
        self.assertIn(b'123456789012345678901234567890.123456789',out)
        self.assertEqual(m.mapped_row({'schema':'other','table':'pmc_collector_binding'},raw),raw)
        with self.assertRaises(ValueError):m.mapped_row(t,b'{"role_name":"unexpected"}')
    def test_identifiers_and_paths(self):
        self.assertEqual(m.ident('a"b'),'"a""b"')
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);(root/'row').write_bytes(b'{}\n');(root/'alias').symlink_to(root/'row')
            for p in ('../row','/row','alias'):
                with self.assertRaises(ValueError):m.safe_file(root,p)
            self.assertEqual(m.safe_file(root,'row'),root/'row')

if __name__=='__main__':unittest.main()
