"""Offline positive/negative controls for the fixed-report DOCX oracle."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

repo = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wf10_docx_oracle', Path(__file__).with_name('study-workflow-wf10-docx-verify.py'))
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
old = repo / 'docs/testing/evidence/research-t18-2026-11-12/corrected-report-6277b638/corrected-report.docx'
source = 'cmwdq0636001jlud6scho3s1q'


class FixedWordOracle(unittest.TestCase):
    def test_accepted_fixed_word_is_readable_and_has_exact_source(self):
        proof = oracle.compare(old, old, source)
        self.assertTrue(proof['passed'])
        self.assertGreater(proof['tableCount'], 0)

    def test_different_table_value_in_owned_copy_is_rejected(self):
        (repo / '.tmp').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='wf10-word-oracle-', dir=repo / '.tmp') as folder:
            changed = Path(folder) / 'changed.docx'
            with zipfile.ZipFile(old) as original, zipfile.ZipFile(changed, 'w') as output:
                for info in original.infolist():
                    body = original.read(info.filename)
                    if info.filename == 'word/document.xml':
                        document = ET.fromstring(body)
                        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                        cell = document.find('.//w:tbl/w:tr[2]/w:tc[2]//w:t', ns)
                        self.assertIsNotNone(cell)
                        cell.text = '999999'
                        body = ET.tostring(document)
                    output.writestr(info, body)
            with self.assertRaisesRegex(AssertionError, 'FIXED_SCIENTIFIC_TABLES_CHANGED'):
                oracle.compare(old, changed, source)

    def test_wrong_source_id_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'EXACT_ANALYSIS_SOURCE_MISSING'):
            oracle.compare(old, old, 'a-different-source')


if __name__ == '__main__':
    unittest.main()
