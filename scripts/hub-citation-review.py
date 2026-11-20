#!/usr/bin/env python3
"""One bounded follow-up to the approved K01 citation-quality review."""
import base64,fcntl,json,os,pathlib,re,sys,time,types,zlib
# The CI transport supplies the already reviewed K01 operator helpers.
H=types.SimpleNamespace(**globals()['HUB_K01_HELPERS']) if 'HUB_K01_HELPERS' in globals() else None
OLD='6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492'
PREP=r'''
import fs from 'node:fs';import{createHash}from'node:crypto';
import{readResearchRuntimeConfig}from'/opt/researchhub/hub/server/research-runtime/config.mjs';
import{loadChatAdmission,createChatBudget}from'/opt/researchhub/hub/server/research-runtime/chat-budget.mjs';
import{extendCitationReviewBudget,citationReviewPrefixHash}from'/opt/researchhub/hub/server/research-runtime/chat-k01-budget.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),old='6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492';
try{const config=readResearchRuntimeConfig(process.env);if(config.identity.database!=='researchhub'||config.identity.tenantId!=='rh-kb-local-b0e2af9d-tenant'||config.executionProfile!=='bounded-hub-knowledge-v2'||process.env.HUB_CHAT_ADMISSION_SHA256!==old||process.env.HUB_CHAT_BUDGET_EXTENSION)throw Error('CITATION_BASELINE_REJECTED');
 const a=loadChatAdmission(process.env.HUB_CHAT_ADMISSION_FILE,old),budget=createChatBudget({admission:a,admissionSha:old,directory:process.env.HUB_CHAT_LEDGER_DIR}),previous=budget.snapshot(),raw=fs.readFileSync(process.env.HUB_CHAT_LEDGER_DIR+'/budget.json','utf8');if(JSON.stringify(previous)!==JSON.stringify(JSON.parse(raw)))throw Error('CITATION_BASELINE_MOVED');
 const issuedAt=process.env.HUB_CITATION_ISSUED_AT||new Date().toISOString(),next={...a,limits:{...a.limits,jobs:8,dispatches:6},citationReview:{previousAdmissionSha:old,prefixHash:citationReviewPrefixHash(previous),issuedAt}},admissionRaw=JSON.stringify(next)+'\n',admissionSha=sha(admissionRaw),ledger=extendCitationReviewBudget({previous,previousAdmission:a,previousAdmissionSha:old,admission:next,admissionSha});
 console.log(JSON.stringify({status:'citation-extension-prepared',issuedAt,previousLedgerSha:sha(raw),admissionRaw,admissionSha,ledgerRaw:JSON.stringify(ledger)+'\n',prefixHash:next.citationReview.prefixHash}));
}catch(e){console.log(JSON.stringify({status:'stopped',code:/^CITATION_[A-Z_]+$/.test(e.message??'')?e.message:'CITATION_PREPARATION_FAILED'}));process.exitCode=1;}
'''

VERIFY=r"""
import{loadChatAdmission,createChatBudget}from'/opt/researchhub/hub/server/research-runtime/chat-budget.mjs';
import{citationReviewPrefixHash}from'/opt/researchhub/hub/server/research-runtime/chat-k01-budget.mjs';
const a=loadChatAdmission(process.env.HUB_CHAT_ADMISSION_FILE,process.env.HUB_CHAT_ADMISSION_SHA256),s=createChatBudget({admission:a,admissionSha:process.env.HUB_CHAT_ADMISSION_SHA256,directory:process.env.HUB_CHAT_LEDGER_DIR}).snapshot();
if(!a.citationReview||citationReviewPrefixHash(s)!==a.citationReview.prefixHash||s.sessions.length!==4||s.jobs.length!==6||s.dispatches.length!==4||s.dispatches.some(d=>d.state!=='known'))throw Error('K01_CITATION_LIVE_BUDGET_CHANGED');console.log(JSON.stringify({status:'citation-live-budget-verified',sessions:4,jobs:6,requests:4}));
"""

