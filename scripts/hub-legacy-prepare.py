#!/usr/bin/env python3
"""Seal only the approved original-author legacy samples for read-only viewing."""
import fcntl,hashlib,importlib.util,json,os,pathlib,re,subprocess,sys
OPS=pathlib.Path('/srv/researchhub/ops');TENANT='rh-kb-local-b0e2af9d-tenant'
NODE=r'''
import {createHash} from 'node:crypto';
import {readResearchRuntimeConfig} from './server/research-runtime/config.mjs';
import {runtimeDependencies} from './server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,withDeploymentTransaction} from './server/database/transactions.mjs';
let p;try{
 const c=readResearchRuntimeConfig(process.env);if(c.identity.database!=='researchhub'||c.identity.tenantId!=='rh-kb-local-b0e2af9d-tenant')throw Error('target');
 const{load}=runtimeDependencies(c.core);p=new(load('prisma/prisma.service','PrismaService'))();await p.app.$connect();await p.elevated.$connect();const env=bindRuntimeTransactions({prisma:p,expected:c.identity});
 const result=await withDeploymentTransaction(env,'direct',async tx=>{
  const t=c.identity.tenantId,accounts=[t.replace('-tenant','-admin'),t.replace('-tenant','-owner')];
  const rows=await tx.$queryRawUnsafe(`SELECT jsonb_build_array(r.asset_id,c."idempotencyKey",r.tenant_id,r.study_group_id,r.research_project_id,r.owner_account_id,r.asset_kind,r.revision,r.working_version_no,r.approved_version_no,r.release_state,(SELECT jsonb_agg(jsonb_build_array(v.version_no,v.content_hash,v.policy_hash,v.artifact_version_id) ORDER BY v.version_no) FROM rh_asset.version_policy v WHERE v.asset_id=r.asset_id)) AS descriptor FROM rh_asset.asset_registry r JOIN public.research_artifact c ON c.id=r.asset_id AND c."tenantId"=r.tenant_id WHERE r.tenant_id=$1 AND r.asset_id NOT LIKE 'rhab-%' AND r.owner_account_id=ANY($2::text[]) AND r.deleted_at IS NULL AND EXISTS(SELECT 1 FROM rh_asset.version_policy v WHERE v.asset_id=r.asset_id) AND NOT EXISTS(SELECT 1 FROM rh_asset.version_policy v WHERE v.asset_id=r.asset_id AND (v.source_kind<>'author' OR v.source_bindings IS DISTINCT FROM '[]'::jsonb)) ORDER BY r.asset_id`,t,accounts);
  const assets=rows.map(x=>({id:x.descriptor[0],fingerprint:createHash('sha256').update(JSON.stringify(x.descriptor)).digest('hex')}));
  const [snapshot]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' ORDER BY asset_id),'')) AS hash FROM rh_asset.asset_registry r WHERE tenant_id=$1 AND asset_id NOT LIKE 'rhab-%'`,t);
  return{assets,snapshot};
 },{readOnly:true});console.log(JSON.stringify({status:'legacy-read-prepared',...result}));
}catch{console.log(JSON.stringify({status:'stopped',code:'LEGACY_READ_ONLY_FAILED'}));process.exitCode=1;}finally{if(p)await p.onModuleDestroy();}
'''
def need(ok,code):
 if not ok:raise ValueError(code)
def run(args,stdin=None):
 r=subprocess.run(args,input=stdin,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=90);need(r.returncode==0,'LEGACY_COMMAND_FAILED');return r.stdout.strip()
