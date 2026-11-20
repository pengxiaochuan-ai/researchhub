#!/usr/bin/env python3
"""Manual frozen demo restore; only researchhub. Python 3.6+, stdlib + existing libpq."""
import argparse
import ctypes
import ctypes.util
import fcntl
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import threading

HERE=pathlib.Path(__file__).resolve().parent

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,str(path));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

base=module('rds_base',HERE/('run-server.py' if (HERE/'run-server.py').exists() else 'manual-rds-server.py'))
data=module('rds_data',HERE/'demo-restore-data.py')
LOCK="DO $lock$ BEGIN IF NOT pg_try_advisory_xact_lock(hashtextextended('researchhub-demo-install',0)) THEN RAISE EXCEPTION 'MANUAL_ANOTHER_INSTALL_ACTIVE'; END IF; END $lock$;"

def lock_sql(sql):
    base.require(sql.count('\nBEGIN;')==1 or sql.startswith('BEGIN;'),'SQL_TRANSACTION_INVALID')
    return sql.replace('BEGIN;','BEGIN;\n'+LOCK,1)

def guard(state):
    return """DO $guard$ DECLARE m jsonb; BEGIN
 IF current_database()<>'researchhub' OR current_user<>'aisci_control' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE_OR_OPERATOR'; END IF;
 IF (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'researchhub_demo_owner' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE_OWNER'; END IF;
 SELECT shobj_description(oid,'pg_database')::jsonb INTO m FROM pg_database WHERE datname=current_database();
 IF m->>'purpose' IS DISTINCT FROM 'researchhub-manual-demo' OR m->>'syntheticOnly' IS DISTINCT FROM 'true' OR m->>'sourceSchemaSha256' IS DISTINCT FROM '%s' OR m->>'state' IS DISTINCT FROM '%s' THEN RAISE EXCEPTION 'MANUAL_STAGE_OR_SOURCE_MISMATCH'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND rolbypassrls=(rolname='researchhub_demo_owner'))<>4 THEN RAISE EXCEPTION 'MANUAL_ROLE_STATE_INVALID_STOP'; END IF;
END $guard$;\n"""%(data.SOURCE_SHA,state)

def counts_sql(manifest,empty=False):
    chunks=['DO $counts$ DECLARE n bigint; BEGIN\n']
    for t in manifest['tables']:
        chunks.append('SELECT count(*) INTO n FROM '+data.qualified(t)+'; IF n<>'+str(0 if empty else t['rows'])+" THEN RAISE EXCEPTION '"+('MANUAL_RESTORE_TARGET_NOT_EMPTY' if empty else 'MANUAL_DATA_COUNT_MISMATCH')+"'; END IF;\n")
    chunks.append('END $counts$;\n');return ''.join(chunks)

def import_start(manifest):
    return 'BEGIN;\n'+LOCK+"\nSET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='10min';\nSET LOCAL idle_in_transaction_session_timeout='2min';\nSET LOCAL standard_conforming_strings=on;\nSET LOCAL timezone='UTC';\n"+guard('pre-data-complete')+'SET LOCAL ROLE researchhub_demo_owner;\n'+counts_sql(manifest,True)

def import_end(manifest):
    marker={'purpose':'researchhub-manual-demo','syntheticOnly':True,'sourceSchemaSha256':data.SOURCE_SHA,'sourceManifestSha256':data.MANIFEST_SHA,'state':'pre-data-complete','dataLoaded':True}
    return counts_sql(manifest)+"DO $tenant$ BEGIN IF (SELECT count(*) FROM public.tenant)<>1 OR (SELECT count(*) FROM public.tenant WHERE id='"+data.TENANT+"')<>1 THEN RAISE EXCEPTION 'MANUAL_SYNTHETIC_TENANT_MISMATCH'; END IF; END $tenant$;\nCOMMENT ON DATABASE researchhub IS "+data.literal(json.dumps(marker,separators=(',',':')))+';\nCOMMIT;\n'

