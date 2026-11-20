"""Verify the exact inference files before loading or copying cached weights."""
import hashlib
import json
from pathlib import Path
import shutil
import sys


def verify(root, manifest):
    for name, expected in manifest['files'].items():
        path = root / name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError('HUB_EMBED_MODEL_CONTENT_MISMATCH')
    return root


def copy_cached(cache, target, manifest):
    for candidate in sorted(cache.rglob('model_optimized.onnx')):
        try:
            root = verify(candidate.parent, manifest)
        except RuntimeError:
            continue
        target.mkdir(parents=True, exist_ok=False)
        for name in manifest['files']:
            dest = target / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / name, dest)
        return verify(target, manifest)
    raise RuntimeError('HUB_EMBED_CACHED_MODEL_UNAVAILABLE')


if __name__ == '__main__':
    manifest = json.loads(Path(__file__).with_name('model.json').read_text())
    copy_cached(Path(sys.argv[1]), Path(sys.argv[2]), manifest)
