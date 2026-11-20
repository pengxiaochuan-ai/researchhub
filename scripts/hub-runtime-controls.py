#!/usr/bin/env python3
"""Bind reviewed public controls to an already-built private Hub image release."""
import argparse,hashlib,json,os,pathlib,re,sys
from importlib.util import spec_from_file_location,module_from_spec
HERE=pathlib.Path(__file__).resolve().parent
TARGET={'database':'researchhub','tenantId':'rh-kb-local-b0e2af9d-tenant','markerSha256':'cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523','schemaFingerprint':'895dadbcc49134d4fde59ddaacedf242'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--tag',required=True);p.add_argument('--manifest-sha',required=True);p.add_argument('--previous');a=p.parse_args()
 if not re.fullmatch('hub-runtime-[a-f0-9]{8}-[0-9]+',a.tag) or not re.fullmatch('[a-f0-9]{64}',a.manifest_sha):raise ValueError('HUB_CONTROL_INPUT_REJECTED')
 spec=spec_from_file_location('artifacts',str(HERE/'hub-runtime-artifacts.py'));m=module_from_spec(spec);spec.loader.exec_module(m);store=m.bucket()
 raw=store.get_object('releases/researchhub/'+a.tag+'/runtime-release.json').read()
 if hashlib.sha256(raw).hexdigest()!=a.manifest_sha:raise ValueError('HUB_IMAGE_MANIFEST_DIGEST_MISMATCH')
 release=json.loads(raw)
 if release.get('tag')!=a.tag or release.get('architecture')!='amd64' or release.get('tenantSlug')!=TARGET['tenantId']:raise ValueError('HUB_IMAGE_RELEASE_REJECTED')
 sources={'server.py':HERE/'hub-runtime-server.py','execution-profile.py':HERE/'hub-execution-profile.py','database-config.py':HERE.parent/'deploy/demo-database-config.py','run-server.py':HERE.parent/'deploy/manual-rds-server.py','backend-compose.yml':HERE.parent/'deploy/backend-demo.compose.yml','ecs-release.sh':HERE/'ecs-release.sh'}
 if a.previous:sources.update({'pair.py':HERE/'hub-release-pair.py','frontend-compose.yml':HERE.parent/'docker-compose.ecs.yml','previous-release.json':pathlib.Path(a.previous)})
 bodies={name:path.read_bytes() for name,path in sources.items()};bodies['runtime-release.json']=raw
 if a.previous:
  policy=json.loads((HERE.parent/'deploy/release-policy.json').read_text());previous=json.loads(bodies['previous-release.json'])
  def template(document,kind):
   filename='docker-compose.ecs.yml' if kind=='frontend' else 'backend-compose.yml'
   if filename in document['files']:
    expected=document['files'][filename]['sha256'];body=store.get_object('releases/researchhub/'+document['tag']+'/'+filename).read()
   else:
    if kind!='backend' or document['tag']!=policy['seedTag']:raise ValueError('HUB_BASELINE_TEMPLATE_REQUIRED')
    prefix='releases/researchhub/'+policy['seedTag']+'/runtime-controls-'+policy['seedControlSha256'][:16]+'/'
    sealed=store.get_object(prefix+'control-manifest.json').read()
    if hashlib.sha256(sealed).hexdigest()!=policy['seedControlSha256']:raise ValueError('HUB_SEED_CONTROL_DIGEST_MISMATCH')
    old=json.loads(sealed)
    if old['imageManifestSha256']!=policy['seedManifestSha256']:raise ValueError('HUB_SEED_IMAGE_BINDING_MISMATCH')
    expected=old['files']['backend-compose.yml']['sha256'];body=store.get_object(prefix+'backend-compose.yml').read()
   if len(body)>2*1024*1024 or hashlib.sha256(body).hexdigest()!=expected:raise ValueError('HUB_PAIRED_TEMPLATE_DIGEST_MISMATCH')
   return body
  for kind in ('frontend','backend'):
   bodies[kind+'-compose.yml']=template(release,kind)
   bodies['previous-'+kind+'-compose.yml']=template(previous,kind)
 files={name:{'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body)} for name,body in bodies.items()}
 control={'schema':'researchhub-runtime-controls.v1','tag':a.tag,'imageManifestSha256':a.manifest_sha,'target':TARGET,'files':files,'controlGit':os.environ['GITHUB_SHA']}
 policy=json.loads((HERE.parent/'deploy/release-policy.json').read_text());control['executionPolicy']=policy.get('executionPolicy',{'profile':'disabled'})
 if policy.get('coreUpgrade'):control['coreUpgrade']=policy['coreUpgrade']
 if policy.get('articleCoreUpgrade'):control['articleCoreUpgrade']=policy['articleCoreUpgrade']
 if a.previous:
  previous=json.loads(bodies['previous-release.json']);control.update(paired=True,previousManifestSha256=hashlib.sha256(bodies['previous-release.json']).hexdigest(),previousTag=previous['tag'],previousBackendComposeSha256=hashlib.sha256(bodies['previous-backend-compose.yml']).hexdigest())
 content=(json.dumps(control,indent=2)+'\n').encode();sha=hashlib.sha256(content).hexdigest();prefix='releases/researchhub/'+a.tag+'/runtime-controls-'+sha[:16]+'/'
 for name,body in bodies.items():store.put_object(prefix+name,body,headers={'x-oss-object-acl':'private'})
 store.put_object(prefix+'control-manifest.json',content,headers={'x-oss-object-acl':'private'})
 with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('control_sha='+sha+'\n')
 print(json.dumps({'tag':a.tag,'controlSha256':sha,'files':len(files),'privateAcl':True,'serviceWrites':0}))
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,ValueError) and str(e).startswith('HUB_') else 'HUB_CONTROL_UPLOAD_FAILED','kind':type(e).__name__,'httpStatus':getattr(e,'status',None)}));raise SystemExit(1)