LIVE="""BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SELECT json_build_object('database',current_database(),'operator',current_user,'version',current_setting('server_version_num')::int,
'owner',pg_get_userbyid(datdba),'marker',shobj_description(oid,'pg_database')::json,
'vector',(SELECT extversion FROM pg_extension WHERE extname='vector'),
'roles',(SELECT json_agg(json_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,'replication',rolreplication,'bypass',rolbypassrls,'canSet',pg_has_role(current_user,oid,'SET'))) FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector')),
'memberships',(SELECT count(*) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE r.rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector')),
 'tables',(SELECT json_agg(json_build_object('schema',n.nspname,'table',c.relname,'columns',(SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR n.nspname LIKE 'rh_%')))
FROM pg_database WHERE datname=current_database();
COMMIT;
"""

def validate(live,manifest,activated=False):
    base.require(live.get('database')=='researchhub' and live.get('operator')=='aisci_control' and live.get('owner')==base.ROLES[0],'LIVE_TARGET_MISMATCH')
    base.require(live.get('version',0)//10000==base.EXPECTED_SERVER_MAJOR and live.get('vector')==base.EXPECTED_VECTOR_VERSION,'LIVE_SERVER_OR_VECTOR_MISMATCH')
    marker=live.get('marker') or {}
    base.require(marker.get('purpose')=='researchhub-manual-demo' and marker.get('syntheticOnly') is True and marker.get('sourceSchemaSha256')==data.SOURCE_SHA and marker.get('state') in ('pre-data-complete','post-data-complete'),'LIVE_SOURCE_OR_STAGE_MISMATCH')
    if marker.get('state')=='pre-data-complete' and marker.get('dataLoaded'):
        base.require(marker.get('sourceManifestSha256')==data.MANIFEST_SHA,'LIVE_DATA_SOURCE_MISMATCH')
    roles=live.get('roles') or []
    base.require(len(roles)==4 and set(r['name'] for r in roles)==set(base.ROLES) and live.get('memberships')==0,'LIVE_ROLE_SET_MISMATCH')
    for r in roles:
        base.require(not any(r.get(k) for k in ('super','createdb','createrole','inherit','replication')) and r.get('bypass')==(r['name']==base.ROLES[0]) and r.get('canSet') is True and r.get('login')==(activated and r['name'] in base.ROLES[:2]),'LIVE_ROLE_STATE_MISMATCH')
    expected={(t['schema'],t['table']):t['columns'] for t in manifest['tables']}
    actual={(t['schema'],t['table']):t['columns'] for t in live.get('tables') or []}
    base.require(expected==actual and len(actual)==182,'LIVE_TABLE_INVENTORY_MISMATCH')
    return marker

def deadline(proc,seconds):
    expired=threading.Event()
    def stop():
        expired.set()
        try:proc.kill()
        except ProcessLookupError:pass
    timer=threading.Timer(seconds,stop);timer.daemon=True;timer.start();return timer,expired

def run_sql(binary,cfg,env,sql,log,timeout=1800):
    # SQL/row data/verifiers never enter logs; only the safe status/error identifier.
    args=base.client_args(binary,cfg,'researchhub')+['-v','VERBOSITY=terse']
    err=tempfile.TemporaryFile();out=tempfile.TemporaryFile()
    proc=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=out,stderr=err,env=env)
    timer,expired=deadline(proc,timeout)
    try:
        try:
            for chunk in ([sql] if isinstance(sql,str) else sql):proc.stdin.write(chunk.encode('utf-8'))
            proc.stdin.close()
        except BrokenPipeError:pass
        code=proc.wait();base.require(not expired.is_set(),'CLIENT_DEADLINE_EXCEEDED_RECHECK_STATE');err.seek(0);error=err.read().decode('utf-8','replace');out.seek(0);result=out.read().decode('utf-8')
        found=re.search(r'\bMANUAL_[A-Z_]+\b',error)
        safe=found.group(0) if found else 'PSQL_FAILED_RECHECK_STATE'
        if log:base.save_private(log,json.dumps({'ok':code==0,'code':None if code==0 else safe})+'\n')
        base.require(code==0,safe);return result
    finally:
        timer.cancel()
        if proc.poll() is None:proc.kill();proc.wait()
        if proc.stdin and not proc.stdin.closed:
            try:proc.stdin.close()
            except BrokenPipeError:pass
        out.close();err.close()

