"""Retention for the independent ResearchHub release cache (Python 3.6+)."""
import calendar
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import tempfile
import time

PREFIX = 'releases/researchhub/'
ARTIFACTS = {'frontend': 'researchhub.tar.gz', 'backend': 'backend-image.tar.gz'}
REPOSITORIES = {'frontend': 'ghcr.io/pengxiaochuan-ai/pengxc-researchhub',
                'backend': 'researchhub-backend'}
PROJECTS = {'frontend': 'researchhub', 'backend': 'researchhub-backend'}
TAG = re.compile(r'hub-runtime-[a-f0-9]{8}-[0-9]+')
SHA = re.compile(r'[a-f0-9]{64}')
IMAGE = re.compile(r'sha256:[a-f0-9]{64}')
OWNER_UID = 0
AGE = 24 * 60 * 60
BATCH = 8


def require(condition, code='HUB_CACHE_IDENTITY_CHANGED'):
    if not condition:
        raise ValueError(code)


def regular(path):
    data = path.lstat()
    require(path.resolve() == path and stat.S_ISREG(data.st_mode)
            and data.st_uid == OWNER_UID and data.st_mode & 0o022 == 0)
    return data


def read_small(path):
    require(regular(path).st_size < 2 * 1024 * 1024)
    return path.read_bytes()


def stamp(path):
    data = regular(path)
    require(data.st_nlink == 1)
    return (data.st_dev, data.st_ino, data.st_size, data.st_mtime_ns)


def digest(stream):
    checksum = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        checksum.update(block)
    return checksum.hexdigest()


def docker(*args):
    return subprocess.check_output(('docker',) + args, stderr=subprocess.DEVNULL,
                                   universal_newlines=True, timeout=30)


def containers():
    ids = docker('container', 'ls', '-aq', '--no-trunc').splitlines()
    return json.loads(docker('container', 'inspect', *ids)) if ids else []


def image_id(manifest, kind):
    value = manifest.get('images', {}).get(kind, {}).get('configId', '')
    require(IMAGE.fullmatch(value), 'HUB_CACHE_CANONICAL_IMAGE_REQUIRED')
    return value


def manifest_from_oss(store, reference):
    tag, sha = reference['tag'], reference['manifestSha256']
    require(TAG.fullmatch(tag) and SHA.fullmatch(sha))
    body = store.get_object(PREFIX + tag + '/runtime-release.json').read(262144)
    require(hashlib.sha256(body).hexdigest() == sha)
    manifest = json.loads(body)
    require(manifest['tag'] == tag)
    return manifest


def production_state(ops, store):
    pointer_bytes = read_small(ops / 'paired-current.json')
    pointer = json.loads(pointer_bytes)
    require(pointer.get('schema') == 'researchhub-release-pointer.v1')
    require(json.loads(store.get_object(PREFIX + 'current-release.json').read(16384)) == pointer)
    current = manifest_from_oss(store, pointer)
    previous = manifest_from_oss(store, pointer.get('rollback') or current['previousRelease'])
    historical = current['previousRelease']['tag']
    live = containers()
    for kind, project in PROJECTS.items():
        active = [row for row in live if row['State']['Running']
                  and (row['Config'].get('Labels') or {}).get('com.docker.compose.project') == project
                  and (kind == 'frontend' or (row['Config'].get('Labels') or {}).get('com.docker.compose.service') == 'researchhub-api')]
        require(len(active) == 1 and active[0]['Image'] == image_id(current, kind)
                and active[0]['Config']['Image'] == current[kind + 'Image'],
                'HUB_CACHE_LIVE_PAIR_MISMATCH')
    return pointer_bytes, current, previous, historical, live


