import json, subprocess, sys, tempfile, unittest, zipfile
from pathlib import Path

SCRIPT = Path(__file__).with_name('research-t18-report-docx-verify.py')
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

def p(value): return '<w:p><w:r><w:t>'+value+'</w:t></w:r></w:p>'
def table(rows):
    return '<w:tbl>' + ''.join('<w:tr>' + ''.join('<w:tc>'+p(c)+'</w:tc>' for c in row) + '</w:tr>' for row in rows) + '</w:tbl>'

class Verify(unittest.TestCase):
    def test_exact_binding_and_tamper(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d); cols=[{'key':'v1','label':'观察值','unit':None,'fieldKey':'value','valueType':'number','formVersionId':'form1','formDefinitionHash':'a'*64,'rows':[{'label':'总数','value':'0','path':'columns.v1.total'}]}, {'key':'v2','label':'另一指标','unit':'kg','fieldKey':'other','valueType':'number','formVersionId':'form1','formDefinitionHash':'a'*64,'rows':[{'label':'总数','value':'1','path':'columns.v2.total'}]}]
            expected={'columns':cols,'rowCount':'1','runId':'run1','executorVersion':'descriptive-v1','snapshotId':'snap1','manifestHash':'b'*64,'studyId':'study1'}
            (d/'expected.json').write_text(json.dumps(expected,ensure_ascii=False),encoding='utf8')
            def make(*,swap=False,badvalue=False,badpath=False,missinghash=False):
                parts=[p('受试者数：1')]
                for i,c in enumerate(cols):
                    heading=cols[1-i] if swap else c
                    parts += [p(heading['label']),p('单位：'+(heading['unit'] or '未声明')),table([['指标','结果'],['总数','9' if badvalue and i==0 else c['rows'][0]['value']]])]
                parts += [p('可复核附录'),p('受试者数固定结果路径：rowCount')]
                for i,c in enumerate(cols):
                    parts += [p(c['label']+'（'+c['key']+'）'),p('变量标识：'+c['key']),p('表单字段：'+c['fieldKey']),p('字段类型：'+c['valueType']),p('单位：'+(c['unit'] or '未声明')),p('固定表单版本：'+c['formVersionId']),p('表单定义摘要：'+c['formDefinitionHash']),table([['指标','固定结果路径'],['总数','columns.bad.total' if badpath and i==0 else c['rows'][0]['path']]])]
                parts += [p('方法运行：run1'),p('算子版本：descriptive-v1'),p('分析快照：snap1')]
                if not missinghash: parts += [p('分析依据摘要：'+'b'*64)]
                xml=f'<w:document xmlns:w="{W}"><w:body>'+''.join(parts)+'</w:body></w:document>'
                with zipfile.ZipFile(d/'x.docx','w') as z:z.writestr('[Content_Types].xml','x');z.writestr('word/document.xml',xml)
            cmd=[sys.executable,str(SCRIPT),str(d/'x.docx'),str(d/'expected.json'),str(d/'result.json')]
            make();self.assertEqual(subprocess.run(cmd,capture_output=True).returncode,0)
            for case in [{'swap':True},{'badvalue':True},{'badpath':True},{'missinghash':True}]:
                make(**case);self.assertNotEqual(subprocess.run(cmd,capture_output=True).returncode,0,case)
if __name__=='__main__': unittest.main()
