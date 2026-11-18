import {registerTestAdmission} from '../admission/test-support.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createAccountAccess} from './account-service.mjs';import {bcrypt,runtime,withRollback} from './test-support.mjs';
test('registration requires delivered one-time proof and creates no private membership; reset revokes old authVersion',async()=>{
 await withRollback(async({db,direct})=>{
 await direct(async tx=>{const seats=await tx.account.count({where:{tenantId:runtime.ids.tenant}});await tx.tenant.update({where:{id:runtime.ids.tenant},data:{quotaSeats:seats+3}});});
 const tag=randomUUID().slice(0,8),email='wp02-'+tag+'@example.test',ctx={ip:'unit-'+tag},deliveries=[];
 let clock=Date.now();
 const s=createAccountAccess({registerAdmissionInTransaction:registerTestAdmission,db,bcrypt,secret:runtime.secret,config:{baseUrl:'http://127.0.0.1:19501'},now:()=>new Date(clock),mailer:{send:async m=>{deliveries.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
 await s.requestRegistration(ctx,{email:email.toUpperCase(),requestKey:'request-'+tag});
 const token=deliveries[0].tokenUrl.split('=')[1],password='Initial-'+tag+'-password';
 const input={token,password,displayName:'WP02合成新成员',requestKey:'confirm-'+tag};
 const first=await s.confirmRegistration(ctx,input),replay=await s.confirmRegistration(ctx,input);assert.equal(first.created,true);assert.equal(replay.created,true);
 const account=await direct(tx=>tx.account.findFirst({where:{tenantId:runtime.ids.tenant,username:email}}));assert(account);assert.equal(account.role,'researcher');assert.equal(account.isTenantAdmin,false);
 const counts=await direct(async tx=>({groups:await tx.studyGroupMembership.count({where:{accountId:account.id}}),projects:await tx.researchProjectMembership.count({where:{accountId:account.id}}),agents:await tx.agentAccess.count({where:{accountId:account.id}}),capabilities:await tx.accountCapability.count({where:{accountId:account.id}})}));assert.deepEqual(counts,{groups:0,projects:0,agents:0,capabilities:0});
 await assert.rejects(s.confirmRegistration(ctx,{...input,requestKey:'other-'+tag,password:'Different-'+tag+'-password'}));
 await s.requestReset(ctx,{email,requestKey:'reset-'+tag});const resetToken=deliveries.at(-1).tokenUrl.split('=')[1];
 await assert.rejects(s.confirmReset({...ctx,ip:'wrong-purpose-'+tag},{token,password,requestKey:'wrong-purpose-'+tag}));
 const changed='Changed-'+tag+'-password';await s.confirmReset(ctx,{token:resetToken,password:changed,requestKey:'reset-confirm-'+tag});
 const updated=await direct(tx=>tx.account.findUnique({where:{id:account.id}}));assert.equal(updated.authVersion,account.authVersion+1);assert.equal(await bcrypt.compare(changed,updated.passwordHash),true);assert.equal(await bcrypt.compare(password,updated.passwordHash),false);
 await assert.rejects(s.confirmReset(ctx,{token:resetToken,password:'Other-'+tag+'-password',requestKey:'replay-'+tag}));
 });
});
test('unknown delivery, expiry, spoofed fields and failed redemption quota reject without creating account',async()=>withRollback(async({db,direct})=>{
 await direct(async tx=>{const seats=await tx.account.count({where:{tenantId:runtime.ids.tenant}});await tx.tenant.update({where:{id:runtime.ids.tenant},data:{quotaSeats:seats+3}});});
 const tag=randomUUID().slice(0,8),ctx={ip:'negative-'+tag},emails=[];let clock=Date.now();
 const s=createAccountAccess({registerAdmissionInTransaction:registerTestAdmission,db,bcrypt,secret:runtime.secret,config:{baseUrl:'http://127.0.0.1:19501'},now:()=>new Date(clock),mailer:{send:async m=>{emails.push(m);return{status:'unknown'};}}});
 const email='negative-'+tag+'@example.test';await s.requestRegistration(ctx,{email,requestKey:'request-'+tag});
 const token=emails[0].tokenUrl.split('=')[1],input={token,password:'Correct-12-Password',displayName:'合成',requestKey:'confirmation-'+tag};
 for(let i=0;i<5;i++)await assert.rejects(s.confirmRegistration(ctx,input),e=>e.code==='WP02_INVALID_TOKEN');
 await assert.rejects(s.confirmRegistration(ctx,input),e=>e.status===429);
 await assert.rejects(s.requestRegistration(ctx,{email,requestKey:'different-'+tag,role:'tenant_admin'}),e=>e.code==='WP02_INVALID_FIELDS');
 assert.equal(await direct(tx=>tx.account.count({where:{tenantId:runtime.ids.tenant,username:email}})),0);
 const known=await s.requestRegistration({ip:'known-'+tag},{email:'OWNER@EXAMPLE.ORG',requestKey:'known-'+tag});assert.equal(known.accepted,true);assert.equal(emails.length,1);
}));
test('delivered registration expires and verified profile uses CAS plus request replay protection',async()=>withRollback(async({db,direct})=>{
 await direct(async tx=>{const seats=await tx.account.count({where:{tenantId:runtime.ids.tenant}});await tx.tenant.update({where:{id:runtime.ids.tenant},data:{quotaSeats:seats+3}});});
 const tag=randomUUID().slice(0,8),ctx={ip:'profile-'+tag},emails=[];let clock=Date.now();
 const s=createAccountAccess({registerAdmissionInTransaction:registerTestAdmission,db,bcrypt,secret:runtime.secret,config:{baseUrl:'http://127.0.0.1:19501'},now:()=>new Date(clock),mailer:{send:async m=>{emails.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
 const email='profile-'+tag+'@example.test';await s.requestRegistration(ctx,{email,requestKey:'request-'+tag});const input={token:emails[0].tokenUrl.split('=')[1],password:'Correct-12-Password',displayName:'合成新用户',requestKey:'confirm-'+tag};clock+=900001;await assert.rejects(s.confirmRegistration(ctx,input));clock-=900001;
 await s.confirmRegistration(ctx,input);const a=await direct(tx=>tx.account.findFirst({where:{tenantId:runtime.ids.tenant,username:email}})),who={...ctx,user:{accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion}};
 const p=await s.readProfile(who),edit={displayName:'合成修订',baseVersion:p.baseVersion,requestKey:'profile-edit-'+tag};
 const updated=await s.updateProfile(who,edit);assert.equal(updated.displayName,'合成修订');assert.equal((await s.updateProfile(who,edit)).displayName,'合成修订');
 await assert.rejects(s.updateProfile(who,{...edit,displayName:'其他名称'}),e=>e.status===409);
 await assert.rejects(s.updateProfile(who,{...edit,requestKey:'fresh-profile-'+tag,displayName:'又一名称'}),e=>e.status===409);
}));
test('unconfirmed delivery and audit failure cannot create account; reset checks current version and status',async()=>withRollback(async({db,direct})=>{
 await direct(async tx=>{const seats=await tx.account.count({where:{tenantId:runtime.ids.tenant}});await tx.tenant.update({where:{id:runtime.ids.tenant},data:{quotaSeats:seats+3}});});
 const tag=randomUUID().slice(0,8),ctx={ip:'failure-'+tag},mails=[];let failDelivery=true,failAudit=false;
 const guarded={...db,transaction:fn=>db.transaction(tx=>fn(new Proxy(tx,{get(t,k){
  if(k==='$executeRawUnsafe')return(sql,...args)=>{if(failDelivery&&sql.startsWith('UPDATE account_action_challenge SET "deliveryStatus"='))throw Error('INJECTED_DELIVERY_COMMIT');return t[k](sql,...args);};
  if(k==='auditLog'&&failAudit)return{create:()=>{throw Error('INJECTED_AUDIT_COMMIT');},createMany:()=>{throw Error('INJECTED_AUDIT_COMMIT');}};return t[k];
 }})))};
 const s=createAccountAccess({registerAdmissionInTransaction:registerTestAdmission,db:guarded,bcrypt,secret:runtime.secret,config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:async m=>{mails.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
 const email='failure-'+tag+'@example.test';await assert.rejects(s.requestRegistration(ctx,{email,requestKey:'request-'+tag}),e=>e.status===503);failDelivery=false;
 const input={token:mails[0].tokenUrl.split('=')[1],password:'Synthetic-Failure-Password',displayName:'故障回滚',requestKey:'confirm-'+tag};await assert.rejects(s.confirmRegistration(ctx,input),e=>e.code==='WP02_INVALID_TOKEN');
 assert.equal(await direct(tx=>tx.account.count({where:{tenantId:runtime.ids.tenant,username:email}})),0);
 const email2='audit-'+tag+'@example.test';await s.requestRegistration(ctx,{email:email2,requestKey:'audit-request-'+tag});const good={...input,token:mails.at(-1).tokenUrl.split('=')[1],requestKey:'audit-confirm-'+tag};failAudit=true;await assert.rejects(s.confirmRegistration(ctx,good),/INJECTED_AUDIT_COMMIT/);failAudit=false;
 assert.equal(await direct(tx=>tx.account.count({where:{tenantId:runtime.ids.tenant,username:email2}})),0);await s.confirmRegistration(ctx,good);
 const account=await direct(tx=>tx.account.findFirst({where:{tenantId:runtime.ids.tenant,username:email2}}));await s.requestReset(ctx,{email:email2,requestKey:'reset-request-'+tag});const reset={token:mails.at(-1).tokenUrl.split('=')[1],password:'Changed-Failure-Password',requestKey:'reset-confirm-'+tag};
 await direct(tx=>tx.account.update({where:{id:account.id},data:{authVersion:{increment:1}}}));await assert.rejects(s.confirmReset(ctx,reset),e=>e.code==='WP02_INVALID_TOKEN');
 await direct(tx=>tx.account.update({where:{id:account.id},data:{authVersion:account.authVersion,status:'disabled'}}));await assert.rejects(s.confirmReset(ctx,reset),e=>e.code==='WP02_INVALID_TOKEN');const unchanged=await direct(tx=>tx.account.findUnique({where:{id:account.id}}));assert.equal(unchanged.passwordHash,account.passwordHash);assert.equal(unchanged.status,'disabled');
}));
