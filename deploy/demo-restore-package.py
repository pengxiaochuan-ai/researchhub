#!/usr/bin/env python3
"""Build only a private ignored handoff; no database or network access."""
import hashlib,importlib.util,json,os,pathlib,shutil,sys
HERE=pathlib.Path(__file__).resolve().parent

def load(name,file):
    s=importlib.util.spec_from_file_location(name,str(file));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def build(snapshot,original,output):
    data=load('data',HERE/'demo-restore-data.py');base=load('base',HERE/'manual-rds-server.py')
    snapshot=pathlib.Path(snapshot).resolve();original=pathlib.Path(original).resolve();output=pathlib.Path(output).resolve()
    data.demand(str(output).startswith(str(HERE.parent/'.tmp')+'/') and not output.exists(),'OUTPUT_MUST_BE_NEW_PRIVATE_TMP')
    base.verify_package(original);manifest=data.source_manifest(snapshot/'manifest.json');expected=data.inspect_data(snapshot,manifest)
    output.mkdir(mode=0o700);(output/'data').mkdir(mode=0o700)
    for item in json.loads((original/'manifest.json').read_text())['files']:
        shutil.copyfile(str(original/item['file']),str(output/item['file']));(output/item['file']).chmod(0o600)
    for t in manifest['tables']:
        shutil.copyfile(str(data.safe_file(snapshot,t['file'])),str(output/'data'/t['file']));(output/'data'/t['file']).chmod(0o600)
    shutil.copyfile(str(snapshot/'manifest.json'),str(output/'source-manifest.json'))
    for source,target in [('demo-restore-data.py','demo-restore-data.py'),('demo-restore-server.py','restore-demo.py')]:shutil.copyfile(str(HERE/source),str(output/target))
    (output/'数据恢复说明.md').write_text((HERE.parent/'docs/technical/manual-rds-demo-restore-2026-11-19.md').read_text(),encoding='utf-8')
    (output/'数据恢复验证.md').write_text((HERE.parent/'docs/testing/manual-rds-demo-restore-2026-11-19.md').read_text(),encoding='utf-8')
    (output/'README.txt').write_text('已完成00–04后，只运行restore-demo.py，不重跑run-server.py all。\npython3 restore-demo.py check\npython3 restore-demo.py run\npython3 restore-demo.py accounts\n仅新researchhub库；原既有VPC连接配置。check不连DB。详见数据恢复说明.md。\n本包包含已批准的合成演示数据，只能私有传输，禁止Git/公开下载。旧manifest.dataIncluded=false保留00–04执行器契约；demoDataIncluded=true明确本包带独立data目录。\n',encoding='utf-8')
    receipt=json.loads((original/'manifest.json').read_text());receipt['demoDataIncluded']=True;receipt['expectedRows']=98565
    receipt['files']=[]
    for p in sorted(output.iterdir()):
        if p.is_file():
            p.chmod(0o600);raw=p.read_bytes();receipt['files'].append({'file':p.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    (output/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n');(output/'manifest.json').chmod(0o600)
    sums=[x['sha256']+'  '+x['file'] for x in receipt['files']]
    sums+=[t['sha256']+'  data/'+t['file'] for t in manifest['tables']]
    sums+=[hashlib.sha256((output/'manifest.json').read_bytes()).hexdigest()+'  manifest.json']
    (output/'SHA256SUMS').write_text('\n'.join(sums)+'\n');(output/'SHA256SUMS').chmod(0o600)
    base.verify_package(output)
    return {'directory':str(output),'tables':len(expected),'rows':98565,'dataBytes':sum(t['bytes'] for t in manifest['tables']),'remoteWrites':0}

if __name__=='__main__':
    if len(sys.argv)!=4:raise SystemExit('Usage: demo-restore-package.py FROZEN_SNAPSHOT ORIGINAL_SQL_PACKAGE NEW_PRIVATE_OUTPUT')
    print(json.dumps(build(*sys.argv[1:])))
