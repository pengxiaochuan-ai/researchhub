#!/usr/bin/env python3
"""Manual-only 00-04 runner. Python 3.6+, no package dependencies."""
import argparse
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit, parse_qs, unquote

SOURCE_SHA = '5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c'
EXPECTED_HOST_SHA256 = '695a70ecb80c5b5950da8260e59903c52037e2252f19a32a89999077c5b7858a'
EXPECTED_SERVER_MAJOR = 18
EXPECTED_VECTOR_VERSION = '0.8.1.2'
FILES = {'00':'00-check-postgres.sql','01':'01-create-roles.sql','02':'02-create-database.sql','03':'03-init-researchhub.sql','04':'04-pre-data.sql'}
ROLES = ['researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector']

class Stop(Exception):
    pass

def require(condition, code):
    if not condition:
        raise Stop(code)

def load_config(path):
    path = pathlib.Path(path)
    require(not path.is_symlink() and path.is_file(), 'CONFIG_NOT_REGULAR_FILE')
    mode = path.stat()
    require(mode.st_mode & 0o077 == 0 and mode.st_uid in (os.geteuid(), 0), 'CONFIG_NOT_PRIVATE')
    require(mode.st_size < 1048576, 'CONFIG_TOO_LARGE')
    values = []
    for line in path.read_text(encoding='utf-8').splitlines():
        match = re.match(r'^\s*(?:export\s+)?DIRECT_URL\s*=\s*(.*?)\s*$', line)
        if match:
            value = match.group(1)
            if value.startswith(('"', "'")):
                require(len(value) > 1 and value[-1] == value[0], 'CONFIG_QUOTING_INVALID')
                value = value[1:-1]
            values.append(value)
    require(len(values) == 1, 'CONFIG_DIRECT_URL_MISSING_OR_DUPLICATE')
    u = urlsplit(values[0])
    require(u.scheme in ('postgres','postgresql') and not u.fragment, 'CONFIG_URL_INVALID')
    host = u.hostname or ''
    require(hashlib.sha256(host.encode()).hexdigest() == EXPECTED_HOST_SHA256 and (u.port or 5432) == 5432, 'CONFIG_TARGET_MISMATCH')
    user = unquote(u.username or '', errors='strict')
    password = unquote(u.password or '', errors='strict')
    require(user == 'aisci_control' and unquote(u.path) == '/aisci', 'CONFIG_ROLE_OR_SOURCE_DATABASE_MISMATCH')
    require(password and not any(ord(c)<32 or ord(c)==127 for c in password), 'CONFIG_PASSWORD_INVALID')
    query = parse_qs(u.query)
    require(len(query.get('sslmode',[])) <= 1, 'CONFIG_SSL_INVALID')
    return {'host':host,'port':5432,'user':user,'password':password,'sslmode':query.get('sslmode',['unspecified'])[0]}

def client_major(version):
    match = re.match(r'psql \(PostgreSQL\) (\d+)\.(\d+)(?:\D|$)', version.strip())
    require(match, 'PSQL_VERSION_UNRECOGNIZED')
    major, minor = int(match.group(1)), int(match.group(2))
    # Only the newly verified legacy release; do not expand other old versions.
    require(major >= 16 or (major, minor) == (13,23), 'PSQL_VALIDATED_CLIENT_REQUIRED')
    return major

