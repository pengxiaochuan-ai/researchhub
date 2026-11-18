// Apply only the independently reviewed compatibility CHECK to the guarded synthetic database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-reviewed-email-channel']);
const migration='20261112030000_participant_email_channel',sql=readFileSync(workspaceRoot+'app/server/prisma/migrations/'+migration+'/migration.sql','utf8');
const sha256=createHash('sha256').update(sql).digest('hex'),rollbackSha256=createHash('sha256').update(readFileSync(workspaceRoot+'researchhub/docs/planning/research-study-workflow-2026-11-11/t11-outreach/rollback.sql')).digest('hex');
assert.equal(sha256,'ef41733e9bedd8127408491fbe10f429e04cdbe564b55b066629d051a8f2cc0e');assert.equal(rollbackSha256,'3e642c68949f71d91100c40850a8d73b7e61587769b737e3d7250acc80eb98c0');
const env=fixtureEnvironment(),target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
async function snapshot(tx){
 const [rows]=await tx.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY id),'')) AS fingerprint FROM public.participant_contact c`;
 const [history]=await tx.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) AS fingerprint FROM public._prisma_migrations m`;
 const [security]=await tx.$queryRaw`SELECT relrowsecurity,relforcerowsecurity,relacl::text FROM pg_class WHERE oid='public.participant_contact'::regclass`;
 return {rows,history,security};
}
const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
 assert(marker.syntheticOnly);assert.equal(config.databaseName,target.databaseName);
 await tx.$executeRawUnsafe('SET LOCAL row_security = off');await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))`;
 const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;
 if(prior){assert.equal(prior.manifest.sha256,sha256);return {...prior.manifest,reused:true};}
 await tx.$executeRawUnsafe('LOCK TABLE public.participant_contact IN ACCESS EXCLUSIVE MODE');
 await tx.$executeRawUnsafe('LOCK TABLE public._prisma_migrations IN SHARE MODE');
 const [constraint]=await tx.$queryRaw`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.participant_contact'::regclass AND conname='participant_contact_channel_check'`;
 assert(constraint?.definition.includes('sms_sandbox')&&constraint.definition.includes('wecom_sandbox')&&!constraint.definition.includes('email'));
 const before=await snapshot(tx);
 assert(!sql.includes('$rh_email_check$')&&!sql.includes('$rh_email_sql$'));
 await tx.$executeRawUnsafe('DO $rh_email_check$ BEGIN EXECUTE $rh_email_sql$'+sql+'$rh_email_sql$; END $rh_email_check$;');
 const after=await snapshot(tx);assert.deepEqual(after,before);
 const [updated]=await tx.$queryRaw`SELECT pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint WHERE conrelid='public.participant_contact'::regclass AND conname='participant_contact_channel_check'`;
 assert(updated.convalidated&&updated.definition.includes('email')&&updated.definition.includes('sms_sandbox')&&updated.definition.includes('wecom_sandbox'));
 const record={at:new Date().toISOString(),syntheticOnly:true,migration,databaseName:config.databaseName,sha256,rollbackSha256,before,after,oldRowsAndSecurityUnchanged:true,prismaHistoryModified:false,forwardInOneGuardedTransaction:true,constraintValidated:true,emailSent:false,productionAcceptance:false};
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(record)}::jsonb)`;return record;
});
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t12-2026-11-12/';mkdirSync(out,{recursive:true});writeFileSync(out+'email-channel-migration.json',JSON.stringify({...result,committed:true},null,2));console.log(JSON.stringify({committed:true,sha256,reused:result.reused??false,oldRowsAndSecurityUnchanged:true,emailSent:false}));
