// Generate local, private SQL. This program never opens a database connection.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const SOURCE_SHA = '5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c';
export const ROLE_MAP = Object.freeze({aisci_owner:'researchhub_demo_owner',aisci_app:'researchhub_demo_app',rh_analysis_job_candidate_reader:'researchhub_demo_analysis_reader',rh_pmc_collector_local:'researchhub_demo_pmc_collector'});
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const q = value => '"'+value.replaceAll('"','""')+'"';
const literal = value => "'"+value.replaceAll("'","''")+"'";

export function normalizeSchema(source, section) {
  let sql = source.replace(/^\\(?:un)?restrict[^\n]*\n/gm,'');
  if (/^\\/m.test(sql)) throw Error('MANUAL_UNEXPECTED_PSQL_COMMAND');
  if (section==='pre-data') {
    if ((sql.match(/^CREATE SCHEMA public;$/gm)||[]).length!==1) throw Error('MANUAL_PUBLIC_SCHEMA_UNEXPECTED');
    sql=sql.replace(/^CREATE SCHEMA public;$/m,'-- public exists in the newly created database.')
      .replace(/^ALTER SCHEMA public OWNER TO pg_database_owner;$/m,'ALTER SCHEMA public OWNER TO researchhub_demo_owner;');
  }
  for (const [from,to] of Object.entries(ROLE_MAP)) sql=sql.replace(new RegExp('\\b'+from+'\\b','g'),to);
  sql=sql.replace(/^SET (?:statement_timeout|lock_timeout|idle_in_transaction_session_timeout) = 0;\n/gm,'')
    .replace(/^SET ([a-z_]+) = /gm,'SET LOCAL $1 = ')
    .replace("SELECT pg_catalog.set_config('search_path', '', false);","SELECT pg_catalog.set_config('search_path', '', true);");
  const special='ALTER FUNCTION rh_analysis.discover_execution_jobs(p_tenant text, p_deployment text, p_limit integer) OWNER TO researchhub_demo_analysis_reader;';
  if (section==='pre-data') {
    if (!sql.includes(special)) throw Error('MANUAL_ANALYSIS_OWNER_MISSING');
    sql=sql.replace(special,'GRANT USAGE,CREATE ON SCHEMA rh_analysis TO researchhub_demo_analysis_reader;\n'+special+'\nREVOKE CREATE ON SCHEMA rh_analysis FROM researchhub_demo_analysis_reader;');
  }
  if (/\b(?:aisci_owner|aisci_app|rh_analysis_job_candidate_reader|rh_pmc_collector_local)\b/.test(sql)) throw Error('MANUAL_OLD_ROLE_REMAINS');
  if (/^(?:COPY |INSERT |DROP |CREATE DATABASE |CREATE ROLE )/m.test(sql)) throw Error('MANUAL_UNEXPECTED_SCHEMA_MUTATION');
  return sql;
}

const guard = state => `DO $guard$ DECLARE marker jsonb; BEGIN
 IF current_database()<>'researchhub' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE'; END IF;
 IF (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'researchhub_demo_owner' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE_OWNER'; END IF;
 SELECT shobj_description(oid,'pg_database')::jsonb INTO marker FROM pg_database WHERE datname=current_database();
 IF marker->>'purpose' IS DISTINCT FROM 'researchhub-manual-demo' OR marker->>'sourceSchemaSha256' IS DISTINCT FROM '${SOURCE_SHA}' OR marker->>'state' IS DISTINCT FROM '${state}' THEN RAISE EXCEPTION 'MANUAL_STAGE_OR_SOURCE_MISMATCH'; END IF;
END $guard$;`;

export function dataCheck(tables) {
  const checks=tables.map(t=>`SELECT count(*) INTO actual FROM ${q(t.schema)}.${q(t.table)}; IF actual<>${t.rows} THEN RAISE EXCEPTION 'MANUAL_DATA_COUNT_MISMATCH: ${t.schema}.${t.table}, expected %, actual %',${t.rows},actual; END IF;`).join('\n');
  return `SET LOCAL ROLE researchhub_demo_owner;\nDO $data$ DECLARE actual bigint; BEGIN\n${checks}\n IF (SELECT count(*) FROM public.tenant WHERE id='rh-kb-local-b0e2af9d-tenant')<>1 THEN RAISE EXCEPTION 'MANUAL_SYNTHETIC_TENANT_MISMATCH'; END IF;\nEND $data$;\nRESET ROLE;`;
}

