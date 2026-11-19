"""Sealed execution state shared by release validation and rollback. No quota reset."""
import calendar,datetime,hashlib,json,pathlib,re

PROFILE='bounded-hub-chat-v1'
ROOT=pathlib.Path('/srv/researchhub/ops/chat-runtime')
CORE='85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135'
ACCOUNTS={'rh-kb-local-b0e2af9d-admin','rh-kb-local-b0e2af9d-owner'}

def need(ok,code):
 if not ok:raise ValueError(code)

def values(saved):
 profile=saved.get('HUB_EXECUTION_PROFILE','disabled')
 need(profile in ('disabled',PROFILE),'HUB_EXECUTION_PROFILE_REJECTED')
 fixed={'CONTROL_PLANE_ENABLED':'false','OFFICIAL_JOB_KINDS':'','HUB_EMBEDDING_MODE':'keyword-only','HUB_MAIL_MODE':'disabled'}
 fixed.update(HUB_EXECUTION_PROFILE=profile,HUB_PAID_AI_ENABLED='true' if profile==PROFILE else 'false',ENABLED_WORKER_KINDS='knowledge-chat' if profile==PROFILE else '')
 if profile==PROFILE:
  sha=saved.get('HUB_CHAT_ADMISSION_SHA256','')
  need(re.fullmatch('[a-f0-9]{64}',sha or ''),'HUB_CHAT_ADMISSION_DIGEST_REQUIRED')
  need(saved.get('HUB_CHAT_ADMISSION_FILE')=='/run/researchhub-admission/admission.json' and saved.get('HUB_CHAT_LEDGER_DIR')=='/run/researchhub-ai-ledger','HUB_CHAT_PATHS_REJECTED')
  fixed.update({k:saved[k] for k in ('HUB_CHAT_ADMISSION_SHA256','HUB_CHAT_ADMISSION_FILE','HUB_CHAT_LEDGER_DIR')})
 for k in ('HUB_PAID_AI_ENABLED','ENABLED_WORKER_KINDS'):
  need(saved.get(k,fixed[k])==fixed[k],'HUB_EXECUTION_STATE_MISMATCH')
 return fixed

def support(release,saved):
 state=values(saved)
 if state['HUB_EXECUTION_PROFILE']==PROFILE:
  need(PROFILE in release.get('supportedExecutionProfiles',[]) and release.get('coreDigest')==CORE,'HUB_ROLLBACK_EXECUTION_UNSUPPORTED')
 return state

def sealed(saved):
 sha=saved.get('HUB_CHAT_ADMISSION_SHA256','');need(re.fullmatch('[a-f0-9]{64}',sha or ''),'HUB_CHAT_ADMISSION_DIGEST_REQUIRED')
 p=ROOT/'admission'/'admission.json';need(p.is_file() and not p.is_symlink() and p.stat().st_size<262144,'HUB_CHAT_ADMISSION_REQUIRED')
 raw=p.read_bytes();need(hashlib.sha256(raw).hexdigest()==sha,'HUB_CHAT_ADMISSION_CHANGED');a=json.loads(raw)
 need(a.get('schema')=='hub-chat-admission.v1' and a.get('campaignId')=='prod-ai-assets-20261120' and a.get('database')=='researchhub' and a.get('tenantId')=='rh-kb-local-b0e2af9d-tenant' and set(a.get('accounts',[]))==ACCOUNTS and a.get('limits')=={'sessions':2,'jobs':2,'dispatches':2,'feeMicros':1000000},'HUB_CHAT_ADMISSION_REJECTED')
 return a

def admitted_jobs(saved):
 if saved.get('HUB_EXECUTION_PROFILE','disabled')=='disabled':return {}
 a=sealed(saved);p=ROOT/'ledger'/'budget.json'
 need(p.is_file() and not p.is_symlink() and p.stat().st_size<262144 and p.stat().st_uid==1000 and p.stat().st_mode&0o077==0,'HUB_CHAT_LEDGER_REQUIRED')
 s=json.loads(p.read_text());need(s.get('schema')=='hub-chat-budget.v1' and s.get('admissionSha')==saved['HUB_CHAT_ADMISSION_SHA256'] and s.get('campaignId')==a['campaignId'],'HUB_CHAT_LEDGER_CHANGED')
 jobs=s.get('jobs',[]);sessions=s.get('sessions',[]);need(isinstance(jobs,list) and len(jobs)<=2 and isinstance(sessions,list) and len(sessions)<=2,'HUB_CHAT_LEDGER_REJECTED')
 historical=set(a['historicalChatIds']);result={}
 for job in jobs:
  need(job.get('accountId') in ACCOUNTS and all(re.fullmatch('[A-Za-z0-9_-]{1,160}',job.get(k,'') or '') for k in ('id','requestKey','sessionId')) and job['id'] not in historical and job.get('createdAt','')>=a['issuedAt'] and any(x.get('accountId')==job['accountId'] and x.get('sessionId')==job['sessionId'] for x in sessions),'HUB_CHAT_LEDGER_JOB_REJECTED')
  created=datetime.datetime.strptime(job['createdAt'],'%Y-%m-%dT%H:%M:%S.%fZ');millis=calendar.timegm(created.utctimetuple())*1000+created.microsecond//1000
  result[job['id']]={'tenantId':a['tenantId'],'accountId':job['accountId'],'sessionId':job['sessionId'],'requestKey':job['requestKey'],'createdAtMillis':millis}
 need(len(result)==len(jobs) and len({x['accountId'] for x in jobs})==len(jobs),'HUB_CHAT_LEDGER_JOB_REJECTED')
 return result

def mounts(service,saved):
 expected={'/run/researchhub-admission':(str(ROOT/'admission'),True),'/run/researchhub-ai-ledger':(str(ROOT/'ledger'),False)}
 found={}
 for row in service.get('volumes',[]):
  target=row.get('target')
  need(target in expected and target not in found and row.get('type')=='bind','HUB_CHAT_MOUNT_REJECTED')
  source,readonly=expected[target]
  need(row.get('source')==source and bool(row.get('read_only',False))==readonly and row.get('bind',{}).get('create_host_path') is False,'HUB_CHAT_MOUNT_REJECTED');found[target]=True
 need(set(found)==set(expected),'HUB_CHAT_MOUNT_REQUIRED')