def completed_controls(root):
    """Only explicit terminal receipts may supply deletion candidates."""
    candidates = []
    protected = set()
    for tag_dir in sorted(root.iterdir()):
        if not TAG.fullmatch(tag_dir.name) or not tag_dir.is_dir() or tag_dir.resolve() != tag_dir:
            continue
        controls = [p for p in tag_dir.iterdir() if re.fullmatch(r'control-[a-f0-9]{16}', p.name)]
        for control in controls:
            manifest = None
            try:
                manifest = json.loads(read_small(control / 'runtime-release.json'))
                require(isinstance(manifest, dict) and manifest.get('tag') == tag_dir.name)
                receipt = json.loads(read_small(control / 'pair-receipt.json'))
                require(isinstance(receipt, dict))
                status = receipt.get('status')
                require(status in ('promoted', 'rolled-back'))
                candidates.append((control, manifest))
            except (OSError, ValueError, KeyError):
                # An unproven tag is ineligible. A recorded pending rollback is protected too.
                protected.add(tag_dir.name)
                if isinstance(manifest, dict):
                    for kind in ARTIFACTS:
                        value = manifest.get(kind + 'Image', '')
                        if isinstance(value, str) and TAG.fullmatch(value.rsplit(':', 1)[-1]):
                            protected.add(value.rsplit(':', 1)[-1])
                try:
                    receipt = json.loads(read_small(control / 'pair-receipt.json'))
                    if isinstance(receipt, dict) and receipt.get('status') in ('prepared', 'applied', 'unknown'):
                        for key in ('tag', 'previousTag'):
                            value = receipt.get(key, '')
                            if isinstance(value, str) and TAG.fullmatch(value):
                                protected.add(value)
                except (OSError, ValueError):
                    pass
    return candidates, protected


def protect(current, previous, candidate, live, protected):
    ids = {row['Image'] for row in live}
    refs = {row['Config']['Image'] for row in live}
    for manifest in (current, previous, candidate):
        protected.add(manifest['tag'])
        for kind in ARTIFACTS:
            ids.add(image_id(manifest, kind))
            refs.add(manifest[kind + 'Image'])
    protected.update(ref.rsplit(':', 1)[-1] for ref in refs if TAG.fullmatch(ref.rsplit(':', 1)[-1]))
    return ids, refs


def recoverable(store, control, manifest, kind, archive=None):
    name = ARTIFACTS[kind]
    item = manifest['files'][name]
    require(SHA.fullmatch(item['sha256']) and item['bytes'] > 0)
    key = PREFIX + manifest['tag'] + '/'
    require(store.get_object(key + 'runtime-release.json').read(262144)
            == read_small(control / 'runtime-release.json'))
    if archive is not None:
        require(stamp(archive)[2] == item['bytes'])
        with archive.open('rb') as source:
            require(digest(source) == item['sha256'])
    require(digest(store.get_object(key + name)) == item['sha256'])
    return {'ossKey': key + name, 'sha256': item['sha256'], 'bytes': item['bytes']}


