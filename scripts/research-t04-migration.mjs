// Explicit local synthetic fixture operation. Executes one reviewed canonical migration, never migrate-deploy.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-canonical-nullable']);
const migration='20261111220000_visit_plan_draft_nullable',file=workspaceRoot+'app/server/prisma/migrations/'+migration+'/migration.sql',sql=readFileSync(file,'utf8'),hash=createHash('sha256').update(sql).digest('hex'),reviewedHash='90ca7f9c2c17a8862a554f819b6fc295e81b7221f5058cb95f87e0582b515dc5';assert.equal(hash,reviewedHash,'MIGRATION_SOURCE_CHANGED_REQUIRES_REVIEW');
const env=fixtureEnvironment();const target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
async function columns(tx){return tx.$queryRaw`SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='visit_plan' AND column_name IN ('anchor','targetDayOffset','windowBeforeDays','windowAfterDays') ORDER BY column_name`;}
async function rows(tx){return tx.$queryRaw`SELECT id,anchor,"targetDayOffset","windowBeforeDays","windowAfterDays" FROM public.visit_plan ORDER BY id`;}
const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
 assert.equal(config.databaseName,target.databaseName);assert.equal(marker.syntheticOnly,true);assert.equal(marker.runId,config.runId);
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))`;
 const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;
 if(prior){assert.equal(prior.manifest.sha256,hash);const current=await columns(tx);assert(current.length===4&&current.every(c=>c.is_nullable==='YES'&&c.column_default===null));return{...prior.manifest,reused:true};}
 await tx.$executeRawUnsafe('LOCK TABLE public.visit_plan IN ACCESS EXCLUSIVE MODE');
 const beforeColumns=await columns(tx);assert.equal(beforeColumns.length,4);assert(beforeColumns.every(c=>c.is_nullable==='NO'));assert(beforeColumns.filter(c=>c.column_name!=='anchor').every(c=>c.column_default==='0'));
 const before=await rows(tx);await tx.$executeRawUnsafe(sql);const after=await rows(tx),afterColumns=await columns(tx);assert.deepEqual(after,before);assert(afterColumns.length===4&&afterColumns.every(c=>c.is_nullable==='YES'&&c.column_default===null));
 const manifest={at:new Date().toISOString(),purpose:'research-t04-reviewed-canonical-migration-fixture',syntheticOnly:true,databaseName:config.databaseName,fixtureRunId:config.runId,migration,sha256:hash,beforeColumns,afterColumns,existingRows:before.length,beforeHash:digest(before),afterHash:digest(after),canonicalSqlOnly:true,prismaHistoryModified:false,businessRowsModified:0};
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(manifest)}::jsonb)`;return manifest;
});
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t04-2026-11-11/';mkdirSync(out,{recursive:true});writeFileSync(out+'migration.json',JSON.stringify({...result,committed:true},null,2));console.log(JSON.stringify({committed:true,reused:result.reused??false,existingRows:result.existingRows,oldValuesUnchanged:result.beforeHash===result.afterHash,migration,sha256:hash}));
