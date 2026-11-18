"""Compare actual downloaded Word tables with the already accepted fixed report. No network."""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile


def read_word(path):
    with zipfile.ZipFile(path) as archive:
        assert sum(item.file_size for item in archive.infolist()) <= 64 * 1024 * 1024
        assert archive.testzip() is None
        assert '[Content_Types].xml' in archive.namelist()
        document = ET.fromstring(archive.read('word/document.xml'))
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    text = lambda node: ''.join(item.text or '' for item in node.findall('.//w:t', ns))
    tables = [[[text(cell) for cell in row.findall('./w:tc', ns)]
               for row in table.findall('./w:tr', ns)]
              for table in document.findall('.//w:tbl', ns)]
    return tables, text(document)


def compare(old_path, new_path, source_id):
    old_tables, old_text = read_word(old_path)
    new_tables, new_text = read_word(new_path)
    assert old_tables and old_tables == new_tables, 'FIXED_SCIENTIFIC_TABLES_CHANGED'
    assert old_text == new_text, 'FIXED_REPORT_TEXT_CHANGED'
    assert source_id in old_text and source_id in new_text, 'EXACT_ANALYSIS_SOURCE_MISSING'
    return {'passed': True, 'tableCount': len(new_tables),
            'allTableCellsMatchAcceptedFixedReport': True,
            'allWordTextMatchesAcceptedFixedReport': True,
            'analysisSourcePresent': source_id,
            'sizeBytes': new_path.stat().st_size,
            'sha256': hashlib.sha256(new_path.read_bytes()).hexdigest()}


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'OLD_DOCX NEW_DOCX EXACT_SOURCE_ID OUT_JSON'
    old_path, new_path = map(Path, sys.argv[1:3])
    value = compare(old_path, new_path, sys.argv[3])
    Path(sys.argv[4]).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': True, 'tableCount': value['tableCount'], 'sha256': value['sha256']}))
