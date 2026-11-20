#!/usr/bin/env python3
"""Single approved K01 extension. No resets, DDL, account grants or model calls."""
import datetime,fcntl,hashlib,importlib.util,json,os,pathlib,re,subprocess,sys,tempfile,time
OPS=pathlib.Path('/srv/researchhub/ops');ROOT=OPS/'chat-runtime';STAGE=ROOT/'k01';CORE='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669';OLD_SHA='fd96111fd68a7658b79c12dcaf23437ee9ced0bd1ca1af6093dacb8e4d9e23c4'
def need(ok,code):
 if not ok:raise ValueError(code)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def run(args,stdin=None,timeout=90):
 r=subprocess.run(args,input=stdin,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=timeout);need(r.returncode==0,'K01_COMMAND_FAILED_RECHECK_REQUIRED');return r.stdout.strip()
def load(name,path):
 s=importlib.util.spec_from_file_location(name,str(path));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def private(path,uid=0):
 st=path.lstat();need(not path.is_symlink() and path.is_file() and st.st_uid==uid and st.st_mode&0o077==0 and st.st_size<1048576,'K01_PRIVATE_FILE_REJECTED');return path.read_bytes()
def exclusive(path,raw,uid=0,gid=0,mode=0o600):
 fd=os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),mode)
 with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
 os.chown(str(path),uid,gid);os.chmod(str(path),mode)
def replace(path,raw,uid,gid,mode):
 need(path.is_file() and not path.is_symlink(),'K01_REPLACE_TARGET_REJECTED');temporary=path.parent/('.k01-'+path.name);exclusive(temporary,raw,uid,gid,mode);os.replace(str(temporary),str(path));fd=os.open(str(path.parent),os.O_RDONLY)
 try:os.fsync(fd)
 finally:os.close(fd)
