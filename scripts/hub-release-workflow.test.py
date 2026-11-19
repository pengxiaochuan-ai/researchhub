import pathlib,re,unittest
class WorkflowTests(unittest.TestCase):
 def test_only_finalize_never_started_allows_automatic_restore(self):
  text=pathlib.Path('.github/workflows/deploy.yml').read_text();part=text.split('      - name: Restore both previous components',1)[1];condition=re.search(r'^        if: (.*)$',part,re.M).group(1)
  def restore(finalize,apply='success',failed=True,cancelled=False):
   expression=condition.replace('always()','True').replace('failure()',str(failed)).replace('cancelled()',str(cancelled)).replace('steps.apply.outcome',repr(apply)).replace('steps.finalize.outcome',repr(finalize)).replace('&&',' and ').replace('||',' or ')
   return eval(expression,{'__builtins__':{}},{})
  self.assertTrue(restore('skipped'));self.assertTrue(restore('skipped',failed=False,cancelled=True))
  for outcome in ('success','failure','cancelled'):
   self.assertFalse(restore(outcome));self.assertFalse(restore(outcome,failed=False,cancelled=True))
  self.assertFalse(restore('skipped',apply='failure'))
 def test_no_live_unpaired_entry_remains(self):
  for file in ('hub-runtime-build.yml','rollback.yml'):self.assertFalse((pathlib.Path('.github/workflows')/file).exists())
  self.assertIn('options: [verify]',pathlib.Path('.github/workflows/hub-runtime-activate.yml').read_text())
 def test_source_refresh_and_no_automatic_database_migration(self):
  text=pathlib.Path('.github/workflows/deploy.yml').read_text();self.assertIn('refreshBackendHub',text);self.assertIn("sourceGit:process.env.GITHUB_SHA",text)
  self.assertNotRegex(text,r'(?:prisma\s+(?:migrate|db\s+push)|psql\s|run-server.py\s+(?:all|0[0-9]))')
if __name__=='__main__':unittest.main()