def assert_live_configuration(live,sha):
 env=dict(x.split('=',1) for x in live['Config']['Env'] if '=' in x)
 expected={'HUB_CHAT_ADMISSION_SHA256':sha,'HUB_CHAT_BUDGET_EXTENSION':'citation-review-v1','HUB_EXECUTION_PROFILE':'bounded-hub-knowledge-v2','HUB_PAID_AI_ENABLED':'true','ENABLED_WORKER_KINDS':'knowledge-chat,knowledge-import','HUB_CORE_MANIFEST_SHA256':H.CORE}
 H.need(all(env.get(k)==v for k,v in expected.items()),'K01_CITATION_LIVE_ENV_MISMATCH');mounts={x.get('Destination'):x for x in live.get('Mounts',[])}
 for name,destination,rw in [('admission','/run/researchhub-admission',False),('ledger','/run/researchhub-ai-ledger',True)]:
  row=mounts.get(destination,{});H.need(row.get('Type')=='bind' and row.get('Source')==str(H.ROOT/name) and row.get('RW') is rw,'K01_CITATION_LIVE_MOUNT_MISMATCH')

def legacy_services():
 rows=set()
 for project in ('ops','official-site'):
  rows.update(H.run(['docker','ps','-a','--filter','label=com.docker.compose.project='+project,'--format','{{.ID}} {{.Image}} {{.State}}']).splitlines())
 H.need(bool(rows),'K01_OLD_SERVICES_BASELINE_REQUIRED');return '\n'.join(sorted(rows))

