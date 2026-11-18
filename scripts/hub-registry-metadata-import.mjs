import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertExternalAdmission} from './hub-external-schema.mjs';
import {initialFive,initialDocumentId} from '../server/hub-sources/initial-five.mjs';
import {extractRegistryDetails,registryDetailHash} from '../server/hub-sources/registry-detail-contract.mjs';
import {assertRegistryCatalog} from '../server/hub-sources/registry-detail-schema-contract.mjs';

// Deliberately limited to the two approved local source files, without DDL or
// any review writes. A new extraction is invisible until the normal admin review.
export async function importRegistryMetadata({transact}={}){
 const {env}=loadFixtureInput(fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url)));
 const target=await assertFixtureTarget(env);
 if(target.databaseName!=='wp01_test_full_baseline')throw Error('HUB_REGISTRY_TARGET_REJECTED');
 const {ids}=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8'));
 const sources=initialFive.filter(x=>x.documentType==='clinical_registry').map(source=>{
  const bytes=readFileSync(new URL('../docs/'+source.fileName,import.meta.url));
  return {...source,bytes,documentId:initialDocumentId(ids.tenant,'lingshu-xinyu',source),
   legacy:extractRegistryDetails(bytes,source),payload:extractRegistryDetails(bytes,source,{includeRegistration:true})};
 });
 if(sources.length!==2)throw Error('HUB_REGISTRY_MANIFEST_REJECTED');
 return (transact??(fn=>withFixtureTransaction(env,'direct',fn)))(async db=>{
  await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
  await assertExternalAdmission(db,target,ids);
  const tables=['clinical_registry_extraction','clinical_registry_detail_review'];
  const guards=await db.$queryRaw`SELECT c.relname,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,
   has_table_privilege('aisci_app',c.oid,'SELECT') AS readable,
   has_any_column_privilege('aisci_app',c.oid,'UPDATE') AS editable,
   has_table_privilege('aisci_app',c.oid,'DELETE') AS deletable,
   has_any_column_privilege('aisci_app',c.oid,'INSERT') AS insertable
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_source' AND c.relkind='r' AND c.relname=ANY(${tables}::text[])`;
  if(guards.length!==2||guards.some(x=>!x.rls||!x.forced||!x.readable||x.editable||x.deletable||x.insertable!==(x.relname==='clinical_registry_detail_review')))throw Error('HUB_REGISTRY_SCHEMA_DRIFT');
  const policies=await db.$queryRaw`SELECT tablename AS "tableName",policyname AS "policyName",cmd AS command,permissive,roles::text[] AS roles,qual,with_check AS "withCheck" FROM pg_policies WHERE schemaname='rh_source' AND tablename=ANY(${tables}::text[])`;
  const constraints=await db.$queryRaw`SELECT t.relname AS "tableName",pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='rh_source' AND t.relname=ANY(${tables}::text[]) AND c.contype IN ('f','u')`;
  assertRegistryCatalog({policies,constraints});
  const items=[];
  for(const source of sources){
   await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ids.tenant+':lingshu-xinyu:'+source.documentId},0))`;
   const [version]=await db.$queryRaw`SELECT v.id,v.version_number AS version,v.content_sha256 AS sha,p.content_bytes AS bytes FROM rh_source.external_document_version v JOIN rh_source.external_document_payload p ON p.tenant_id=v.tenant_id AND p.hub_key=v.hub_key AND p.version_id=v.id WHERE v.tenant_id=${ids.tenant} AND v.hub_key='lingshu-xinyu' AND v.document_id=${source.documentId} ORDER BY v.version_number DESC LIMIT 1`;
   if(!version||version.version!==1||version.sha!==source.expectedSha256||createHash('sha256').update(version.bytes).digest('hex')!==source.expectedSha256)throw Error('HUB_REGISTRY_SOURCE_DRIFT');
   const prior=await db.$queryRaw`SELECT id,extraction_version AS version,source_sha256 AS sha,payload,payload_sha256 AS hash FROM rh_source.clinical_registry_extraction WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu' AND version_id=${version.id} ORDER BY extraction_version DESC`;
   const legacy=prior.find(x=>x.version===1),payloadSha256=registryDetailHash(source.payload);
   const extractionId='rhce-'+createHash('sha256').update(version.id+':'+payloadSha256).digest('hex').slice(0,40);
   if(!legacy||legacy.sha!==source.expectedSha256||legacy.hash!==registryDetailHash(source.legacy)||registryDetailHash(legacy.payload)!==legacy.hash||prior.length>2)throw Error('HUB_REGISTRY_EXTRACTION_DRIFT');
   const head=prior[0],exists=head.version===2;
   if(exists&&(head.id!==extractionId||head.sha!==version.sha||head.hash!==payloadSha256||registryDetailHash(head.payload)!==payloadSha256)||!exists&&head.version!==1)throw Error('HUB_REGISTRY_EXTRACTION_DRIFT');
   if(!exists)await db.$executeRaw`INSERT INTO rh_source.clinical_registry_extraction(id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by) VALUES(${extractionId},${ids.tenant},'lingshu-xinyu',${version.id},2,${version.sha},'chictr-mhtml-v1',${JSON.stringify(source.payload)}::jsonb,${payloadSha256},'codex-user-approved-registry-metadata-2026-11-11')`;
   items.push({documentId:source.documentId,registrationNumber:source.externalKey,extractionId,extractionVersion:2,payloadSha256,inserted:!exists});
  }
  return {databaseName:target.databaseName,items};
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--apply')throw Error('Usage: node scripts/hub-registry-metadata-import.mjs --apply');
 importRegistryMetadata().then(x=>process.stdout.write(JSON.stringify(x)+'\n')).catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
}
