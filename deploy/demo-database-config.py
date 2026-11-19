#!/usr/bin/env python3
"""Authenticate existing Hub DB roles; save only a new private Hub configuration."""
import argparse,fcntl,getpass,hashlib,importlib.util,json,os,pathlib,re,shutil,stat,subprocess,sys,tempfile,signal
from urllib.parse import quote,urlsplit,unquote,parse_qs
HERE=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('guard',str(HERE/('run-server.py' if (HERE/'run-server.py').exists() else 'manual-rds-server.py')));base=importlib.util.module_from_spec(s);s.loader.exec_module(base)
TENANT='rh-kb-local-b0e2af9d-tenant'
DEPLOYMENT='researchhub-demo-20261119'
ROLES=['researchhub_demo_owner','researchhub_demo_app']

def connection_url(cfg,role,password):
    return 'postgresql://'+role+':'+quote(password,safe='')+'@'+cfg['host']+':5432/researchhub?schema=public&sslmode=disable&connection_limit='+('1' if role==ROLES[0] else '3')+'&pool_timeout=10'

def check_identity(row,role):
    base.require(row.get('database')=='researchhub' and row.get('role')==role and row.get('readonly')=='on' and row.get('owner')==ROLES[0],'NEW_ACCOUNT_IDENTITY_MISMATCH')
    base.require(row.get('super') is False and row.get('createdb') is False and row.get('createrole') is False and row.get('bypass')==(role==ROLES[0]),'NEW_ACCOUNT_PRIVILEGE_MISMATCH')
    marker=json.loads(row.get('marker') or '{}')
    base.require(marker.get('purpose')=='researchhub-manual-demo' and marker.get('syntheticOnly') is True and marker.get('state')=='post-data-complete' and marker.get('sourceSchemaSha256')==base.SOURCE_SHA,'NEW_ACCOUNT_TARGET_MARKER_MISMATCH')
    return True

IDENTITY="""SELECT json_build_object('database',current_database(),'role',current_user,'readonly',current_setting('transaction_read_only'),'owner',pg_get_userbyid(d.datdba),'super',r.rolsuper,'bypass',r.rolbypassrls,'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,'marker',shobj_description(d.oid,'pg_database')) FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database();"""
SEED="""SELECT json_build_object('tenantSlug',(SELECT slug FROM public.tenant WHERE id='rh-kb-local-b0e2af9d-tenant' AND status='active'),'adminId',(SELECT id FROM public.account WHERE "tenantId"='rh-kb-local-b0e2af9d-tenant' AND username='admin@example.org' AND role='tenant_admin' AND "isTenantAdmin" AND status='active'));"""

def query(binary,cfg,role,password,sql):
    with tempfile.TemporaryDirectory(prefix='hub-account-') as tmp:
        directory=pathlib.Path(tmp);config=dict(cfg,user=role,password=password)
        env=base.client_env(config,base.write_passfile(directory,config),True);env['PGAPPNAME']='researchhub-new-account-check'
        command=base.client_args(binary,config,'researchhub')+['-v','VERBOSITY=terse']
        r=subprocess.run(command,input="BEGIN READ ONLY;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='2s';SET LOCAL search_path=pg_catalog;\n"+sql+'\nCOMMIT;',stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,encoding='utf-8',env=env,timeout=45)
        # Never include stderr: auth errors can contain connection/credential context.
        base.require(r.returncode==0,'NEW_ACCOUNT_CONNECTION_FAILED_'+('OWNER' if role==ROLES[0] else 'APP'))
        return [json.loads(line) for line in r.stdout.splitlines() if line.strip()]

def save_config(path,values):
    parent=path.parent
    if parent.exists():base.require(parent.is_dir() and not parent.is_symlink() and parent.stat().st_uid==os.geteuid() and parent.stat().st_mode&0o022==0,'DATABASE_CONFIG_DIRECTORY_NOT_CONTROLLED')
    else:parent.mkdir(parents=True,mode=0o700)
    fd=os.open(str(parent/'.env.prod.lock'),os.O_WRONLY|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600)
    with os.fdopen(fd,'w') as lock:
        st=os.fstat(lock.fileno());base.require(stat.S_ISREG(st.st_mode) and st.st_uid==os.geteuid() and st.st_mode&0o077==0,'DATABASE_CONFIG_LOCK_NOT_PRIVATE')
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise base.Stop('DATABASE_CONFIG_UPDATE_ALREADY_ACTIVE')
        return save_config_locked(path,values)

