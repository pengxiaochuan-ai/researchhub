"""Materialize a private, offline, version-locked runtime; source files are read only."""
from pathlib import Path
import importlib.metadata as metadata,json,subprocess,sys,hashlib,sysconfig
from packaging.requirements import Requirement

root=Path(__file__).resolve().parent.parent
target=root/'.tmp/ai-media-content-implementation-2026-11-17/venv'
assert target.is_dir() and sys.version_info[:2]==(3,12)
source=Path(sysconfig.get_paths()['purelib']).resolve()
destination=Path(subprocess.check_output([str(target/'bin/python'),'-I','-c','import sysconfig;print(sysconfig.get_paths()["purelib"])'],text=True).strip())
assert source!=destination and root in destination.parents
pending=['openai-whisper','faster-whisper','packaging'];found={};tops={}
while pending:
 name=pending.pop();dist=metadata.distribution(name);canonical=dist.metadata['Name'].lower().replace('_','-')
 if canonical in found:continue
 found[canonical]={'version':dist.version,'metadataHash':hashlib.sha256(dist.read_text('METADATA').encode()).hexdigest()}
 for raw in dist.requires or []:
  r=Requirement(raw)
  if not r.marker or r.marker.evaluate({'extra':''}):pending.append(r.name)
 for f in dist.files or []:
  p=Path(str(f))
  if p.is_absolute() or '..' in p.parts:continue
  src=source/p.parts[0]
  if src.exists():tops[p.parts[0]]=src
for name,src in sorted(tops.items()):
 dst=destination/name
 if dst.exists():continue
 # APFS clones have independent inodes and copy-on-write extents; no symlink into the source venv.
 subprocess.run(['/bin/cp','-cR',str(src),str(dst)],check=True)
 assert src.stat().st_ino!=dst.stat().st_ino
lock={'schema':'hub-media-python-runtime.v1','python':sys.version.split()[0],'packages':found,'copiedTopLevelEntries':sorted(tops)}
folder=target.parent;(folder/'runtime-lock.json').write_text(json.dumps(lock,indent=2)+'\n')
(folder/'requirements.lock.txt').write_text('\n'.join(n+'=='+v['version'] for n,v in sorted(found.items()))+'\n')
print(json.dumps({'materialized':True,'packages':len(found),'entries':len(tops),'sourceUnchanged':True}))
