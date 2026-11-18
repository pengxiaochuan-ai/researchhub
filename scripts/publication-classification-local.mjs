import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {extractClassification,parseArticleMetadata,CLASSIFICATION_VERSION} from '../server/hub-sources/publication-classification.mjs';

const base=fileURLToPath(new URL('../',import.meta.url));
export async function classifyLocalPublications(){
 const {env}=loadFixtureInput(fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url)));
 const target=await assertFixtureTarget(env);if(target.databaseName!=='wp01_test_full_baseline')throw Error('PUBLICATION_TARGET_REJECTED');
 const {ids}=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url)));
 if(ids.tenant!=='rh-kb-local-b0e2af9d-tenant')throw Error('PUBLICATION_SCOPE_REJECTED');
 const result=await withFixtureTransaction(env,'direct',async db=>{
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  const preserve=async()=>{
   const [row]=await db.$queryRaw`SELECT
    (SELECT md5(string_agg((to_jsonb(c)-'classification')::text,'' ORDER BY c.id)) FROM rh_source.canonical_publication c WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu') AS workbook,
    (SELECT md5(string_agg((to_jsonb(v)-'classification')::text,'' ORDER BY v.id)) FROM rh_source.pmc_candidate_version v WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu') AS pmc,
    (SELECT md5(string_agg(to_jsonb(d)::text,'' ORDER BY d.decision_version)) FROM rh_source.pmc_article_decision d WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu') AS decisions,
    (SELECT md5(string_agg(c.relname||coalesce(c.relacl::text,'')||c.relrowsecurity::text||c.relforcerowsecurity::text,'' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_source' AND c.relname IN ('canonical_publication','pmc_candidate_version')) AS access`;
   return row;
  };
  const before=await preserve();
  const schema=readFileSync(new URL('../server/hub-sources/publication-classification.sql',import.meta.url),'utf8');
  for(const statement of schema.split(';').map(x=>x.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
  const columns=await db.$queryRaw`SELECT table_name,data_type FROM information_schema.columns WHERE table_schema='rh_source' AND table_name IN ('canonical_publication','pmc_candidate_version') AND column_name='classification'`;
  if(columns.length!==2||columns.some(c=>c.data_type!=='jsonb'))throw Error('PUBLICATION_SCHEMA_MISMATCH');
  const records=await db.$queryRaw`SELECT c.id,r.title,r.abstract_text AS abstract,r.row_sha256 AS "sourceHash",c.classification
   FROM rh_source.canonical_publication c JOIN rh_source.source_record r ON r.id=c.source_record_id AND r.tenant_id=c.tenant_id AND r.hub_key=c.hub_key
   WHERE c.tenant_id=${ids.tenant} AND c.hub_key='lingshu-xinyu' ORDER BY c.id`;
  const pmc=await db.$queryRaw`SELECT v.id,v.pmcid,v.title,v.abstract_text AS abstract,v.raw_sha256 AS "sourceHash",v.classification,
    a.local_object_key AS "objectKey",a.object_sha256 AS "objectSha"
   FROM rh_source.pmc_candidate_version v LEFT JOIN LATERAL (SELECT a.local_object_key,a.object_sha256 FROM rh_source.pmc_asset a WHERE a.version_id=v.id AND a.tenant_id=v.tenant_id AND a.hub_key=v.hub_key AND a.asset_kind='jats' ORDER BY (a.object_sha256=v.raw_sha256) DESC,a.id LIMIT 1) a ON true
   WHERE v.tenant_id=${ids.tenant} AND v.hub_key='lingshu-xinyu' AND v.campaign_key='pmc-first-2026-10-31' ORDER BY v.id`;
  if(records.length>20000||pmc.length>20||new Set(pmc.map(x=>x.id)).size!==pmc.length)throw Error('PUBLICATION_INVENTORY_CHANGED');
  const objectRoot=resolve(base,'.tmp/researchhub-pmc-local');
  const updates=[];let unchanged=0;
  for(const row of [...records,...pmc]){
   let metadata={};
   if(row.pmcid){
    if(!row.objectKey)throw Error('PUBLICATION_JATS_MISSING');
    const path=resolve(objectRoot,row.objectKey);if(!path.startsWith(objectRoot+sep))throw Error('PUBLICATION_OBJECT_PATH_REJECTED');
    const bytes=readFileSync(path);if(createHash('sha256').update(bytes).digest('hex')!==row.objectSha)throw Error('PUBLICATION_OBJECT_HASH_MISMATCH');
    metadata=parseArticleMetadata(bytes.toString('utf8'),row.pmcid);
   }
   const classification=extractClassification({...row,metadata});
   // JSONB object ordering is irrelevant; compare canonical sorted recursive representation.
   const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
   if(JSON.stringify(canonical(row.classification))===JSON.stringify(canonical(classification))){unchanged++;continue;}
   updates.push({id:row.id,pmc:!!row.pmcid,sourceHash:row.sourceHash,classification});
  }
  for(const isPmc of [false,true]){
   const rows=updates.filter(x=>x.pmc===isPmc);
   for(let i=0;i<rows.length;i+=400){const payload=JSON.stringify(rows.slice(i,i+400));
    const count=isPmc?await db.$executeRaw`UPDATE rh_source.pmc_candidate_version v SET classification=x.classification
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(id text,"sourceHash" text,classification jsonb)
      WHERE v.id=x.id AND v.raw_sha256=x."sourceHash" AND v.tenant_id=${ids.tenant} AND v.hub_key='lingshu-xinyu' AND v.campaign_key='pmc-first-2026-10-31'`
     :await db.$executeRaw`UPDATE rh_source.canonical_publication c SET classification=x.classification
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(id text,"sourceHash" text,classification jsonb)
      WHERE c.id=x.id AND c.tenant_id=${ids.tenant} AND c.hub_key='lingshu-xinyu'
       AND EXISTS(SELECT 1 FROM rh_source.source_record r WHERE r.id=c.source_record_id AND r.tenant_id=c.tenant_id AND r.row_sha256=x."sourceHash")`;
    if(count!==Math.min(400,rows.length-i))throw Error('PUBLICATION_BACKFILL_CONFLICT');
   }
  }
  const after=await preserve();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('PUBLICATION_ORIGINAL_PRESERVATION_FAILED');
  return {databaseName:target.databaseName,extractorVersion:CLASSIFICATION_VERSION,workbookRecords:records.length,pmcVersions:pmc.length,updated:updates.length,unchanged,originalsAndAccessPreserved:true,before,after};
 });
 const out=base+'docs/testing/evidence/publication-classification-'+randomUUID();mkdirSync(out,{recursive:true});writeFileSync(out+'/result.json',JSON.stringify(result,null,2));return {...result,evidence:out+'/result.json'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='--apply')throw Error('Use --apply only for dedicated synthetic database');
 classifyLocalPublications().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
