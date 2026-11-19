import importlib.util
import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch, mock_open
import subprocess

spec = importlib.util.spec_from_file_location('inspection', 'scripts/hub-production-inspect.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InspectionTests(unittest.TestCase):
    def test_database_errors_do_not_echo_connection_details(self):
        result = subprocess.CompletedProcess([], 1, '', 'postgresql://user:must-not-appear@private/db')
        with patch.object(module.subprocess, 'run', return_value=result):
            with self.assertRaisesRegex(ValueError, '^INSPECT_COMMAND_FAILED$'):
                module.run(['docker', 'exec', 'fixture'])

    def test_key_probe_returns_only_presence_and_never_sources_config(self):
        with patch('builtins.open', mock_open(read_data='DEEPSEEK_API_KEY="fixture-not-real"\nOTHER=ignored\n')):
            self.assertIs(module.legacy_key_presence(), True)
        with patch('builtins.open', mock_open(read_data='DEEPSEEK_API_KEY=""\n')):
            self.assertIs(module.legacy_key_presence(), False)
        with patch('builtins.open', mock_open(read_data='DEEPSEEK_API_KEY=a\nDEEPSEEK_API_KEY=b\n')):
            self.assertIs(module.legacy_key_presence(), False)

    def test_ambiguous_container_never_executes_node(self):
        with patch.object(module, 'run', return_value='abc123abc123\ndef456def456') as run:
            with self.assertRaisesRegex(ValueError, '^INSPECT_HUB_CONTAINER_REQUIRED$'):
                module.main()
            self.assertEqual(run.call_count, 1)

    def test_inspection_does_not_restart_services_or_boot_workers(self):
        replies=['abc123abc123', 'old old-image Up 1 hour', '{"status":"hub-production-inspected","databaseWrites":0}', 'old old-image']
        with patch.object(module, 'run', side_effect=replies) as run, patch.object(module, 'legacy_key_presence', return_value=False):
            output=io.StringIO()
            with redirect_stdout(output):
                module.main()
            self.assertIn('"containerIdentitiesUnchanged": true', output.getvalue())
            self.assertEqual(run.call_args_list[2].args[0], ['docker','exec','-i','abc123abc123','node','--input-type=module','-'])
            self.assertIn('{readOnly:true}', module.NODE)
            self.assertNotIn('bootResearchRuntime', module.NODE)
            self.assertNotIn('createRuntimeFoundation', module.NODE)


if __name__ == '__main__':
    unittest.main()
