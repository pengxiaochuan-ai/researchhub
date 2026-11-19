// Explicit source-only export. No restore, cloud, target DB or application startup.
import {mkdirSync,mkdtempSync,writeFileSync,openSync,closeSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {DEMO_SOURCE_DATABASE,DEMO_SCHEMAS,demoIdentifier as q,demoSelection,assertDemoSourceIdentity,assertDemoSourceEndpoint} from './demo-snapshot-plan.mjs';
import {catalogFingerprintSql} from './migration-plan.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sha=x=>createHash('sha256').update(x).digest('hex');
let stage='source-validation';
async function main(){
 if(process.argv.slice(2).join(' ')!=='--export-approved-synthetic-hub')throw Error('DEMO_ARGUMENTS_REJECTED');
 const {loadCatalogTarget}=await import('../scripts/research-assets-catalog-schema.mjs');
 const {validateFixtureConfig,fixtureClient}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const {env,ids}=loadCatalogTarget(),config=validateFixtureConfig(env);
 if(config.databaseName!==DEMO_SOURCE_DATABASE||ids.tenant!=='rh-kb-local-b0e2af9d-tenant')throw Error('DEMO_SOURCE_REJECTED');
 assertDemoSourceEndpoint(config.directUrl);
 const inspect=JSON.parse(execFileSync('docker',['inspect','aisci-pg'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
 const ports=inspect.NetworkSettings?.Ports?.['5432/tcp']??[];
 if(inspect.Name!=='/aisci-pg'||!ports.some(p=>p.HostPort==='5434'))throw Error('DEMO_SOURCE_CONTAINER_REJECTED');
 const base=join(root,'.tmp/independent-demo-delivery-20261119');mkdirSync(base,{recursive:true,mode:0o700});
 const directory=mkdtempSync(join(base,'tenant-snapshot-'));const client=fixtureClient(config.directUrl);
 try{
  const manifest=await client.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await tx.$executeRawUnsafe('SET LOCAL row_security=off');await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'");
   const [identity]=await tx.$queryRawUnsafe("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS readonly,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()");
   assertDemoSourceIdentity(identity,config.runId);
   const [state]=await tx.$queryRawUnsafe("SELECT current_setting('server_version') AS version,pg_export_snapshot() AS snapshot,("+catalogFingerprintSql(DEMO_SCHEMAS)+") AS fingerprint");
   if(!/^[0-9A-Fa-f-]{1,80}$/.test(state.snapshot))throw Error('DEMO_SNAPSHOT_REJECTED');
   stage='table-catalog';
   const tables=await tx.$queryRawUnsafe(`SELECT t.table_schema::text AS schema,t.table_name::text AS name,array_agg(c.column_name::text ORDER BY c.ordinal_position) FILTER(WHERE c.is_generated='NEVER') AS columns FROM information_schema.tables t JOIN information_schema.columns c ON (c.table_schema,c.table_name)=(t.table_schema,t.table_name) WHERE t.table_type='BASE TABLE' AND t.table_schema=ANY($1::text[]) GROUP BY t.table_schema,t.table_name ORDER BY t.table_schema,t.table_name`,DEMO_SCHEMAS);
   const byName=new Map(tables.map(t=>[t.schema+'.'+t.name,t]));for(const table of tables)demoSelection(table);
   stage='foreign-key-catalog';
   const fks=await tx.$queryRawUnsafe(`SELECT k.conname::text AS name,n.nspname::text AS schema,c.relname::text AS table,pn.nspname::text AS parent_schema,p.relname::text AS parent_table,array_agg(a.attname::text ORDER BY x.i) AS columns,array_agg(pa.attname::text ORDER BY x.i) AS parent_columns FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace JOIN LATERAL unnest(k.conkey,k.confkey) WITH ORDINALITY x(child,parent,i) ON true JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=x.child JOIN pg_attribute pa ON pa.attrelid=p.oid AND pa.attnum=x.parent WHERE k.contype='f' AND n.nspname=ANY($1::text[]) GROUP BY k.oid,k.conname,n.nspname,c.relname,pn.nspname,p.relname ORDER BY n.nspname,c.relname,k.conname`,DEMO_SCHEMAS);
   const query=sql=>sql.includes('$1')?tx.$queryRawUnsafe(sql,ids.tenant):tx.$queryRawUnsafe(sql);
   const closure=[];
   for(const fk of fks){
    stage='closure:'+fk.schema+'.'+fk.table;
    const child=byName.get(fk.schema+'.'+fk.table),parent=byName.get(fk.parent_schema+'.'+fk.parent_table);
    if(!child||!parent)throw Error('DEMO_EXTERNAL_PARENT_REJECTED');
    const present=fk.columns.map(c=>'"c".'+q(c)+' IS NOT NULL').join(' AND ');
    const same=fk.columns.map((c,i)=>'"c".'+q(c)+'="p".'+q(fk.parent_columns[i])).join(' AND ');
    const [row]=await query('SELECT count(*)::int AS n FROM '+q(fk.schema)+'.'+q(fk.table)+' AS "c" WHERE ('+demoSelection(child,'c')+') AND '+present+' AND NOT EXISTS(SELECT 1 FROM '+q(parent.schema)+'.'+q(parent.name)+' AS "p" WHERE '+same+' AND ('+demoSelection(parent,'p')+'))');
    if(row.n)closure.push({table:fk.schema+'.'+fk.table,constraint:fk.name,parent:parent.schema+'.'+parent.name,excludedParents:row.n});
   }
   if(closure.length){writeFileSync(join(directory,'selection-blockers.json'),JSON.stringify({blocked:true,closure},null,2),{mode:0o600});throw Error('DEMO_SELECTION_PARENT_CLOSURE_FAILED');}
   stage='schema-archive';
   const archive=join(directory,'schema.dump'),fd=openSync(archive,'wx',0o600);
   try{execFileSync('docker',['exec','aisci-pg','pg_dump','--username=aisci_owner','--dbname='+DEMO_SOURCE_DATABASE,'--format=custom','--schema-only','--snapshot='+state.snapshot,...DEMO_SCHEMAS.map(s=>'--schema='+s)],{stdio:['ignore',fd,'pipe'],timeout:30000});}finally{closeSync(fd);}
   const files=[];let totalRows=0;
   for(const [index,table] of tables.entries()){
    stage='rows:'+table.schema+'.'+table.name;
    const rows=await query('SELECT row_to_json("t")::text AS row FROM (SELECT '+table.columns.map(q).join(',')+' FROM '+q(table.schema)+'.'+q(table.name)+' AS "s" WHERE '+demoSelection(table,'s')+') AS "t" ORDER BY row_to_json("t")::text');
    const content=rows.map(r=>r.row).join('\n')+(rows.length?'\n':'');const file=String(index).padStart(3,'0')+'.jsonl';
    writeFileSync(join(directory,file),content,{mode:0o600,flag:'wx'});files.push({file,schema:table.schema,table:table.name,columns:table.columns,rows:rows.length,bytes:Buffer.byteLength(content),sha256:sha(content)});totalRows+=rows.length;
   }
   return{schema:'hub-approved-demo-source-snapshot.v1',at:new Date().toISOString(),sourceSyntheticOnly:true,sourceDatabase:DEMO_SOURCE_DATABASE,sourceVersion:state.version,sourceFingerprint:state.fingerprint,tenantId:ids.tenant,excludedFixtureMetadata:true,parentClosureVerified:true,sourceWrites:0,restoreValidated:false,objectFilesIncluded:false,historicalTasksMayExist:true,consumersMustRemainStopped:true,schemaArchive:{file:'schema.dump',sha256:sha(readFileSync(archive))},tables:files,totalRows};
  },{isolationLevel:'RepeatableRead',timeout:120000,maxWait:5000});
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({directory,sourceSyntheticOnly:true,sourceWrites:0,tables:manifest.tables.length,totalRows:manifest.totalRows,parentClosureVerified:true,restoreValidated:false,objectFilesIncluded:false}));
 }catch(error){writeFileSync(join(directory,'failed.json'),JSON.stringify({blocked:true,code:/^DEMO_[A-Z_]+$/.test(error.message??'')?error.message:'DEMO_SNAPSHOT_FAILED'}),{mode:0o600});throw error;}finally{await client.$disconnect();}
}
main().catch(error=>{console.error(JSON.stringify({blocked:true,stage,code:/^DEMO_[A-Z_]+$/.test(error.message??'')?error.message:/^P[0-9]{4}$/.test(error.code??'')?error.code:'DEMO_SNAPSHOT_FAILED',sqlState:/^[0-9A-Z]{5}$/.test(error.meta?.code??'')?error.meta.code:null}));process.exitCode=1;});
