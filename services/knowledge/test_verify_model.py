import hashlib
import tempfile
import unittest
from pathlib import Path
from verify_model import verify, copy_cached


class ModelTests(unittest.TestCase):
    def test_only_matching_complete_cached_model_is_copied(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'cache' / 'snapshot'
            source.mkdir(parents=True)
            body = b'synthetic-operator-weights'
            (source / 'model_optimized.onnx').write_bytes(body)
            manifest = {'files': {'model_optimized.onnx': hashlib.sha256(body).hexdigest()}}
            self.assertEqual(copy_cached(root / 'cache', root / 'owned', manifest), root / 'owned')
            (root / 'owned' / 'model_optimized.onnx').write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError, 'CONTENT_MISMATCH'):
                verify(root / 'owned', manifest)
            with self.assertRaisesRegex(RuntimeError, 'CACHED_MODEL_UNAVAILABLE'):
                copy_cached(root / 'empty', root / 'must-not-exist', manifest)
            self.assertFalse((root / 'must-not-exist').exists())


if __name__ == '__main__':
    unittest.main()