def write_passfile(directory, config):
    escape = lambda s: str(s).replace('\\','\\\\').replace(':','\\:')
    path = directory / 'pgpass'
    content = ''.join(':'.join(escape(v) for v in (config['host'],5432,db,config['user'],config['password']))+'\n' for db in ('postgres','researchhub'))
    fd = os.open(str(path), os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as f:
        f.write(content)
    return path

def client_env(config, passfile, allow_plain, original=None):
    source = os.environ if original is None else original
    env = {k:v for k,v in source.items() if k in ('PATH','HOME','LANG','TZ','TERM') or k.startswith('LC_')}
    env.update({'PGPASSFILE':str(passfile),'PGSSLMODE':'disable' if allow_plain else 'require','PGCONNECT_TIMEOUT':'10','PGAPPNAME':'researchhub-manual-00-04','PGCLIENTENCODING':'UTF8'})
    return env

def client_args(binary, config, database):
    require(database in ('postgres','researchhub'), 'DATABASE_NOT_ALLOWED')
    return [binary,'-X','--no-password','-qAt','-v','ON_ERROR_STOP=1','--host',config['host'],'--port','5432','--username',config['user'],'--dbname',database]

def verify_package(package):
    path = package / 'manifest.json'
    require(path.is_file() and not path.is_symlink(), 'PACKAGE_MANIFEST_MISSING')
    manifest = json.loads(path.read_text(encoding='utf-8'))
    require(isinstance(manifest, dict), 'PACKAGE_MANIFEST_INVALID')
    require(manifest.get('schema') == 'researchhub-manual-rds-sql.v1' and manifest.get('sourceSchemaSha256') == SOURCE_SHA and manifest.get('database') == 'researchhub' and manifest.get('tables') == 182 and manifest.get('dataIncluded') is False, 'PACKAGE_SOURCE_MISMATCH')
    inventory = manifest.get('files',[])
    require(isinstance(inventory,list) and all(isinstance(x,dict) and isinstance(x.get('file'),str) and isinstance(x.get('sha256'),str) for x in inventory), 'PACKAGE_INVENTORY_INVALID')
    names = [x['file'] for x in inventory]
    require(len(set(names))==len(names) and set(FILES.values()).issubset(names), 'PACKAGE_INVENTORY_INVALID')
    for item in inventory:
        name = item['file']
        require(pathlib.Path(name).name == name and '/' not in name and '\\' not in name, 'PACKAGE_PATH_INVALID')
        p = package / name
        require(p.is_file() and not p.is_symlink(), 'PACKAGE_FILE_MISSING')
        require(hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256'], 'PACKAGE_HASH_MISMATCH')
    return manifest

LIVE_SQL = """BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='2s';
SELECT json_build_object('database',current_database(),'operator',current_user,'version',current_setting('server_version_num')::int,
 'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,'superuser',r.rolsuper,
 'ssl',COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false),
 'target',(SELECT json_build_object('owner',pg_get_userbyid(d.datdba),'marker',shobj_description(d.oid,'pg_database')) FROM pg_database d WHERE d.datname='researchhub'),
 'roles',COALESCE((SELECT json_agg(json_build_object('name',x.rolname,'login',x.rolcanlogin,'superuser',x.rolsuper,'createdb',x.rolcreatedb,'createrole',x.rolcreaterole,'bypass',x.rolbypassrls,'inherit',x.rolinherit,'replication',x.rolreplication,'canSet',pg_has_role(current_user,x.oid,'SET'))) FROM pg_roles x WHERE x.rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector')),'[]'::json),
 'newRoleMemberships',(SELECT count(*) FROM pg_auth_members a JOIN pg_roles m ON m.oid=a.member WHERE m.rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector')))
 FROM pg_roles r WHERE r.rolname=current_user;
COMMIT;"""

def validate_live(live, stage, allow_plain):
    require(stage in FILES, 'STAGE_NOT_ALLOWED')
    require(live.get('database')=='postgres' and live.get('operator')=='aisci_control', 'LIVE_IDENTITY_MISMATCH')
    require(live.get('version',0)//10000==EXPECTED_SERVER_MAJOR, 'LIVE_SERVER_VERSION_MISMATCH')
    require(live.get('ssl') is True or allow_plain, 'LIVE_TLS_REQUIRED')
    require(live.get('superuser') or (live.get('createdb') and live.get('createrole')), 'LIVE_OPERATOR_CANNOT_CREATE')
    roles = live.get('roles',[])
    target = live.get('target')
    if stage in ('00','01'):
        require(not roles and target is None, 'LIVE_FRESH_TARGET_REQUIRED')
        return
    require(len(roles)==4 and set(x['name'] for x in roles)==set(ROLES), 'LIVE_ROLE_SET_MISMATCH')
    for r in roles:
        require(not any(r.get(k) for k in ('login','superuser','createdb','createrole','inherit','replication')) and r.get('bypass')==(r['name']==ROLES[0]) and r.get('canSet') is True, 'LIVE_ROLE_ATTRIBUTES_INVALID')
    require(live.get('newRoleMemberships')==0, 'LIVE_UNEXPECTED_NEW_ROLE_MEMBERSHIP')
    if stage=='02':
        require(target is None, 'LIVE_DATABASE_ALREADY_EXISTS')
    else:
        require(target and target.get('owner')==ROLES[0], 'LIVE_TARGET_OWNER_MISMATCH')
        if stage=='03':
            require(target.get('marker') is None, 'LIVE_TARGET_ALREADY_INITIALIZED')
        else:
            try:
                marker = json.loads(target.get('marker') or '')
            except ValueError:
                raise Stop('LIVE_MARKER_INVALID')
            require(marker.get('purpose')=='researchhub-manual-demo' and marker.get('syntheticOnly') is True and marker.get('sourceSchemaSha256')==SOURCE_SHA and marker.get('state')=='initialized', 'LIVE_STAGE_OR_SOURCE_MISMATCH')

def save_private(path, text):
    fd = os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as f:
        f.write(text)

def execute(binary, config, env, database, sql, log, timeout=600):
    result = subprocess.run(client_args(binary,config,database),input=sql,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,encoding='utf-8',env=env,timeout=timeout)
    clean = lambda value: value.replace(config['password'],'[REDACTED]')
    save_private(log,clean(result.stdout)+'\n'+clean(result.stderr))
    if result.returncode:
        code = re.search(r'\bMANUAL_[A-Z_]+\b',result.stderr)
        raise Stop(code.group(0) if code else 'PSQL_FAILED_STATE_MUST_BE_RECHECKED')
    return result.stdout

POST_SQL = """BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT json_build_object('database',current_database(),'operator',current_user,
 'marker',shobj_description(oid,'pg_database'),
 'tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR n.nspname LIKE 'rh_%')),
 'vector',(SELECT extversion FROM pg_extension WHERE extname='vector')) FROM pg_database WHERE datname=current_database();
COMMIT;"""

def run(args):
    require(sys.version_info >= (3,6), 'PYTHON_36_OR_NEWER_REQUIRED')
    package = pathlib.Path(args.package).resolve()
    verify_package(package)
    binary = shutil.which(args.psql)
    require(binary, 'PSQL_NOT_INSTALLED_NO_AUTOMATIC_INSTALL')
    version = subprocess.run([binary,'--version'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,encoding='utf-8',env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','LANG','TZ','TERM') or k.startswith('LC_')},timeout=10)
    require(version.returncode==0,'PSQL_VERSION_CHECK_FAILED')
    major = client_major(version.stdout)
    config = load_config(pathlib.Path(args.config))
    print(json.dumps({'check':'ok','python':sys.version.split()[0],'clientMajor':major,'sourceConfig':str(args.config),'sourceDatabase':'aisci','sqlDatabases':['postgres','researchhub'],'configuredSslMode':config['sslmode'],'executionSslMode':'disable' if args.allow_vpc_demo_non_tls else 'require','databaseConnected':False}))
    if args.stage=='check':
        return
    logs = package / '.server-run'
    if logs.exists():
        require(not logs.is_symlink() and logs.is_dir() and logs.stat().st_mode&0o077==0 and logs.stat().st_uid==os.geteuid(), 'LOG_DIRECTORY_NOT_PRIVATE')
    else:
        logs.mkdir(mode=0o700)
    lockfd = os.open(str(logs/'lock'),os.O_RDWR|os.O_CREAT,0o600)
    with os.fdopen(lockfd,'w') as lock:
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            raise Stop('ANOTHER_RUN_IS_ACTIVE')
        with tempfile.TemporaryDirectory(prefix='run-',dir=str(logs)) as directory:
            connection = pathlib.Path(directory)
            env = client_env(config,write_passfile(connection,config),args.allow_vpc_demo_non_tls)
            run_id = connection.name
            for stage in (sorted(FILES) if args.stage=='all' else [args.stage]):
                verify_package(package)
                prefix = logs / (run_id+'-'+stage)
                live = json.loads(execute(binary,config,env,'postgres',LIVE_SQL,pathlib.Path(str(prefix)+'-preflight.log'),30))
                validate_live(live,stage,args.allow_vpc_demo_non_tls)
                sql = (package/FILES[stage]).read_text(encoding='utf-8')
                # No --single-transaction: 02 is standalone CREATE DATABASE.
                database = 'postgres' if stage in ('00','01','02') else 'researchhub'
                execute(binary,config,env,database,sql,pathlib.Path(str(prefix)+'-sql.log'))
                save_private(pathlib.Path(str(prefix)+'-receipt.json'),json.dumps({'stage':stage,'database':database,'sourceSchemaSha256':SOURCE_SHA,'sqlCompleted':True,'operator':config['user']})+'\n')
                print(json.dumps({'stage':stage,'status':'sql-completed','database':database,'logs':str(prefix)}))
                if stage=='04':
                    state = json.loads(execute(binary,config,env,'researchhub',POST_SQL,pathlib.Path(str(prefix)+'-verify.log'),30))
                    marker = json.loads(state.get('marker') or '')
                    require(state.get('database')=='researchhub' and state.get('operator')==config['user'] and state.get('tables')==182 and state.get('vector')==EXPECTED_VECTOR_VERSION and marker.get('sourceSchemaSha256')==SOURCE_SHA and marker.get('state')=='pre-data-complete', 'FINAL_VERIFICATION_FAILED')
                    print(json.dumps({'status':'00-04-complete-stop-before-data','tables':182,'logDirectory':str(logs),'accountsEnabled':False}))

def main():
    parser = argparse.ArgumentParser(description='ResearchHub manual 00-04 only. Default check never connects to a DB.')
    parser.add_argument('stage',nargs='?',default='check',choices=['check','all']+list(FILES))
    parser.add_argument('--package',default=str(pathlib.Path(__file__).resolve().parent))
    parser.add_argument('--config',default='/srv/aisci/ops/.env.prod')
    parser.add_argument('--psql',default='psql')
    parser.add_argument('--allow-vpc-demo-non-tls',action='store_true',help='Only after explicit approval for this VPC synthetic demo; do not use for clinical data.')
    args = parser.parse_args()
    signal.signal(signal.SIGTERM,lambda *_: sys.exit(130))
    try:
        run(args)
    except (Stop,OSError,ValueError,UnicodeError,subprocess.SubprocessError,KeyboardInterrupt) as error:
        print(json.dumps({'status':'stopped','code':str(error) if isinstance(error,Stop) else 'RUN_FAILED_OR_INTERRUPTED_RECHECK_LIVE_STATE','automaticRetry':False}),file=sys.stderr)
        return 1
    return 0

if __name__=='__main__':
    sys.exit(main())