def import_chunks(package,manifest):
    yield import_start(manifest)
    for t in manifest['tables']:
        rows=[];size=0
        with data.safe_file(package/'data',t['file']).open('rb') as source:
            for raw in source:
                mapped=data.mapped_row(t,raw);rows.append(mapped);size+=len(mapped)
                if len(rows)>=100 or size>=1024*1024:
                    yield data.insert_sql(t,rows);rows=[];size=0
        if rows:yield data.insert_sql(t,rows)
    yield import_end(manifest)

def verify_contents(binary,cfg,env,manifest,expected,temporary,timeout=1800):
    # One stable snapshot, no stdout row logging and no float conversion.
    query="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='10min'; SET LOCAL timezone='UTC'; SET LOCAL ROLE researchhub_demo_owner;\n"
    for i,t in enumerate(manifest['tables']):
        query+="SELECT '@@RH_TABLE:"+str(i)+"';\nSELECT row_to_json(r) FROM (SELECT "+','.join(data.ident(x) for x in t['columns'])+' FROM '+data.qualified(t)+') r;\n'
    query+='COMMIT;\n';sqlfile=temporary/'verify.sql';base.save_private(sqlfile,query)
    err=tempfile.TemporaryFile();proc=subprocess.Popen(base.client_args(binary,cfg,'researchhub')+['-v','VERBOSITY=terse','--file',str(sqlfile)],stdout=subprocess.PIPE,stderr=err,env=env)
    timer,expired=deadline(proc,timeout)
    results=[];current=None;hashes=[]
    try:
        for line in proc.stdout:
            if line.startswith(b'@@RH_TABLE:'):
                if current is not None:results.append({'schema':manifest['tables'][current]['schema'],'table':manifest['tables'][current]['table'],'rows':len(hashes),'sha256':data.table_hash(hashes)})
                current=int(line.strip().split(b':')[1]);base.require(current==len(results),'CONTENT_STREAM_ORDER_INVALID');hashes=[]
            else:
                base.require(current is not None,'CONTENT_STREAM_INVALID');hashes.append(data.row_hash(line))
        if current is not None:results.append({'schema':manifest['tables'][current]['schema'],'table':manifest['tables'][current]['table'],'rows':len(hashes),'sha256':data.table_hash(hashes)})
        code=proc.wait()
        base.require(not expired.is_set(),'CLIENT_DEADLINE_EXCEEDED_RECHECK_STATE')
        base.require(code==0,'CONTENT_QUERY_FAILED')
        base.require(results==expected,'CONTENT_HASH_MISMATCH_STOP')
        return {'tables':len(results),'rows':sum(t['rows'] for t in results),'contentMatch':True}
    finally:
        timer.cancel()
        if proc.poll() is None:proc.kill();proc.wait()
        proc.stdout.close();err.close();sqlfile.unlink()

def validate_passwords(owner,app):
    base.require(len(owner)>=32 and len(app)>=32 and owner!=app and all(ord(c)>=32 and ord(c)!=127 for c in owner+app),'TWO_DISTINCT_32_CHARACTER_PASSWORDS_REQUIRED')

