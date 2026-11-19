#!/usr/bin/env python3
"""Plan against successful component provenance; never execute database changes."""
import argparse,hashlib,json,pathlib,re,subprocess,os,ast

def release_tag(revision,run_id,attempt):
 if not re.fullmatch('[a-f0-9]{40}',revision) or not str(run_id).isdigit() or not 1<=int(attempt)<=999:raise ValueError('HUB_RELEASE_TAG_INPUT_REJECTED')
 return 'hub-runtime-'+revision[:8]+'-'+str(int(run_id)*1000+int(attempt))

def database_path(path):
 p=pathlib.PurePosixPath(path)
 return p.suffix in ('.sql','.prisma') or 'migrations' in p.parts or bool(re.search(r'(?:^|[-_])(ddl|schema|migration|guard)(?:[-_.]|$)',p.name)) and p.suffix in ('.sql','.mjs','.py','.json')

def classify(paths):
 result={'frontend':False,'backend':False,'database':False}
 for path in paths:
  p=pathlib.PurePosixPath(path)
  if path.startswith(('tests/','docs/test/','docs/testing/')) or re.search(r'\.(?:test|spec)\.[^.]+$',p.name):continue
  if database_path(path):result.update(frontend=True,backend=True,database=True);continue
  if path.startswith('docs/') and not path.startswith('docs/reference/'):continue
  if p.suffix=='.md' and not path.startswith(('skill/','integrations/','docs/reference/')):continue
  if path in ('server/static.mjs','server/api-proxy.mjs') or path.startswith(('pages/','public/')) and path!='pages/h01/src/china.json' or path in ('index.html','platform-pages.json','Dockerfile','.dockerignore') or p.name.startswith(('vite.config.','tailwind.config.','postcss.config.')):result['frontend']=True
  elif path.startswith('server/') or path=='deploy/backend.Dockerfile':result['backend']=True
  else:result.update(frontend=True,backend=True)
 return result

def component_base(previous,kind):
 value=previous.get('components',{}).get(kind,{}).get('sourceGit') or previous.get('controlGit','')
 if not re.fullmatch('[a-f0-9]{40}',value):raise ValueError('HUB_RELEASE_BASE_GIT_REQUIRED')
 return value

def git(*args):return subprocess.check_output(['git',*args]).decode()

def changed(base,revision):
 for ref in (base,revision):
  if not re.fullmatch('[a-f0-9]{40}',ref):raise ValueError('HUB_RELEASE_GIT_REJECTED')
 return [x for x in git('diff','--no-renames','--name-only','-z',base,revision,'--').split('\0') if x]


def tree(revision):
 return {row.split('\t',1)[1]:row.split('\t',1)[0].split()[-1] for row in git('ls-tree','-r','-z',revision).split('\0') if row}

def production_source(path):
 return not (path=='scripts/hub-release-rehearsal.py' or path.startswith(('tests/','docs/testing/','docs/test/','scripts/fixtures/')) or re.search(r'\.(?:test|spec)\.[^.]+$',path))

def embedded_ddl(text,path):
 ddl=re.compile(r"\b(?:(?:CREATE|ALTER|DROP)\s+(?:(?:OR\s+REPLACE|TEMP(?:ORARY)?|UNLOGGED|UNIQUE|CONCURRENTLY|IF\s+NOT\s+EXISTS)\s+)*(?:TABLE|SCHEMA|TYPE|FUNCTION|EXTENSION|INDEX|POLICY|TRIGGER|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|ROLE|USER|DATABASE|PROCEDURE|AGGREGATE|RULE|OPERATOR|COLLATION|DOMAIN|TABLESPACE|PUBLICATION|SUBSCRIPTION|SERVER|FOREIGN\s+(?:TABLE|DATA\s+WRAPPER)|STATISTICS|EVENT\s+TRIGGER|TRANSFORM|LANGUAGE|ACCESS\s+METHOD)\b|(?:GRANT|REVOKE|TRUNCATE|COMMENT\s+ON)\s+)",re.I)
 if path.endswith('.py'):
  try:text='\n'.join(n.value for n in ast.walk(ast.parse(text)) if isinstance(n,ast.Constant) and isinstance(n.value,str))
  except SyntaxError:pass
 return bool(ddl.search(text))

def make_plan(previous,revision,approval=''):
 flags={kind:classify(changed(component_base(previous,kind),revision))[kind] for kind in ('frontend','backend')}
 last=previous.get('releaseGit') or previous['controlGit'];old_tree=tree(last);new_tree=tree(revision);known=set(previous.get('databaseSources',[]))
 paths=[path for path in set(old_tree)|set(new_tree) if old_tree.get(path)!=new_tree.get(path) and production_source(path)]
 # Inspect only modified modules; do not scan/fetch the whole repository for DDL.
 for path in paths:
  if path.endswith(('.mjs','.js','.ts','.py')) and not path.startswith('docs/'):
   for ref,entries in ((last,old_tree),(revision,new_tree)):
    if path in entries and embedded_ddl(git('show',ref+':'+path),path):known.add(path);break
 sources=sorted(known|{path for path in set(old_tree)|set(new_tree) if production_source(path) and database_path(path)})
 db_paths=sorted(path for path in paths if path in sources)
 digest=hashlib.sha256(json.dumps([[path,new_tree.get(path,'deleted')] for path in sources],separators=(',',':')).encode()).hexdigest()
 if db_paths:flags.update(frontend=True,backend=True)
 return {'schema':'researchhub-release-plan.v1','releaseGit':revision,'baselineTag':previous['tag'],'build':flags,'databaseChanged':bool(db_paths),'databasePaths':db_paths,'databaseSources':sources,'databaseDigest':digest,'databaseApproved':not db_paths or approval==digest,'releaseRequired':any(flags.values()),'databaseMigrationExecuted':False}

def main():
 p=argparse.ArgumentParser();p.add_argument('--previous',required=True);p.add_argument('--revision',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 plan=make_plan(json.loads(pathlib.Path(a.previous).read_text()),a.revision,os.environ.get('HUB_DATABASE_APPROVED_DIGEST',''));pathlib.Path(a.output).write_text(json.dumps(plan,indent=2)+'\n')
 print(json.dumps(plan))
 if not plan['databaseApproved']:raise ValueError('HUB_DATABASE_SEPARATE_APPROVAL_REQUIRED')
 if os.environ.get('GITHUB_OUTPUT'):
  with open(os.environ['GITHUB_OUTPUT'],'a') as f:
   for key,value in plan['build'].items():f.write(key+'='+str(value).lower()+'\n')
   f.write('release_required='+str(plan['releaseRequired']).lower()+'\n')
if __name__=='__main__':main()
