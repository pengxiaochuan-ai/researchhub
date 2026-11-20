"""Create only synthetic EEGLAB originals and independent canonical/hostile envelopes."""
import argparse, hashlib, io, json, struct, zlib
from pathlib import Path
import numpy as np
from scipy.io import savemat
import h5py

def digest(data): return hashlib.sha256(data).hexdigest()

def envelope(members, method=0, flag=0x800, comment=b'', trailing=b'', bad_crc=False, extra=b'', symlink=False):
    local, central, offset = [], [], 0
    for name, data in members:
        name = name.encode('utf8'); crc = zlib.crc32(data) ^ (1 if bad_crc else 0)
        encoded = data if method == 0 else zlib.compress(data)[2:-4]
        a = struct.pack('<I5H3I2H', 0x04034b50, 20, flag, method, 0, 33, crc, len(encoded), len(data), len(name), len(extra))
        c = struct.pack('<I6H3I5H2I', 0x02014b50, 0x0314 if symlink else 20, 20, flag, method, 0, 33, crc, len(encoded), len(data), len(name), len(extra), 0, 0, 0, 0o120777 << 16 if symlink else 0, offset)
        local += [a, name, extra, encoded]; central += [c, name, extra]; offset += len(a)+len(name)+len(extra)+len(encoded)
    cd = b''.join(central)
    return b''.join(local)+cd+struct.pack('<I4H2IH', 0x06054b50, 0, 0, len(members), len(members), len(cd), offset, len(comment))+comment+trailing

def mat5(fields, nested=True, compressed=False):
    out = io.BytesIO(); savemat(out, {'EEG':fields} if nested else fields, format='5', do_compression=compressed)
    return out.getvalue()

