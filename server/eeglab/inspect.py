"""Bounded, read-only EEGLAB structure inspection. Never executes MATLAB code."""
import json, math, os, resource, struct, sys, zlib

LOGICAL_LIMIT = 256 * 1024 * 1024
FIELDS = ['EEG', 'nbchan', 'srate', 'pnts', 'trials', 'data', 'datfile']

class Rejected(Exception):
    pass

def reject(code='metadata_mismatch'):
    raise Rejected(code)

def preflight_v5(path):
    total = 0
    with open(path, 'rb') as stream:
        header = stream.read(128)
        if len(header) != 128 or not header.startswith(b'MATLAB 5.0 MAT-file') or header[126:128] not in [b'IM', b'MI']:
            reject('unsupported_mat')
        endian = '<' if header[126:128] == b'IM' else '>'
        if struct.unpack(endian + 'H', header[124:126])[0] != 0x100:
            reject('unsupported_mat')
        remaining = os.fstat(stream.fileno()).st_size - 128
        while remaining:
            tag = stream.read(8)
            if len(tag) != 8:
                reject()
            kind, size = struct.unpack(endian + 'II', tag)
            remaining -= 8
            if kind not in (14, 15) or size < 1 or size > remaining:
                reject()
            if kind == 15:
                decoder, left = zlib.decompressobj(), size
                while left:
                    data = stream.read(min(left, 1024 * 1024))
                    if not data:
                        reject()
                    left -= len(data)
                    while data:
                        out = decoder.decompress(data, 1024 * 1024)
                        total += len(out)
                        if total > LOGICAL_LIMIT:
                            reject('resource_limit')
                        data = decoder.unconsumed_tail
                        if decoder.unused_data:
                            reject()
                    while True:
                        out = decoder.decompress(b'', 1024 * 1024)
                        total += len(out)
                        if total > LOGICAL_LIMIT:
                            reject('resource_limit')
                        if len(out) < 1024 * 1024:
                            break
                if not decoder.eof or decoder.unused_data:
                    reject()
                consumed = size  # scipy/MATLAB compressed elements are not padded.
            else:
                total += size
                if total > LOGICAL_LIMIT:
                    reject('resource_limit')
                consumed = (size + 7) // 8 * 8
                if consumed > remaining:
                    reject()
                stream.seek(consumed, 1)
            remaining -= consumed

def scalar(value):
    import numpy as np
    a = np.asarray(value)
    if a.size != 1 or a.dtype.kind not in 'iuf':
        reject()
    number = float(a.reshape(-1)[0])
    if not math.isfinite(number):
        reject()
    return number

def integer(value, maximum=9007199254740991):
    number = scalar(value)
    if number < 1 or number > maximum or not number.is_integer():
        reject()
    return int(number)

def text(value):
    import numpy as np
    a = np.asarray(value)
    if a.size == 0:
        return ''
    if a.dtype.kind not in 'SU' or a.size > 200 or sum(x > 1 for x in a.shape) > 1:
        reject('reference_mismatch')
    result = ''.join(str(x) if a.dtype.kind == 'U' else x.decode('utf-8') for x in a.reshape(-1))
    if len(result.encode('utf-8')) > 200:
        reject('reference_mismatch')
    return result

def load_v5(path):
    preflight_v5(path)
    import numpy as np
    from scipy.io import loadmat
    raw = loadmat(path, variable_names=FIELDS, struct_as_record=False, squeeze_me=False,
                  chars_as_strings=False, verify_compressed_data_integrity=True)
    if 'EEG' in raw:
        if any(k in raw for k in FIELDS[1:]):
            reject()
        eeg = raw['EEG']
        if not isinstance(eeg, np.ndarray) or eeg.size != 1:
            reject()
        eeg = eeg.reshape(-1)[0]
        return {k: getattr(eeg, k) for k in FIELDS[1:] if hasattr(eeg, k)}, None
    return {k: raw[k] for k in FIELDS[1:] if k in raw}, None

def load_v73(path):
    import h5py, numpy as np
    with open(path, 'rb') as stream:
        head = stream.read(520)
    if not head.startswith(b'MATLAB 7.3 MAT-file') or head[512:520] != b'\x89HDF\r\n\x1a\n':
        reject('unsupported_mat')
    handle = h5py.File(path, 'r')
    try:
        seen, budget = set(), [0, 0]
        def audit(node, depth=0):
            if depth > 16:
                reject('resource_limit')
            address = h5py.h5o.get_info(node.id).addr
            if address in seen:
                return
            seen.add(address)
            budget[0] += 1
            if budget[0] > 4096:
                reject('resource_limit')
            if isinstance(node, h5py.Group):
                for key in node:
                    if not isinstance(node.get(key, getlink=True), h5py.HardLink):
                        reject('unsupported_mat')
                    audit(node[key], depth + 1)
            elif isinstance(node, h5py.Dataset):
                if node.is_virtual or node.external:
                    reject('unsupported_mat')
                plist = node.id.get_create_plist()
                if any(plist.get_filter(i)[0] not in (1, 2, 3) for i in range(plist.get_nfilters())):
                    reject('unsupported_mat')
                budget[1] += math.prod(node.shape) * node.dtype.itemsize
                if budget[1] > LOGICAL_LIMIT:
                    reject('resource_limit')
            else:
                reject('unsupported_mat')
        audit(handle)
        def resolve(node):
            visited = set()
            for _ in range(16):
                address = h5py.h5o.get_info(node.id).addr
                if address in visited:
                    reject('unsupported_mat')
                visited.add(address)
                if isinstance(node, h5py.Dataset) and h5py.check_dtype(ref=node.dtype):
                    if node.size != 1:
                        reject('unsupported_mat')
                    reference = node[()].reshape(-1)[0]
                    if not reference:
                        reject()
                    node = handle[reference]
                    continue
                return node
            reject('resource_limit')
        base = resolve(handle['EEG']) if 'EEG' in handle else handle
        if not isinstance(base, h5py.Group) or base is not handle and any(k in handle for k in FIELDS[1:]):
            reject()
        fields = {}
        for key in FIELDS[1:]:
            if key not in base:
                continue
            node = resolve(base[key])
            if not isinstance(node, h5py.Dataset):
                reject()
            matlab_class = node.attrs.get('MATLAB_class', b'')
            if isinstance(matlab_class, bytes):
                matlab_class = matlab_class.decode('ascii', errors='strict')
            if matlab_class == 'char':
                if node.size > 200 or sum(x > 1 for x in node.shape) > 1 or node.dtype.kind != 'u' or node.dtype.itemsize != 2:
                    reject('reference_mismatch')
                chars = np.asarray(node[()], dtype='<u2').reshape(-1).tobytes().decode('utf-16-le', errors='strict')
                fields[key] = np.array([list(chars)], dtype='U1')
            elif key == 'data':
                fields[key] = node
            else:
                if node.size != 1:
                    reject()
                fields[key] = node[()]
        return fields, handle
    except BaseException:
        handle.close()
        raise

