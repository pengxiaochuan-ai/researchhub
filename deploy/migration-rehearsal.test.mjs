import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {loadMigrationBundle,catalogFingerprintSql} from './migration-plan.mjs';
import {rehearsalDriver,migrationPlan,applyMigrations} from './migration-runner.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const stateFile=process.env.HUB_DEPLOY_REHEARSAL_STATE;
test('owned synthetic PostgreSQL checks baseline, applies once, detects drift and rolls failed DDL back',{skip:!stateFile},()=>{
 const state=JSON.parse(readFileSync(stateFile)),run=rehearsalDriver(state),dir=mkdtempSync(join(tmpdir(),'rh-migration-pg-'));
 const schemas=['public'],fp=()=>run(`BEGIN READ ONLY; SET LOCAL search_path=pg_catalog; ${catalogFingerprintSql(schemas)}; ROLLBACK;`).trim();
 const name='rh_deploy_probe_'+createHash('sha256').update(state.runId).digest('hex').slice(0,10),bundleId='probe-'+name.replaceAll('_','-');
 assert.equal(run(`SELECT to_regclass('public.${name}') IS NULL;`).trim(),'t','fresh owned probe is required; never modify an earlier run');
 const before=fp(),sql=`CREATE TABLE public.${name} (id integer PRIMARY KEY, note text NOT NULL);`;
 const after=run(`BEGIN; SET LOCAL search_path=pg_catalog; ${sql} ${catalogFingerprintSql(schemas)}; ROLLBACK;`).trim();assert.equal(fp(),before);
 const manifest={schemaVersion:1,id:bundleId,managedSchemas:schemas,steps:[{id:'001-create',file:'001.sql',sha256:sha(sql),before,after}]};
 writeFileSync(join(dir,'001.sql'),sql);writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));
 try{
  const bundle=loadMigrationBundle(dir),plan=migrationPlan(bundle,run);
  assert.throws(()=>applyMigrations(bundle,run,'incorrect'),/MIGRATION_APPROVAL_REQUIRED/);assert.equal(fp(),before);
  const done=applyMigrations(bundle,run,plan.digest);assert.equal(done.appliedNow,1);assert.equal(done.pending.length,0);assert.equal(fp(),after);
  const repeat=migrationPlan(bundle,run);assert.equal(applyMigrations(bundle,run,repeat.digest).appliedNow,0);
  run(`ALTER TABLE public.${name} ADD COLUMN drift text;`);assert.throws(()=>migrationPlan(bundle,run),/MIGRATION_BASELINE_MISMATCH/);run(`ALTER TABLE public.${name} DROP COLUMN drift;`);
  // A different named bundle fails after creating its table; neither it nor its ledger row survives.
  const failureSql=`CREATE TABLE public.${name}_failed (id integer); SELECT 1/0;`,failureBefore=fp();
  const bad={schemaVersion:1,id:bundleId+'-failure',managedSchemas:schemas,steps:[{id:'001-fail',file:'fail.sql',sha256:sha(failureSql),before:failureBefore,after:'0'.repeat(32)}]};
  writeFileSync(join(dir,'fail.sql'),failureSql);writeFileSync(join(dir,'manifest.json'),JSON.stringify(bad));const failedBundle=loadMigrationBundle(dir),failurePlan=migrationPlan(failedBundle,run);
  assert.throws(()=>applyMigrations(failedBundle,run,failurePlan.digest));assert.equal(fp(),failureBefore);assert.equal(run(`SELECT to_regclass('public.${name}_failed') IS NULL;`).trim(),'t');assert.equal(run(`SELECT count(*) FROM rh_deploy.migration WHERE bundle='${bad.id}';`).trim(),'0');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
