"""Cloud Assistant payload: metadata only; never import application services."""
import base64
import glob
import json
import platform
import re
import subprocess
from pathlib import Path


def command(args, timeout=20):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True).stdout


def main():
    result = {"schema": "hub-production-readonly.v1", "architecture": platform.machine(), "containers": []}
    ids = command(["docker", "ps", "-q"]).split()
    if not ids or any(not re.fullmatch(r"[a-f0-9]{12,64}", x) for x in ids):
        raise RuntimeError("CONTAINER_INVENTORY_UNAVAILABLE")
    items = json.loads(command(["docker", "inspect", *ids]))
    servers = []
    for item in items:
        cfg, state = item["Config"], item["State"]
        labels = cfg.get("Labels") or {}
        image = cfg.get("Image", "")
        # Never serialize Config.Env, command arguments, mounts or labels wholesale.
        result["containers"].append({"name": item["Name"], "image": image, "status": state["Status"],
            "project": labels.get("com.docker.compose.project"), "service": labels.get("com.docker.compose.service"),
            "ports": item.get("NetworkSettings", {}).get("Ports", {})})
        if labels.get("com.docker.compose.service") == "server" and re.search(r"(?:^|/)aisci-server:", image):
            servers.append(item["Id"])
    result["hubProxy"] = []
    for filename in sorted(glob.glob("/etc/nginx/conf.d/*.conf"))[:40]:
        text = Path(filename).read_text()[:300000]
        if "hub.pengxc.com" in text:
            # Boolean observations only; never echo proxy credentials or headers.
            result["hubProxy"].append({"file": filename, "apiLocation": bool(re.search(r"location[^\n{]*/api", text)),
                "proxyPresent": "proxy_pass" in text, "tlsConfigured": "ssl_certificate" in text})
    if len(servers) != 1:
        result["database"] = {"blocked": "RUNNING_AISCI_SERVER_NOT_UNIQUE", "candidates": len(servers)}
    else:
        fingerprint = base64.b64decode("__FINGERPRINT_SQL_BASE64__").decode()
        queries = [
            "SELECT current_database() AS database,current_user AS role,current_setting('server_version') AS version,current_setting('transaction_read_only') AS readonly",
            "SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
            "SELECT extname,extversion FROM pg_extension ORDER BY extname",
            "SELECT n.nspname AS schema,count(*)::int AS relations,count(*) FILTER(WHERE c.relrowsecurity)::int AS rls,count(*) FILTER(WHERE c.relforcerowsecurity)::int AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' OR n.nspname LIKE 'rh_%' GROUP BY n.nspname ORDER BY n.nspname",
            "SELECT (" + fingerprint + ") AS fingerprint",
        ]
        js = """const{PrismaClient}=require('@prisma/client');const{createHash}=require('node:crypto');const db=new PrismaClient();
        (async()=>{try{const value=await db.$transaction(async tx=>{
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe(\"SET LOCAL statement_timeout='10s'\");
          const out=[];for(const sql of QUERIES)out.push(await tx.$queryRawUnsafe(sql));return out;
        },{timeout:20000});const u=new URL(process.env.DATABASE_URL);console.log(JSON.stringify({metadata:value,connection:{hostSha256:createHash('sha256').update(u.hostname).digest('hex'),tlsMode:u.searchParams.get('sslmode')||'unspecified',source:'running-container DATABASE_URL'},deployment:{product:process.env.DEPLOYMENT_PRODUCT||null,scopeKeysPresent:['DEPLOYMENT_ID','ALLOWED_TENANT_IDS','DEFAULT_TENANT_ID'].filter(k=>Boolean(process.env[k]))}},(_k,v)=>typeof v==='bigint'?v.toString():v));
        }catch(e){console.log(JSON.stringify({blocked:'CATALOG_PROBE_FAILED',code:/^P[0-9]{4}$/.test(e.code||'')?e.code:null}));process.exitCode=1;}finally{await db.$disconnect();}})();""".replace("QUERIES", json.dumps(queries))
        try:
            result["database"] = json.loads(command(["docker", "exec", "--workdir", "/app/server", servers[0], "node", "-e", js], 35))
        except Exception:
            result["database"] = {"blocked": "CATALOG_PROBE_FAILED"}
    print(json.dumps(result, ensure_ascii=False))
    if "blocked" in result["database"]:
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"blocked": "PRODUCTION_READONLY_PROBE_FAILED"}))
        raise SystemExit(1)
