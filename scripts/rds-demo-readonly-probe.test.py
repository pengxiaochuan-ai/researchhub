import contextlib
import importlib.util
import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rds_probe', Path(__file__).with_name('rds-demo-readonly-probe.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class RdsProbeTest(unittest.TestCase):
    def invoke(self, failure=False):
        calls = []
        secret = 'SYNTHETIC_CREDENTIAL_MUST_NOT_APPEAR'
        def fake(args):
            calls.append(args)
            if args[:2] == ['docker', 'ps']:
                return 'a' * 12
            if args[:2] == ['docker', 'inspect']:
                return json.dumps([{'Id': 'a'*64, 'Config': {'Image': 'repo/aisci-server:fixed', 'Env': [secret], 'Labels': {'com.docker.compose.service': 'server'}}}])
            if failure:
                raise RuntimeError(secret)
            return json.dumps({'schema': 'hub-rds-demo-admission.v1', 'identity': [{'database': 'postgres', 'readonly': 'on'}], 'writes': 0})
        out = io.StringIO()
        with patch.object(probe, 'command', fake), contextlib.redirect_stdout(out):
            if failure:
                with self.assertRaises(RuntimeError):
                    probe.main()
            else:
                probe.main()
        self.assertNotIn(secret, out.getvalue())
        return out.getvalue(), calls

    def test_maintenance_only_probe_does_not_emit_environment(self):
        output, calls = self.invoke()
        self.assertEqual(json.loads(output)['writes'], 0)
        js = calls[-1][-1]
        self.assertIn("u.pathname='/postgres'", js)
        self.assertIn('SET TRANSACTION READ ONLY', js)
        self.assertNotIn('dist/main', js)
        self.assertNotIn('FROM public.', js)

    def test_child_failure_does_not_emit_command_or_credentials(self):
        output, _ = self.invoke(True)
        self.assertEqual(output, '')


if __name__ == '__main__':
    unittest.main()
