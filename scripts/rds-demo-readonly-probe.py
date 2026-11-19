"""RDS demo admission: maintenance and legacy ACL catalogs, no business rows."""
import json
import re
import subprocess


def command(args):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          universal_newlines=True, timeout=35, check=True).stdout


def main():
    ids = command(["docker", "ps", "-q"]).split()
    if not ids or any(not re.fullmatch(r"[a-f0-9]{12,64}", x) for x in ids):
        raise RuntimeError()
    inventory = json.loads(command(["docker", "inspect", *ids]))
    servers = [i["Id"] for i in inventory if (i.get("Config", {}).get("Labels") or {}).get("com.docker.compose.service") == "server"
               and re.search(r"(?:^|/)aisci-server:", i.get("Config", {}).get("Image", ""))]
    if len(servers) != 1:
        raise RuntimeError()
    js = """const {PrismaClient}=require('@prisma/client');const {createHash}=require('node:crypto');
    let db,legacy,secure; (async()=>{try{
      if(!process.env.DIRECT_URL)throw Error('UNCONFIGURED');
      const u=new URL(process.env.DIRECT_URL);u.pathname='/postgres';
      u.searchParams.set('connection_limit','1');u.searchParams.set('connect_timeout','5');
      db=new PrismaClient({datasources:{db:{url:u.href}},log:[]});
      const result=await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5s'");
        const identity=await tx.$queryRawUnsafe("SELECT current_database() AS database,current_user AS role,current_setting('server_version') AS version,current_setting('transaction_read_only') AS readonly");
        if(identity[0].database!=='postgres'||identity[0].role!==decodeURIComponent(u.username))throw Error('IDENTITY');
        const capabilities=await tx.$queryRawUnsafe('SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user');
        const databases=await tx.$queryRawUnsafe("SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname='researchhub'");
        const roles=await tx.$queryRawUnsafe("SELECT rolname FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector') ORDER BY rolname");
        const vector=await tx.$queryRawUnsafe("SELECT name,version,superuser,trusted,relocatable FROM pg_available_extension_versions WHERE name='vector' ORDER BY version");
        const tls=await tx.$queryRawUnsafe('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
        return {identity,capabilities,databases,roles,vector,tls};
      },{timeout:20000});
      const old=new URL(process.env.DIRECT_URL);old.pathname='/aisci';old.searchParams.set('connection_limit','1');old.searchParams.set('connect_timeout','5');
      legacy=new PrismaClient({datasources:{db:{url:old.href}},log:[]});
      const legacyPublic=await legacy.$transaction(async tx=>{
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5s'");
        const [where]=await tx.$queryRawUnsafe("SELECT current_database() AS database,current_setting('transaction_read_only') AS readonly");
        if(where.database!=='aisci'||where.readonly!=='on')throw Error('IDENTITY');
        const relations=await tx.$queryRawUnsafe("SELECT n.nspname AS schema,c.relname AS relation,a.privilege_type AS privilege FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND a.grantee=0 ORDER BY n.nspname,c.relname,a.privilege_type");
        const columns=await tx.$queryRawUnsafe("SELECT n.nspname AS schema,c.relname AS relation,t.attname AS column,a.privilege_type AS privilege FROM pg_attribute t JOIN pg_class c ON c.oid=t.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(t.attacl) a WHERE n.nspname='public' AND t.attnum>0 AND NOT t.attisdropped AND a.grantee=0 ORDER BY c.relname,t.attname,a.privilege_type");
        const definers=await tx.$queryRawUnsafe("SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,md5(pg_get_functiondef(p.oid)) AS definition_hash FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='public' AND p.prosecdef AND p.prokind IN ('f','p') AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype) AND a.grantee=0 AND a.privilege_type='EXECUTE' ORDER BY p.proname,arguments");
        const connection=await tx.$queryRawUnsafe("SELECT a.privilege_type FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND a.grantee=0 ORDER BY a.privilege_type");
        const schemas=await tx.$queryRawUnsafe("SELECT nspname AS name,pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname NOT IN ('pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp%' ORDER BY nspname");
        const schemaPublic=await tx.$queryRawUnsafe("SELECT n.nspname AS schema,a.privilege_type FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' AND a.grantee=0 ORDER BY a.privilege_type");
        return {database:where.database,readonly:where.readonly,relations,columns,definers,connection,schemas,schemaPublic};
      },{timeout:20000});
      let tlsStrict;
      try{const s=new URL(u.href);s.searchParams.set('sslmode','require');s.searchParams.set('sslaccept','strict');secure=new PrismaClient({datasources:{db:{url:s.href}},log:[]});
        tlsStrict=await secure.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const [r]=await tx.$queryRawUnsafe('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');return {connected:true,ssl:r.ssl,certificateMode:'strict'};},{timeout:10000});
      }catch(e){const reason=String(e.meta?.message||e.message||'');tlsStrict={connected:false,code:/^P[0-9]{4}$/.test(e.code||'')?e.code:null,reason:/does not support (ssl|tls)/i.test(reason)?'SERVER_TLS_UNAVAILABLE':/certificate|issuer|self.signed/i.test(reason)?'CERTIFICATE_UNTRUSTED':/timeout|timed out/i.test(reason)?'CONNECT_TIMEOUT':'TLS_HANDSHAKE_FAILED'};}
      const capacityRef=(u.hostname.match(/^(pgm-[a-z0-9]+)\\./)||[])[1]||null;
      console.log(JSON.stringify({schema:'hub-rds-demo-admission.v1',...result,legacyPublic,tlsStrict,capacityRef,hostSha256:createHash('sha256').update(u.hostname).digest('hex'),writes:0}));
    }catch(e){console.log(JSON.stringify({blocked:'RDS_DEMO_CATALOG_UNAVAILABLE',code:/^P[0-9]{4}$/.test(e.code||'')?e.code:null}));process.exitCode=1;}finally{if(secure)await secure.$disconnect();if(legacy)await legacy.$disconnect();if(db)await db.$disconnect();}})();"""
    output = command(["docker", "exec", "--workdir", "/app/server", servers[0], "node", "-e", js])
    value = json.loads(output)
    if value.get("schema") != "hub-rds-demo-admission.v1":
        raise RuntimeError()
    print(json.dumps(value))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"blocked": "RDS_DEMO_CATALOG_UNAVAILABLE"}))
        raise SystemExit(1)
