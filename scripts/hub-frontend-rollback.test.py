import pathlib,tempfile,subprocess,os,unittest
class FrontendRollback(unittest.TestCase):
 def test_legacy_rollback_keeps_http_only_compose_and_original_image(self):
  self.run_case('services:\n  researchhub:\n    image: new\n','services:\n  researchhub:\n    env_file:\n      - .env.prod\n',True,False)
 def test_safe_previous_compose_can_be_restored(self):
  self.run_case('services:\n  researchhub:\n    image: current\n','services:\n  researchhub:\n    image: previous\n',True,True)
 def test_two_legacy_templates_are_rejected_before_any_up(self):
  legacy='services:\n  researchhub:\n    env_file:\n      - .env.prod\n';self.run_case(legacy,legacy,False,False)
 def run_case(self,current,previous,ok,copied):
  text=pathlib.Path('scripts/ecs-release.sh').read_text();body=text[text.index('restore_previous_release() {'):text.index('\nactivate_release() {')]
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d);(p/'compose').write_text(current);(p/'previous-compose').write_text(previous);(p/'current-env').write_text('RESEARCHHUB_IMAGE=current');(p/'previous-env').write_text('RESEARCHHUB_IMAGE=previous')
   script='set -eu\nCOMPOSE_FILE="$ROOT/compose";PREVIOUS_COMPOSE="$ROOT/previous-compose";CURRENT_ENV="$ROOT/current-env";PREVIOUS_ENV="$ROOT/previous-env"\ncompose_with_env(){ touch "$ROOT/up-called"; ! grep -Eq "^[[:space:]]*env_file:" "$COMPOSE_FILE"; }\nwait_for_health(){ :; }\n'+body+'\nrestore_previous_release\n'
   r=subprocess.run(['bash','-c',script],env={'PATH':os.environ['PATH'],'ROOT':d},stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   self.assertEqual(r.returncode==0,ok)
   if ok:
    self.assertEqual((p/'compose').read_text(),previous if copied else current);self.assertIn('previous',(p/'current-env').read_text());self.assertTrue((p/'up-called').exists())
   else:self.assertFalse((p/'up-called').exists())
if __name__=='__main__':unittest.main()
