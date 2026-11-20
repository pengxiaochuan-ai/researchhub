#!/usr/bin/env python3
"""Pinned fourteen-object transport; only temporary parts are concurrent."""
import base64,hashlib,importlib.util,json,os,pathlib,subprocess,sys,zlib,concurrent.futures
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('single',str(HERE/'hub-article-original-transfer.py'));single=importlib.util.module_from_spec(spec);spec.loader.exec_module(single)
ROOT='/srv/researchhub/ops/approved-originals-transfer-20261120'
def need(ok,code):
 if not ok:raise ValueError(code)
def main():
 cli,path=sys.argv[1:];m=json.loads((HERE/'hub-approved-originals-20261120.json').read_text());compressed=pathlib.Path(path).read_bytes();need(m['count']==14 and m['totalBytes']==2284075 and m['protectedExisting']=='pmc-PMC13691533','ORIGINALS_MANIFEST_REJECTED');need(len(compressed)==m['payloadBytes'] and hashlib.sha256(compressed).hexdigest()==m['payloadSha256'],'ORIGINALS_COMPRESSED_REJECTED');raw=zlib.decompress(compressed);need(len(raw)==m['decodedPayloadBytes'],'ORIGINALS_LENGTH_REJECTED');payload=json.loads(raw);need(len(payload)==14 and set(payload)==set(r['id'] for r in m['objects']),'ORIGINALS_SCOPE_REJECTED')
 for r in m['objects']:
  body=base64.b64decode(payload[r['id']],validate=True);need(len(body)==r['bytes'] and hashlib.sha256(body).hexdigest()==r['sha256'],'ORIGINALS_BYTES_REJECTED')
 chunks=[compressed[i:i+10000] for i in range(0,len(compressed),10000)];need(len(chunks)==69,'ORIGINALS_CHUNK_COUNT_REJECTED');scripts=[]
 prepare="python3 - <<'PY_ORIGINALS'\nimport pathlib\np=pathlib.Path("+repr(ROOT)+");p.mkdir(mode=0o700,exist_ok=False)\nprint('{\"status\":\"approved-originals-transfer-prepared\"}')\nPY_ORIGINALS\n"
 for i,b in enumerate(chunks):
  script="python3 - <<'PY_ORIGINALS'\nimport pathlib,base64\np=pathlib.Path("+repr(ROOT+'/part'+str(i))+");b=base64.b64decode("+repr(base64.b64encode(b).decode())+")\nwith p.open('xb') as f:f.write(b)\np.chmod(0o600)\nprint('{\"status\":\"approved-originals-part\",\"part\":'+str("+str(i)+")+'}')\nPY_ORIGINALS\n";scripts.append(('part'+str(i),script))
 node=(HERE/'hub-approved-originals-restore.mjs').read_text()
 apply="""import hashlib,json,pathlib,re,subprocess,zlib
root=pathlib.Path(ROOT)
compressed=b''.join((root/('part'+str(i))).read_bytes() for i in range(69))
assert len(compressed)==680963 and hashlib.sha256(compressed).hexdigest()==COMPRESSED_SHA
raw=zlib.decompress(compressed);assert len(raw)==3045747
ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=researchhub-backend','--filter','label=com.docker.compose.service=researchhub-api'],universal_newlines=True).splitlines();assert len(ids)==1 and re.fullmatch('[a-f0-9]{12,64}',ids[0])
before=subprocess.check_output(['docker','ps','--format','{{.ID}} {{.Image}}'])
r=subprocess.run(['docker','exec','-i','-w','/opt/researchhub/hub',ids[0],'node','--input-type=module','-e',NODE],input=raw,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=150)
print(r.stdout.decode('utf8','replace'));assert r.returncode==0
result=json.loads(r.stdout.decode().splitlines()[-1]);assert result['status']=='approved-originals-restored' and len(result['objects'])==14
assert subprocess.check_output(['docker','ps','--format','{{.ID}} {{.Image}}'])==before
for i in range(69):(root/('part'+str(i))).unlink()
root.rmdir();print('{"status":"approved-originals-transfer-cleaned","containerIdentitiesUnchanged":true}')
"""
 apply='ROOT='+repr(ROOT)+'\nCOMPRESSED_SHA='+repr(m['payloadSha256'])+'\nNODE='+repr(node)+'\n'+apply;apply="python3 - <<'PY_ORIGINALS'\n"+apply+"\nPY_ORIGINALS\n"
 for s in [prepare,apply]+[s for _,s in scripts]:single.encode(s)
 if os.environ.get('ARTICLE_TRANSFER_DRY_RUN')=='true':print(json.dumps({'status':'approved-originals-prepared','objects':14,'totalBytes':2284075,'commands':len(scripts)+2,'maxCommandBytes':max(len(single.encode(s)) for s in [prepare,apply]+[s for _,s in scripts])}));return
 single.run(cli,prepare,'prepare')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
  futures=[executor.submit(single.run,cli,s,label) for label,s in scripts]
  for future in concurrent.futures.as_completed(futures):future.result()
 single.run(cli,apply,'apply')
if __name__=='__main__':
 try:main()
 except Exception as error:
  code=str(error) if isinstance(error,ValueError) and str(error).startswith(('ARTICLE_','ORIGINALS_')) else 'ORIGINALS_TRANSFER_FAILED'
  print(json.dumps({'status':'stopped','code':code,'automaticRetry':False}));raise SystemExit(1)
