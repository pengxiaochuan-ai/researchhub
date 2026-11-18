"""Verify a downloaded DOCX against saved fixed Run strings; no network."""
import json, sys, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

path, expected_path, output_path = map(Path, sys.argv[1:])
expected = json.loads(expected_path.read_text(encoding='utf-8'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(path) as archive:
    assert archive.testzip() is None
    assert '[Content_Types].xml' in archive.namelist()
    document = ET.fromstring(archive.read('word/document.xml'))

def text(node):
    return ''.join(n.text or '' for n in node.findall('.//w:t', ns))

def cells(table):
    return [[text(c) for c in row.findall('./w:tc', ns)] for row in table.findall('./w:tr', ns)]

body = document.find('./w:body', ns)
assert body is not None
segments, paragraphs = [], []
for node in body:
    if node.tag == '{%s}p' % ns['w']:
        paragraphs.append(text(node))
    elif node.tag == '{%s}tbl' % ns['w']:
        segments.append((paragraphs, cells(node)))
        paragraphs = []
columns = expected['columns']
assert len(segments) == 2 * len(columns)
assert '受试者数：' + expected['rowCount'] in segments[0][0]
for i, column in enumerate(columns):
    before, table = segments[i]
    assert before[-2:] == [column['label'], '单位：' + (column['unit'] if column['unit'] is not None else '未声明')]
    assert table == [['指标', '结果']] + [[r['label'], r['value']] for r in column['rows']]
    appendix_before, appendix_table = segments[i + len(columns)]
    exact = [column['label']+'（'+column['key']+'）', '变量标识：'+column['key'], '表单字段：'+column['fieldKey'], '字段类型：'+column['valueType'], '单位：'+(column['unit'] if column['unit'] is not None else '未声明'), '固定表单版本：'+column['formVersionId'], '表单定义摘要：'+column['formDefinitionHash']]
    assert appendix_before[-len(exact):] == exact
    assert appendix_table == [['指标', '固定结果路径']] + [[r['label'], r['path']] for r in column['rows']]
assert '可复核附录' in segments[len(columns)][0]
assert '受试者数固定结果路径：rowCount' in segments[len(columns)][0]
for required in ['方法运行：'+expected['runId'], '算子版本：'+expected['executorVersion'], '分析快照：'+expected['snapshotId'], '分析依据摘要：'+expected['manifestHash']]:
    assert required in paragraphs
output_path.write_text(json.dumps({'passed': True, 'tableCount': len(segments), 'eachHeadingUnitAndAppendixBound': True, 'rowCountRunSnapshotBasisAndSourceExact': True}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
