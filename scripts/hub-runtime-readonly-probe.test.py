import importlib.util,pathlib,unittest,tempfile,json,contextlib,io
s=importlib.util.spec_from_file_location('m',str(pathlib.Path(__file__).with_name('hub-runtime-readonly-probe.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ProbeTests(unittest.TestCase):
 def test_private_values_never_enter_metadata(self):
  c={'Name':'/researchhub-front','Config':{'Image':'image:tag','Env':['S3_SECRET_KEY=NEVER-PRINT','DATABASE_URL=postgresql://SECRET','S3_BUCKET=bucket'],'Labels':{'com.docker.compose.project':'researchhub','com.docker.compose.service':'researchhub'}},'State':{'Status':'running'},'NetworkSettings':{'Ports':{},'Networks':{'researchhub_default':{}}},'HostConfig':{'Memory':536870912}}
  out=m.container_metadata(c);text=json.dumps(out);self.assertNotIn('NEVER-PRINT',text);self.assertNotIn('postgresql://SECRET',text);self.assertNotIn('bucket',text);self.assertEqual(out['project'],'researchhub')
 def test_config_only_exposes_safe_runtime_binding(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'config';p.write_text('DATABASE_URL=SECRET\nJWT_SECRET=SECRET\nVITE_AUTH_TENANT_SLUG=synthetic-hub\nHUB_DATABASE_NAME=researchhub\n');p.chmod(0o600)
   text=json.dumps(m.config_metadata(p));self.assertNotIn('SECRET',text);self.assertIn('synthetic-hub',text)
if __name__=='__main__':unittest.main()
