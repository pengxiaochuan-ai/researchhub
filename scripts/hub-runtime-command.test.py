import pathlib,subprocess,os,unittest
class CommandToken(unittest.TestCase):
 def test_same_workflow_actions_and_reruns_have_distinct_tokens(self):
  text=pathlib.Path('scripts/run-hub-runtime-command.sh').read_text();body=text[text.index('runtime_client_token() {'):text.index('export ALIBABA_CLOUD_IGNORE_PROFILE')]
  def token(action,attempt='1',sha='a'*64):
   env=dict(os.environ,GITHUB_RUN_ID='12345',GITHUB_RUN_ATTEMPT=attempt,HUB_RUNTIME_TAG='hub-runtime-12345678-1001',HUB_RUNTIME_ACTION=action,HUB_RUNTIME_CONTROL_SHA256=sha)
   value=subprocess.check_output(['bash','-c',body+'\nruntime_client_token'],env=env).decode().strip();self.assertRegex(value,r'^hub-runtime-[a-f0-9]{32}$');self.assertLessEqual(len(value),64);return value
  values={token('pair-release'),token('pair-finalize'),token('pair-rollback'),token('pair-release','2'),token('pair-release',sha='b'*64)}
  self.assertEqual(len(values),5);self.assertEqual(token('pair-release'),token('pair-release'))
if __name__=='__main__':unittest.main()
