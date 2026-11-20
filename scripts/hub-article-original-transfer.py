#!/usr/bin/env python3
"""Transfer only the approved original through the existing Cloud Assistant."""
import base64,hashlib,json,os,pathlib,subprocess,sys,time,zlib
# Exact hash retained independently of the temporary artifact/release name.
SHA='48556afca3235223e18adf8f82b03b46223d34b3af29be13a0b0e01a80944967'
ROOT='/srv/researchhub/ops/article-original-transfer-48556afca323'
def need(ok,code):
 if not ok:raise ValueError(code)
def encode(script):
 data=base64.b64encode(script.encode()).decode();need(len(data)<24000,'ARTICLE_COMMAND_LIMIT');return data
def run(cli,script,label):
 args=[cli,'ecs','RunCommand','--RegionId','cn-hangzhou','--Type','RunShellScript','--ContentEncoding','Base64','--CommandContent',encode(script),'--InstanceId.1',os.environ['ALIYUN_ECS_INSTANCE_ID'],'--Username','root','--Timeout','180','--TerminationMode','ProcessTree','--RepeatMode','Once','--KeepCommand','false','--ClientToken','hub-original-'+os.environ['GITHUB_RUN_ID']+'-'+label,'--Name','hub-approved-original-'+label]
 value=json.loads(subprocess.check_output(args));invoke=value['InvokeId']
 for _ in range(48):
  value=json.loads(subprocess.check_output([cli,'ecs','DescribeInvocationResults','--RegionId','cn-hangzhou','--InvokeId',invoke,'--InstanceId',os.environ['ALIYUN_ECS_INSTANCE_ID'],'--ContentEncoding','Base64']))
  rows=value.get('Invocation',{}).get('InvocationResults',{}).get('InvocationResult',[])
  if rows and rows[0].get('InvocationStatus') not in ['Pending','Running','Scheduled','Stopping']:
   row=rows[0];output=base64.b64decode(row.get('Output','')).decode('utf8','replace');print(output,flush=True);need(row.get('InvocationStatus')=='Success' and row.get('ExitCode')==0,'ARTICLE_COMMAND_FAILED');return
  time.sleep(5)
 raise ValueError('ARTICLE_COMMAND_TIMEOUT')
def main():
 cli,source=sys.argv[1:];compressed=pathlib.Path(source).read_bytes();raw=zlib.decompress(compressed);need(len(raw)==150195 and hashlib.sha256(raw).hexdigest()==SHA,'ARTICLE_PAYLOAD_REJECTED');chunks=[compressed[i:i+10000] for i in range(0,len(compressed),10000)];need(len(chunks)==4,'ARTICLE_CHUNKS_REJECTED')
 node=pathlib.Path('scripts/hub-article-original-restore.mjs').read_text()
 scripts=[]
 scripts.append(('prepare',"python3 - <<'PY_ORIGINAL'\nimport os,pathlib\np=pathlib.Path("+repr(ROOT)+");p.mkdir(mode=0o700,exist_ok=False)\nprint('{\"status\":\"original-transfer-prepared\"}')\nPY_ORIGINAL\n"))
 for i,chunk in enumerate(chunks):
  script="python3 - <<'PY_ORIGINAL'\nimport pathlib,base64\np=pathlib.Path("+repr(ROOT+'/part'+str(i))+ ");raw=base64.b64decode("+repr(base64.b64encode(chunk).decode())+")\nwith p.open('xb') as f:f.write(raw)\np.chmod(0o600)\nprint('{\"status\":\"original-chunk-written\",\"part\":'+str("+str(i)+")+'}')\nPY_ORIGINAL\n";scripts.append(('part'+str(i),script))
 apply="""import base64,hashlib,json,pathlib,re,subprocess,zlib
root=pathlib.Path(ROOT)
raw=zlib.decompress(b''.join((root/('part'+str(i))).read_bytes() for i in range(4)))
assert len(raw)==150195 and hashlib.sha256(raw).hexdigest()==SHA
ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api'],universal_newlines=True).splitlines()
assert len(ids)==1 and re.fullmatch('[a-f0-9]{12,64}',ids[0])
before=subprocess.check_output(['docker','ps','--format','{{.ID}} {{.Image}}'])
result=subprocess.run(['docker','exec','-i','-w','/opt/researchhub/hub',ids[0],'node','--input-type=module','-e',NODE],input=raw,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=150)
print(result.stdout.decode('utf8','replace'))
assert result.returncode==0
last=json.loads(result.stdout.decode().splitlines()[-1]);assert last['status']=='article-original-restored'
assert subprocess.check_output(['docker','ps','--format','{{.ID}} {{.Image}}'])==before
for i in range(4):(root/('part'+str(i))).unlink()
root.rmdir()
print('{"status":"original-transfer-cleaned","containerIdentitiesUnchanged":true}')
"""
 apply='ROOT='+repr(ROOT)+'\nSHA='+repr(SHA)+'\nNODE='+repr(node)+'\n'+apply
 scripts.append(('apply',"python3 - <<'PY_ORIGINAL'\n"+apply+"\nPY_ORIGINAL\n"))
 for _,script in scripts:encode(script)
 if os.environ.get('ARTICLE_TRANSFER_DRY_RUN')=='true':print(json.dumps({'status':'prepared','commands':len(scripts),'bytes':len(raw),'sha256':SHA,'maxCommandBytes':max(len(encode(s)) for _,s in scripts)}));return
 for label,script in scripts:run(cli,script,label)
if __name__=='__main__':
 try:main()
 except Exception as error:
  code=str(error) if isinstance(error,ValueError) and str(error).startswith('ARTICLE_') else 'ARTICLE_TRANSFER_FAILED'
  print(json.dumps({'status':'stopped','code':code,'automaticRetry':False}));raise SystemExit(1)
