#!/usr/bin/env python3
"""One release manifest for both images; OSS holds only checked private artifacts."""
import argparse,hashlib,importlib.util,json,os,pathlib,re,subprocess,sys
HERE=pathlib.Path(__file__).resolve().parent

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,str(HERE/file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
artifacts=module('artifacts','hub-runtime-artifacts.py');plan_module=module('plan','hub-release-plan.py');runtime=module('runtime','hub-runtime-server.py')
need=artifacts.need
PREFIX='releases/researchhub/';POINTER=PREFIX+'current-release.json'

def digest(raw):return hashlib.sha256(raw).hexdigest()

def manifest(store,tag,sha):
 need(re.fullmatch('hub-runtime-[a-f0-9]{8}-[0-9]+',tag or '') and re.fullmatch('[a-f0-9]{64}',sha or ''),'HUB_RELEASE_REFERENCE_REJECTED')
 raw=store.get_object(PREFIX+tag+'/runtime-release.json').read();need(len(raw)<262144 and digest(raw)==sha,'HUB_RELEASE_MANIFEST_MISMATCH');body=json.loads(raw)
 need(body.get('tag')==tag and body.get('architecture')=='amd64' and body.get('schema')=='researchhub-runtime-images.v1','HUB_RELEASE_MANIFEST_REJECTED');return raw,body

def read_current(store,policy):
 try:
  response=store.get_object(POINTER);raw=response.read();need(len(raw)<16384,'HUB_RELEASE_POINTER_REJECTED');pointer=json.loads(raw);etag=response.headers.get('ETag') or response.headers.get('etag');need(bool(etag),'HUB_RELEASE_POINTER_ETAG_REQUIRED')
  need(pointer.get('schema')=='researchhub-release-pointer.v1','HUB_RELEASE_POINTER_REJECTED')
 except Exception as e:
  if getattr(e,'status',None)!=404:raise
  pointer={'tag':policy['seedTag'],'manifestSha256':policy['seedManifestSha256']};etag=None
 raw,previous=manifest(store,pointer['tag'],pointer['manifestSha256']);need(previous['coreDigest'] in [policy['coreDigest'],policy.get('coreUpgrade',{}).get('sourceCoreDigest')],'HUB_RELEASE_CORE_REAPPROVAL_REQUIRED')
 return raw,previous,{'etag':etag,'tag':pointer['tag'],'manifestSha256':pointer['manifestSha256']}

def provenance(previous,kind,built,revision):
 old=previous.get('components',{}).get(kind,{})
 return {'sourceGit':revision if built else plan_module.component_base(previous,kind),'built':built,'reusedFrom':None if built else previous['tag']}

def validate_core_policy(policy,root=HERE.parent):
 for name,expected in {**policy['coreSourceGuards'],**policy.get('coreUpgradeGuards',{})}.items():
  need(digest((root/name).read_bytes())==expected,'HUB_RELEASE_CORE_SOURCE_REAPPROVAL_REQUIRED')
 hub=json.loads((root/'package.json').read_text())
 return hub

def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','reuse','collect']);p.add_argument('--directory',required=True);p.add_argument('--component',choices=['frontend','backend']);p.add_argument('--mode',choices=['plan','rehearse','release','rollback'],default='release');p.add_argument('--tag');p.add_argument('--manifest-sha');a=p.parse_args();directory=pathlib.Path(a.directory);directory.mkdir(mode=0o700,parents=True,exist_ok=True);policy=json.loads((HERE.parent/'deploy/release-policy.json').read_text());store=artifacts.bucket()
 if a.action=='prepare':
  validate_core_policy(policy)
  raw,previous,pointer=read_current(store,policy);(directory/'previous-release.json').write_bytes(raw);(directory/'baseline-pointer.json').write_text(json.dumps(pointer))
  if a.mode=='rollback':
   target_raw,target=manifest(store,a.tag,a.manifest_sha);need(target['coreDigest'] in [policy['coreDigest'],policy.get('coreUpgrade',{}).get('sourceCoreDigest')],'HUB_RELEASE_ROLLBACK_CORE_REJECTED');(directory/'runtime-release.json').write_bytes(target_raw)
   output({'release_required':'true','tag':a.tag,'manifest_sha':a.manifest_sha});return
  plan=plan_module.make_plan(previous,os.environ['GITHUB_SHA'],os.environ.get('HUB_DATABASE_APPROVED_DIGEST',''));(directory/'plan.json').write_text(json.dumps(plan,indent=2)+'\n');print(json.dumps(plan))
  need(plan['databaseApproved'],'HUB_DATABASE_SEPARATE_APPROVAL_REQUIRED')
  output({'frontend':str(plan['build']['frontend']).lower(),'backend':str(plan['build']['backend']).lower(),'release_required':str(plan['releaseRequired']).lower(),'core_digest':policy['coreDigest']})
  if a.mode=='plan' or not plan['releaseRequired']:return
  target=directory.parent/('hub-backend-baseline' if policy.get('coreUpgrade') else 'hub-backend-context');artifacts.fetch(argparse.Namespace(key=policy['coreSourceKey'],sha256=policy['coreSourceSha256'],bucket=os.environ['HUB_CORE_SOURCE_BUCKET'],target=str(target)))
  context=json.loads((target/'release.json').read_text());need(context['coreDigest']==policy.get('coreUpgrade',{}).get('sourceCoreDigest',policy['coreDigest']),'HUB_RELEASE_CORE_DIGEST_REJECTED');return
 previous=json.loads((directory/'previous-release.json').read_text());plan=json.loads((directory/'plan.json').read_text()) if (directory/'plan.json').exists() else None
 if a.action=='reuse':
  kind=a.component;need(kind is not None and plan['build'][kind] is False,'HUB_RELEASE_REUSE_REJECTED');name='researchhub.tar.gz' if kind=='frontend' else 'backend-image.tar.gz';path=directory/('previous-'+name)
  store.get_object_to_file(PREFIX+previous['tag']+'/'+name,str(path));runtime.canonical_image_id(path,previous[kind+'Image'],previous['files'][name]['sha256'])
  with subprocess.Popen(['gzip','-dc',str(path)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL) as producer:
   try:subprocess.run(['docker','load'],stdin=producer.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=300)
   finally:producer.stdout.close()
   need(producer.wait(timeout=30)==0,'HUB_RELEASE_REUSE_LOAD_FAILED')
  reference=('ghcr.io/pengxiaochuan-ai/pengxc-researchhub:' if kind=='frontend' else 'researchhub-backend:')+os.environ['HUB_RELEASE_TAG'];subprocess.run(['docker','tag',previous[kind+'Image'],reference],check=True);return
 if a.action=='collect':
  context=directory.parent/'hub-backend-context';tag=os.environ['HUB_RELEASE_TAG'];artifacts.collect(argparse.Namespace(directory=str(directory),tag=tag,context=str(context),source_sha=policy['coreSourceSha256']))
  path=directory/'runtime-release.json';r=json.loads(path.read_text());r.pop('contextSha256',None);r.update(releaseGit=os.environ['GITHUB_SHA'],privateCoreSourceArchiveSha256=policy['coreSourceSha256'],databaseDigest=plan['databaseDigest'],databaseSources=plan['databaseSources'],databaseFingerprint=policy['target']['schemaFingerprint'],previousRelease=json.loads((directory/'baseline-pointer.json').read_text()),components={kind:provenance(previous,kind,plan['build'][kind],os.environ['GITHUB_SHA']) for kind in ('frontend','backend')})
  if not plan['build']['backend']:
   r['hubDigest']=previous['hubDigest'];r['supportedExecutionProfiles']=previous.get('supportedExecutionProfiles',['disabled'])
  for kind,name in [('frontend','researchhub.tar.gz'),('backend','backend-image.tar.gz')]:r['images'][kind]['configId']=runtime.canonical_image_id(directory/name,r[kind+'Image'],r['files'][name]['sha256'])
  path.write_text(json.dumps(r,indent=2)+'\n');output({'tag':tag,'manifest_sha':digest(path.read_bytes())});return

def output(values):
 if os.environ.get('GITHUB_OUTPUT'):
  with open(os.environ['GITHUB_OUTPUT'],'a') as f:
   for key,value in values.items():f.write(key+'='+value+'\n')
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,ValueError) and str(e).startswith('HUB_') else 'HUB_PAIRED_RELEASE_FAILED','kind':type(e).__name__,'httpStatus':getattr(e,'status',None),'automaticRetry':False}));raise SystemExit(1)
