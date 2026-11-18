import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertHubAgent} from '../server/hub-sources/visible-repository.mjs';
const root=new URL('../../',import.meta.url).pathname,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
test('real read-only app PG history admission keeps current tenant/account/authVersion and explicit research Agent authority',async()=>{
 await withFixtureTransaction(env,'app',async db=>{
  await db.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true)`,ids.tenant,ids.group,ids.project);
  for(const actor of ['owner','admin']){
   const account=await db.account.findFirst({where:{tenantId:ids.tenant,id:ids[actor]}});assert(account);
   const principal={tenantId:ids.tenant,accountId:account.id,authVersion:account.authVersion},args={db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',principal};
   await assertHubAgent(args);await assert.rejects(assertHubAgent({...args,principal:{...principal,authVersion:account.authVersion+1}}),/HUB_SOURCE_SCOPE_REJECTED/);
   await assert.rejects(assertHubAgent({...args,principal:{...principal,accountId:'missing-synthetic-account'}}),/HUB_SOURCE_SCOPE_REJECTED/);
   await assert.rejects(assertHubAgent({...args,principal:{...principal,tenantId:'other'}}),/HUB_SOURCE_SCOPE_REJECTED/);
  }
 },{readOnly:true});
});
