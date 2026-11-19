import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {loadMigrationBundle,makeMigrationPlan,assertMigrationApproval,migrationTransaction} from './migration-plan.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){const dir=mkdtempSync(join(tmpdir(),'rh-migration-unit-')),sql='CREATE TABLE public.synthetic_probe (id integer PRIMARY KEY);';writeFileSync(join(dir,'001.sql'),sql);const manifest={schemaVersion:1,id:'researchhub-initial-v1',managedSchemas:['public'],steps:[{id:'001-probe',file:'001.sql',sha256:sha(sql),before:'a'.repeat(32),after:'b'.repeat(32)}]};writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));return{dir,manifest};}
test('plan binds exact target, source and schema; apply needs the exact reviewed digest',()=>{
 const f=fixture();try{const b=loadMigrationBundle(f.dir),state={database:'rh_deploy_test',role:'postgres',markerDigest:'m'.repeat(64),fingerprint:'a'.repeat(32),applied:[]};const p=makeMigrationPlan(b,state);assert.equal(p.pending.length,1);assert.throws(()=>assertMigrationApproval(p,'wrong'),/MIGRATION_APPROVAL_REQUIRED/);assert.doesNotThrow(()=>assertMigrationApproval(p,p.digest));assert.notEqual(makeMigrationPlan(b,{...state,database:'another'}).digest,p.digest);assert.throws(()=>makeMigrationPlan(b,{...state,fingerprint:'c'.repeat(32)}),/MIGRATION_BASELINE_MISMATCH/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('source tampering, path escape and transaction-breaking SQL reject before a target call',()=>{
 const f=fixture();try{writeFileSync(join(f.dir,'001.sql'),'ALTER SYSTEM SET work_mem=1;');assert.throws(()=>loadMigrationBundle(f.dir),/MIGRATION_SOURCE_MISMATCH/);const malicious='COMMIT; DROP TABLE public.anything;';f.manifest.steps[0].sha256=sha(malicious);writeFileSync(join(f.dir,'001.sql'),malicious);writeFileSync(join(f.dir,'manifest.json'),JSON.stringify(f.manifest));assert.throws(()=>loadMigrationBundle(f.dir),/MIGRATION_TRANSACTION_ESCAPE/);f.manifest.steps[0].file='../001.sql';writeFileSync(join(f.dir,'manifest.json'),JSON.stringify(f.manifest));assert.throws(()=>loadMigrationBundle(f.dir),/MIGRATION_FILE_REJECTED/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('inline psql execution and include commands cannot escape the migration transaction',()=>{
 const f=fixture();try{for(const sql of ["SELECT 'COMMIT' AS command \\gexec",'SELECT 1; \\i other.sql','SELECT 1 \\! echo unsafe','ABORT;','END;',"PREPARE TRANSACTION 'escape';"]){
  f.manifest.steps[0].sha256=sha(sql);writeFileSync(join(f.dir,'001.sql'),sql);writeFileSync(join(f.dir,'manifest.json'),JSON.stringify(f.manifest));assert.throws(()=>loadMigrationBundle(f.dir),/MIGRATION_TRANSACTION_ESCAPE/);
 }}finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('idempotence accepts only an exact ordered ledger and checks the final catalog',()=>{
 const f=fixture();try{const b=loadMigrationBundle(f.dir),step=b.manifest.steps[0],state={database:'rh_deploy_test',role:'postgres',markerDigest:'m'.repeat(64),fingerprint:'b'.repeat(32),applied:[{id:step.id,sha256:step.sha256}]};assert.equal(makeMigrationPlan(b,state).pending.length,0);assert.throws(()=>makeMigrationPlan(b,{...state,applied:[{id:step.id,sha256:'0'.repeat(64)}]}),/MIGRATION_LEDGER_MISMATCH/);const script=migrationTransaction(b,step,{database:state.database,role:state.role,markerDigest:state.markerDigest});assert(script.startsWith('BEGIN;'));assert(script.includes('pg_advisory_xact_lock'));assert(script.includes("SET LOCAL lock_timeout='2s'"));assert(script.endsWith('COMMIT;\n'));
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