def verifier(password,user,library=None):
    lib=ctypes.CDLL(library or ctypes.util.find_library('pq') or 'libpq.so.5')
    lib.PQconnectStart.argtypes=[ctypes.c_char_p];lib.PQconnectStart.restype=ctypes.c_void_p
    lib.PQencryptPasswordConn.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_char_p,ctypes.c_char_p];lib.PQencryptPasswordConn.restype=ctypes.c_void_p
    lib.PQfreemem.argtypes=[ctypes.c_void_p];lib.PQfinish.argtypes=[ctypes.c_void_p]
    # Native function needs a PGconn for its error buffer. This fixed nonexistent
    # local Unix socket cannot contact RDS; explicit algorithm requires no query.
    conn=lib.PQconnectStart(b'host=/nonexistent-researchhub-scram port=1 connect_timeout=1')
    base.require(bool(conn),'LIBPQ_CONTEXT_FAILED')
    try:
        ptr=lib.PQencryptPasswordConn(conn,password.encode(),user.encode(),b'scram-sha-256')
        base.require(bool(ptr),'LIBPQ_PASSWORD_FAILED')
        try:result=ctypes.string_at(ptr).decode('ascii')
        finally:lib.PQfreemem(ptr)
        base.require(result.startswith('SCRAM-SHA-256$'),'LIBPQ_PASSWORD_FORMAT_INVALID');return result
    finally:lib.PQfinish(conn)

def post_checks(binary,cfg,env):
    sql="""BEGIN READ ONLY; SELECT json_build_object('tables',count(*),'forced',count(*) FILTER(WHERE c.relrowsecurity AND c.relforcerowsecurity),'policies',(SELECT count(*) FROM pg_policy p JOIN pg_class pc ON pc.oid=p.polrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace WHERE pn.nspname='public' OR pn.nspname LIKE 'rh_%'),'invalidIndexes',(SELECT count(*) FROM pg_index WHERE NOT indisvalid),'notValid',(SELECT json_agg(conname ORDER BY conname) FROM pg_constraint WHERE NOT convalidated)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR n.nspname LIKE 'rh_%'); COMMIT;"""
    actual=json.loads(run_sql(binary,cfg,env,sql,None))
    base.require(actual=={'tables':182,'forced':179,'policies':209,'invalidIndexes':0,'notValid':['study_task_blocked_reason_check','study_task_priority_check','subject_visit_anchor_schedule_check']},'POST_DATA_STRUCTURE_MISMATCH')
    return actual

