import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {withRollback,runtime} from '../wp02/test-support.mjs';import {createHubSession} from './session.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url)),{JwtService}=require('@nestjs/jwt'),{lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
test('real synthetic PG: current authVersion/tenant/status and durable per-session logout, all rolled back',async()=>withRollback(async({direct})=>{
 const jwt=new JwtService({secret:'synthetic-session-pg-only-unique-key'}),s=createHubSession({jwt,scope:{product:'researchhub',deploymentId:'pg-session-test',allowedTenantIds:[runtime.ids.tenant]},transaction:direct,lockAuthorization:lockAuthorizationMutation});
 const a=await direct(tx=>tx.account.findUnique({where:{id:runtime.ids.owner}})),claims={accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion},one=await s.issue(claims),two=await s.issue(claims);
 await s.authenticate(one.token);await s.logout(one.token);await assert.rejects(()=>s.renew(one.token),{status:401});await s.authenticate(two.token);
 await direct(tx=>tx.account.update({where:{id:a.id},data:{authVersion:{increment:1}}}));await assert.rejects(()=>s.renew(two.token),{status:401});
 await direct(tx=>tx.account.update({where:{id:a.id},data:{authVersion:a.authVersion,status:'disabled'}}));await assert.rejects(()=>s.renew(two.token),{status:401});
 await direct(tx=>tx.account.update({where:{id:a.id},data:{status:'active'}}));await direct(tx=>tx.tenant.update({where:{id:a.tenantId},data:{status:'suspended'}}));await assert.rejects(()=>s.renew(two.token),{status:401});
}));
