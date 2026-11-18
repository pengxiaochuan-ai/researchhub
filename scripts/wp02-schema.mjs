import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function applyWp02Schema({env,expectedDigest}){
 const sql=readFileSync(root+'app/server/prisma/migrations/20261023000000_wp02_account_invitation/migration.sql','utf8'),sha=createHash('sha256').update(sql).digest('hex');assert.equal(sha,expectedDigest,'WP02_MIGRATION_DIGEST_MISMATCH');
 await withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe('SET LOCAL lock_timeout=2000');
  const rows=await tx.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3','public','account','emailNormalized');assert.equal(rows.length,0,'WP02_SCHEMA_ALREADY_PRESENT_CHECK_MANIFEST');
  for(const statement of sql.split('-- WP02 statement boundary'))await tx.$executeRawUnsafe(statement.trim());
 });return{syntheticOnly:true,digest:sha};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert.equal(process.argv[2],'apply');const out=root+'docs/test/evidence/2026-10-23-researchhub-wp02/';assert(existsSync(out+'baseline.json'),'WP02_BASELINE_REQUIRED');assert(!existsSync(out+'schema-applied.json'),'WP02_SCHEMA_MANIFEST_EXISTS');
 const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
 const expectedDigest=process.argv[3];assert.match(expectedDigest??'',/^[a-f0-9]{64}$/,'WP02_EXPLICIT_DIGEST_REQUIRED');
 const result=await applyWp02Schema({env,expectedDigest});writeFileSync(out+'schema-applied.json',JSON.stringify({at:new Date().toISOString(),...result},null,2),{flag:'wx'});console.log(JSON.stringify(result));
}
