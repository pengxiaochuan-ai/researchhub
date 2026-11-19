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
 def test_pinned_download_and_loaded_image_rejected_before_activation(self):
  import hashlib
  text=pathlib.Path('scripts/ecs-release.sh').read_text();body=text[text.index('verify_pinned_frontend_artifacts() {'):text.index('\nactivate_release() {')]
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d);archive=p/'image';compose=p/'compose';archive.write_bytes(b'approved image');compose.write_bytes(b'approved compose')
   env=dict(os.environ,HUB_EXPECTED_FRONTEND_SHA256=hashlib.sha256(archive.read_bytes()).hexdigest(),HUB_EXPECTED_COMPOSE_SHA256=hashlib.sha256(compose.read_bytes()).hexdigest(),HUB_EXPECTED_FRONTEND_IMAGE_ID='sha256:'+'a'*64,IMAGE_REF='approved:tag',ARCHIVE=str(archive),COMPOSE=str(compose))
   script='set -eu\n'+body+'\nverify_pinned_frontend_artifacts "$ARCHIVE" "$COMPOSE"\ndocker(){ echo "sha256:'+'a'*64+'"; }\nverify_pinned_frontend_image\n'
   run=lambda code,e:subprocess.run(['bash','-c',code],env=e,stdout=subprocess.PIPE,stderr=subprocess.PIPE).returncode
   self.assertEqual(run(script,env),0)
   archive.write_bytes(b'drifted with a separately updated checksum file');self.assertNotEqual(run(script,env),0)
   archive.write_bytes(b'approved image');compose.write_bytes(b'drifted compose');self.assertNotEqual(run(script,env),0)
   compose.write_bytes(b'approved compose');self.assertNotEqual(run(script.replace('echo "sha256:'+'a'*64,'echo "sha256:'+'b'*64),env),0)
   self.assertLess(text.index('verify_pinned_frontend_artifacts "${image_archive}"'),text.index('gzip -dc "${image_archive}"'))
   self.assertLess(text.index('verify_pinned_frontend_image || return 1'),text.index('=== Activating researchhub release ==='))
if __name__=='__main__':unittest.main()
