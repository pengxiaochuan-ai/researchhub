"""Sealed execution state shared by release validation and rollback. No quota reset."""
import calendar,datetime,hashlib,json,pathlib,re
from urllib.parse import urlsplit

PROFILE='bounded-hub-chat-v1'
KNOWLEDGE_PROFILE='bounded-hub-knowledge-v2'
STANDARD_PROFILE='standard'
ROOT=pathlib.Path('/srv/researchhub/ops/chat-runtime')
CORE='85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135'
KNOWLEDGE_CORE='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669'
ACCOUNTS={'rh-kb-local-b0e2af9d-admin','rh-kb-local-b0e2af9d-owner'}

def need(ok,code):
 if not ok:raise ValueError(code)

def proposed(release,saved):
 """The approved normal-mode transition; unrelated saved parameters survive."""
 desired=dict(saved)
 if release.get('executionPolicy',{}).get('profile')==STANDARD_PROFILE:
  desired.update(HUB_EXECUTION_PROFILE=STANDARD_PROFILE,HUB_PAID_AI_ENABLED='true',ENABLED_WORKER_KINDS='knowledge-chat,knowledge-import',HUB_EMBEDDING_MODE='service')
  desired['KB_DOC_PARSER_URL']=saved.get('KB_DOC_PARSER_URL') or 'http://researchhub-doc-parser:8200'
  desired['KB_EMBED_URL']=saved.get('KB_EMBED_URL') or 'http://researchhub-embed:8199'
 return desired

def values(saved):
 profile=saved.get('HUB_EXECUTION_PROFILE','disabled')
 need(profile in ('disabled',PROFILE,KNOWLEDGE_PROFILE,STANDARD_PROFILE),'HUB_EXECUTION_PROFILE_REJECTED')
 if profile==STANDARD_PROFILE:
  fixed={'CONTROL_PLANE_ENABLED':'false','OFFICIAL_JOB_KINDS':'','HUB_EMBEDDING_MODE':'service','HUB_MAIL_MODE':saved.get('HUB_MAIL_MODE','disabled'),'HUB_EXECUTION_PROFILE':STANDARD_PROFILE,'HUB_PAID_AI_ENABLED':'true','ENABLED_WORKER_KINDS':'knowledge-chat,knowledge-import'}
  need(saved.get('HUB_EMBEDDING_MODE')=='service','HUB_STANDARD_EMBEDDING_REQUIRED')
  for key in ('KB_DOC_PARSER_URL','KB_EMBED_URL'):
   value=saved.get(key,'');url=urlsplit(value)
   need(url.scheme in ('http','https') and url.hostname and not url.username and not url.password and url.path in ('','/') and not url.query and not url.fragment,'HUB_STANDARD_DEPENDENCY_REQUIRED')
   fixed[key]=value
  for key in ('HUB_PAID_AI_ENABLED','ENABLED_WORKER_KINDS'):
   need(saved.get(key,fixed[key])==fixed[key],'HUB_EXECUTION_STATE_MISMATCH')
  # Archived acceptance settings remain on disk; standard neither reads their
  # admission/ledger nor resets counters. Native permissions/quota govern use.
  return fixed
 extension=saved.get('HUB_CHAT_BUDGET_EXTENSION')
 if extension is not None:
  need(extension=='citation-review-v1' and profile==KNOWLEDGE_PROFILE,'HUB_CHAT_BUDGET_EXTENSION_REJECTED')
 fixed={'CONTROL_PLANE_ENABLED':'false','OFFICIAL_JOB_KINDS':'','HUB_EMBEDDING_MODE':'keyword-only','HUB_MAIL_MODE':'disabled'}
 if extension is not None:fixed['HUB_CHAT_BUDGET_EXTENSION']=extension
 fixed.update(HUB_EXECUTION_PROFILE=profile,HUB_PAID_AI_ENABLED='false' if profile=='disabled' else 'true',ENABLED_WORKER_KINDS='knowledge-chat,knowledge-import' if profile==KNOWLEDGE_PROFILE else 'knowledge-chat' if profile==PROFILE else '')
 if profile!='disabled':
  sha=saved.get('HUB_CHAT_ADMISSION_SHA256','')
  need(re.fullmatch('[a-f0-9]{64}',sha or ''),'HUB_CHAT_ADMISSION_DIGEST_REQUIRED')
  need(saved.get('HUB_CHAT_ADMISSION_FILE')=='/run/researchhub-admission/admission.json' and saved.get('HUB_CHAT_LEDGER_DIR')=='/run/researchhub-ai-ledger','HUB_CHAT_PATHS_REJECTED')
  fixed.update({k:saved[k] for k in ('HUB_CHAT_ADMISSION_SHA256','HUB_CHAT_ADMISSION_FILE','HUB_CHAT_LEDGER_DIR')})
 for k in ('HUB_PAID_AI_ENABLED','ENABLED_WORKER_KINDS'):
  need(saved.get(k,fixed[k])==fixed[k],'HUB_EXECUTION_STATE_MISMATCH')
 return fixed

