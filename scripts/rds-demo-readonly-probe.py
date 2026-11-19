"""RDS demo admission: maintenance catalog only, no aisci/business queries."""
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
    let db; (async()=>{try{
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
        const databases=await tx.$queryRawUnsafe("SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname='researchhub_demo'");
        const roles=await tx.$queryRawUnsafe("SELECT rolname FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app') ORDER BY rolname");
        const vector=await tx.$queryRawUnsafe("SELECT name,version,superuser,trusted,relocatable FROM pg_available_extension_versions WHERE name='vector' ORDER BY version");
        const tls=await tx.$queryRawUnsafe('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
        return {identity,capabilities,databases,roles,vector,tls};
      },{timeout:20000});
      console.log(JSON.stringify({schema:'hub-rds-demo-admission.v1',...result,hostSha256:createHash('sha256').update(u.hostname).digest('hex'),writes:0}));
    }catch(e){console.log(JSON.stringify({blocked:'RDS_DEMO_CATALOG_UNAVAILABLE',code:/^P[0-9]{4}$/.test(e.code||'')?e.code:null}));process.exitCode=1;}finally{if(db)await db.$disconnect();}})();"""
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