export function stageSql(body, before, after) {
  return `-- DMS: select researchhub; submit this WHOLE file in ONE session/transaction.\nBEGIN;\nSET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='5min';\nSET LOCAL idle_in_transaction_session_timeout='2min';\n${before}\n-- Temporary membership ONLY between newly created Hub roles; removed before commit.\nGRANT researchhub_demo_analysis_reader TO researchhub_demo_owner WITH INHERIT TRUE, SET TRUE;\nSET LOCAL ROLE researchhub_demo_owner;\n${body}\nRESET ROLE;\nREVOKE researchhub_demo_analysis_reader FROM researchhub_demo_owner;\n${after}\nCOMMIT;\n`;
}
export function sequenceResetSql(pre) {
  const sequences=[...pre.matchAll(/^ALTER TABLE ([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*) ALTER COLUMN ([a-z_][a-z0-9_]*) ADD GENERATED ALWAYS AS IDENTITY/gm)];
  if(sequences.length!==7) throw Error('MANUAL_IDENTITY_INVENTORY_CHANGED');
  return '-- New target only: rebase 7 identity sequences after explicit-value import.\n'+sequences.map(([,table,column])=>`SELECT pg_catalog.setval(pg_catalog.pg_get_serial_sequence('${table}','${column}'),COALESCE((SELECT max(${column}) FROM ${table}),1),(SELECT max(${column}) IS NOT NULL FROM ${table}));`).join('\n')+'\n';
}
function marker(state) { return `SET LOCAL ROLE researchhub_demo_owner;\nCOMMENT ON DATABASE researchhub IS '${JSON.stringify({purpose:'researchhub-manual-demo',syntheticOnly:true,sourceSchemaSha256:SOURCE_SHA,state})}';\nRESET ROLE;`; }

export function preDataEmptyGuardSql() {
  // Exact RDS-owned extension member observed after 03; no schema-wide exemption.
  return `DO $empty$ BEGIN
 IF EXISTS(
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p')
   AND NOT COALESCE((
    n.nspname='vector' AND c.relname='rabitq_info' AND c.relpersistence='p'
    AND pg_get_userbyid(c.relowner)='aisci_control'
    AND EXISTS(
     SELECT 1 FROM pg_depend d
     JOIN pg_extension e ON d.refclassid='pg_extension'::regclass AND d.refobjid=e.oid
     JOIN pg_namespace en ON en.oid=e.extnamespace
     WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.objsubid=0
      AND d.deptype='e' AND e.extname='vector' AND e.extversion='0.8.1.2'
      AND en.nspname='public'
    )
   ),false)
 ) THEN RAISE EXCEPTION 'MANUAL_TARGET_NOT_EMPTY'; END IF;
END $empty$;`;
}

export function buildPackage(snapshot, output) {
  if(!resolve(output).startsWith(resolve(root,'.tmp')+'/')) throw Error('MANUAL_OUTPUT_MUST_BE_LOCAL_IGNORED_TMP');
  const manifest=JSON.parse(readFileSync(join(snapshot,'manifest.json'),'utf8'));
  if (!manifest.sourceSyntheticOnly || !manifest.parentClosureVerified || manifest.tenantId!=='rh-kb-local-b0e2af9d-tenant' || manifest.tables.length!==182 || manifest.schemaArchive.sha256!==SOURCE_SHA) throw Error('MANUAL_SOURCE_MANIFEST_REJECTED');
  const archive=readFileSync(join(snapshot,'schema.dump'));
  if(hash(archive)!==SOURCE_SHA) throw Error('MANUAL_ARCHIVE_HASH_MISMATCH');
  // pg_restore reads the archive from stdin; no connection to the old database.
  const extract=section=>execFileSync('docker',['exec','-i','aisci-pg','pg_restore','--section='+section,'--file=-'],{input:archive,maxBuffer:8*1024*1024,encoding:'utf8'});
  const pre=normalizeSchema(extract('pre-data'),'pre-data'), post=normalizeSchema(extract('post-data'),'post-data');
  if ((pre.match(/^CREATE TABLE /gm)||[]).length!==182) throw Error('MANUAL_TABLE_COUNT_MISMATCH');
  const files={};
  for(const name of ['00-check-postgres.sql','01-create-roles.sql','02-create-database.sql','03-init-researchhub.sql','07-set-passwords.sql']) files[name]=readFileSync(join(root,'deploy/manual-rds',name),'utf8').replaceAll('__SOURCE_SCHEMA_SHA256__',SOURCE_SHA);
  const empty=preDataEmptyGuardSql();
  files['04-pre-data.sql']=stageSql(pre,guard('initialized')+'\n'+empty,marker('pre-data-complete'));
  files['05-post-data.sql']=stageSql(post+'\n'+sequenceResetSql(pre),guard('pre-data-complete')+'\n'+dataCheck(manifest.tables),marker('post-data-complete'));
  const tableValues=manifest.tables.map(t=>`(${literal(t.schema)},${literal(t.table)},${t.rows})`).join(',\n');
  files['06-verify.sql']=`BEGIN READ ONLY;\nSET LOCAL statement_timeout='5min';\n${guard('post-data-complete')}\n${dataCheck(manifest.tables)}\nSELECT current_database(),current_user,version();\nSELECT extname,extversion FROM pg_extension WHERE extname='vector';\nSELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname LIKE 'researchhub_demo_%' ORDER BY rolname;\nSELECT n.nspname,count(*) AS tables,count(*) FILTER(WHERE c.relrowsecurity) AS rls_tables,count(*) FILTER(WHERE c.relforcerowsecurity) AS force_rls_tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR n.nspname LIKE 'rh_%') GROUP BY n.nspname ORDER BY n.nspname;\nSELECT count(*) AS policies FROM pg_policy;\nSELECT count(*) AS invalid_indexes FROM pg_index WHERE NOT indisvalid;\nSELECT count(*) AS unvalidated_constraints FROM pg_constraint WHERE NOT convalidated;\nWITH expected(schema_name,table_name,expected_rows) AS (VALUES ${tableValues}) SELECT count(*) AS expected_tables,sum(expected_rows) AS expected_rows FROM expected;\nCOMMIT;\n`;
  files['07-set-passwords.sql']=files['07-set-passwords.sql'].replace('-- SOURCE_AND_STAGE_GUARD',guard('post-data-complete')).replace("DO $unbuilt$ BEGIN RAISE EXCEPTION 'MANUAL_GENERATE_PRIVATE_PACKAGE_FIRST'; END $unbuilt$;",dataCheck(manifest.tables));
  files['README.txt']='服务器先运行 python3 run-server.py check（不连接数据库），详见服务器执行说明.md。\n请先读仓库 docs/technical/manual-rds-setup-2026-11-19.md。\n00/01/02连接postgres；02必须单独自动提交。03/04连接researchhub。\n执行04后停下：本包只有表结构，不含演示数据。不得启动应用/Worker。\n演示行数据恢复、逐表内容核验后才执行05/06/07；05/07拒绝行数不符。\n07需在本机私有副本填写两份全新口令，不要发到聊天或Git。\n不得连接aisci执行任何写入。出错提交ROLLBACK后停止并保留错误。\n';
  files['run-server.py']=readFileSync(join(root,'deploy/manual-rds-server.py'),'utf8');
  files['服务器执行说明.md']=readFileSync(join(root,'docs/technical/manual-rds-server-runner-2026-11-19.md'),'utf8').replace('manual-rds-setup-2026-11-19.md','操作说明.md').replace('../testing/manual-rds-server-runner-2026-11-19.md','服务器验证记录.md').replace('manual-rds-client13-compatibility-2026-11-19.md','客户端13兼容说明.md');
  files['服务器验证记录.md']=readFileSync(join(root,'docs/testing/manual-rds-server-runner-2026-11-19.md'),'utf8').replace('../technical/manual-rds-server-runner-2026-11-19.md','服务器执行说明.md').replace('../technical/manual-rds-client13-compatibility-2026-11-19.md','客户端13兼容说明.md');
  files['客户端13兼容说明.md']=readFileSync(join(root,'docs/technical/manual-rds-client13-compatibility-2026-11-19.md'),'utf8');
  files['04续行说明.md']=readFileSync(join(root,'docs/technical/manual-rds-vector-metadata-2026-11-19.md'),'utf8');
  files['操作说明.md']=readFileSync(join(root,'docs/technical/manual-rds-setup-2026-11-19.md'),'utf8').replace('../testing/manual-rds-sql-2026-11-19.md','验证记录.md').replace('manual-rds-server-runner-2026-11-19.md','服务器执行说明.md');
  files['验证记录.md']=readFileSync(join(root,'docs/testing/manual-rds-sql-2026-11-19.md'),'utf8').replace('../technical/manual-rds-setup-2026-11-19.md','操作说明.md');
  files['role-map.json']=JSON.stringify({roles:ROLE_MAP,dataFieldMappings:[{schema:'rh_source',table:'pmc_collector_binding',column:'role_name',from:'rh_pmc_collector_local',to:'researchhub_demo_pmc_collector'}],note:'Only map this exact policy identity field during data restore; do not rewrite business IDs or arbitrary row text.'},null,2)+'\n';
  mkdirSync(output,{recursive:false,mode:0o700});
  for(const [name,body] of Object.entries(files)) writeFileSync(join(output,name),body,{mode:0o600,flag:'wx'});
  const receipt={schema:'researchhub-manual-rds-sql.v1',sourceSchemaSha256:SOURCE_SHA,sourceManifestSha256:hash(readFileSync(join(snapshot,'manifest.json'))),database:'researchhub',tables:182,expectedRows:manifest.tables.reduce((n,t)=>n+t.rows,0),dataIncluded:false,remoteWrites:0,files:Object.entries(files).map(([file,body])=>({file,bytes:Buffer.byteLength(body),sha256:hash(body)}))};
  writeFileSync(join(output,'manifest.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
  writeFileSync(join(output,'SHA256SUMS'),receipt.files.map(f=>f.sha256+'  '+f.file).join('\n')+'\n',{mode:0o600,flag:'wx'});
  return {directory:output,tables:182,expectedRows:receipt.expectedRows,dataIncluded:false,files:receipt.files.length};
}
if (process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4) throw Error('Usage: node deploy/manual-rds-package.mjs PRIVATE_SNAPSHOT_DIR NEW_PRIVATE_OUTPUT_DIR');
  console.log(JSON.stringify(buildPackage(resolve(process.argv[2]),resolve(process.argv[3]))));
}
