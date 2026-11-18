import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {consumeRate} from '../server/wp02/repository.mjs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
let mode=process.argv[2];
if(['all','accounts-green','invitations-green'].includes(mode)){
 const files=mode==='all'?['account-service','invitation-service']:mode==='accounts-green'?['account-service']:['invitation-service'];
 const r=spawnSync(process.execPath,['--test',...files.map(n=>'server/wp02/'+n+'.test.mjs')],{cwd:root+'researchhub',stdio:'inherit'});assert.equal(r.status,0,'WP02_PG_DOMAIN_TEST_FAILED');
 if(mode!=='all')process.exit(0);mode='schema-green';
}
if(mode==='schema-red'||mode==='schema-green'){
 await withFixtureTransaction(env,'direct',async tx=>{
  const columns=await tx.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name IN ($3,$4)','public','account','emailNormalized','emailVerifiedAt');assert.equal(columns.length,2,'WP02_EMAIL_COLUMNS_MISSING');
  for(const name of ['account_action_challenge','research_member_invitation','wp02_request_window']){const rows=await tx.$queryRawUnsafe('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=to_regclass($1)','public.'+name);assert.equal(rows.length,1,'WP02_TABLE_MISSING');assert.equal(rows[0].relrowsecurity,true);assert.equal(rows[0].relforcerowsecurity,true);}
 },{readOnly:true});
 if(mode==='schema-green'){
  const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
  const purpose='wp02-rls-'+randomUUID(),keyHash='d'.repeat(64),at=new Date();
  await withFixtureTransaction(env,'direct',tx=>consumeRate(tx,{tenantId:ids.tenant,purpose,keyHash,limit:3,windowMs:3600000,now:at}));
  const visible=async tenant=>withFixtureTransaction(env,'app',async tx=>{if(tenant)await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true)",tenant);return tx.$queryRawUnsafe('SELECT id FROM wp02_request_window WHERE purpose=$1',purpose);},{readOnly:true});
  assert.equal((await visible(null)).length,0);assert.equal((await visible(ids.tenant)).length,1);assert.equal((await visible('wp02-foreign-denied')).length,0);
  const outcomes=await Promise.all(Array.from({length:8},()=>withFixtureTransaction(env,'direct',tx=>consumeRate(tx,{tenantId:ids.tenant,purpose,keyHash,limit:3,windowMs:3600000,now:at})).then(()=>true,e=>{assert.equal(e.status,429);return false;})));assert.equal(outcomes.filter(Boolean).length,2);
  const check=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe('SELECT count FROM wp02_request_window WHERE purpose=$1',purpose),{readOnly:true});assert.equal(check[0].count,3);
  const appDelete=await withFixtureTransaction(env,'app',tx=>tx.$queryRawUnsafe('SELECT has_table_privilege(current_user,$1,$2) AS allowed','public.wp02_request_window','DELETE'),{readOnly:true});assert.equal(appDelete[0].allowed,false);
  const rollback=new Error('WP02_ROLLBACK');let emailChecked=false;
  await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
   const a=await tx.account.create({data:{tenantId:ids.tenant,username:'wp02-rollback-'+randomUUID(),passwordHash:'test-only-never-committed',displayName:'合成回滚'}});
   await tx.$executeRawUnsafe('UPDATE account SET "emailNormalized"=$1,"emailVerifiedAt"=CURRENT_TIMESTAMP WHERE id=$2','wp02-rollback@example.test',a.id);
   await tx.$executeRawUnsafe('SAVEPOINT duplicate_email');
   try{const b=await tx.account.create({data:{tenantId:ids.tenant,username:'wp02-rollback-'+randomUUID(),passwordHash:'test-only-never-committed',displayName:'合成回滚'}});await tx.$executeRawUnsafe('UPDATE account SET "emailNormalized"=$1 WHERE id=$2','wp02-rollback@example.test',b.id);assert.fail('duplicate email accepted');}catch(e){assert.equal(e.meta?.code,'23505');}
   await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT duplicate_email');emailChecked=true;throw rollback;
  }),e=>e===rollback);assert(emailChecked);
  console.log(JSON.stringify({schemaReady:true,rls:{noContext:0,own:1,foreign:0,delete:false},parallelRemainingSlots:2,emailUnique:true,originalAccountUnchanged:true}));
 }else console.log(JSON.stringify({schemaReady:true}));
}else throw new Error('WP02_PG_MODE_NOT_IMPLEMENTED');
