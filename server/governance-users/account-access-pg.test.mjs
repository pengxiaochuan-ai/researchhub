import {registerTestAdmission} from '../admission/test-support.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {createAccountAccess} from '../wp02/account-service.mjs';import {createWp02Repository} from '../wp02/repository.mjs';import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});const bcrypt=require('bcryptjs'),{lockAuthorizationMutation}=require('./src/common/worker-publication.ts'),{env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8')),rollback=Error('P2_ACCOUNT_ACCESS_ROLLBACK');
test('existing self password-reset path keeps email verification, advances version once and cannot add Study membership (rollback only)',async()=>{
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true),set_config('app.research_project_id','',true)`;
  const id='rh-p2-reset-'+randomUUID(),email=id+'@example.test',password='Synthetic-reset-password-2026';
  await tx.account.create({data:{id,tenantId:ids.tenant,username:email,passwordHash:await bcrypt.hash('Synthetic-old-password-2026',10),displayName:'P2密码回滚对照'}});
  await tx.$executeRaw`UPDATE public.account SET "emailNormalized"=${email},"emailVerifiedAt"=now() WHERE id=${id} AND "tenantId"=${ids.tenant}`;
  const db=createWp02Repository({tenantId:ids.tenant,transact:fn=>fn(tx),lockAuthorization:lockAuthorizationMutation}),mail=[];
  const service=createAccountAccess({registerAdmissionInTransaction:registerTestAdmission,db,bcrypt,secret:'p2-synthetic-test-secret-not-production-2026',config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:async message=>{mail.push(message);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
  await service.requestReset({ip:id},{email,requestKey:randomUUID()});assert.equal(mail.length,1);const token=mail[0].tokenUrl.split('#reset=')[1];assert(token);
  const input={token,password,requestKey:randomUUID()};assert.deepEqual(await service.confirmReset({ip:id},input),{reset:true});assert.deepEqual(await service.confirmReset({ip:id},input),{reset:true});
  const changed=await tx.account.findUnique({where:{id}});assert.equal(changed.authVersion,1);assert(await bcrypt.compare(password,changed.passwordHash));assert.equal(await tx.studyGroupMembership.count({where:{accountId:id}}),0);
  await assert.rejects(service.confirmReset({ip:id},{...input,requestKey:randomUUID()}),{code:'WP02_INVALID_TOKEN'});throw rollback;
 }),e=>e===rollback);
});
