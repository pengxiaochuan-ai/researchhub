import json,subprocess,re
def run(*args):return subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,universal_newlines=True,timeout=20).stdout
def cid(service):
 value=run('docker','ps','-aq','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service='+service).strip()
 assert re.fullmatch('[a-f0-9]{12,64}',value)
 return value
api=cid('researchhub-api')
parser=cid('researchhub-doc-parser')
state=json.loads(run('docker','inspect',parser))[0]
s=state['State']
js="""const u=process.env.KB_DOC_PARSER_URL;try{const r=await fetch(u.replace(/\\/$/,'')+'/health',{signal:AbortSignal.timeout(8000)});console.log(JSON.stringify({http:r.status}));}catch(e){console.log(JSON.stringify({error:e.cause?.code??e.name}));}"""
logs=run('docker','logs','--since','2026-11-21T08:22:25Z','--until','2026-11-21T08:24:00Z','--tail','100',parser)
print(json.dumps({'parser':{k:s[k] for k in ['Status','OOMKilled','ExitCode','StartedAt','FinishedAt']},'restartCount':state['RestartCount'],'memoryLimit':state['HostConfig']['Memory'],'apiToParser':json.loads(run('docker','exec',api,'node','--input-type=module','-e',js).strip()),'logSignals':{x:logs.lower().count(x) for x in ['killed','memoryerror','startup complete','shutting down','422','200 ok','traceback']},'databaseWrites':0,'modelCalls':0}))
events=run('docker','events','--since','48h','--until','1s','--filter','container='+parser,'--format','{{json .}}')
for line in events.splitlines()[-40:]:
 try:
  event=json.loads(line)
  if event['Action'] in ('oom','die','start','restart','kill'):print(json.dumps({'event':event['Action'],'time':event['time'],'exitCode':event['Actor']['Attributes'].get('exitCode')}))
 except (ValueError,KeyError):
  pass
actual=run('docker','exec',parser,'sha256sum','/app/knowledge/parser.py').split()[0]
print(json.dumps({'parserSha256':actual if re.fullmatch('[a-f0-9]{64}',actual) else None,'image':state['Config']['Image']}))
kernel=run('journalctl','-k','--since','2026-11-22 05:31:50 UTC','--until','2026-11-22 05:32:25 UTC','--no-pager','-o','cat')
full_id=state['Id']
print(json.dumps({'oomLines':sum('oom-kill' in l.lower() or 'killed process' in l.lower() for l in kernel.splitlines()),'parserCgroupOOM':any(full_id in l and ('oom' in l.lower() or 'killed process' in l.lower()) for l in kernel.splitlines()),'segfaultLines':kernel.lower().count('segfault'),'kernelLogAvailable':bool(kernel.strip())}))
