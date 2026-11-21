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
