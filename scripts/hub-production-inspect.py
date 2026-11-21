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
events=run('docker','events','--since','2026-11-21T08:23:30Z','--until','2026-11-21T08:24:00Z','--filter','container='+parser,'--format','{{json .}}')
for line in events.splitlines():
 try:
  event=json.loads(line)
  print(json.dumps({'event':event['Action'],'exitCode':event['Actor']['Attributes'].get('exitCode')}))
 except (ValueError,KeyError):
  pass
kernel=run('journalctl','-k','--since','2026-11-21 08:23:30 UTC','--until','2026-11-21 08:24:00 UTC','--no-pager','-o','cat').lower()
print(json.dumps({'kernelOOM':len(re.findall('oom-kill|out of memory|killed process',kernel)),'kernelSegfault':kernel.count('segfault'),'parserLogFatal':{x:logs.lower().count(x) for x in ['fatal','segmentation','sigkill','sigsegv','bus error','signal','error']}}))
