"""Append hostile synthetic cases; never regenerate or change existing originals."""
import hashlib, importlib.util, json, shutil, struct, sys, zlib
from pathlib import Path
import h5py, numpy as np
spec=importlib.util.spec_from_file_location('synthetic_eeglab_writer',Path(__file__).with_name('generate-eeglab-fixtures.py'))
writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
root=Path(sys.argv[1] if len(sys.argv)>1 else '.tmp/eeglab-ui-fixtures-2026-11-19').resolve()
manifest_path=root/'manifest.json';manifest=json.loads(manifest_path.read_text());assert manifest['syntheticOnly']
old={m['path']:m['sha256'] for c in manifest['cases'] for m in c.get('files',[])}
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in old.items())
source=root/'v73-struct/SYN_HDF5.set'
def append(case_id,edit=None,reason='unsupported_mat',raw=None):
    if any(c['id']==case_id for c in manifest['cases']):return
    folder=root/case_id;folder.mkdir(exist_ok=True);name='SYN_SECURITY.set';path=folder/name
    if raw is None:
        shutil.copyfile(source,path)
        with h5py.File(path,'r+') as f:edit(f,folder)
    else:path.write_bytes(raw)
    data=path.read_bytes();archive=folder/'originals.eeglab';archive.write_bytes(writer.envelope([(name,data)]))
    manifest['cases'].append(dict(id=case_id,valid=False,reason=reason,archive=str(archive),archiveSha256=writer.digest(archive.read_bytes()),files=[dict(name=name,path=str(path),extension='set',size=len(data),sha256=writer.digest(data))]))
def external_link(f,folder):
    del f['EEG/data'];f['EEG']['data']=h5py.ExternalLink(str(folder/'DO_NOT_OPEN.h5'),'/data')
def external_storage(f,folder):
    del f['EEG/data'];d=f['EEG'].create_dataset('data',(8,2),dtype='<f4',external=[(str(folder/'DO_NOT_OPEN.bin'),0,h5py.h5f.UNLIMITED)]);d.attrs['MATLAB_class']=np.bytes_('single')
def virtual(f,folder):
    del f['EEG/data'];layout=h5py.VirtualLayout((8,2),dtype='<f4');layout[:]=h5py.VirtualSource(str(folder/'DO_NOT_OPEN.h5'),'/data',shape=(8,2));d=f['EEG'].create_virtual_dataset('data',layout);d.attrs['MATLAB_class']=np.bytes_('single')
def unknown_filter(f,folder):
    del f['EEG/data'];d=f['EEG'].create_dataset('data',data=np.zeros((8,2),dtype=np.float32),compression='lzf');d.attrs['MATLAB_class']=np.bytes_('single')
def reference_cycle(f,folder):
    del f['EEG/data'];d=f['EEG'].create_dataset('data',(1,1),dtype=h5py.ref_dtype);d[0,0]=d.ref
def logical_bomb(f,folder):
    del f['EEG/data'];d=f['EEG'].create_dataset('data',(100000000,2),dtype='<f4',chunks=(1024,2),compression='gzip');d.attrs['MATLAB_class']=np.bytes_('single')
for key,edit in [('h5-external-link',external_link),('h5-external-storage',external_storage),('h5-vds',virtual),('h5-unknown-filter',unknown_filter),('h5-reference-cycle',reference_cycle)]:append(key,edit)
append('h5-logical-bomb',logical_bomb,reason='resource_limit')
compressor=zlib.compressobj();chunks=[]
for _ in range(257):chunks.append(compressor.compress(b'\0'*(1024*1024)))
chunks.append(compressor.flush());compressed=b''.join(chunks);header=(root/'embedded-struct/SYN_STRUCT.set').read_bytes()[:128]
append('mat-v5-compression-bomb',raw=header+struct.pack('<II',15,len(compressed))+compressed,reason='resource_limit')
def append_valid(case_id,entries,version,layout,points=8,epochs=1,rate=128):
    if any(c['id']==case_id for c in manifest['cases']):return
    folder=root/case_id;folder.mkdir(exist_ok=True);files=[]
    for name,data in entries:
        path=folder/name;path.write_bytes(data);files.append(dict(name=name,path=str(path),extension=name.rsplit('.',1)[1],size=len(data),sha256=writer.digest(data)))
    archive=folder/'originals.eeglab';archive.write_bytes(writer.envelope(entries))
    inspection=dict(hasEeg=True,hasAudio=False,hasVideo=False,hasImage=False,format='eeglab',matVersion=version,layout=layout,channels=2,sampleRateHz=rate,samplesPerEpoch=points,epochCount=epochs,sampledDurationSeconds=points*epochs/rate,members=[{k:f[k] for k in ['name','extension','size','sha256']} for f in files])
    manifest['cases'].append(dict(id=case_id,valid=True,files=files,archive=str(archive),archiveSha256=writer.digest(archive.read_bytes()),inspection=inspection))
if not any(c['id']=='v73-scalar-refs' for c in manifest['cases']):
    folder=root/'v73-scalar-refs';folder.mkdir(exist_ok=True);path=folder/'SYN_REFS.set';shutil.copyfile(source,path)
    with h5py.File(path,'r+') as f:
        refs=f.create_group('#refs#')
        for key in list(f['EEG']):
            f.move('/EEG/'+key,'/#refs#/'+key);d=f['EEG'].create_dataset(key,(1,1),dtype=h5py.ref_dtype);d[0,0]=refs[key].ref
    append_valid('v73-scalar-refs',[(path.name,path.read_bytes())],'v7.3','embedded')
array=np.arange(16,dtype=np.float32).reshape((2,4,2),order='F')
facts=dict(nbchan=2.,pnts=4.,trials=2.,srate=128.5,datfile='',data=array)
append_valid('v5-epochs-fractional',[('SYN_EPOCHS.set',writer.mat5(facts,nested=False))],'v5','embedded',points=4,epochs=2,rate=128.5)
name='SYN_合成.fdt';external={**facts,'data':name,'datfile':name}
raw=array.reshape((2,8),order='F').T.astype('<f4').tobytes(order='F')
append_valid('v5-unicode-pair',[('SYN_合成.set',writer.mat5(external)),(name,raw)],'v5','external-fdt',points=4,epochs=2,rate=128.5)
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in old.items())
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cases':len(manifest['cases']),'valid':sum(c['valid'] for c in manifest['cases']),'previousMembersUnchanged':True,'manifest':str(manifest_path)}))