def mat73(path, fields, nested=True):
    with h5py.File(path, 'w', userblock_size=512) as f:
        group = f.create_group('EEG') if nested else f
        if nested: group.attrs['MATLAB_class'] = np.bytes_('struct')
        for key, value in fields.items():
            if isinstance(value, str):
                data = np.frombuffer(value.encode('utf-16le'), dtype='<u2').reshape((-1,1))
                d = group.create_dataset(key, data=data); d.attrs['MATLAB_class'] = np.bytes_('char'); d.attrs['MATLAB_int_decode'] = 2
            else:
                value = np.asarray(value); data = value.reshape((1,1)) if value.ndim == 0 else value.transpose(tuple(reversed(range(value.ndim))))
                d = group.create_dataset(key, data=data); d.attrs['MATLAB_class'] = np.bytes_('single' if value.dtype == np.float32 else 'double')
    header = b'MATLAB 7.3 MAT-file, Platform: synthetic, Created for deterministic EEGLAB contract tests HDF5 schema 1.00 .'
    with path.open('r+b') as f: f.write(header.ljust(116,b' ')[:116]+b'\0'*8+b'\x00\x02IM'+b'\0'*(512-128))
    return path.read_bytes()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='.tmp/eeglab-ui-fixtures-2026-11-19'); args = ap.parse_args()
    out = Path(args.out).resolve(); out.mkdir(parents=True, exist_ok=True); cases = []
    array = np.arange(16, dtype=np.float32).reshape((2,8), order='F')
    fdt = array.T.astype('<f4').tobytes(order='F')
    def fields(data, datfile='', **extra):
        return dict(nbchan=2.,pnts=8.,trials=1.,srate=128.,data=data,datfile=datfile,subject='SYNTHETIC_HEADER_DO_NOT_EXPOSE',history="error('SYNTHETIC history must never execute');",**extra)
    def add(case_id, entries, valid=True, version='v5', layout='embedded', reason=None, package_options=None):
        folder = out/case_id; folder.mkdir(exist_ok=True); raw = []
        for name, data in entries:
            path = folder/name; path.write_bytes(data); raw.append(dict(name=name,path=str(path),extension=name.rsplit('.',1)[-1].lower(),size=len(data),sha256=digest(data)))
        package = envelope(entries, **(package_options or {})); archive = folder/'originals.eeglab'; archive.write_bytes(package)
        facts = dict(hasEeg=True,hasAudio=False,hasVideo=False,hasImage=False,format='eeglab',matVersion=version,layout=layout,channels=2,sampleRateHz=128,samplesPerEpoch=8,epochCount=1,sampledDurationSeconds=0.0625,members=[{k:x[k] for k in ['name','extension','size','sha256']} for x in raw])
        cases.append(dict(id=case_id,valid=valid,reason=reason,files=raw,archive=str(archive),archiveSha256=digest(package),inspection=facts))
    add('embedded-struct',[('SYN_STRUCT.set',mat5(fields(array)))])
    add('embedded-flat',[('SYN_FLAT.set',mat5(fields(array),nested=False))])
    add('embedded-compressed-mat',[('SYN_COMPRESSED.set',mat5(fields(array),compressed=True))])
    pair_set = mat5(fields('SYN_PAIR.fdt','SYN_PAIR.fdt'))
    pair = [('SYN_PAIR.set',pair_set),('SYN_PAIR.fdt',fdt)]
    add('external-pair',pair,layout='external-fdt')
    for case_id, nested, external in [('v73-struct',True,False),('v73-flat',False,False),('v73-external',True,True)]:
        folder=out/case_id; folder.mkdir(exist_ok=True); filename='SYN_HDF5.set'; data=mat73(folder/filename,fields('SYN_HDF5.fdt','SYN_HDF5.fdt') if external else fields(array),nested)
        add(case_id,[(filename,data)]+([('SYN_HDF5.fdt',fdt)] if external else []),version='v7.3',layout='external-fdt' if external else 'embedded')
    add('missing-fdt',[pair[0]],False,layout='external-fdt',reason='missing_fdt')
    add('wrong-fdt-name',[pair[0],('SYN_OTHER.fdt',fdt)],False,layout='external-fdt',reason='wrong_fdt_name')
    add('wrong-fdt-size',[pair[0],('SYN_PAIR.fdt',fdt[:-4])],False,layout='external-fdt',reason='wrong_fdt_size')
    add('unused-fdt',[('SYN_STRUCT.set',mat5(fields(array))),('SYN_UNUSED.fdt',fdt)],False,reason='unused_fdt')
    add('conflicting-reference',[('SYN_PAIR.set',mat5(fields('SYN_PAIR.fdt','SYN_OTHER.fdt'))),pair[1]],False,layout='external-fdt',reason='conflicting_reference')
    add('unsafe-reference',[('SYN_PATH.set',mat5(fields('../SYN_PAIR.fdt','../SYN_PAIR.fdt'))),pair[1]],False,layout='external-fdt',reason='unsafe_reference')
    add('shape-mismatch',[('SYN_SHAPE.set',mat5(fields(np.zeros((2,7),dtype=np.float32))))],False,reason='shape_mismatch')
    add('invalid-rate',[('SYN_RATE.set',mat5({**fields(array),'srate':0.}))],False,reason='invalid_rate')
    add('corrupt-mat',[('SYN_CORRUPT.set',b'not a MATLAB file')],False,reason='corrupt_mat')
    source=cases[0]; member=(source['files'][0]['name'],Path(source['files'][0]['path']).read_bytes())
    for case_id, entries, options in [
        ('zip-deflate',[member],dict(method=8)),('zip-encrypted',[member],dict(flag=0x801)),('zip-descriptor',[member],dict(flag=0x808)),
        ('zip-comment',[member],dict(comment=b'X')),('zip-trailing',[member],dict(trailing=b'X')),('zip-extra-field',[member],dict(extra=b'\x01\x00\x00\x00')),('zip-bad-crc',[member],dict(bad_crc=True)),('zip-symlink',[member],dict(symlink=True)),
        ('zip-duplicate',[member,member],{}),('zip-extra-member',[member,('SYN_EXTRA.txt',b'No extra members')],{}),('zip-two-sets',[member,('SYN_SECOND.set',member[1])],{})]:
        folder=out/case_id;folder.mkdir(exist_ok=True);archive=folder/'originals.eeglab';archive.write_bytes(envelope(entries,**options));cases.append(dict(id=case_id,valid=False,reason=case_id,archive=str(archive),archiveSha256=digest(archive.read_bytes()),files=[]))
    for case_id,name in [('zip-path','../SYN_PATH.set'),('zip-control','SYN\nCONTROL.set'),('zip-reserved','CON.set')]:
        folder=out/case_id;folder.mkdir(exist_ok=True);archive=folder/'originals.eeglab';archive.write_bytes(envelope([(name,member[1])]));cases.append(dict(id=case_id,valid=False,reason=case_id,archive=str(archive),archiveSha256=digest(archive.read_bytes()),files=[]))
    manifest=dict(schema='synthetic-eeglab-fixtures.v1',syntheticOnly=True,producerVersions=dict(numpy=np.__version__,h5py=h5py.__version__),cases=cases)
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'out':str(out),'cases':len(cases),'valid':sum(x['valid'] for x in cases),'manifest':str(out/'manifest.json')}))

if __name__ == '__main__': main()
