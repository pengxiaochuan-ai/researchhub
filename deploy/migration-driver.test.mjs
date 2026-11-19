import test from'node:test';import assert from'node:assert/strict';import{mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync,chmodSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'rh-driver-unit-')),configFile=join(dir,'operator.json'),connectionFile=join(dir,'connection.json'),called=join(dir,'fake-reader-called'),reader=join(dir,'fake-psql');
 const connection={PGHOST:'synthetic.invalid',PGPORT:'5432',PGDATABASE:'synthetic',PGUSER:'operator',PGPASSWORD:'synthetic-not-a-secret',PGSSLMODE:'verify-full'};
 const config={tier:'production',executeProduction:true,deploymentId:'synthetic-driver-test',expectedMarkerDigest:'a'.repeat(64),expectedDatabase:'synthetic',expectedRole:'operator',connectionFile,psql:reader};
 // This executable never connects to PostgreSQL. It records only its input and
 // returns an intentionally mismatched identity to exercise the real CLI guard.
 writeFileSync(reader,'#!/usr/bin/env node\nconst fs=require("node:fs");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{fs.writeFileSync('+JSON.stringify(called)+',s);console.log(JSON.stringify({database:"wrong",role:"operator",markerDigest:"'+ 'a'.repeat(64)+'",fingerprint:"'+ 'b'.repeat(32)+'",ledger:false}));});\n',{mode:0o700});
 const save=()=>{writeFileSync(configFile,JSON.stringify(config),{mode:0o600});writeFileSync(connectionFile,JSON.stringify(connection),{mode:0o600});};save();
 const run=(command='plan',digest)=>spawnSync(process.execPath,['deploy/migration-runner.mjs',command,'deploy/migrations/researchhub-production-equivalence-v1',configFile,...(digest?[digest]:[])],{cwd:resolve('.'),env:{PATH:process.env.PATH},encoding:'utf8'});
 return{dir,configFile,connectionFile,called,config,connection,save,run};
}
test('production pre-admission refuses missing approval, empty marker and missing apply digest before any reader',()=>{
 const f=fixture();try{f.config.executeProduction=false;f.save();assert.match(f.run().stderr,/MIGRATION_PRODUCTION_NOT_APPROVED/);f.config.executeProduction=true;f.config.expectedMarkerDigest=createHash('sha256').update('').digest('hex');f.save();assert.match(f.run().stderr,/MIGRATION_PRODUCTION_NOT_APPROVED/);f.config.expectedMarkerDigest='a'.repeat(64);f.save();assert.match(f.run('apply').stderr,/MIGRATION_PRODUCTION_NOT_APPROVED/);assert(!existsSync(f.called));}finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('production connection permissions, TLS and registered identity reject before any reader',()=>{
 const f=fixture();try{chmodSync(f.configFile,0o644);assert.match(f.run().stderr,/MIGRATION_CONFIG_PERMISSIONS_REJECTED/);chmodSync(f.configFile,0o600);f.connection.PGSSLMODE='disable';f.save();assert.match(f.run().stderr,/MIGRATION_TLS_REQUIRED/);f.connection.PGSSLMODE='verify-full';f.connection.PGDATABASE='other';f.save();assert.match(f.run().stderr,/MIGRATION_TARGET_MISMATCH/);assert(!existsSync(f.called));}finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('first returned identity mismatch aborts after a read-only probe with no ledger or DDL execution',()=>{
 const f=fixture();try{const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/MIGRATION_TARGET_MISMATCH/);const input=readFileSync(f.called,'utf8');assert.match(input,/BEGIN READ ONLY/);assert.doesNotMatch(input,/CREATE TABLE|INSERT INTO|ALTER TABLE/);}finally{rmSync(f.dir,{recursive:true,force:true});}
});
