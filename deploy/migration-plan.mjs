import {readFileSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const fail=code=>{throw new Error(code);};
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const identifier=/^[a-z][a-z0-9_]{0,62}$/;
export function catalogFingerprintSql(schemas){
 if(!Array.isArray(schemas)||!schemas.length||schemas.some(s=>!identifier.test(s)||s==='rh_deploy'))fail('MIGRATION_SCHEMA_REJECTED');
 const selected=schemas.map(literal).join(',');
 return `WITH namespaces AS (SELECT oid,nspname,nspowner,nspacl FROM pg_namespace WHERE nspname IN (${selected})), entries AS (
 SELECT 'namespace:'||n.nspname AS key,jsonb_build_array(n.nspowner::regrole::text,n.nspacl::text)::text AS value FROM namespaces n
 UNION ALL SELECT 'relation:'||n.nspname||'.'||c.relname,jsonb_build_array(c.relkind,c.relowner::regrole::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity)::text FROM pg_class c JOIN namespaces n ON n.oid=c.relnamespace
 UNION ALL SELECT 'column:'||n.nspname||'.'||c.relname||'.'||a.attname,jsonb_build_array(a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid))::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN namespaces n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint:'||n.nspname||'.'||c.relname||'.'||k.conname,pg_get_constraintdef(k.oid,true) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN namespaces n ON n.oid=c.relnamespace
 UNION ALL SELECT 'index:'||n.nspname||'.'||c.relname,pg_get_indexdef(c.oid) FROM pg_class c JOIN namespaces n ON n.oid=c.relnamespace WHERE c.relkind='i'
 UNION ALL SELECT 'function:'||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_array(pg_get_functiondef(p.oid),p.proowner::regrole::text,p.proacl::text,p.prosecdef,p.proconfig)::text FROM pg_proc p JOIN namespaces n ON n.oid=p.pronamespace WHERE p.prokind IN ('f','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 UNION ALL SELECT 'policy:'||schemaname||'.'||tablename||'.'||policyname,jsonb_build_array(permissive,roles,cmd,qual,with_check)::text FROM pg_policies WHERE schemaname IN (${selected})
 UNION ALL SELECT 'trigger:'||n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_array(pg_get_triggerdef(t.oid,true),t.tgenabled)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN namespaces n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
 UNION ALL SELECT 'enum:'||n.nspname||'.'||t.typname||'.'||e.enumlabel,e.enumsortorder::text FROM pg_type t JOIN namespaces n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
 UNION ALL SELECT 'sequence:'||schemaname||'.'||sequencename,jsonb_build_array(start_value,min_value,max_value,increment_by,cycle,cache_size)::text FROM pg_sequences WHERE schemaname IN (${selected})
 UNION ALL SELECT 'extension:'||e.extname,e.extversion FROM pg_extension e JOIN namespaces n ON n.oid=e.extnamespace
 ) SELECT md5(coalesce(string_agg(key||':'||value,E'\\n' ORDER BY key,value),'')) FROM entries`;
}
// Keep only SQL outside quoted bodies/comments; never interpret psql commands.
function controls(sql){
 let output='',i=0;
 while(i<sql.length){
  if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i+2);i=end<0?sql.length:end;output+=' ';continue;}
  if(sql.startsWith('/*',i)){let depth=1;i+=2;while(i<sql.length&&depth){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}if(depth)fail('MIGRATION_SQL_REJECTED');output+=' ';continue;}
  const tag=sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
  if(tag){const end=sql.indexOf(tag,i+tag.length);if(end<0)fail('MIGRATION_SQL_REJECTED');i=end+tag.length;output+=' ';continue;}
  if(sql[i]==="'"||sql[i]==='"'){
   const quote=sql[i],escaped=quote==="'"&&/[eE]/.test(sql[i-1]??'')&&!/[a-zA-Z0-9_$]/.test(sql[i-2]??'');let closed=false;i++;
   while(i<sql.length){if(escaped&&sql[i]==='\\'){i+=2;continue;}if(sql[i]===quote){if(sql[i+1]===quote){i+=2;continue;}i++;closed=true;break;}i++;}
   if(!closed)fail('MIGRATION_SQL_REJECTED');output+=' ';continue;
  }
  output+=sql[i++];
 }
 return output;
}
export function loadMigrationBundle(directory){
 const root=realpathSync(directory),bytes=readFileSync(resolve(root,'manifest.json')),manifest=JSON.parse(bytes);
 if(manifest.schemaVersion!==1||!/^[a-z][a-z0-9-]{0,100}$/.test(manifest.id??'')||!Array.isArray(manifest.steps)||!manifest.steps.length)fail('MIGRATION_MANIFEST_REJECTED');
 catalogFingerprintSql(manifest.managedSchemas);
 const ids=new Set(),sqlById=new Map();
 for(const step of manifest.steps){
  if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(step.id??'')||ids.has(step.id)||!['before','after'].every(k=>/^[a-f0-9]{32}$/.test(step[k]??'')))fail('MIGRATION_MANIFEST_REJECTED');
  if(typeof step.file!=='string'||isAbsolute(step.file)||step.file.split('/').some(p=>!p||p==='.'||p==='..')||!step.file.endsWith('.sql'))fail('MIGRATION_FILE_REJECTED');
  const path=resolve(root,step.file),rel=relative(root,realpathSync(path));if(lstatSync(path).isSymbolicLink()||rel.startsWith('..')||isAbsolute(rel))fail('MIGRATION_FILE_REJECTED');
  const sql=readFileSync(path,'utf8');if(hash(sql)!==step.sha256)fail('MIGRATION_SOURCE_MISMATCH');
  const control=controls(sql);
  if(/\\/.test(control)||control.split(';').some(statement=>/^\s*(?:COMMIT|ROLLBACK|ABORT|END|BEGIN|START\s+TRANSACTION|PREPARE\s+TRANSACTION|ALTER\s+SYSTEM|CREATE\s+DATABASE|DROP\s+DATABASE|VACUUM)\b/i.test(statement)))fail('MIGRATION_TRANSACTION_ESCAPE');
  if(step.dependsOn&&(!Array.isArray(step.dependsOn)||step.dependsOn.some(id=>!ids.has(id))))fail('MIGRATION_DEPENDENCY_REJECTED');
  if(ids.size&&manifest.steps[ids.size-1].after!==step.before)fail('MIGRATION_CHAIN_REJECTED');
  ids.add(step.id);sqlById.set(step.id,sql);
 }
 return{root,manifest,digest:hash(bytes.toString()),sqlById};
}
export function makeMigrationPlan(bundle,state){
 const {steps}=bundle.manifest,applied=state.applied??[];
 if(applied.length>steps.length||applied.some((row,i)=>row.id!==steps[i].id||row.sha256!==steps[i].sha256))fail('MIGRATION_LEDGER_MISMATCH');
 const expected=applied.length?steps[applied.length-1].after:steps[0].before;
 if(state.fingerprint!==expected)fail('MIGRATION_BASELINE_MISMATCH');
 const body={schemaVersion:1,bundle:bundle.manifest.id,bundleDigest:bundle.digest,target:{database:state.database,role:state.role,markerDigest:state.markerDigest,endpointFingerprint:state.endpointFingerprint},fingerprint:state.fingerprint,applied,pending:steps.slice(applied.length).map(({id,sha256,before,after})=>({id,sha256,before,after}))};
 return{...body,digest:hash(body)};
}
export function assertMigrationApproval(plan,approvedDigest){if(plan.digest!==approvedDigest)fail('MIGRATION_APPROVAL_REQUIRED');}
export function migrationTransaction(bundle,step,target){
 const fingerprint=catalogFingerprintSql(bundle.manifest.managedSchemas),sql=bundle.sqlById.get(step.id);if(!sql)fail('MIGRATION_MANIFEST_REJECTED');
 const marker=`encode(sha256(convert_to(coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database'),''),'UTF8')),'hex')`;
 return `BEGIN;
SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='60s'; SET LOCAL search_path=pg_catalog;
SELECT pg_advisory_xact_lock(hashtextextended('researchhub-deployment-migrations',0));
DO $rh_guard$ BEGIN IF current_database()<>${literal(target.database)} OR session_user<>${literal(target.role)} OR (${marker})<>${literal(target.markerDigest)} THEN RAISE EXCEPTION 'MIGRATION_TARGET_MISMATCH'; END IF; IF (${fingerprint})<>${literal(step.before)} THEN RAISE EXCEPTION 'MIGRATION_BASELINE_MISMATCH'; END IF; END $rh_guard$;
CREATE SCHEMA IF NOT EXISTS rh_deploy;
CREATE TABLE IF NOT EXISTS rh_deploy.migration (bundle text NOT NULL,id text NOT NULL,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(bundle,id));
REVOKE ALL ON SCHEMA rh_deploy FROM PUBLIC;
REVOKE ALL ON rh_deploy.migration FROM PUBLIC;
${sql}
RESET ROLE; SET LOCAL search_path=pg_catalog;
DO $rh_verify$ BEGIN IF (${fingerprint})<>${literal(step.after)} THEN RAISE EXCEPTION 'MIGRATION_AFTER_MISMATCH'; END IF; END $rh_verify$;
INSERT INTO rh_deploy.migration(bundle,id,sha256) VALUES (${literal(bundle.manifest.id)},${literal(step.id)},${literal(step.sha256)});
COMMIT;
`;
}
