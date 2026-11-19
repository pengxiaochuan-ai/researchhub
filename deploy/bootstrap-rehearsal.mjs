import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {validateRehearsalState,rehearsalSql} from './rehearsal.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
export function bootstrapRehearsal({directory,sourceSql,securityFile,expectedSourceDigest}){
 directory=resolve(directory);const state=validateRehearsalState(JSON.parse(readFileSync(join(directory,'rehearsal-state.json'))));
 const source=readFileSync(sourceSql,'utf8'),security=JSON.parse(readFileSync(securityFile));
 if(sha(source)!==expectedSourceDigest||security.syntheticOnly!==true||security.schemaOnly!==true||/^COPY\s/m.test(source)||source.includes('wp01_meta'))throw new Error('REHEARSAL_BASELINE_REJECTED');
 const roles=new Set([...security.objects.map(x=>x.owner),...security.functions.map(x=>x.owner),'aisci_app','aisci_owner']);
 if([...roles].some(x=>!['aisci_owner','aisci_app','rh_analysis_job_candidate_reader'].includes(x)))throw new Error('REHEARSAL_BASELINE_ROLE_REJECTED');
 const probe='rh_deploy_probe_'+sha(state.runId).slice(0,10);
 const gate=`DO $gate$ DECLARE marker jsonb; BEGIN SELECT shobj_description(oid,'pg_database')::jsonb INTO marker FROM pg_database WHERE datname=current_database(); IF current_database()<>'${state.database}' OR marker->>'purpose'<>'researchhub-deployment-rehearsal' OR marker->>'runId'<>'${state.runId}' OR marker->>'syntheticOnly'<>'true' THEN RAISE EXCEPTION 'REHEARSAL_DATABASE_REJECTED'; END IF; IF to_regclass('public.account') IS NOT NULL THEN RAISE EXCEPTION 'REHEARSAL_BASELINE_ALREADY_PRESENT'; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'${probe}') THEN RAISE EXCEPTION 'REHEARSAL_UNEXPECTED_TABLE'; END IF; END $gate$;`;
 rehearsalSql(state,`BEGIN; ${gate} ROLLBACK;`);
 const passwords={app:randomBytes(32).toString('hex'),owner:randomBytes(32).toString('hex')};
 let sql=source.replace(/^\\(?:un)?restrict[^\n]*$/gm,'');
 if((sql.match(/^CREATE SCHEMA public;$/gm)??[]).length!==1)throw new Error('REHEARSAL_BASELINE_FORMAT_REJECTED');
 sql=sql.replace(/^CREATE SCHEMA public;$/m,'');
 const readerOwners=security.functions.filter(x=>x.owner==='rh_analysis_job_candidate_reader');
 for(const f of readerOwners)if(!/^[a-z_][a-z0-9_]*$/.test(f.schema)||!/^[a-z_][a-z0-9_]*$/.test(f.name)||/[;$]/.test(f.arguments))throw new Error('REHEARSAL_FUNCTION_IDENTITY_REJECTED');
 const owned=readerOwners.map(f=>`ALTER FUNCTION ${quote(f.schema)}.${quote(f.name)}(${f.arguments}) OWNER TO rh_analysis_job_candidate_reader;`).join('\n');
 const moveProbe=`DO $move$ BEGIN IF to_regclass('public.${probe}') IS NOT NULL THEN ALTER TABLE public.${probe} SET SCHEMA rh_deploy; END IF; END $move$;`;
 // All setup below is confined to this brand-new labelled instance. No production
 // runner imports this bootstrap and no shared/legacy database is a valid target.
 const bootstrap=`BEGIN; ${gate}
 CREATE ROLE aisci_owner LOGIN SUPERUSER BYPASSRLS PASSWORD '${passwords.owner}';
 CREATE ROLE aisci_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${passwords.app}';
 CREATE ROLE rh_analysis_job_candidate_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
 CREATE ROLE rh_pmc_collector_local NOLOGIN NOSUPERUSER NOBYPASSRLS;
 ${moveProbe}
 SET LOCAL ROLE aisci_owner;
 CREATE EXTENSION IF NOT EXISTS vector;
 ${sql}
 RESET ROLE;
 ${owned}
 ALTER ROLE aisci_owner NOSUPERUSER BYPASSRLS;
 COMMIT;`;
 rehearsalSql(state,bootstrap);
 const urls={databaseUrl:`postgresql://aisci_app:${passwords.app}@127.0.0.1:${state.port}/${state.database}`,directUrl:`postgresql://aisci_owner:${passwords.owner}@127.0.0.1:${state.port}/${state.database}`};
 writeFileSync(join(directory,'runtime-database.json'),JSON.stringify(urls,null,2)+'\n',{mode:0o600,flag:'wx'});
 const result={syntheticOnly:true,runId:state.runId,sourceDigest:expectedSourceDigest,dataRowsCopied:0,fixtureMetadataCopied:false,sourceOwnerRestored:true,directSuperuser:false,appSuperuser:false,appBypassRls:false};
 writeFileSync(join(directory,'baseline-installed.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const[directory,sourceSql,securityFile,expectedSourceDigest]=process.argv.slice(2);console.log(JSON.stringify(bootstrapRehearsal({directory,sourceSql,securityFile,expectedSourceDigest})));}
 catch(error){console.error(error.message?.startsWith('REHEARSAL_')?error.message:'REHEARSAL_BOOTSTRAP_FAILED');process.exitCode=1;}
}