def current():
 ids=run(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api']).splitlines();need(len(ids)==1,'K01_API_NOT_UNIQUE');c=json.loads(run(['docker','inspect',ids[0]]))[0];return c

def controls(tag,expected=None):
 need(re.fullmatch('hub-runtime-[a-f0-9]{8}-[0-9]+',tag),'K01_TAG_REJECTED');found=[]
 for p in (OPS/'runtime-releases'/tag).glob('control-*'):
  if p.is_symlink() or not p.is_dir():continue
  q=p/'control-manifest.json'
  if not q.is_file() or q.is_symlink():continue
  raw=q.read_bytes();digest=sha(raw)
  if p.name!='control-'+digest[:16] or expected and digest!=expected:continue
  c=json.loads(raw)
  if c.get('schema')!='researchhub-runtime-controls.v1' or c.get('tag')!=tag:continue
  required={'server.py','execution-profile.py','database-config.py','run-server.py','backend-compose.yml','runtime-release.json'}
  if not required<=set(c.get('files',{})):continue
  good=all(pathlib.Path(n).name==n and (p/n).is_file() and not (p/n).is_symlink() and sha((p/n).read_bytes())==v['sha256'] for n,v in c['files'].items())
  if not good or sha((p/'runtime-release.json').read_bytes())!=c.get('imageManifestSha256'):continue
  release=json.loads((p/'runtime-release.json').read_text())
  if release.get('coreDigest')==CORE and 'bounded-hub-knowledge-v2' in release.get('supportedExecutionProfiles',[]):found.append((p,c,release))
 need(bool(found),'K01_VERIFIED_BRIDGE_REQUIRED');return sorted(found,key=lambda v:v[0].stat().st_mtime)[-1]
NODE=r'''
import fs from 'node:fs';
import {readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';
import {runtimeDependencies}from'./server/research-runtime/dependencies.mjs';
import {bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';
import {prepareKnowledgeAdmission}from'./server/research-runtime/knowledge-admission-preparation.mjs';
let prisma;try{const config=readResearchRuntimeConfig(process.env);if(config.identity.database!=='researchhub'||config.core.digest!=='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669'||config.executionProfile!=='bounded-hub-chat-v1')throw Error('K01_BASELINE_REJECTED');const{load}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:config.identity});const result=await withDeploymentTransaction(env,'direct',tx=>prepareKnowledgeAdmission({tx,oldAdmissionRaw:fs.readFileSync('/run/researchhub-admission/admission.json'),oldLedgerRaw:fs.readFileSync('/run/researchhub-ai-ledger/budget.json'),input:JSON.parse(process.env.HUB_K01_INPUT)}),{readOnly:true});console.log(JSON.stringify({status:'k01-migration-validated',...result}));}catch(e){console.log(JSON.stringify({status:'stopped',code:/^K01_[A-Z_]+$/.test(e.message??'')?e.message:'K01_READONLY_PREPARATION_FAILED'}));process.exitCode=1;}finally{if(prisma)await prisma.onModuleDestroy();}
'''
PDF_PREFLIGHT=r'''
import fs from'node:fs';import{createHash}from'node:crypto';
import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';
import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';
import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';
import{loadChatAdmission}from'./server/research-runtime/chat-budget.mjs';
import{storageSettings,createReadyRuntimeStorage}from'./server/research-runtime/storage.mjs';
import{createRuntimeDocExtractor}from'./server/research-runtime/knowledge-parser.mjs';
let prisma;try{
 const config=readResearchRuntimeConfig(process.env),admission=loadChatAdmission(process.env.HUB_CHAT_ADMISSION_FILE,process.env.HUB_CHAT_ADMISSION_SHA256);
 if(config.identity.database!=='researchhub'||config.executionProfile!=='bounded-hub-knowledge-v2'||admission.schema!=='hub-chat-admission.v2'||process.env.KB_DOC_PARSER_URL)throw Error('K01_PDF_PREFLIGHT_CONFIGURATION_REJECTED');
 const{load,require}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const storage=await createReadyRuntimeStorage({load,require,settings:storageSettings(process.env)}),extract=createRuntimeDocExtractor({Native:load('knowledge/doc-extract.service','DocExtractService'),PDFParse:require('pdf-parse').PDFParse,resolveMetadata:load('knowledge/knowledge-literature-metadata','resolveLiteratureMetadata'),parserConfigured:false}),results=[];
 const hashes={'rh-kb-local-b0e2af9d-admin':'3b83d035edc68e9c2593a400dee1168a535ab1c87bae741cc4be52d927ce1988','rh-kb-local-b0e2af9d-owner':'edc10bafa65d30529aa9122d6bd9dee5a27a4be059aea857281b924d249dd2dc'};
 for(const b of admission.k01.bindings){
  const task=await withDeploymentTransaction(env,'direct',async tx=>{await load('common/worker-authorization','assertWorkerAuthorized')(tx,config.scope,{kind:'knowledge-import',taskId:b.importTaskId,tenantId:admission.tenantId});return tx.knowledgeImportTask.findFirst({where:{id:b.importTaskId,tenantId:admission.tenantId,kbId:b.kbId,createdBy:b.accountId,status:'failed',docId:null,errorCode:'IMPORT_FAILED',errorMessage:'对象存储不可用'},include:{sourceFile:true}});},{readOnly:true});
  if(!task||task.sourceFile.sha256!==hashes[b.accountId]||task.sourceFile.kbId!==b.kbId||task.sourceFile.createdBy!==b.accountId||task.sourceFile.docId!==null||Number(task.sourceFile.size)>70000)throw Error('K01_PDF_PREFLIGHT_SOURCE_REJECTED');
  const bytes=await storage.getBuffer(task.sourceFile.storageKey,Number(task.sourceFile.size));if(createHash('sha256').update(bytes).digest('hex')!==task.sourceFile.sha256)throw Error('K01_PDF_PREFLIGHT_HASH_CHANGED');
  const parsed=await extract.extract(task.sourceFile.filename,bytes);if(parsed.extractor!=='node-local'||parsed.usedOcr!==false||parsed.pageCount!==1||!parsed.contentMd.includes('# 第1页')||!parsed.contentMd.includes('核对来源')||parsed.contentMd.includes('\uFFFD')||!parsed.title.includes('原创合成'))throw Error('K01_PDF_PREFLIGHT_TEXT_INVALID');
  const unchanged=await withDeploymentTransaction(env,'direct',tx=>tx.knowledgeImportTask.findFirst({where:{id:task.id,status:'failed',docId:null,updatedAt:task.updatedAt},select:{id:true}}),{readOnly:true});if(!unchanged)throw Error('K01_PDF_PREFLIGHT_TASK_CHANGED');
  results.push({accountId:b.accountId,taskId:task.id,sourceSha256:task.sourceFile.sha256,readableChinese:true,readableTitle:true,pageCount:1,usedOcr:false,extractor:'node-local',originalFailureUnchanged:true});
 }
 console.log(JSON.stringify({status:'k01-original-pdfs-readonly-verified',results,objectWrites:0,databaseWrites:0,modelCalls:0,importJobsExecuted:0}));
}catch(e){console.log(JSON.stringify({status:'stopped',code:/^K01_[A-Z_]+$/.test(e.message??'')?e.message:'K01_PDF_PREFLIGHT_FAILED'}));process.exitCode=1;}finally{if(prisma)await prisma.onModuleDestroy();}
'''
def old_services():return run(['docker','ps','-a','--filter','label=com.docker.compose.project=ops','--filter','label=com.docker.compose.project=official-site','--format','{{.ID}} {{.Image}} {{.State}}'])
def snapshot(server,helper,saved,imports):
 rows=server.task_snapshot(helper,saved)
 for task in imports:rows['knowledge_import_task'].pop(task,None)
 return rows

def main(action):
 need(os.geteuid()==0 and OPS.resolve()==OPS,'K01_ROOT_REQUIRED');os.umask(0o077)
 c=current();tag=c['Config']['Image'].partition(':')[2];p,control,release=controls(tag);helper=load('k01_database',p/'database-config.py');saved=helper.read_config(OPS/'.env.prod')
 need(saved.get('HUB_BACKEND_IMAGE')==c['Config']['Image'] and saved.get('HUB_CORE_MANIFEST_SHA256')==CORE and saved.get('HUB_DATABASE_NAME')=='researchhub' and saved.get('DEFAULT_TENANT_ID')=='rh-kb-local-b0e2af9d-tenant','K01_SAVED_TARGET_REJECTED')
 services=old_services()
 if action=='stage':
  need(saved.get('HUB_EXECUTION_PROFILE')=='bounded-hub-chat-v1' and saved.get('HUB_CHAT_ADMISSION_SHA256')==OLD_SHA and saved.get('HUB_PAID_AI_ENABLED')=='true' and saved.get('ENABLED_WORKER_KINDS')=='knowledge-chat','K01_OLD_STATE_REQUIRED')
  need(not STAGE.exists(),'K01_STAGE_ALREADY_EXISTS_NO_RESET');raw=run(['docker','exec','-i','-e','HUB_K01_INPUT='+os.environ['HUB_K01_INPUT'],c['Id'],'node','--input-type=module','-'],NODE);result=json.loads(raw.splitlines()[-1]);need(result.get('status')=='k01-migration-validated','K01_PREPARATION_REJECTED')
  olda=(ROOT/'admission/admission.json').read_bytes();oldl=private(ROOT/'ledger/budget.json',1000);need(sha(olda)==result['previousAdmissionSha'] and sha(oldl)==result['previousLedgerSha'],'K01_FILES_CHANGED_DURING_STAGE')
  STAGE.mkdir(mode=0o700)
  for name,data in [('original-admission.json',olda),('original-budget.json',oldl),('admission.json',result['admissionRaw'].encode()),('budget.json',result['ledgerRaw'].encode())]:exclusive(STAGE/name,data)
  receipt={'tag':tag,'manifestSha256':control['imageManifestSha256'],'admissionSha256':result['admissionSha'],'originalLedgerSha256':result['previousLedgerSha'],'ledgerSha256':sha(result['ledgerRaw'].encode()),'input':json.loads(os.environ['HUB_K01_INPUT']),'oldServices':services}
  exclusive(STAGE/'stage.json',(json.dumps(receipt)+'\n').encode());need(old_services()==services,'K01_OLD_SERVICES_CHANGED')
  print(json.dumps({'status':'k01-extension-staged','tag':tag,'manifestSha256':receipt['manifestSha256'],'admissionSha256':receipt['admissionSha256'],'databaseWrites':0,'modelCalls':0,'workersChanged':False}));return
 receipt=json.loads(private(STAGE/'stage.json'));newa=private(STAGE/'admission.json');newl=private(STAGE/'budget.json');need(sha(newa)==receipt['admissionSha256'] and sha(newl)==receipt['ledgerSha256'],'K01_STAGE_CHANGED')
 if action=='activate':
  need(receipt['tag']==tag and receipt['manifestSha256']==control['imageManifestSha256'],'K01_BRIDGE_CHANGED')
  digest=os.environ.get('HUB_K01_CHECKPOINT_SHA','');need(re.fullmatch('[a-f0-9]{64}',digest),'K01_CHECKPOINT_REQUIRED');p,control,release=controls(tag,digest)
  need(control.get('executionPolicy')=={'profile':'bounded-hub-knowledge-v2','admissionSha256':receipt['admissionSha256']} and control.get('paired') is True,'K01_EXACT_CHECKPOINT_REQUIRED')
  previous_raw=(p/'previous-release.json').read_bytes();need(sha(previous_raw)==control.get('previousManifestSha256') and previous_raw==(p/'runtime-release.json').read_bytes(),'K01_CHECKPOINT_NOT_CURRENT_PAIR')
  need(not (STAGE/'activation.json').exists(),'K01_ACTIVATION_ALREADY_STARTED_RECHECK_REQUIRED')
  need(saved.get('HUB_EXECUTION_PROFILE')=='bounded-hub-chat-v1' and saved.get('HUB_CHAT_ADMISSION_SHA256')==OLD_SHA and sha((ROOT/'admission/admission.json').read_bytes())==OLD_SHA and sha(private(ROOT/'ledger/budget.json',1000))==receipt['originalLedgerSha256'],'K01_ORIGINAL_STATE_CHANGED')
  # Revalidate fixtures and terminal original tasks immediately before switching.
  checked=json.loads(run(['docker','exec','-i','-e','HUB_K01_INPUT='+json.dumps(receipt['input']),c['Id'],'node','--input-type=module','-'],NODE).splitlines()[-1]);need(checked.get('admissionSha')==receipt['admissionSha256'] and checked.get('ledgerRaw','').encode()==newl,'K01_REVALIDATION_CHANGED')
  server=load('k01_runtime',p/'server.py');imports=[b['importTaskId'] for b in receipt['input']['bindings']];before=snapshot(server,helper,saved,imports)
  exclusive(STAGE/'activation.json',(json.dumps({'state':'started','checkpointSha256':digest,'oldServices':services,'historicalTasks':before})+'\n').encode())
  # An interrupted switch is fail-closed. Never restore v1 or erase cumulative rows.
  replace(ROOT/'admission/admission.json',newa,0,1000,0o440);replace(ROOT/'ledger/budget.json',newl,1000,1000,0o600)
  changes={'HUB_EXECUTION_PROFILE':'bounded-hub-knowledge-v2','HUB_CHAT_ADMISSION_SHA256':receipt['admissionSha256'],'HUB_PAID_AI_ENABLED':'true','ENABLED_WORKER_KINDS':'knowledge-chat,knowledge-import'};helper.save_config(OPS/'.env.prod',changes)
  run(['docker','compose','--project-name','researchhub-backend','--env-file',str(OPS/'.env.prod'),'-f',str(p/'backend-compose.yml'),'up','-d','--no-deps','researchhub-api'],timeout=120)
  ready=False
  for _ in range(40):
   if server.api_status()=='401':ready=True;break
   time.sleep(2)
  need(ready,'K01_ACTIVATION_STATE_RECHECK_REQUIRED');need(old_services()==services,'K01_OLD_SERVICES_CHANGED');need(snapshot(server,helper,helper.read_config(OPS/'.env.prod'),imports)==before,'K01_HISTORICAL_TASKS_CHANGED')
  exclusive(STAGE/'activated.json',(json.dumps({'state':'activated','checkpointSha256':digest,'tag':tag,'admissionSha256':receipt['admissionSha256']})+'\n').encode())
 elif action!='inspect':raise ValueError('K01_ACTION_REJECTED')
 live=current();values=dict(line.split('=',1) for line in live['Config']['Env'] if '=' in line);need(values.get('HUB_EXECUTION_PROFILE')=='bounded-hub-knowledge-v2' and values.get('HUB_CHAT_ADMISSION_SHA256')==receipt['admissionSha256'] and values.get('HUB_PAID_AI_ENABLED')=='true' and values.get('ENABLED_WORKER_KINDS')=='knowledge-chat,knowledge-import','K01_LIVE_PROFILE_MISMATCH')
 if action=='inspect' and os.environ.get('HUB_K01_PDF_PREFLIGHT')=='true':
  parsed=json.loads(run(['docker','exec','-i',live['Id'],'node','--input-type=module','-'],PDF_PREFLIGHT).splitlines()[-1]);need(parsed.get('status')=='k01-original-pdfs-readonly-verified','K01_PDF_PREFLIGHT_FAILED');print(json.dumps(parsed))
 need(old_services()==services,'K01_OLD_SERVICES_CHANGED');ledger=json.loads(private(ROOT/'ledger/budget.json',1000));need(ledger['schema']=='hub-chat-budget.v2' and ledger['admissionSha']==receipt['admissionSha256'],'K01_LEDGER_CHANGED')
 print(json.dumps({'status':'k01-runtime-active','tag':tag,'admissionSha256':receipt['admissionSha256'],'modelsEnabled':True,'workerKinds':['knowledge-chat','knowledge-import'],'sessions':len(ledger['sessions']),'jobs':len(ledger['jobs']),'actualRequests':len(ledger['dispatches']),'feeUpperMicros':sum(d.get('feeUpperMicros',d['reservedMicros']) for d in ledger['dispatches']),'oldServicesUnchanged':True,'operatorModelCalls':0,'operatorDatabaseWrites':0,'approvedImportTasks':2}))

def execute(action):
 need(action in ('stage','activate','inspect'),'K01_ACTION_REJECTED');fds=[]
 try:
  for name in ('hub-runtime-release.lock','release.lock'):
   fd=os.open(str(OPS/name),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600);fds.append(fd);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if action=='inspect':main(action)
  else:
   lock=ROOT/'ledger/budget.lock';fd=os.open(str(lock),os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
   try:main(action)
   finally:os.close(fd);lock.unlink()
 finally:
  for fd in fds:os.close(fd)

if __name__=='__main__':
 try:execute(sys.argv[1])
 except Exception as e:
  code=str(e) if re.fullmatch('(?:K01|DATABASE_CONFIG)_[A-Z0-9_]+',str(e)) else 'K01_OPERATION_FAILED_RECHECK_REQUIRED';print(json.dumps({'status':'stopped','code':code,'automaticRetry':False}));raise SystemExit(1)
