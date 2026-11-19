import importlib.util,pathlib,unittest
s=importlib.util.spec_from_file_location('plan',str(pathlib.Path(__file__).with_name('hub-release-plan.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Changes(unittest.TestCase):
 def test_page_only(self):self.assertEqual(m.classify(['pages/h01/src/main.jsx','pages/shared/Button.css','Dockerfile']),{'frontend':True,'backend':False,'database':False})
 def test_backend_only(self):self.assertEqual(m.classify(['server/research-assets/business-registration.mjs','deploy/backend.Dockerfile']),{'frontend':False,'backend':True,'database':False})
 def test_proxy_is_frontend(self):self.assertEqual(m.classify(['server/static.mjs','server/api-proxy.mjs']),{'frontend':True,'backend':False,'database':False})
 def test_shared_and_unknown_are_conservative(self):
  for path in ['src/auth-session.js','package.json','deploy/backend-package.mjs','.github/workflows/deploy.yml','new-runtime-config.toml','pages/h01/src/china.json']:
   self.assertEqual(m.classify([path]),{'frontend':True,'backend':True,'database':False})
 def test_documentation_and_tests_do_not_release(self):self.assertEqual(m.classify(['docs/product/a.md','server/a.test.mjs','tests/a.test.mjs']),{'frontend':False,'backend':False,'database':False})
 def test_schema_and_migrations_require_independent_approval(self):
  for path in ['deploy/asset-production-ddl.mjs','server/research-assets/schema.sql','server/directory/source-lock.sql','server/hub-sources/pmc-article-decision.sql','prisma/schema.prisma','prisma/migrations/123/migration.sql','server/ai-agent/session-audio-guard.sql']:
   self.assertTrue(m.classify([path])['database'])
 def test_change_base_is_last_successful_component_not_previous_push(self):
  previous={'controlGit':'a'*40,'components':{'frontend':{'sourceGit':'b'*40},'backend':{'sourceGit':'c'*40}}}
  self.assertEqual(m.component_base(previous,'frontend'),'b'*40);self.assertEqual(m.component_base(previous,'backend'),'c'*40)
  self.assertEqual(m.component_base({'controlGit':'a'*40},'backend'),'a'*40)
 def test_workflow_rerun_has_a_distinct_immutable_candidate_tag(self):
  one=m.release_tag('a'*40,12345,1);two=m.release_tag('a'*40,12345,2)
  self.assertNotEqual(one,two);self.assertRegex(one,r'^hub-runtime-[a-f0-9]{8}-[0-9]+$')
if __name__=='__main__':unittest.main()
