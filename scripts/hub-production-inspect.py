import hashlib,json,os,pathlib,re,shutil,stat,subprocess
ops=pathlib.Path('/srv/researchhub/ops')
releases=ops/'runtime-releases'
assert ops.resolve()==ops and releases.resolve()==releases and os.geteuid()==0
names=('researchhub.tar.gz','backend-image.tar.gz')
tag='hub-runtime-33a9ffd3-45155206512001'
candidate=releases/tag/'control-bdb3f76d4f1a580e'
def read(p):
 assert p.is_file() and p.resolve()==p and p.stat().st_uid==0 and p.stat().st_size<2*1024*1024
 return json.loads(p.read_text())
pointer=read(ops/'paired-current.json')
control=read(candidate/'control-manifest.json')
manifest=read(candidate/'runtime-release.json')
assert manifest['tag']==tag and control['tag']==tag
assert hashlib.sha256((candidate/'control-manifest.json').read_bytes()).hexdigest()=='bdb3f76d4f1a580ebd392faabf041271fdf4542d8d921c74adb87374d4d8f637'
assert hashlib.sha256((candidate/'runtime-release.json').read_bytes()).hexdigest()==control['imageManifestSha256']
active=subprocess.check_output(['docker','ps','-a','--format','{{.Image}}'],text=True).splitlines()
current=pointer['tag']
assert current==manifest['previousRelease']['tag']
current_control=releases/current/('control-'+pointer['controlSha256'][:16])
current_release=read(current_control/'runtime-release.json')
previous=current_release['previousRelease']['tag']
protected={tag,current,previous}
rows=[]
for folder in sorted(releases.glob('hub-runtime-*'))[-90:]:
 if folder.name in protected or any(folder.name in image for image in active):continue
 if not re.fullmatch(r'hub-runtime-[a-f0-9]{8}-\d+',folder.name) or folder.resolve()!=folder:continue
 for dir in folder.glob('control-*'):
  if not re.fullmatch(r'control-[a-f0-9]{16}',dir.name) or dir.resolve()!=dir:continue
  mpath=dir/'runtime-release.json'
  if not mpath.is_file():continue
  release=read(mpath)
  if release.get('tag')!=folder.name:continue
  for name in names:
   p=dir/name
   if not p.is_file() or p.is_symlink():continue
   s=p.stat()
   item=release.get('files',{}).get(name,{})
   if s.st_uid==0 and s.st_nlink==1 and s.st_size==item.get('bytes') and re.fullmatch(r'[0-9a-f]{64}',item.get('sha256','')):
    rows.append({'path':str(p.relative_to(ops)),'size':s.st_size,'blocksBytes':s.st_blocks*512,'sha':item['sha256']})
print(json.dumps({'status':'disk-readonly','free':shutil.disk_usage(str(ops)).free,'required':4*1024**3+4*sum(manifest['files'][name]['bytes'] for name in names),'protected':sorted(protected),'archives':rows}))