def current_pair():
 live=H.current();front_ids=H.run(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub']).splitlines();H.need(len(front_ids)==1,'K01_CITATION_FRONTEND_REQUIRED');front=json.loads(H.run(['docker','inspect',front_ids[0]]))[0];tag=front['Config']['Image'].partition(':')[2];return live,front,tag

def prepare(live,issued_at=None):
 args=['docker','exec','-i']
 if issued_at:args+=['-e','HUB_CITATION_ISSUED_AT='+issued_at]
 args += [live['Id'],'node','--input-type=module','-'];x=json.loads(H.run(args,PREP).splitlines()[-1]);H.need(x.get('status')=='citation-extension-prepared','K01_CITATION_PREPARATION_REJECTED');return x

def main(action):
 H.need(os.geteuid()==0 and H.OPS.resolve()==H.OPS,'K01_ROOT_REQUIRED');os.umask(0o077);live,front,tag=current_pair();p,c,r=H.controls(tag);db=H.load('citation_config',p/'database-config.py');saved=db.read_config(H.OPS/'.env.prod');H.need(saved.get('HUB_DATABASE_NAME')=='researchhub' and saved.get('DEFAULT_TENANT_ID')=='rh-kb-local-b0e2af9d-tenant' and saved.get('HUB_CORE_MANIFEST_SHA256')==H.CORE and saved.get('HUB_BACKEND_IMAGE')==live['Config']['Image'] and r['backendImage']==live['Config']['Image'] and r['frontendImage']==front['Config']['Image'] and 'citation-review-v1' in r.get('supportedBudgetExtensions',[]),'K01_CITATION_TARGET_REJECTED')
 H.need(saved.get('HUB_CHAT_ADMISSION_SHA256')==OLD and saved.get('HUB_EXECUTION_PROFILE')=='bounded-hub-knowledge-v2' and saved.get('HUB_PAID_AI_ENABLED')=='true' and saved.get('ENABLED_WORKER_KINDS')=='knowledge-chat,knowledge-import' and not saved.get('HUB_CHAT_BUDGET_EXTENSION'),'K01_CITATION_OLD_STATE_REQUIRED')
 stage=H.ROOT/'citation-review-20261120';services=legacy_services()
 if action=='advice-stage':
  H.need(not stage.exists(),'K01_CITATION_ALREADY_STAGED');x=prepare(live);olda=(H.ROOT/'admission/admission.json').read_bytes();oldl=H.private(H.ROOT/'ledger/budget.json',1000);H.need(H.sha(olda)==OLD and H.sha(oldl)==x['previousLedgerSha'],'K01_CITATION_BASELINE_CHANGED');stage.mkdir(mode=0o700)
  for name,data in [('original-admission.json',olda),('original-budget.json',oldl),('admission.json',x['admissionRaw'].encode()),('budget.json',x['ledgerRaw'].encode())]:H.exclusive(stage/name,data)
  receipt={k:x[k] for k in ('issuedAt','previousLedgerSha','admissionSha','prefixHash')};receipt.update(tag=tag,manifestSha256=c['imageManifestSha256'],backendImage=live['Config']['Image'],hubDigest=r['hubDigest'],oldServices=services);H.exclusive(stage/'stage.json',(json.dumps(receipt)+'\n').encode());H.need(legacy_services()==services,'K01_OLD_SERVICES_CHANGED');print(json.dumps({'status':'citation-extension-staged',**receipt,'databaseWrites':0,'modelCalls':0}));return
 H.need(action=='advice-activate','K01_ACTION_REJECTED');receipt=json.loads(H.private(stage/'stage.json'));newa=H.private(stage/'admission.json');newl=H.private(stage/'budget.json');H.need(H.sha(newa)==receipt['admissionSha'] and receipt['backendImage']==live['Config']['Image'] and receipt['hubDigest']==r['hubDigest'],'K01_CITATION_STAGE_CHANGED');H.need(not(stage/'activation-started.json').exists(),'K01_CITATION_ACTIVATION_ALREADY_STARTED')
 p,c,r=H.controls(tag,os.environ.get('HUB_K01_CHECKPOINT_SHA'));H.need(c.get('executionPolicy')=={'profile':'bounded-hub-knowledge-v2','admissionSha256':receipt['admissionSha']} and c.get('paired') is True and (p/'previous-release.json').read_bytes()==(p/'runtime-release.json').read_bytes() and r['backendImage']==live['Config']['Image'] and r['frontendImage']==front['Config']['Image'] and 'citation-review-v1' in r.get('supportedBudgetExtensions',[]),'K01_CITATION_CHECKPOINT_REJECTED')
 x=prepare(live,receipt['issuedAt']);H.need(x['admissionRaw'].encode()==newa and x['ledgerRaw'].encode()==newl and x['previousLedgerSha']==receipt['previousLedgerSha'] and H.sha(H.private(H.ROOT/'ledger/budget.json',1000))==receipt['previousLedgerSha'],'K01_CITATION_BASELINE_CHANGED')
 server=H.load('citation_server',p/'server.py');before=server.task_snapshot(db,saved);H.exclusive(stage/'activation-started.json',(json.dumps({'tag':tag,'admissionSha':receipt['admissionSha'],'oldServices':services})+'\n').encode())
 H.replace(H.ROOT/'admission/admission.json',newa,0,1000,0o440);H.replace(H.ROOT/'ledger/budget.json',newl,1000,1000,0o600);db.save_config(H.OPS/'.env.prod',{'HUB_CHAT_ADMISSION_SHA256':receipt['admissionSha'],'HUB_CHAT_BUDGET_EXTENSION':'citation-review-v1'})
 H.run(['docker','compose','--project-name','researchhub-backend','--env-file',str(H.OPS/'.env.prod'),'-f',str(p/'backend-compose.yml'),'up','-d','--no-deps','researchhub-api'],timeout=120)
 for _ in range(40):
  if server.api_status()=='401':break
  time.sleep(2)
 else:raise ValueError('K01_CITATION_API_NOT_READY')
 live=H.current();assert_live_configuration(live,receipt['admissionSha']);verified=json.loads(H.run(['docker','exec','-i',live['Id'],'node','--input-type=module','-'],VERIFY).splitlines()[-1]);H.need(verified.get('status')=='citation-live-budget-verified','K01_CITATION_LIVE_BUDGET_REJECTED')
 H.need(legacy_services()==services and live['Config']['Image']==receipt['backendImage'],'K01_CITATION_SERVICES_CHANGED');after=server.task_snapshot(db,db.read_config(H.OPS/'.env.prod'));H.need(before==after,'K01_CITATION_TASKS_CHANGED');H.exclusive(stage/'activated.json',(json.dumps({'status':'activated','admissionSha':receipt['admissionSha'],'tag':tag})+'\n').encode());print(json.dumps({'status':'citation-extension-activated','tag':tag,'admissionSha256':receipt['admissionSha'],'limits':{'sessions':4,'jobs':8,'dispatches':6,'feeMicros':1000000},'oldServicesUnchanged':True,'historicalTasksUnchanged':True,'databaseWrites':0,'modelCalls':0}))

def execute(action):
 H.need(H is not None and action in ('advice-stage','advice-activate'),'K01_ACTION_REJECTED');fds=[]
 try:
  for name in ('hub-runtime-release.lock','release.lock'):
   fd=os.open(str(H.OPS/name),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600);fds.append(fd);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  lock=H.ROOT/'ledger/budget.lock';fd=os.open(str(lock),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
  try:main(action)
  finally:os.close(fd);lock.unlink()
 finally:
  for fd in fds:os.close(fd)

if __name__=='__main__':
 try:execute(sys.argv[1])
 except Exception as e:print(json.dumps({'status':'stopped','code':str(e) if re.fullmatch('K01_[A-Z0-9_]+',str(e)) else 'K01_CITATION_STATE_MUST_BE_RECHECKED','automaticRetry':False}));raise SystemExit(1)