def support(release,saved):
 state=values(saved)
 profile=state['HUB_EXECUTION_PROFILE']
 if profile!='disabled':
  cores=[KNOWLEDGE_CORE] if profile in (KNOWLEDGE_PROFILE,STANDARD_PROFILE) else [CORE,KNOWLEDGE_CORE]
  need(profile in release.get('supportedExecutionProfiles',[]) and release.get('coreDigest') in cores,'HUB_ROLLBACK_EXECUTION_UNSUPPORTED')
 if state.get('HUB_CHAT_BUDGET_EXTENSION'):need(state['HUB_CHAT_BUDGET_EXTENSION'] in release.get('supportedBudgetExtensions',[]),'HUB_BUDGET_EXTENSION_ROLLBACK_UNSUPPORTED')
 return state

def sealed(saved):
 sha=saved.get('HUB_CHAT_ADMISSION_SHA256','');need(re.fullmatch('[a-f0-9]{64}',sha or ''),'HUB_CHAT_ADMISSION_DIGEST_REQUIRED')
 p=ROOT/'admission'/'admission.json';need(p.is_file() and not p.is_symlink() and p.stat().st_size<262144,'HUB_CHAT_ADMISSION_REQUIRED')
 raw=p.read_bytes();need(hashlib.sha256(raw).hexdigest()==sha,'HUB_CHAT_ADMISSION_CHANGED');a=json.loads(raw)
 v2=saved.get('HUB_EXECUTION_PROFILE')==KNOWLEDGE_PROFILE
 extension=a.get('citationReview');extended=extension is not None
 need(not extended or v2 and isinstance(extension,dict) and set(extension)=={'issuedAt','prefixHash','previousAdmissionSha'} and extension['previousAdmissionSha']=='6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492' and re.fullmatch('[a-f0-9]{64}',extension.get('prefixHash','')) and extension.get('issuedAt','')>=a.get('k01',{}).get('issuedAt',''),'HUB_CHAT_CITATION_EXTENSION_REJECTED')
 need(a.get('schema')==('hub-chat-admission.v2' if v2 else 'hub-chat-admission.v1') and a.get('campaignId')=='prod-ai-assets-20261120' and a.get('database')=='researchhub' and a.get('tenantId')=='rh-kb-local-b0e2af9d-tenant' and len(a.get('accounts',[]))==2 and set(a.get('accounts',[]))==ACCOUNTS and a.get('limits')==({'sessions':4,'jobs':8 if extended else 6,'dispatches':6 if extended else 4,'feeMicros':1000000} if v2 else {'sessions':2,'jobs':2,'dispatches':2,'feeMicros':1000000}),'HUB_CHAT_ADMISSION_REJECTED')
 if v2:need(extended==(saved.get('HUB_CHAT_BUDGET_EXTENSION')=='citation-review-v1'),'HUB_CHAT_BUDGET_EXTENSION_REJECTED')
 if extended:need(datetime.datetime.strptime(extension['issuedAt'],'%Y-%m-%dT%H:%M:%S.%fZ')>=datetime.datetime.strptime(a['k01']['issuedAt'],'%Y-%m-%dT%H:%M:%S.%fZ'),'HUB_CHAT_CITATION_EXTENSION_REJECTED')
 if v2:
  old=a.get('legacy',{});k=a.get('k01',{});bindings=k.get('bindings',[])
  need(a.get('coreDigest')==KNOWLEDGE_CORE and old.get('admission',{}).get('coreDigest')==CORE and re.fullmatch('[a-f0-9]{64}',old.get('admissionSha','')) and re.fullmatch('[a-f0-9]{64}',old.get('prefixHash','')),'HUB_CHAT_LEGACY_BINDING_REJECTED')
  legacy=old['admission'];need(legacy.get('schema')=='hub-chat-admission.v1' and legacy.get('limits')=={'sessions':2,'jobs':2,'dispatches':2,'feeMicros':1000000} and all(legacy.get(key)==a.get(key) for key in ('issuedAt','model','accounts','database','tenantId','campaignId','historicalChatIds')),'HUB_CHAT_LEGACY_BINDING_REJECTED')
  need(k.get('studyGroupId')=='rh-kb-local-b0e2af9d-group' and k.get('researchProjectId')=='rh-kb-local-b0e2af9d-project' and len(bindings)==2 and {b.get('accountId') for b in bindings}==ACCOUNTS and len({b.get('kbId') for b in bindings})==2 and all(re.fullmatch('[A-Za-z0-9_-]{1,160}',b.get(key,'') or '') for b in bindings for key in ('kbId','positiveDocId','importTaskId')) and len({b[key] for b in bindings for key in ('positiveDocId','importTaskId')})==4,'HUB_CHAT_KB_BINDING_REJECTED')
  need(datetime.datetime.strptime(k['issuedAt'],'%Y-%m-%dT%H:%M:%S.%fZ')>=datetime.datetime.strptime(a['issuedAt'],'%Y-%m-%dT%H:%M:%S.%fZ'),'HUB_CHAT_KB_BINDING_REJECTED')
 return a