def save_config_locked(path,values):
    base.require(not path.is_symlink(),'DATABASE_CONFIG_SYMLINK_REJECTED')
    base.require(all(re.fullmatch(r'[A-Z][A-Z0-9_]*',k) and isinstance(v,str) and not any(ord(c)<32 or ord(c)==127 for c in v) for k,v in values.items()),'DATABASE_CONFIG_VALUE_INVALID')
    parent=path.parent
    if parent.exists():base.require(parent.is_dir() and not parent.is_symlink() and parent.stat().st_uid==os.geteuid() and parent.stat().st_mode&0o022==0,'DATABASE_CONFIG_DIRECTORY_NOT_CONTROLLED')
    else:parent.mkdir(parents=True,mode=0o700)
    original=None;version=None
    if path.exists():
        st=path.stat();base.require(path.is_file() and st.st_uid in (0,os.geteuid()) and st.st_mode&0o022==0 and st.st_size<=65536,'DATABASE_CONFIG_FILE_NOT_CONTROLLED')
        original=path.read_bytes();version=(st.st_dev,st.st_ino,st.st_mtime_ns,st.st_size)
    lines=(original.decode('utf-8') if original is not None else '# Hub production configuration\n').splitlines(keepends=True)
    result=[];seen=set()
    for line in lines:
        match=re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=',line)
        key=match.group(1) if match else None
        if key in values:
            base.require(key not in seen,'DATABASE_CONFIG_DUPLICATE_KEY');seen.add(key);result.append(key+'='+values[key]+'\n')
        else:result.append(line)
    if result and not result[-1].endswith('\n'):result[-1]+='\n'
    result.extend(key+'='+value+'\n' for key,value in values.items() if key not in seen)
    temporary=None;backup=None;backup_ready=False
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',prefix='.env.prod.next-',dir=str(parent),delete=False) as f:
            temporary=pathlib.Path(f.name);f.write(''.join(result));f.flush();os.fsync(f.fileno())
        if original is not None:
            st=path.stat();base.require(not path.is_symlink() and (st.st_dev,st.st_ino,st.st_mtime_ns,st.st_size)==version and path.read_bytes()==original,'DATABASE_CONFIG_CHANGED_CONCURRENTLY')
            with tempfile.NamedTemporaryFile(mode='wb',prefix='.env.prod.backup-',dir=str(parent),delete=False) as f:
                backup=pathlib.Path(f.name);f.write(original);f.flush();os.fsync(f.fileno())
            backup_ready=True
            st=path.stat();base.require(not path.is_symlink() and (st.st_dev,st.st_ino,st.st_mtime_ns,st.st_size)==version and path.read_bytes()==original,'DATABASE_CONFIG_CHANGED_CONCURRENTLY')
            os.replace(str(temporary),str(path));temporary=None
        else:os.link(str(temporary),str(path))
        return str(backup) if backup is not None else None
    finally:
        if temporary is not None:temporary.unlink()
        if backup is not None and not backup_ready:backup.unlink()

def read_config(path):
    base.require(path.is_file() and not path.is_symlink() and path.stat().st_mode&0o077==0 and path.stat().st_uid in (0,os.geteuid()) and path.stat().st_size<=65536,'DATABASE_CONFIG_NOT_PRIVATE')
    out={}
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):continue
        match=re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=(.*)$',line)
        base.require(match,'DATABASE_CONFIG_FORMAT_INVALID');key,value=match.groups()
        if key in ('DATABASE_URL','DIRECT_URL','HUB_DATABASE_MARKER_SHA256'):base.require(key not in out,'DATABASE_CONFIG_DUPLICATE_KEY')
        out[key]=value
    return out

def check_url(value,role):
    u=urlsplit(value)
    base.require(u.scheme=='postgresql' and u.hostname and hashlib.sha256(u.hostname.encode()).hexdigest()==base.EXPECTED_HOST_SHA256 and (u.port or 5432)==5432 and u.path=='/researchhub' and unquote(u.username or '')==role and parse_qs(u.query).get('sslmode')==['disable'] and not u.fragment,'DATABASE_CONFIG_TARGET_MISMATCH')
    return {'host':u.hostname,'port':5432},unquote(u.password or '')

