#!/usr/bin/env python3
"""One-time, explicitly approved historical queue retirement; Python 3.6+."""
import argparse,fcntl,hashlib,json,os,pathlib,re,subprocess,sys
from urllib.parse import urlparse,unquote,parse_qs

OPS=pathlib.Path('/srv/researchhub/ops')
TENANT='rh-kb-local-b0e2af9d-tenant'
ADMISSION_SHA='4f0bce262076ad3a1c18bbeeb4e652528527098f77f8953cdfb0d214b28e0c28'
SNAPSHOT='735bdccbbc401c67285f0dd9714a2bed'
def need(ok,code):
 if not ok:raise ValueError(code)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def private(path,owner=None):
 need(path.is_file() and not path.is_symlink() and path.stat().st_uid==(os.geteuid() if owner is None else owner) and path.stat().st_mode&0o077==0,'RETIRE_PRIVATE_FILE_REQUIRED')
 return path.read_bytes()
def sealed_admission(path):
 need(path.is_file() and not path.is_symlink() and path.stat().st_uid==0 and path.stat().st_gid==1000 and path.stat().st_mode&0o777==0o440,'RETIRE_SEALED_ADMISSION_REQUIRED')
 raw=path.read_bytes();need(digest(raw)==ADMISSION_SHA,'RETIRE_ADMISSION_CHANGED');return raw
def exclusive(path,raw):
 fd=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
 with os.fdopen(fd,'wb') as out:out.write(raw);out.flush();os.fsync(out.fileno())
 need(private(path)==raw,'RETIRE_ARCHIVE_MISMATCH')
def settings(path):
 raw=private(path);values={}
 for line in raw.decode().splitlines():
  m=re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$',line)
  if not m:continue
  k,v=m.groups()
  if v[:1] in ('"',"'") and v[-1:]==v[:1]:v=v[1:-1]
  need(k not in values,'RETIRE_DUPLICATE_CONFIGURATION');values[k]=v
 need(values.get('HUB_DATABASE_NAME')=='researchhub' and values.get('HUB_EXECUTION_PROFILE')=='bounded-hub-knowledge-v2' and values.get('HUB_CHAT_ADMISSION_SHA256')==ADMISSION_SHA,'RETIRE_LIVE_CONFIGURATION_CHANGED')
 url=urlparse(values.get('DIRECT_URL',''))
 need(url.scheme in ('postgres','postgresql') and unquote(url.path)=='/researchhub' and unquote(url.username or '')==values.get('HUB_DATABASE_OWNER_ROLE') and url.hostname and url.password,'RETIRE_CONNECTION_IDENTITY_REJECTED')
 marker=values.get('HUB_DATABASE_MARKER_SHA256','');need(re.fullmatch('[a-f0-9]{64}',marker),'RETIRE_MARKER_REQUIRED')
 env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C.UTF-8','PGHOST':url.hostname,'PGPORT':str(url.port or 5432),'PGDATABASE':'researchhub','PGUSER':unquote(url.username),'PGPASSWORD':unquote(url.password),'PGCONNECT_TIMEOUT':'8','PGSSLMODE':parse_qs(url.query).get('sslmode',['disable'])[0],'PGAPPNAME':'researchhub-history-retirement'}
 return values,env,digest(raw)
def psql(env,sql,variables):
 args=['psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1']
 for key,value in variables.items():args.extend(['-v',key+'='+value])
 p=subprocess.run(args,input=sql,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,env=env,timeout=50)
 need(p.returncode==0,'RETIRE_DATABASE_CHECK_FAILED_NO_AUTOMATIC_RETRY')
 return p.stdout.strip()
