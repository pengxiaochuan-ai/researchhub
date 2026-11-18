// Explicit synthetic-target migration. Importing this file never opens a connection.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {requestHash,HUB_KEY} from '../server/admission/policy.mjs';
import {createAdmissionService} from '../server/admission/service.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=root+'researchhub/.tmp/f01-admission/';
const manifestPath=directory+'migration-manifest.json';
export const schemaStatements=()=>readFileSync(new URL('../server/admission/schema.sql',import.meta.url),'utf8').split(/^-- statement\s*$/m).map(s=>s.trim()).filter(Boolean);
export function target(){
 const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
 const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
 assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);return{env,ids};
}
async function snapshot(tx,ids){
 const accounts=await tx.account.findMany({where:{tenantId:ids.tenant},select:{id:true,tenantId:true,status:true,authVersion:true,role:true,isTenantAdmin:true,displayName:true,emailNormalized:true,emailVerifiedAt:true},orderBy:{id:'asc'}});
 const [tenant,groups,projects]=await Promise.all([tx.tenant.findUnique({where:{id:ids.tenant},select:{id:true,status:true,quotaSeats:true}}),tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}),tx.researchProjectMembership.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}})]);
 return JSON.parse(JSON.stringify({accounts,tenant,membershipHash:requestHash({groups,projects})}));
}
async function definitionHash(tx){return requestHash(await tx.$queryRawUnsafe("SELECT 'table' AS kind,c.relname::text AS name,concat(c.relrowsecurity,c.relforcerowsecurity,c.relacl::text) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_admission' AND c.relkind='r' UNION ALL SELECT 'function',p.proname::text,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_admission' UNION ALL SELECT 'constraint',x.conname::text,pg_get_constraintdef(x.oid) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_admission' UNION ALL SELECT 'policy',policyname::text,concat(qual,with_check) FROM pg_policies WHERE schemaname='rh_admission' UNION ALL SELECT 'trigger',c.relname::text||'.'||t.tgname::text,concat(pg_get_triggerdef(t.oid),t.tgenabled,t.tgdeferrable,t.tginitdeferred,t.tgfoid::regprocedure::text) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_admission' AND NOT t.tgisinternal UNION ALL SELECT 'column',c.relname::text||'.'||a.attname::text,concat(format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='rh_admission' AND a.attnum>0 AND NOT a.attisdropped ORDER BY kind,name,definition"));}
export async function migration(mode){
 assert(['prepare','predict','apply','check'].includes(mode));const {env,ids}=target();
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 mkdirSync(directory,{recursive:true,mode:0o700});
 if(mode==='prepare'){
  const state=await withFixtureTransaction(env,'direct',tx=>snapshot(tx,ids),{readOnly:true});
  const admin=state.accounts.find(a=>a.id===ids.admin&&a.status==='active'&&a.role==='tenant_admin'&&a.isTenantAdmin===true);assert(admin);
  const manifest={version:1,createdAt:new Date().toISOString(),tenantId:ids.tenant,hubKey:HUB_KEY,adminId:admin.id,adminAuthVersion:admin.authVersion,sourceHash:requestHash(schemaStatements()),state,legacy:state.accounts.filter(a=>a.status==='active').map(a=>a.id)};
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2),{mode:0o600});return{prepared:true,legacyAccounts:manifest.legacy.length,manifestPath,hash:requestHash(manifest)};
 }
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));assert.equal(manifest.sourceHash,requestHash(schemaStatements()));assert.equal(manifest.tenantId,ids.tenant);assert.equal(manifest.hubKey,HUB_KEY);
 let result;const rollback=new Error('F01_PREDICTION_ROLLBACK');
 try{await withFixtureTransaction(env,'direct',async tx=>{
  await lockAuthorizationMutation(tx,ids.tenant);
  const [state]=await tx.$queryRawUnsafe("SELECT to_regnamespace('rh_admission')::text AS name");
  if(state.name){
   const receipt=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'hub.admission.schema.v1',target:'rh_admission'},orderBy:{createdAt:'desc'},select:{meta:true}});
   assert.equal(receipt?.meta?.sourceHash,manifest.sourceHash,'F01_SCHEMA_DRIFT');assert.equal(receipt.meta.definitionHash,await definitionHash(tx),'F01_SCHEMA_DRIFT');
   result={verified:true,definitionHash:receipt.meta.definitionHash};return;
  }
  if(mode==='check'){result={configured:false};return;}
  assert.deepEqual(await snapshot(tx,ids),manifest.state,'F01_FROZEN_ACCOUNT_OR_MEMBER_STATE_CHANGED');
  for(const sql of schemaStatements())await tx.$executeRawUnsafe(sql);
  const service=createAdmissionService({tenantId:ids.tenant,transact:fn=>fn(tx),lockAuthorization:lockAuthorizationMutation});
  const actor={tenantId:ids.tenant,accountId:manifest.adminId,authVersion:manifest.adminAuthVersion};
  for(const accountId of manifest.legacy){const a=manifest.state.accounts.find(a=>a.id===accountId);await service.legacyInTransaction(tx,actor,a,'f01-legacy-'+accountId);}
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  assert.deepEqual(await snapshot(tx,ids),manifest.state,'F01_PROTECTED_STATE_CHANGED');
  const hash=await definitionHash(tx);
  await tx.auditLog.create({data:{tenantId:ids.tenant,accountId:actor.accountId,action:'hub.admission.schema.v1',target:'rh_admission',meta:{sourceHash:manifest.sourceHash,definitionHash:hash,manifestHash:requestHash(manifest),legacyAccounts:manifest.legacy.length,approval:'F01 V0.3 serial implementation authorized 2026-11-17',syntheticOnly:true}}});
  result={configured:mode==='apply',predicted:mode==='predict',legacyAccounts:manifest.legacy.length,definitionHash:hash,protectedUnchanged:true};
  if(mode==='predict')throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 writeFileSync(directory+mode+'-result.json',JSON.stringify(result,null,2),{mode:0o600});return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))migration(process.argv[2]?.replace(/^--/,'')).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});