def admitted_jobs(saved):
 if saved.get('HUB_EXECUTION_PROFILE','disabled') in ('disabled',STANDARD_PROFILE):return {}
 a=sealed(saved);p=ROOT/'ledger'/'budget.json'
 need(p.is_file() and not p.is_symlink() and p.stat().st_size<262144 and p.stat().st_uid==1000 and p.stat().st_mode&0o077==0,'HUB_CHAT_LEDGER_REQUIRED')
 s=json.loads(p.read_text());v2=a['schema']=='hub-chat-admission.v2';need(s.get('schema')==('hub-chat-budget.v2' if v2 else 'hub-chat-budget.v1') and s.get('admissionSha')==saved['HUB_CHAT_ADMISSION_SHA256'] and s.get('campaignId')==a['campaignId'],'HUB_CHAT_LEDGER_CHANGED')
 jobs=s.get('jobs',[]);sessions=s.get('sessions',[]);need(isinstance(jobs,list) and len(jobs)<=a['limits']['jobs'] and isinstance(sessions,list) and len(sessions)<=a['limits']['sessions'],'HUB_CHAT_LEDGER_REJECTED')
 if v2:
  need(all(isinstance(s.get(key),list) and 2<=len(s[key])<=a['limits'][key] for key in ('sessions','jobs','dispatches')),'HUB_CHAT_LEDGER_REJECTED')
  prefix={key:s[key][:2] for key in ('sessions','jobs','dispatches')};digest=hashlib.sha256(json.dumps(prefix,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
  need(digest==a['legacy']['prefixHash'] and isinstance(s.get('inheritedRevision'),int) and s.get('revision',-1)>s['inheritedRevision'],'HUB_CHAT_LEGACY_LEDGER_CHANGED')
  bindings={b['accountId']:b for b in a['k01']['bindings']}
  need(all(x.get('accountId') in bindings and x.get('contextKey')=='kb:'+bindings[x['accountId']]['kbId'] and x.get('reservedAt','')>=a['k01']['issuedAt'] for x in sessions[2:]) and len({x['accountId'] for x in sessions[2:]})==len(sessions[2:]),'HUB_CHAT_KB_BINDING_REJECTED')
  extended=a.get('citationReview') is not None
  if extended:
   need(all(len(s[key])>=n for key,n in [('sessions',4),('jobs',6),('dispatches',4)]),'HUB_CHAT_LEDGER_REJECTED')
   frozen={key:s[key][:n] for key,n in [('sessions',4),('jobs',6),('dispatches',4)]};digest=hashlib.sha256(json.dumps(frozen,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
   need(digest==a['citationReview']['prefixHash'] and all(j.get('createdAt','')>=a['citationReview']['issuedAt'] for j in jobs[6:]) and all(d.get('at','')>=a['citationReview']['issuedAt'] for d in s['dispatches'][4:]),'HUB_CHAT_CITATION_PREFIX_CHANGED')
  need(all(sum(j.get('accountId')==actor for j in jobs[2:])<=(3 if extended else 2) for actor in ACCOUNTS) and all(sum(d.get('accountId')==actor for d in s['dispatches'][2:])<=(2 if extended else 1) for actor in ACCOUNTS),'HUB_CHAT_LEDGER_REJECTED')
  need(sum(d.get('feeUpperMicros',d.get('reservedMicros',1000001)) if d.get('state')=='known' else d.get('reservedMicros',1000001) for d in s['dispatches'])<=1000000,'HUB_CHAT_LEDGER_REJECTED')
 historical=set(a['historicalChatIds']);result={}
 for job in jobs:
  need(job.get('accountId') in ACCOUNTS and all(re.fullmatch('[A-Za-z0-9_-]{1,160}',job.get(k,'') or '') for k in ('id','requestKey','sessionId')) and job['id'] not in historical and job.get('createdAt','')>=a['issuedAt'] and any(x.get('accountId')==job['accountId'] and x.get('sessionId')==job['sessionId'] for x in sessions),'HUB_CHAT_LEDGER_JOB_REJECTED')
  created=datetime.datetime.strptime(job['createdAt'],'%Y-%m-%dT%H:%M:%S.%fZ');millis=calendar.timegm(created.utctimetuple())*1000+created.microsecond//1000
  result[job['id']]={'tenantId':a['tenantId'],'accountId':job['accountId'],'sessionId':job['sessionId'],'requestKey':job['requestKey'],'createdAtMillis':millis}
 need(len(result)==len(jobs) and (v2 or len({x['accountId'] for x in jobs})==len(jobs)),'HUB_CHAT_LEDGER_JOB_REJECTED')
 # V2 freezes the two original failed Hub jobs, including their terminal rows.
 # Only new, signed K01 jobs may change while the new worker is active.
 return {job['id']:result[job['id']] for job in jobs[6 if a.get('citationReview') else 2:]} if v2 else result

def core_transition(previous,release,saved,upgrade=None):
 if previous.get('coreDigest')==release.get('coreDigest'):return
 need(saved.get('HUB_EXECUTION_PROFILE')==PROFILE and upgrade=={'sourceCoreDigest':CORE,'targetCoreDigest':KNOWLEDGE_CORE} and {previous.get('coreDigest'),release.get('coreDigest')}=={CORE,KNOWLEDGE_CORE},'HUB_PAIR_CORE_OR_DATABASE_REAPPROVAL_REQUIRED')

def mounts(service,saved,template=None):
 expected={'/run/researchhub-admission':(str(ROOT/'admission'),True),'/run/researchhub-ai-ledger':(str(ROOT/'ledger'),False)}
 found={}
 for row in service.get('volumes',[]):
  target=row.get('target')
  need(target in expected and target not in found and row.get('type')=='bind','HUB_CHAT_MOUNT_REJECTED')
  source,readonly=expected[target]
  create=row.get('bind',{}).get('create_host_path')
  # Older Compose serializes an explicitly false bind field as {}. Missing is
  # accepted only with the same sealed long-form source/target block, never by
  # assuming Docker's (true) default or trusting a short-form mount.
  explicitFalse=bool(template and re.search(r'source:\s*'+re.escape(source)+r'\s+target:\s*'+re.escape(target)+r'(?:\s+read_only:\s*true)?\s+bind:\s*\{\s*create_host_path:\s*false\s*\}',template))
  need(row.get('source')==source and bool(row.get('read_only',False))==readonly and (create is False or create is None and explicitFalse),'HUB_CHAT_MOUNT_REJECTED');found[target]=True
 need(set(found)==set(expected),'HUB_CHAT_MOUNT_REQUIRED')
