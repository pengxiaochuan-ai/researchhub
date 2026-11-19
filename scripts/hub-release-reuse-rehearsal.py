#!/usr/bin/env python3
"""Use real sealed legacy artifacts to verify each unchanged component's reuse."""
import importlib.util,json,os,pathlib,subprocess,tempfile,hashlib
HERE=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('release',str(HERE/'hub-release.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
policy=json.loads((HERE.parent/'deploy/release-policy.json').read_text());raw,previous=m.manifest(m.artifacts.bucket(),policy['seedTag'],policy['seedManifestSha256']);alias=os.environ['HUB_RELEASE_TAG']+'9';results=[]
with tempfile.TemporaryDirectory(prefix='hub-reuse-',dir=os.environ['RUNNER_TEMP']) as d:
 directory=pathlib.Path(d);(directory/'previous-release.json').write_bytes(raw);(directory/'plan.json').write_text(json.dumps({'build':{'frontend':False,'backend':False}}))
 try:
  for kind,name in [('backend','backend-image.tar.gz'),('frontend','researchhub.tar.gz')]:
   env=dict(os.environ,HUB_RELEASE_TAG=alias);subprocess.run(['python3',str(HERE/'hub-release.py'),'reuse','--directory',d,'--component',kind],env=env,check=True)
   old=directory/('previous-'+name);expected=m.runtime.canonical_image_id(old,previous[kind+'Image'],previous['files'][name]['sha256']);new_ref=('researchhub-backend:' if kind=='backend' else 'ghcr.io/pengxiaochuan-ai/pengxc-researchhub:')+alias;new=directory/name
   with new.open('wb') as f:
    producer=subprocess.Popen(['docker','save',new_ref],stdout=subprocess.PIPE)
    try:subprocess.run(['gzip','-1'],stdin=producer.stdout,stdout=f,check=True)
    finally:producer.stdout.close()
    assert producer.wait()==0
   actual=m.runtime.canonical_image_id(new,new_ref,m.artifacts.file_info(new)['sha256']);assert actual==expected
   provenance=m.provenance(previous,kind,False,os.environ['GITHUB_SHA']);assert provenance['sourceGit']==previous['controlGit'] and provenance['sourceGit']!=os.environ['GITHUB_SHA'];results.append({'component':kind,'canonicalIdUnchanged':True,'sourceGit':provenance['sourceGit'],'reusedFrom':provenance['reusedFrom']})
 finally:
  for ref in ('researchhub-backend:'+alias,'ghcr.io/pengxiaochuan-ai/pengxc-researchhub:'+alias):subprocess.run(['docker','image','rm',ref],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
print(json.dumps({'unchangedComponentsActuallyReused':results,'buildPerformed':False,'serverActivated':False,'privateArtifactsOnly':True}))