def main():
 need(os.geteuid()==0 and OPS.resolve()==OPS,'LEGACY_ROOT_REQUIRED')
 ids=run(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api']).splitlines();need(len(ids)==1,'LEGACY_API_NOT_UNIQUE');row=json.loads(run(['docker','inspect',ids[0]]))[0];tag=row['Config']['Image'].partition(':')[2];need(re.fullmatch('hub-runtime-[a-f0-9]{8}-[0-9]+',tag),'LEGACY_IMAGE_REJECTED')
 choices=[]
 for path in (OPS/'runtime-releases'/tag).glob('control-*'):
  manifest=path/'control-manifest.json'
  if not manifest.is_file() or manifest.is_symlink():continue
  raw=manifest.read_bytes();control=json.loads(raw)
  if path.name!='control-'+hashlib.sha256(raw).hexdigest()[:16] or control.get('tag')!=tag or control.get('schema')!='researchhub-runtime-controls.v1':continue
  files=control.get('files',{})
  if not {'server.py','execution-profile.py','database-config.py','run-server.py','runtime-release.json'}<=set(files) or any(pathlib.Path(n).name!=n or '/' in n or '\\' in n for n in files):continue
  if all((path/n).is_file() and not (path/n).is_symlink() and hashlib.sha256((path/n).read_bytes()).hexdigest()==v['sha256'] for n,v in files.items()) and hashlib.sha256((path/'runtime-release.json').read_bytes()).hexdigest()==control.get('imageManifestSha256'):choices.append(path)
 need(bool(choices),'LEGACY_SEALED_HELPER_REQUIRED');path=sorted(choices,key=lambda x:x.stat().st_mtime)[-1]
 spec=importlib.util.spec_from_file_location('legacy_runtime',str(path/'server.py'));runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime);helper=runtime.helper_module();saved=helper.read_config(OPS/'.env.prod');need(saved.get('HUB_DATABASE_NAME')=='researchhub' and saved.get('DEFAULT_TENANT_ID')==TENANT and saved.get('HUB_BACKEND_IMAGE')==row['Config']['Image'],'LEGACY_SCOPE_REJECTED')
 r=json.loads(run(['docker','exec','-i',ids[0],'node','--input-type=module','-'],NODE).splitlines()[-1]);need(r.get('status')=='legacy-read-prepared' and r['snapshot']['count']==27 and 0<len(r['assets'])<=27,'LEGACY_SOURCE_INVENTORY_CHANGED')
 a={'schema':'hub-legacy-asset-read.v1','tenantId':TENANT,'accounts':[TENANT.replace('-tenant','-admin'),TENANT.replace('-tenant','-owner')],'readOnly':True,'syntheticOnly':True,'assets':r['assets'],'registrySnapshot':r['snapshot']};raw=(json.dumps(a,sort_keys=True,separators=(',',':'))+'\n').encode();sha=hashlib.sha256(raw).hexdigest();file=OPS/'chat-runtime'/'admission'/'legacy-assets.json';need(file.parent.is_dir() and not file.parent.is_symlink(),'LEGACY_ADMISSION_DIRECTORY_REQUIRED')
 fd=os.open(str(file),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o440)
 with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
 os.chown(str(file),0,1000);os.chmod(str(file),0o440)
 helper.save_config(OPS/'.env.prod',{'HUB_LEGACY_ASSET_ADMISSION_FILE':'/run/researchhub-admission/legacy-assets.json','HUB_LEGACY_ASSET_ADMISSION_SHA256':sha})
 print(json.dumps({'status':'legacy-assets-admitted-read-only','assets':len(r['assets']),'admissionSha256':sha,'registrySnapshot':r['snapshot'],'chatAdmissionUnchanged':saved.get('HUB_CHAT_ADMISSION_SHA256'),'modelsInvoked':0,'databaseWrites':0,'containersChanged':0}))
if __name__=='__main__':
 try:
  fds=[]
  for name in ('hub-runtime-release.lock','release.lock'):
   fd=os.open(str(OPS/name),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600);fds.append(fd);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  main()
 except Exception as e:
  print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,ValueError) and re.fullmatch('LEGACY_[A-Z_]+',str(e)) else 'LEGACY_PREPARATION_FAILED_RECHECK_REQUIRED','automaticRetry':False}));raise SystemExit(1)
