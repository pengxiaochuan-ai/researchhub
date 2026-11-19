import contextlib
import importlib.util
import io
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("probe", Path(__file__).with_name("production-readonly-probe.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class ProbeTest(unittest.TestCase):
    def test_subprocess_uses_python36_compatible_signature(self):
        def legacy_run(args, *, stdout, stderr, universal_newlines, timeout, check):
            self.assertEqual(stdout, probe.subprocess.PIPE)
            self.assertEqual(stderr, probe.subprocess.PIPE)
            self.assertTrue(universal_newlines)
            self.assertTrue(check)
            self.assertEqual(timeout, 20)
            return SimpleNamespace(stdout="synthetic metadata")
        with patch.object(probe.subprocess, "run", legacy_run):
            self.assertEqual(probe.command(["synthetic-command"]), "synthetic metadata")

    def test_real_local_subprocess_capture(self):
        self.assertEqual(probe.command([sys.executable, "-c", "print('synthetic metadata')"]),
                         "synthetic metadata\n")

    def test_inventory_failure_reports_only_sanitized_phase_and_kind(self):
        old_command = probe.command
        secret = "SYNTHETIC_ERROR_MUST_NEVER_APPEAR"
        def fail(*_args, **_kwargs):
            raise probe.subprocess.CalledProcessError(7, [secret], output=secret, stderr=secret)
        probe.command = fail
        output = io.StringIO()
        try:
            with contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as caught:
                probe.entry()
        finally:
            probe.command = old_command
        self.assertEqual(caught.exception.code, 1)
        self.assertNotIn(secret, output.getvalue())
        result = json.loads(output.getvalue())
        self.assertEqual(result["phase"], "container_inventory")
        self.assertEqual(result["kind"], "CalledProcessError")
        self.assertEqual(result["exitCode"], 7)

    def run_probe(self, service="server", db_failure=False):
        calls = []
        secret = "SYNTHETIC_MUST_NEVER_APPEAR"
        item = {"Id": "a" * 64, "Name": "/aisci-server", "State": {"Status": "running"},
                "Config": {"Image": "ghcr.io/test/aisci-server:fixed", "Env": ["PASSWORD=" + secret],
                           "Cmd": [secret], "Labels": {"com.docker.compose.service": service}},
                "NetworkSettings": {"Ports": {}}}

        def command(args, timeout=20):
            calls.append(args)
            if args[:2] == ["docker", "ps"]:
                return "a" * 12
            if args[:2] == ["docker", "inspect"]:
                return json.dumps([item])
            if db_failure:
                raise RuntimeError(secret)
            return json.dumps({"metadata": [[{"readonly": "on"}]]})

        old_command, old_glob, old_base64 = probe.command, probe.glob.glob, probe.base64.b64decode
        probe.command, probe.glob.glob = command, lambda _p: []
        probe.base64.b64decode = lambda _x: b"SELECT 'synthetic-catalog-hash'"
        output = io.StringIO()
        status = 0
        try:
            with contextlib.redirect_stdout(output):
                try:
                    probe.main()
                except SystemExit as e:
                    status = e.code
        finally:
            probe.command, probe.glob.glob, probe.base64.b64decode = old_command, old_glob, old_base64
        self.assertNotIn(secret, output.getvalue())
        return status, json.loads(output.getvalue()), calls

    def test_only_metadata_is_emitted(self):
        status, result, calls = self.run_probe()
        self.assertEqual(status, 0)
        self.assertEqual(result["database"]["metadata"][0][0]["readonly"], "on")
        self.assertEqual(calls[-1][:2], ["docker", "exec"])
        self.assertIn("SET TRANSACTION READ ONLY", calls[-1][-1])
        self.assertNotIn("dist/main", calls[-1][-1])

    def test_missing_server_is_blocked_without_database_access(self):
        status, result, calls = self.run_probe(service="web")
        self.assertEqual(status, 2)
        self.assertIn("blocked", result["database"])
        self.assertEqual(len(calls), 2)

    def test_database_failure_is_a_failed_probe_not_successful_inventory(self):
        status, result, _ = self.run_probe(db_failure=True)
        self.assertEqual(status, 2)
        self.assertEqual(result["database"]["blocked"], "CATALOG_PROBE_FAILED")


if __name__ == "__main__":
    unittest.main()