def run(args):
    binary=shutil.which(args.psql);base.require(binary,'PSQL_NOT_FOUND');base.client_major(subprocess.check_output([binary,'--version'],timeout=10).decode())
    output=pathlib.Path(args.output)
    if args.action=='check':
        values=read_config(output)
        for role,key in zip(ROLES,['DIRECT_URL','DATABASE_URL']):
            cfg,password=check_url(values.get(key,''),role);row=query(binary,cfg,role,password,IDENTITY)[0];check_identity(row,role)
            base.require(hashlib.sha256(row['marker'].encode()).hexdigest()==values.get('HUB_DATABASE_MARKER_SHA256'),'DATABASE_CONFIG_MARKER_CHANGED')
        print(json.dumps({'status':'new-database-accounts-connected','database':'researchhub','ownerConnected':True,'appConnected':True,'config':str(output),'databaseWrites':0,'workersStarted':False}));return
    saved=None
    if output.is_file() and not output.is_symlink() and output.stat().st_mode&0o077==0:
        existing=read_config(output)
        if all(existing.get(key) for key in ('DATABASE_URL','DIRECT_URL')):
            try:
                owner_cfg,owner_value=check_url(existing['DIRECT_URL'],ROLES[0]);app_cfg,app_value=check_url(existing['DATABASE_URL'],ROLES[1])
                if owner_cfg==app_cfg and owner_value and app_value:saved=(dict(owner_cfg,sslmode='disable'),owner_value,app_value)
            except base.Stop:pass
    if saved is not None:cfg,owner,app=saved
    else:
        base.require(sys.stdin.isatty(),'PASSWORDS_REQUIRE_INTERACTIVE_TERMINAL')
        cfg=base.load_config(pathlib.Path(args.source_config));base.require(cfg['sslmode']=='disable','EXISTING_CONNECTION_MODE_CHANGED')
        owner=getpass.getpass('输入已设置的owner数据库密码：');app=getpass.getpass('输入已设置的app数据库密码：')
    base.require(owner and app and all(ord(c)>=32 and ord(c)!=127 for c in owner+app),'DATABASE_PASSWORD_INPUT_INVALID')
    fp=HERE/'runtime-fingerprint.sql';inventory=json.loads((HERE/'connect-manifest.json').read_text())
    base.require(inventory.get('schema')=='researchhub-db-connect.v1' and hashlib.sha256(fp.read_bytes()).hexdigest()==inventory.get('fingerprintSqlSha256'),'CONNECT_PACKAGE_MISMATCH')
    rows=query(binary,cfg,ROLES[0],owner,IDENTITY+'\n'+SEED+'\n'+fp.read_text());check_identity(rows[0],ROLES[0]);seed=rows[1];fingerprint=rows[2].get('fingerprint')
    base.require(re.fullmatch('[a-f0-9]{32}',fingerprint or '') and re.fullmatch('[A-Za-z0-9_-]{1,160}',seed.get('adminId') or '') and re.fullmatch('[a-z0-9-]{1,100}',seed.get('tenantSlug') or ''),'HUB_RUNTIME_SEED_MISMATCH')
    app_row=query(binary,cfg,ROLES[1],app,IDENTITY)[0];check_identity(app_row,ROLES[1]);base.require(rows[0]['marker']==app_row['marker'],'NEW_ACCOUNTS_TARGET_DIFFER')
    values={'DATABASE_URL':connection_url(cfg,ROLES[1],app),'DIRECT_URL':connection_url(cfg,ROLES[0],owner),'HUB_DATABASE_NAME':'researchhub','HUB_DATABASE_APP_ROLE':ROLES[1],'HUB_DATABASE_OWNER_ROLE':ROLES[0],'HUB_DATABASE_MARKER_SHA256':hashlib.sha256(rows[0]['marker'].encode()).hexdigest(),'HUB_MANAGED_SCHEMAS':','.join(inventory['managedSchemas']),'HUB_SCHEMA_FINGERPRINT':fingerprint,'DEPLOYMENT_PRODUCT':'researchhub','DEPLOYMENT_ID':DEPLOYMENT,'ALLOWED_TENANT_IDS':TENANT,'DEFAULT_TENANT_ID':TENANT,'HUB_SOURCE_REVIEWER_ACCOUNT_ID':seed['adminId'],'VITE_AUTH_TENANT_SLUG':seed['tenantSlug']}
    save_config(output,values)
    print(json.dumps({'status':'new-database-accounts-connected','database':'researchhub','ownerConnected':True,'appConnected':True,'configSaved':True,'config':str(output),'databaseWrites':0,'workersStarted':False}))

def main():
    parser=argparse.ArgumentParser(description='Check existing new DB passwords and merge into Hub .env.prod; never changes passwords.')
    parser.add_argument('action',nargs='?',choices=['configure','check'],default='configure');parser.add_argument('--source-config',default='/srv/aisci/ops/.env.prod');parser.add_argument('--output',default='/srv/researchhub/ops/.env.prod');parser.add_argument('--psql',default='psql')
    args=parser.parse_args();signal.signal(signal.SIGTERM,lambda *_:sys.exit(130))
    try:run(args)
    except (base.Stop,OSError,ValueError,UnicodeError,subprocess.SubprocessError,KeyboardInterrupt):
        e=sys.exc_info()[1];print(json.dumps({'status':'stopped','code':str(e) if isinstance(e,base.Stop) else 'DATABASE_CONNECTION_CONFIG_FAILED','automaticRetry':False}),file=sys.stderr);return 1
    return 0

if __name__=='__main__':sys.exit(main())
