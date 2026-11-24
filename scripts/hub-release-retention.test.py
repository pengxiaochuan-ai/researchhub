import hashlib
import importlib.util
import io
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

script = pathlib.Path(__file__).with_name('hub-release-retention.py')
spec = importlib.util.spec_from_file_location('retention', str(script))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


class RetentionTests(unittest.TestCase):
    now = 1795500000

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ops = pathlib.Path(self.tmp.name).resolve()
        (self.ops / 'runtime-releases').mkdir()
        self.objects = {}
        self.store = SimpleNamespace(get_object=lambda key: io.BytesIO(self.objects[key]))
        self.images = {}
        self.removed_images = []
        self.owner = patch.object(retention, 'OWNER_UID', os.geteuid())
        self.owner.start()
        self.addCleanup(self.owner.stop)
        self.previous, self.previous_dir = self.release('22222222', 400)
        self.current, self.current_dir = self.release('33333333', 500, self.previous)
        self.old, self.old_dir = self.release('11111111', 200)
        self.live = [self.container(self.current, kind, True) for kind in retention.ARTIFACTS]
        self.set_pointer(self.current)
        for name, value in (('docker', self.docker), ('containers', lambda: self.live)):
            mock = patch.object(retention, name, value)
            mock.start()
            self.addCleanup(mock.stop)

    def bytes(self, value):
        return json.dumps(value, sort_keys=True).encode()

    def ref(self, manifest):
        tag = manifest['tag']
        raw = self.objects[retention.PREFIX + tag + '/runtime-release.json']
        return {'tag': tag, 'manifestSha256': hashlib.sha256(raw).hexdigest()}

    def set_pointer(self, manifest, displaced=None):
        pointer = {'schema': 'researchhub-release-pointer.v1', **self.ref(manifest)}
        if displaced:
            pointer['rollback'] = self.ref(displaced)
        raw = self.bytes(pointer)
        (self.ops / 'paired-current.json').write_bytes(raw)
        self.objects[retention.PREFIX + 'current-release.json'] = raw

    def release(self, label, run, previous=None, status='promoted', backend=None):
        tag = 'hub-runtime-{}-{}'.format(label, run)
        folder = self.ops / 'runtime-releases' / tag / 'control-0123456789abcdef'
        folder.mkdir(parents=True)
        manifest = {'tag': tag, 'previousRelease': self.ref(previous) if previous else None,
                    'files': {}, 'images': {}}
        for n, (kind, name) in enumerate(retention.ARTIFACTS.items()):
            ref = retention.REPOSITORIES[kind] + ':' + tag
            image = 'sha256:' + hashlib.sha256((ref + str(n)).encode()).hexdigest()
            if kind == 'backend' and backend:
                ref = backend['backendImage']
                image = backend['images'][kind]['configId']
            manifest[kind + 'Image'] = ref
            manifest['images'][kind] = {'configId': image}
            raw = (tag + name).encode()
            key = retention.PREFIX + tag + '/' + name
            self.objects[key] = raw
            archive = folder / name
            archive.write_bytes(raw)
            os.utime(str(archive), (self.now - retention.AGE, self.now - retention.AGE))
            manifest['files'][name] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
            self.images.setdefault(ref, {'Id': image, 'RepoTags': [ref], 'Created': '2026-11-01T00:00:00.123Z'})
        raw = self.bytes(manifest)
        (folder / 'runtime-release.json').write_bytes(raw)
        self.objects[retention.PREFIX + tag + '/runtime-release.json'] = raw
        (folder / 'pair-receipt.json').write_bytes(
            self.bytes({'status': status, 'tag': tag, 'previousTag': (previous or {}).get('tag', '')}))
        return manifest, folder

    def container(self, manifest, kind, running, project=None):
        labels = {'com.docker.compose.project': project or retention.PROJECTS[kind],
                  'com.docker.compose.service': 'researchhub-api'}
        return {'Image': manifest['images'][kind]['configId'], 'State': {'Running': running},
                'Config': {'Image': manifest[kind + 'Image'], 'Labels': labels}}

    def docker(self, *args):
        if args[:2] == ('image', 'inspect') and args[2] in self.images:
            return json.dumps([self.images[args[2]]])
        if args[:3] == ('image', 'rm', '--no-prune'):
            self.removed_images.append(args[3])
            del self.images[args[3]]
            return ''
        raise subprocess.CalledProcessError(1, args)

    def run_phase(self, phase, required=0, candidate=None):
        return retention.retain_locked(self.ops, self.store, candidate or self.current,
                                       phase, required=required, now=self.now)

    def test_audit_does_not_touch_archives_or_images(self):
        result = self.run_phase('audit')
        self.assertEqual((result['archiveCandidates'], result['imageCandidates']), (2, 2))
        self.assertEqual(len(list(self.old_dir.glob('*.tar.gz'))), 2)
        self.assertEqual(self.removed_images, [])
        self.assertFalse((self.ops / 'cache-recovery').exists())

    def test_maintain_only_reclaims_old_owned_archive_or_image(self):
        result = self.run_phase('maintain')
        self.assertEqual((result['archivesReclaimed'], result['imagesReclaimed']), (2, 2))
        self.assertEqual(set(self.removed_images), {self.old['frontendImage'], self.old['backendImage']})
        self.assertFalse(list(self.old_dir.glob('*.tar.gz')))
        self.assertTrue((self.old_dir / 'runtime-release.json').exists())
        self.assertTrue((self.old_dir / 'pair-receipt.json').exists())
        self.assertEqual(len(list(self.current_dir.glob('*.tar.gz'))), 2)
        self.assertEqual(len(list(self.previous_dir.glob('*.tar.gz'))), 2)
        docs = [json.loads(p.read_text()) for p in (self.ops / 'cache-recovery').glob('*.json')]
        self.assertEqual(len(docs), 4)
        for item in docs:
            self.assertEqual(hashlib.sha256(self.objects[item['ossKey']]).hexdigest(), item['sha256'])

    def test_guard_preserves_reused_ref_rollback_and_unfinished_tag(self):
        pending, pending_dir = self.release('44444444', 600, self.old, status='unknown')
        displaced, displaced_dir = self.release('55555555', 700, self.current, backend=self.old)
        self.set_pointer(self.current, displaced=displaced)
        result = self.run_phase('maintain')
        self.assertEqual(result['rollback'], displaced['tag'])
        self.assertEqual((result['archivesReclaimed'], result['imagesReclaimed']), (0, 0))
        for folder in (pending_dir, displaced_dir, self.old_dir):
            self.assertEqual(len(list(folder.glob('*.tar.gz'))), 2)

    def test_stopped_foreign_container_and_foreign_alias_are_protected(self):
        alternate = dict(self.old, backendImage='unrelated:alias')
        self.live.append(self.container(alternate, 'backend', False, project='official-site'))
        self.images[self.old['frontendImage']]['RepoTags'].append('official-site:historical')
        result = self.run_phase('maintain')
        self.assertEqual(result['imagesReclaimed'], 0)
        self.assertEqual(self.removed_images, [])

    def test_preserves_corrupted_remote_and_local_copies(self):
        self.objects[retention.PREFIX + self.old['tag'] + '/backend-image.tar.gz'] = b'changed remote'
        archive = self.old_dir / 'researchhub.tar.gz'
        archive.write_bytes(b'x' * archive.stat().st_size)
        os.utime(str(archive), (self.now - retention.AGE, self.now - retention.AGE))
        result = self.run_phase('maintain')
        self.assertEqual(result['archivesReclaimed'], 0)
        self.assertEqual(result['imagesReclaimed'], 0)
        self.assertEqual(result['skipped'], 2)
        self.assertEqual(len(list(self.old_dir.glob('*.tar.gz'))), 2)

    def test_prepare_rechecks_real_free_and_does_not_touch_images(self):
        archive = self.old_dir / 'researchhub.tar.gz'
        with patch.object(retention.shutil, 'disk_usage', lambda _: SimpleNamespace(free=50 if archive.exists() else 101)):
            result = self.run_phase('prepare', required=100)
        self.assertEqual(result['archivesReclaimed'], 1)
        self.assertEqual(result['freeAfter'], 101)
        self.assertTrue((self.old_dir / 'backend-image.tar.gz').exists())
        self.assertEqual(self.removed_images, [])

    def test_24_hours_controls_archive_and_image_eligibility(self):
        image = self.images[self.old['frontendImage']]
        from time import strftime, gmtime
        image['Created'] = strftime('%Y-%m-%dT%H:%M:%SZ', gmtime(self.now - retention.AGE + 1))
        archive = self.old_dir / 'researchhub.tar.gz'
        os.utime(str(archive), (self.now - retention.AGE + 1, self.now - retention.AGE + 1))
        result = self.run_phase('maintain')
        self.assertTrue(archive.exists())
        self.assertEqual((result['archivesReclaimed'], result['imagesReclaimed']), (1, 1))
        self.assertEqual(self.removed_images, [self.old['backendImage']])

    def test_pointer_or_live_pair_drift_blocks_any_cleanup(self):
        self.live[0]['Image'] = self.old['images']['frontend']['configId']
        with self.assertRaisesRegex(ValueError, 'HUB_CACHE_LIVE_PAIR_MISMATCH'):
            self.run_phase('maintain')
        self.assertEqual(self.removed_images, [])
        self.assertEqual(len(list(self.old_dir.glob('*.tar.gz'))), 2)

    def test_hardlink_and_symlink_are_never_removed(self):
        backend = self.old_dir / 'backend-image.tar.gz'
        os.link(str(backend), str(self.ops / 'extra-link'))
        frontend = self.old_dir / 'researchhub.tar.gz'
        target = self.ops / 'outside'
        frontend.rename(target)
        frontend.symlink_to(target)
        result = self.run_phase('maintain')
        self.assertEqual(result['archivesReclaimed'], 0)
        self.assertTrue(frontend.is_symlink() and target.exists() and backend.exists())


if __name__ == '__main__':
    unittest.main()