def validate_snapshot(value,role,marker):
 need(value.get('database')=='researchhub' and value.get('role')==role and value.get('marker')==marker,'RETIRE_DATABASE_IDENTITY_CHANGED')
 need(value.get('historicalCount')==623 and value.get('historicalHash')==SNAPSHOT and len(value.get('rows',[]))==175,'RETIRE_HISTORICAL_STATE_CHANGED')
 for row in value['rows']:
  need(row.get('tenantId')==TENANT and row.get('status')=='queued' and row.get('attempts')==0 and all(row.get(k) is None for k in ('executionToken','workerOwner','leaseExpiresAt','startedAt','assistantMessageId','result')),'RETIRE_PRIOR_EXECUTION_REQUIRES_REVIEW')
 need(value.get('reservations')==0,'RETIRE_RESERVATIONS_REQUIRE_REVIEW')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','execute']);parser.add_argument('--approval-ref');args=parser.parse_args()
 need(os.geteuid()==0,'RETIRE_ROOT_OPERATOR_REQUIRED')
 if args.action=='execute':need(re.fullmatch('HUB_HISTORY_175_APPROVED_[A-Za-z0-9_-]{12,120}',args.approval_ref or ''),'RETIRE_EXPLICIT_APPROVAL_REQUIRED')
 locks=[]
 try:
  for name in ('hub-runtime-release.lock','release.lock'):
   fd=os.open(str(OPS/name),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600);locks.append(fd);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  values,env,config_sha=settings(OPS/'.env.prod')
  admission=sealed_admission(OPS/'chat-runtime/admission/admission.json');ids=json.loads(admission)['historicalChatIds']
  need(len(ids)==623 and len(set(ids))==623 and all(re.fullmatch('[A-Za-z0-9_-]{1,160}',x) for x in ids),'RETIRE_ORIGINAL_IDS_REQUIRED')
  variables={'historical_ids':json.dumps(ids,separators=(',',':')),'expected_role':env['PGUSER'],'expected_marker':values['HUB_DATABASE_MARKER_SHA256']}
  sql='''BEGIN READ ONLY;
  WITH historical AS (SELECT * FROM public.knowledge_chat_job WHERE "tenantId"='rh-kb-local-b0e2af9d-tenant' AND id IN (SELECT jsonb_array_elements_text(:'historical_ids'::jsonb))), selected AS (SELECT * FROM historical WHERE status='queued')
  SELECT jsonb_build_object('database',current_database(),'role',current_user,'marker',(SELECT encode(sha256(convert_to(shobj_description(oid,'pg_database'),'UTF8')),'hex') FROM pg_database WHERE datname=current_database()),'historicalCount',(SELECT count(*) FROM historical),'historicalHash',(SELECT md5(coalesce(string_agg(md5(to_jsonb(j)::text),'' ORDER BY id),'')) FROM historical j),'rows',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM selected j),'reservations',(SELECT count(*) FROM public.token_quota_reservation r JOIN selected j ON r."tenantId"=j."tenantId" AND r."requestKey"='chat:'||j."sessionId"||':'||j."requestKey"));
  ROLLBACK;'''
  snapshot=json.loads(psql(env,sql,variables));validate_snapshot(snapshot,env['PGUSER'],variables['expected_marker'])
  sql_path=pathlib.Path(__file__).resolve().parent.parent/'deploy/retire-historical-chat-queue.sql'
  need(sql_path.is_file() and not sql_path.is_symlink(),'RETIRE_SQL_REQUIRED');sql_sha=digest(sql_path.read_bytes())
  archive=OPS/'history-queue-retirement-20261120'
  if args.action=='prepare':
   archive.mkdir(mode=0o700);exclusive(archive/'snapshot.json',json.dumps(snapshot,sort_keys=True,separators=(',',':')).encode())
   exclusive(archive/'receipt.json',json.dumps({'configSha256':config_sha,'admissionSha256':ADMISSION_SHA,'snapshotSha256':digest(private(archive/'snapshot.json')),'sqlSha256':sql_sha}).encode())
   print(json.dumps({'status':'historical-queue-prepared','tasks':175,'databaseWrites':0,'modelCalls':0}));return
  need(archive.is_dir() and not archive.is_symlink() and archive.stat().st_uid==0 and archive.stat().st_mode&0o077==0,'RETIRE_ARCHIVE_REQUIRED')
  receipt=json.loads(private(archive/'receipt.json'));backup=private(archive/'snapshot.json')
  need(receipt=={'configSha256':config_sha,'admissionSha256':ADMISSION_SHA,'snapshotSha256':digest(backup),'sqlSha256':sql_sha} and json.loads(backup)==snapshot,'RETIRE_PREPARED_STATE_CHANGED')
  # Exclusive started marker makes an unknown result non-retriable.
  exclusive(archive/'execution-started.json',json.dumps({'approvalRef':args.approval_ref,'sqlSha256':digest(sql_path.read_bytes())}).encode())
  variables['approval_ref']=args.approval_ref;psql(env,sql_path.read_text(),variables)
  exclusive(archive/'completed.json',json.dumps({'tasks':175,'audits':175,'modelCalls':0,'billingWrites':0}).encode())
  print(json.dumps({'status':'historical-queue-retired','tasks':175,'audits':175,'modelCalls':0,'billingWrites':0}))
 finally:
  for fd in reversed(locks):os.close(fd)
if __name__=='__main__':
 try:main()
 except Exception as error:
  print(json.dumps({'status':'stopped','code':str(error) if isinstance(error,ValueError) else 'RETIRE_STATE_MUST_BE_RECHECKED','automaticRetry':False}));sys.exit(1)
