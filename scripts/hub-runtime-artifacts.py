#!/usr/bin/env python3
"""Private OSS artifacts for the isolated Hub runtime; never logs credentials."""
import argparse,hashlib,json,os,pathlib,re,shutil,sys,tarfile,subprocess

def need(ok,code):
 if not ok:raise ValueError(code)

def source_key(key):
 need(isinstance(key,str) and len(key)<=255 and '..' not in key and re.fullmatch(r'releases/researchhub/[A-Za-z0-9][A-Za-z0-9._-]{0,95}/[A-Za-z0-9._-]+\.tar\.gz',key),'HUB_SOURCE_KEY_REJECTED');return key

def verify_digest(path,expected):
 need(re.fullmatch('[a-f0-9]{64}',expected or ''),'HUB_ARTIFACT_DIGEST_INVALID')
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 need(h.hexdigest()==expected,'HUB_ARTIFACT_DIGEST_MISMATCH')

def file_info(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return {'bytes':path.stat().st_size,'sha256':h.hexdigest()}

def extract_context(archive,target):
 need(not target.exists(),'HUB_CONTEXT_ALREADY_EXISTS')
 with tarfile.open(str(archive),'r:*') as source:
  members=source.getmembers();need(len(members)<=30000 and sum(m.size for m in members)<=512*1024*1024,'HUB_CONTEXT_SIZE_REJECTED')
  seen=set()
  for m in members:
   p=pathlib.PurePosixPath(m.name);need(not p.is_absolute() and '..' not in p.parts and (m.isdir() or m.isfile()),'HUB_CONTEXT_MEMBER_REJECTED')
   if m.isfile():need(p.parts and str(p) not in seen,'HUB_CONTEXT_DUPLICATE_FILE');seen.add(str(p))
  target.mkdir(mode=0o700)
  for m in members:
   p=pathlib.PurePosixPath(m.name);dest=target.joinpath(*p.parts)
   if m.isdir():dest.mkdir(parents=True,exist_ok=True,mode=0o700)
   else:
    dest.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    with source.extractfile(m) as src,dest.open('xb') as out:shutil.copyfileobj(src,out)
    dest.chmod(0o600)

def bucket(name=None):
 import oss2
 endpoint=os.environ['OSS_ENDPOINT'].strip().replace('https://','').replace('http://','').rstrip('/').replace('-internal.aliyuncs.com','.aliyuncs.com')
 need(re.fullmatch(r'oss-[a-z0-9-]+\.aliyuncs\.com',endpoint),'HUB_OSS_ENDPOINT_REJECTED')
 name=name or os.environ['OSS_BUCKET'];need(re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]',name),'HUB_OSS_BUCKET_REJECTED')
 return oss2.Bucket(oss2.Auth(os.environ['OSS_ACCESS_KEY'],os.environ['OSS_SECRET_KEY']),'https://'+endpoint,name,connect_timeout=15)

def fetch(args):
 source_key(args.key);target=pathlib.Path(args.target);archive=target.with_suffix('.tar.gz');need(not archive.exists(),'HUB_DOWNLOAD_ALREADY_EXISTS')
 bucket(args.bucket).get_object_to_file(args.key,str(archive));verify_digest(archive,args.sha256);extract_context(archive,target)
 r=json.loads((target/'release.json').read_text());need(r.get('kind')=='researchhub-private-backend' and re.fullmatch('[a-f0-9]{64}',r.get('coreDigest','')),'HUB_CONTEXT_RELEASE_REJECTED')
 with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('core_digest='+r['coreDigest']+'\n')
 print(json.dumps({'contextFetched':True,'sha256':args.sha256,'privateCore':True}))

def image_info(reference):
 rows=json.loads(subprocess.check_output(['docker','image','inspect',reference,'--format','{{json .}}']).decode());need(rows.get('Architecture')=='amd64' and re.fullmatch('sha256:[a-f0-9]{64}',rows.get('Id','')),'HUB_NATIVE_IMAGE_MISMATCH')
 return {'id':rows['Id'],'architecture':rows['Architecture']}

def collect(args):
 target=pathlib.Path(args.directory);tag=args.tag;need(re.fullmatch(r'hub-runtime-[a-f0-9]{8}-[0-9]+',tag),'HUB_RELEASE_TAG_REJECTED')
 frontend='ghcr.io/pengxiaochuan-ai/pengxc-researchhub:'+tag;backend=getattr(args,'backend_image',None) or 'researchhub-backend:'+tag
 files={}
 for name in ('researchhub.tar.gz','backend-image.tar.gz'):
  p=target/name;need(p.is_file() and not p.is_symlink(),'HUB_IMAGE_ARCHIVE_MISSING');files[name]=file_info(p)
 for name in ('cloud-assistant-bootstrap.sh','ecs-release.sh','oss-release-transfer.py'):
  shutil.copyfile(str(pathlib.Path('scripts')/name),str(target/name));files[name]=file_info(target/name)
 shutil.copyfile('docker-compose.ecs.yml',str(target/'docker-compose.ecs.yml'));files['docker-compose.ecs.yml']=file_info(target/'docker-compose.ecs.yml')
 shutil.copyfile('deploy/backend-demo.compose.yml',str(target/'backend-compose.yml'));files['backend-compose.yml']=file_info(target/'backend-compose.yml')
 (target/'ARTIFACTS.sha256').write_text(''.join(files[n]['sha256']+'  '+n+'\n' for n in ('researchhub.tar.gz','docker-compose.ecs.yml')))
 (target/'TAG.txt').write_text(tag+'\n')
 (target/'SHA256SUMS').write_text(''.join(files[n]['sha256']+'  '+n+'\n' for n in ('cloud-assistant-bootstrap.sh','ecs-release.sh','oss-release-transfer.py')))
 context=getattr(args,'backend_release',None) or json.loads((pathlib.Path(args.context)/'release.json').read_text())
 manifest={'schema':'researchhub-runtime-images.v1','tag':tag,'architecture':'amd64','frontendImage':frontend,'backendImage':backend,'coreDigest':context['coreDigest'],'hubDigest':context['hubDigest'],'contextSha256':args.source_sha,'controlGit':os.environ['GITHUB_SHA'],'tenantSlug':os.environ['HUB_TENANT_SLUG'],'files':files,'images':{'frontend':image_info(frontend),'backend':image_info(backend)},'workersEnabled':False,'modelsEnabled':False,'mailEnabled':False}
 # Capability is distinct from the operator's persistent activation state.
 manifest['supportedExecutionProfiles']=['disabled','bounded-hub-chat-v1']+(['bounded-hub-knowledge-v2'] if context['coreDigest']=='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669' else [])
 feature=pathlib.Path(args.context)/'hub/server/research-runtime/chat-k01-budget.mjs'
 manifest['supportedBudgetExtensions']=getattr(args,'backend_release',None).get('supportedBudgetExtensions',[]) if getattr(args,'backend_release',None) else (['citation-review-v1'] if feature.is_file() and all(marker in feature.read_text() for marker in ("export const CITATION_REVIEW_EXTENSION='citation-review-v1'",'export function extendCitationReviewBudget(')) else [])
 (target/'runtime-release.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'tag':tag,'coreDigest':manifest['coreDigest'],'frontendImage':frontend,'backendImage':backend,'manifestSha256':file_info(target/'runtime-release.json')['sha256']}))

def upload(args):
 import oss2
 need(re.fullmatch(r'hub-runtime-[a-f0-9]{8}-[0-9]+',args.tag),'HUB_RELEASE_TAG_REJECTED');store=bucket();directory=pathlib.Path(args.directory)
 names=['researchhub.tar.gz','backend-image.tar.gz','ARTIFACTS.sha256','TAG.txt','docker-compose.ecs.yml','cloud-assistant-bootstrap.sh','ecs-release.sh','oss-release-transfer.py','SHA256SUMS','runtime-release.json','backend-compose.yml']
 for name in names:
  p=directory/name;need(p.is_file() and not p.is_symlink(),'HUB_RELEASE_FILE_REJECTED')
  oss2.resumable_upload(store,'releases/researchhub/'+args.tag+'/'+name,str(p),headers={'x-oss-object-acl':'private'},multipart_threshold=50*1024*1024,part_size=16*1024*1024,num_threads=4)
 print(json.dumps({'uploaded':len(names),'tag':args.tag,'privateAcl':True,'manifestSha256':file_info(directory/'runtime-release.json')['sha256']}))

def main():
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='action')
 f=sub.add_parser('fetch');f.add_argument('--key',required=True);f.add_argument('--sha256',required=True);f.add_argument('--bucket');f.add_argument('--target',required=True);f.set_defaults(fn=fetch)
 c=sub.add_parser('collect');c.add_argument('--directory',required=True);c.add_argument('--context',required=True);c.add_argument('--tag',required=True);c.add_argument('--source-sha',required=True);c.set_defaults(fn=collect)
 u=sub.add_parser('upload');u.add_argument('--directory',required=True);u.add_argument('--tag',required=True);u.set_defaults(fn=upload)
 a=p.parse_args();need(hasattr(a,'fn'),'HUB_ARTIFACT_ACTION_REQUIRED');a.fn(a)
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,ValueError) and str(e).startswith('HUB_') else 'HUB_RUNTIME_ARTIFACT_FAILED','kind':type(e).__name__,'httpStatus':getattr(e,'status',None)}));raise SystemExit(1)
