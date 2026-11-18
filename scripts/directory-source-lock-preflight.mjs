import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const rows=[];
for(const table of ['external_document_version','pmc_candidate_version','source_registry']){
 try{await withFixtureTransaction(env,'app',async tx=>{await tx.$executeRaw`SELECT set_config('app.tenant_id',${runtime.ids.tenant},true)`;await tx.$queryRawUnsafe(`SELECT id FROM rh_source.${table} WHERE tenant_id=$1 LIMIT 1 FOR SHARE`,runtime.ids.tenant);});rows.push({table,sharedLockAllowed:true});}
 catch(e){if(e.meta?.code!=='42501')throw e;rows.push({table,sharedLockAllowed:false,pgCode:e.meta.code});}
}
const existing=await withFixtureTransaction(env,'direct',tx=>tx.$queryRaw`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_source' AND (p.proname LIKE '%lock%' OR p.proname LIKE '%hold%') ORDER BY p.proname LIMIT 20`,{readOnly:true});
const directoryRows=await withFixtureTransaction(env,'direct',async tx=>{const result={};for(const name of ['entity','assertion','decision'])result[name]=(await tx.$queryRawUnsafe(`SELECT count(*)::int count FROM rh_directory.${name}`))[0].count;return result;},{readOnly:true});assert.deepEqual(directoryRows,{entity:0,assertion:0,decision:0});
const result={at:new Date().toISOString(),syntheticOnly:true,readOnlyExceptTransactionLocks:true,rows,directoryRows,existingHelpers:existing.map(x=>x.proname),oldSourceGrantsChanged:false,newSourceLockFunctionCreated:false,needsNewDecision:rows.some(x=>!x.sharedLockAllowed)};
const out=root+'researchhub/docs/testing/evidence/research-identity-directory-implementation-2026-11-03/directory-source-lock/';mkdirSync(out,{recursive:true});writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:out}));