def receipt(ops, entry):
    destination = ops / 'cache-recovery'
    destination.mkdir(mode=0o700, exist_ok=True)
    require(destination.resolve() == destination and destination.stat().st_uid == OWNER_UID
            and destination.stat().st_mode & 0o077 == 0)
    entry = dict(entry, verifiedAtUTC=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
    with tempfile.NamedTemporaryFile(mode='w', prefix='retention-', suffix='.json',
                                     dir=str(destination), delete=False) as file:
        json.dump(entry, file)
        file.flush()
        os.fsync(file.fileno())
    fd = os.open(str(destination), os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def created_timestamp(image):
    timestamp = image.get('Created', '')
    match = re.fullmatch(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.\d+)?(?:Z|\+00:00)', timestamp)
    require(match)
    return calendar.timegm(time.strptime(match[1], '%Y-%m-%dT%H:%M:%S'))


def retain_locked(ops, store, candidate, phase, required=0, now=None):
    require(phase in ('prepare', 'maintain', 'audit'))
    if now is None:
        now = time.time()
    pointer, current, previous, historical, live = production_state(ops, store)
    if phase != 'prepare':
        require(current['tag'] == candidate['tag'], 'HUB_CACHE_CURRENT_TAG_REQUIRED')
    root = ops / 'runtime-releases'
    require(root.resolve() == root)
    candidates, protected = completed_controls(root)
    protected.add(historical)
    protected_ids, protected_refs = protect(current, previous, candidate, live, protected)
    result = {'status': 'hub-cache-' + phase, 'current': current['tag'], 'rollback': previous['tag'], 'candidate': candidate['tag'],
              'protectedTagCount': len(protected),
              'freeBefore': shutil.disk_usage(str(ops)).free, 'required': required,
              'archiveCandidates': 0, 'imageCandidates': 0, 'archivesReclaimed': 0,
              'imagesReclaimed': 0, 'archiveChecks': 0, 'imageChecks': 0, 'skipped': 0}
    ordered = sorted(candidates, key=lambda item: int(item[1]['tag'].rsplit('-', 1)[1]))
    for control, manifest in ordered:
        if manifest['tag'] in protected:
            continue
        for kind, name in ARTIFACTS.items():
            if phase == 'prepare' and shutil.disk_usage(str(ops)).free > required:
                break
            archive = control / name
            try:
                # The release must be restorable even after its local archive is removed.
                expected = image_id(manifest, kind)
                if archive.exists() and result['archiveChecks'] < BATCH:
                    data = regular(archive)
                    if data.st_nlink == 1 and (phase == 'prepare' or now - data.st_mtime >= AGE):
                        result['archiveCandidates'] += 1
                        if phase != 'audit':
                            result['archiveChecks'] += 1
                            identity = stamp(archive)
                            proof = recoverable(store, control, manifest, kind, archive)
                            require(stamp(archive) == identity and read_small(ops / 'paired-current.json') == pointer)
                            receipt(ops, dict(proof, action='archive', path=str(archive.relative_to(ops))))
                            require(stamp(archive) == identity)
                            archive.unlink()
                            result['archivesReclaimed'] += 1
                if phase == 'prepare' or result['imageChecks'] >= BATCH:
                    continue
                ref = manifest[kind + 'Image']
                if (ref != REPOSITORIES[kind] + ':' + manifest['tag'] or ref in protected_refs
                        or expected in protected_ids):
                    continue
                try:
                    image = json.loads(docker('image', 'inspect', ref))[0]
                except subprocess.CalledProcessError:
                    continue
                tags = image['RepoTags'] or []
                if (image['Id'] != expected or ref not in tags or now - created_timestamp(image) < AGE
                        or any(alias.rsplit(':', 1)[0] not in REPOSITORIES.values()
                               or not TAG.fullmatch(alias.rsplit(':', 1)[-1]) for alias in tags)):
                    continue
                result['imageCandidates'] += 1
                if phase == 'audit':
                    continue
                result['imageChecks'] += 1
                proof = recoverable(store, control, manifest, kind)
                require(read_small(ops / 'paired-current.json') == pointer)
                require(all(row['Image'] != expected and row['Config']['Image'] != ref for row in containers()))
                resident = json.loads(docker('image', 'inspect', ref))[0]
                require(resident['Id'] == expected and sorted(resident['RepoTags']) == sorted(tags))
                receipt(ops, dict(proof, action='image', ref=ref, imageId=expected))
                # Docker refuses an in-use image. Do not force removal or prune parent images.
                docker('image', 'rm', '--no-prune', ref)
                result['imagesReclaimed'] += 1
            except (OSError, ValueError, KeyError, IndexError, TypeError, subprocess.SubprocessError):
                result['skipped'] += 1
            except Exception as error:
                # OSS SDK exceptions do not carry stable messages and may include URLs.
                if error.__class__.__module__.startswith('oss2.'):
                    result['skipped'] += 1
                else:
                    raise
    result['freeAfter'] = shutil.disk_usage(str(ops)).free
    return result


def retain(ops, store, candidate, phase, required=0):
    require(os.geteuid() == 0 and ops.resolve() == ops)
    locks = []
    try:
        for name in ('hub-runtime-release.lock', 'release.lock'):
            fd = os.open(str(ops / name), os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
            locks.append(fd)
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return retain_locked(ops, store, candidate, phase, required)
    finally:
        for fd in locks:
            os.close(fd)