def inspect(path, members):
    import numpy as np
    with open(path, 'rb') as stream:
        magic = stream.read(32)
    if magic.startswith(b'MATLAB 5.0 MAT-file'):
        mat_version, (fields, handle) = 'v5', load_v5(path)
    elif magic.startswith(b'MATLAB 7.3 MAT-file'):
        mat_version, (fields, handle) = 'v7.3', load_v73(path)
    else:
        reject('unsupported_mat')
    try:
        if any(k not in fields for k in ['nbchan', 'srate', 'pnts', 'trials', 'data']):
            reject()
        channels, points, epochs = integer(fields['nbchan'], 4096), integer(fields['pnts']), integer(fields['trials'])
        rate = scalar(fields['srate'])
        if not 0 < rate <= 1e6 or points * epochs > 9007199254740991:
            reject()
        data = fields['data']
        external = isinstance(data, np.ndarray) and data.dtype.kind in 'SU'
        datfile = text(fields['datfile']) if 'datfile' in fields else ''
        if external:
            reference = text(data)
            if len(members) < 2:
                reject('missing_fdt')
            if not reference or reference != members[1]['name'] or datfile and datfile != reference:
                reject('reference_mismatch')
            if channels * points * epochs * 4 != members[1]['size']:
                reject()
            layout = 'external-fdt'
        else:
            if len(members) != 1:
                reject('unexpected_fdt')
            if datfile:
                reject('reference_mismatch')
            if getattr(data, 'dtype', None) is None or data.dtype.kind not in 'iuf' or data.nbytes > LOGICAL_LIMIT:
                reject('resource_limit' if getattr(data, 'nbytes', 0) > LOGICAL_LIMIT else 'metadata_mismatch')
            shape = tuple(reversed(data.shape)) if handle is not None else data.shape
            expected = (channels, points, epochs)
            if shape not in (expected, expected[:2] if epochs == 1 else expected):
                reject()
            if handle is not None:
                row_bytes = math.prod(data.shape[1:]) * data.dtype.itemsize
                step = max(1, (4 * 1024 * 1024) // max(1, row_bytes))
                for start in range(0, data.shape[0], step):
                    data[start:start + step]  # force bounded decoding, without numeric processing
            layout = 'embedded'
        duration = points * epochs / rate
        if not math.isfinite(duration) or duration <= 0:
            reject()
        return {'hasEeg': True, 'hasAudio': False, 'hasVideo': False, 'hasImage': False,
                'format': 'eeglab', 'matVersion': mat_version, 'layout': layout,
                'channels': channels, 'sampleRateHz': rate, 'samplesPerEpoch': points,
                'epochCount': epochs, 'sampledDurationSeconds': duration, 'members': members}
    finally:
        if handle is not None:
            handle.close()

if __name__ == '__main__':
    try:
        import importlib.metadata
        pinned = {'numpy': '2.5.1', 'scipy': '1.18.0', 'h5py': '3.16.0'}
        if any(importlib.metadata.version(n) != v for n, v in pinned.items()):
            print('{"unavailable":true}')
            sys.exit(2)
        if len(sys.argv) == 2 and sys.argv[1] == '--runtime':
            import importlib.metadata, scipy, numpy, h5py
            print(json.dumps({'schema': 'eeglab-reader-runtime.v1', 'python': sys.version.split()[0],
                              'packages': {n: importlib.metadata.version(n) for n in ['numpy', 'scipy', 'h5py']}}))
            sys.exit(0)
        resource.setrlimit(resource.RLIMIT_CPU, (30, 30))
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
        members = json.load(sys.stdin)
        result = inspect(sys.argv[1], members)
        print(json.dumps(result, allow_nan=False, separators=(',', ':')))
    except Rejected as error:
        print(json.dumps({'failureCode': str(error)}))
        sys.exit(2)
    except MemoryError:
        print('{"failureCode":"resource_limit"}')
        sys.exit(2)
    except ImportError:
        print('{"unavailable":true}')
        sys.exit(2)
    except SystemExit:
        raise
    except BaseException:
        print('{"failureCode":"metadata_mismatch"}')
        sys.exit(2)