def run(args):
    package=pathlib.Path(args.package).resolve();base.verify_package(package)
    manifest=data.source_manifest(data.safe_file(package,'source-manifest.json'))
    base.require(not (package/'data').is_symlink() and (package/'data').is_dir(),'DATA_DIRECTORY_INVALID')
    expected=data.inspect_data(package/'data',manifest)
    print(json.dumps({'check':'ok','tables':182,'rows':98565,'dataHashVerified':True,'databaseConnected':False}),flush=True)
    if args.stage=='check':return
    binary=shutil.which(args.psql);base.require(binary,'PSQL_NOT_INSTALLED')
    version=subprocess.check_output([binary,'--version'],timeout=10).decode();base.client_major(version)
    cfg=base.load_config(pathlib.Path(args.config))
    # User authorized existing private VPC settings; no source config mutation.
    base.require(cfg['sslmode']=='disable','EXISTING_CONNECTION_MODE_CHANGED_STOP')
    logs=package/'.restore-run'
    if logs.exists():base.require(not logs.is_symlink() and logs.is_dir() and logs.stat().st_mode&0o077==0 and logs.stat().st_uid==os.geteuid(),'LOG_DIRECTORY_NOT_PRIVATE')
    else:logs.mkdir(mode=0o700)
    fd=os.open(str(logs/'lock'),os.O_WRONLY|os.O_CREAT,0o600)
    with os.fdopen(fd,'w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise base.Stop('ANOTHER_RUN_ACTIVE')
        with tempfile.TemporaryDirectory(prefix='restore-',dir=str(logs)) as tmp:
            temporary=pathlib.Path(tmp);env=base.client_env(cfg,base.write_passfile(temporary,cfg),True);env['PGAPPNAME']='researchhub-manual-demo-restore'
            stamp=temporary.name
            live=json.loads(run_sql(binary,cfg,env,LIVE,None));marker=validate(live,manifest,args.stage=='verify-enabled')
            if args.stage=='run':
                if marker['state']=='pre-data-complete' and not marker.get('dataLoaded'):
                    run_sql(binary,cfg,env,import_chunks(package,manifest),logs/(stamp+'-data.json'))
                    print(json.dumps({'stage':'data','status':'committed','rows':98565}),flush=True)
                print(json.dumps(verify_contents(binary,cfg,env,manifest,expected,temporary)),flush=True)
                if marker['state']=='pre-data-complete':
                    run_sql(binary,cfg,env,lock_sql((package/'05-post-data.sql').read_text(encoding='utf-8')),logs/(stamp+'-05.json'))
                    print(json.dumps({'stage':'05','status':'sql-completed'}),flush=True)
            else:
                base.require(marker['state']=='post-data-complete','POST_DATA_REQUIRED')
            print(json.dumps(verify_contents(binary,cfg,env,manifest,expected,temporary)),flush=True)
            run_sql(binary,cfg,env,(package/'06-verify.sql').read_text(encoding='utf-8'),logs/(stamp+'-06.json'))
            structure=post_checks(binary,cfg,env)
            if args.stage=='accounts':
                base.require(sys.stdin.isatty(),'PASSWORDS_REQUIRE_INTERACTIVE_TERMINAL')
                owner=getpass.getpass('新owner数据库密码（至少32字符）：');confirm=getpass.getpass('确认owner密码：');base.require(owner==confirm,'PASSWORD_CONFIRM_MISMATCH')
                app=getpass.getpass('新app数据库密码（至少32字符）：');confirm=getpass.getpass('确认app密码：');base.require(app==confirm,'PASSWORD_CONFIRM_MISMATCH');validate_passwords(owner,app)
                sql=lock_sql((package/'07-set-passwords.sql').read_text(encoding='utf-8'))
                sql=sql.replace('__REPLACE_OWNER_PASSWORD_WITH_32_OR_MORE_CHARACTERS__',verifier(owner,base.ROLES[0])).replace('__REPLACE_APP_PASSWORD_WITH_32_OR_MORE_CHARACTERS__',verifier(app,base.ROLES[1]))
                del owner,app,confirm
                run_sql(binary,cfg,env,sql,logs/(stamp+'-07.json'));del sql
                validate(json.loads(run_sql(binary,cfg,env,LIVE,None)),manifest,True)
            enabled=args.stage in ('accounts','verify-enabled')
            receipt={'status':'database-accounts-enabled' if enabled else 'data-05-06-complete-ready-for-accounts','database':'researchhub','tables':182,'rows':98565,'contentMatch':True,'structure':structure,'accountsEnabled':enabled,'workersStarted':False,'sourceManifestSha256':data.MANIFEST_SHA}
            base.save_private(logs/(stamp+'-receipt.json'),json.dumps(receipt)+'\n');print(json.dumps(receipt),flush=True)

def main():
    parser=argparse.ArgumentParser(description='Frozen demo restore only. check is offline; run imports then 05/06; accounts prompts for two new database passwords.')
    parser.add_argument('stage',nargs='?',default='check',choices=['check','run','accounts','verify-enabled'])
    parser.add_argument('--package',default=str(HERE));parser.add_argument('--config',default='/srv/aisci/ops/.env.prod');parser.add_argument('--psql',default='psql')
    args=parser.parse_args();signal.signal(signal.SIGTERM,lambda *_:sys.exit(130))
    try:run(args)
    except (base.Stop,OSError,ValueError,UnicodeError,subprocess.SubprocessError,KeyboardInterrupt):
        error=sys.exc_info()[1];print(json.dumps({'status':'stopped','code':str(error) if isinstance(error,base.Stop) else 'RESTORE_FAILED_RECHECK_STATE','automaticRetry':False}),file=sys.stderr);return 1
    return 0

if __name__=='__main__':sys.exit(main())
