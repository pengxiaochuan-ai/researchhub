import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createMemberInvitations} from './invitation-service.mjs';import {withRollback,runtime,fixture,direct} from './test-support.mjs';
import {createAdmissionService} from '../admission/service.mjs';
async function recipient(tx,email,{approved=true}={}){const a=await tx.account.create({data:{tenantId:runtime.ids.tenant,username:email,passwordHash:'rollback-only-no-login',displayName:'合成受邀者',emailNormalized:email,emailVerifiedAt:new Date()}});
 const svc=createAdmissionService({tenantId:a.tenantId,transact:fn=>fn(tx),lockAuthorization:async()=>{}});await svc.registerInTransaction(tx,a,'test-register-'+a.id);const user={accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion},own=await svc.self(user);if(approved)await svc.decide(manager,own.id,{action:'approve',baseRevision:1,requestKey:'test-approve-'+a.id});return user;}
const manager={accountId:runtime.ids.admin,tenantId:runtime.ids.tenant,authVersion:0};
test.beforeEach(async()=>{manager.authVersion=(await direct(tx=>tx.account.findUnique({where:{id:manager.accountId},select:{authVersion:true}}))).authVersion;});
test('a real pending registration cannot accept a valid invitation or create private memberships',async()=>withRollback(async({db,direct})=>{
 const tag=randomUUID().slice(0,8),email='pending-'+tag+'@example.test',user=await direct(tx=>recipient(tx,email,{approved:false})),mail=[];
 const s=createMemberInvitations({db,secret:runtime.secret,target:fixture,config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:async m=>{mail.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
 await s.issue({user:manager,groupId:fixture.groupId,projectId:fixture.projectId,ip:'pending-issuer-'+tag},{email,requestKey:'issue-pending-'+tag});
 await assert.rejects(s.accept({user,ip:'pending-recipient-'+tag},{token:mail[0].tokenUrl.split('=')[1],requestKey:'accept-pending-'+tag}),e=>e.code==='HUB_ADMISSION_REQUIRED');
 assert.equal(await direct(tx=>tx.studyGroupMembership.count({where:{accountId:user.accountId}})),0);assert.equal(await direct(tx=>tx.researchProjectMembership.count({where:{accountId:user.accountId}})),0);
}));
test('only new scope manager may invite; matching verified recipient explicitly accepts just target Study',async()=>withRollback(async({db,direct})=>{
 const tag=randomUUID().slice(0,8),email='invite-'+tag+'@example.test',user=await direct(tx=>recipient(tx,email)),mail=[];
 const s=createMemberInvitations({db,secret:runtime.secret,target:fixture,config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:async m=>{mail.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
 const ctx={user:manager,groupId:fixture.groupId,projectId:fixture.projectId,ip:'manager-'+tag};
 await assert.rejects(s.issue({...ctx,groupId:runtime.ids.group,projectId:runtime.ids.project},{email,requestKey:'old-study-'+tag}),e=>e.status===403);
 const inv=await s.issue(ctx,{email,requestKey:'issue-'+tag}),token=mail[0].tokenUrl.split('=')[1];assert.equal(inv.deliveryStatus,'captured');assert(!JSON.stringify(inv).includes(token));
 await assert.rejects(s.preview({...ctx,user:{...manager,accountId:runtime.ids.owner}},{token}),e=>e.status===404);
 const preview=await s.preview({user,ip:'recipient-'+tag},{token});assert.equal(preview.researchProject.id,fixture.projectId);
 const input={token,requestKey:'accept-'+tag},result=await s.accept({user,ip:'recipient-'+tag},input);assert.equal(result.researchProjectId,fixture.projectId);assert.equal((await s.accept({user,ip:'recipient-'+tag},input)).accepted,true);
 const memberships=await direct(tx=>tx.researchProjectMembership.findMany({where:{accountId:user.accountId}}));assert.equal(memberships.length,1);assert.equal(memberships[0].roleKey,'researcher');
 const group=await direct(tx=>tx.studyGroupMembership.findFirst({where:{accountId:user.accountId}}));assert.equal(group.roleId,fixture.readerRoleId);assert.equal((await s.context({user,groupId:fixture.groupId,projectId:fixture.projectId})).canInvite,false);
 await assert.rejects(s.list({user,groupId:fixture.groupId,projectId:fixture.projectId},{}),e=>e.status===403);
 await direct(tx=>tx.studyGroupMembership.updateMany({where:{accountId:user.accountId,studyGroupId:fixture.groupId},data:{status:'disabled'}}));
 await assert.rejects(s.preview({user,ip:'after-revocation-'+tag},{token}),e=>e.status===404);
}));
test('explicit resend rotates the old link, enforces version and accepts only current email',async()=>withRollback(async({db,direct})=>{
 const tag=randomUUID().slice(0,8),email='resend-'+tag+'@example.test',user=await direct(tx=>recipient(tx,email)),mail=[];let clock=Date.now();
 const s=createMemberInvitations({db,secret:runtime.secret,target:fixture,config:{baseUrl:'http://127.0.0.1:19501'},now:()=>new Date(clock),mailer:{send:async m=>{mail.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}}),ctx={user:manager,groupId:fixture.groupId,projectId:fixture.projectId,ip:'manager-'+tag};
 const inv=await s.issue(ctx,{email,requestKey:'issue-'+tag}),old=mail[0].tokenUrl.split('=')[1],input={baseVersion:inv.version,requestKey:'resend-'+tag};
 await assert.rejects(s.resend(ctx,inv.id,input),e=>e.status===429);clock+=60001;const next=await s.resend(ctx,inv.id,input);assert(next.version>inv.version);assert.equal((await s.resend(ctx,inv.id,input)).version,next.version);assert.equal(mail.length,2);
 await assert.rejects(s.preview({user,ip:'recipient-'+tag},{token:old}),e=>e.status===404);assert.equal((await s.preview({user,ip:'recipient-'+tag},{token:mail[1].tokenUrl.split('=')[1]})).researchProject.id,fixture.projectId);
 await assert.rejects(s.revoke(ctx,inv.id,{baseVersion:inv.version,requestKey:'stale-'+tag}),e=>e.status===409);
 const list=await s.list(ctx,{limit:'1'});assert.equal(list.items.length,1);assert(!JSON.stringify(list).includes('tokenHash'));
}));
test('failure before project membership commit rolls back group membership and token acceptance',async()=>withRollback(async({db,direct})=>{
 const tag=randomUUID().slice(0,8),email='atomic-'+tag+'@example.test',user=await direct(tx=>recipient(tx,email)),mail=[];
 let fail=false;const guardedDb={...db,transaction:fn=>db.transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='researchProjectMembership'&&fail)return new Proxy(t[k],{get(model,method){if(method==='create')return()=>{throw new Error('INJECTED_PROJECT_WRITE_FAILURE');};return model[method];}});return t[k];}})))};
 const s=createMemberInvitations({db:guardedDb,secret:runtime.secret,target:fixture,config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:async m=>{mail.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}}),ctx={user:manager,groupId:fixture.groupId,projectId:fixture.projectId,ip:'manager-'+tag};
 const inv=await s.issue(ctx,{email,requestKey:'issue-'+tag}),token=mail[0].tokenUrl.split('=')[1];fail=true;
 await assert.rejects(s.accept({user,ip:'recipient-'+tag},{token,requestKey:'accept-'+tag}),/INJECTED_PROJECT_WRITE_FAILURE/);
 assert.equal(await direct(tx=>tx.studyGroupMembership.count({where:{accountId:user.accountId}})),0);
 const rows=await direct(tx=>tx.$queryRawUnsafe('SELECT "acceptedAt" FROM research_member_invitation WHERE id=$1',inv.id));assert.equal(rows[0].acceptedAt,null);
}));
test('revocation, issuer loss and disabled target membership cannot be silently repaired on acceptance',async()=>withRollback(async({db,direct})=>{
 const tag=randomUUID().slice(0,8),email='revoked-'+tag+'@example.test',user=await direct(tx=>recipient(tx,email)),mail=[];
 const s=createMemberInvitations({db,secret:runtime.secret,target:fixture,config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:async m=>{mail.push(m);return{status:'captured',messageId:randomUUID(),digest:'a'.repeat(64)};}}});
 const ctx={user:manager,groupId:fixture.groupId,projectId:fixture.projectId,ip:'manager-'+tag},inv=await s.issue(ctx,{email,requestKey:'issue-'+tag}),token=mail[0].tokenUrl.split('=')[1];
 await s.revoke(ctx,inv.id,{baseVersion:inv.version,requestKey:'revoke-'+tag});await assert.rejects(s.accept({user,ip:'r-'+tag},{token,requestKey:'accept-'+tag}));
 const email2='disabled-'+tag+'@example.test',user2=await direct(tx=>recipient(tx,email2)),inv2=await s.issue(ctx,{email:email2,requestKey:'issue-second-'+tag}),token2=mail.at(-1).tokenUrl.split('=')[1];
 await direct(tx=>tx.studyGroupMembership.create({data:{tenantId:runtime.ids.tenant,studyGroupId:fixture.groupId,accountId:user2.accountId,roleId:fixture.readerRoleId,status:'disabled'}}));
 await assert.rejects(s.accept({user:user2,ip:'r2-'+tag},{token:token2,requestKey:'accept2-'+tag}),e=>e.status===409);assert.equal(await direct(tx=>tx.researchProjectMembership.count({where:{accountId:user2.accountId}})),0);
 await direct(tx=>tx.researchProjectMembership.updateMany({where:{researchProjectId:fixture.projectId,accountId:manager.accountId},data:{status:'disabled'}}));
 await assert.rejects(s.preview({user:user2,ip:'r3-'+tag},{token:token2}),e=>e.status===404);
}));
test('failed or unknown SMTP and issuer loss during send cannot become consumable invitations',async()=>withRollback(async({db,direct})=>{
 const tag=randomUUID().slice(0,8),ctx={user:manager,groupId:fixture.groupId,projectId:fixture.projectId,ip:'inflight-'+tag};let clock=Date.now();
 for(const status of['failed','unknown','captured']){
  const email=status+'-'+tag+'@example.test',user=await direct(tx=>recipient(tx,email));let token;
  const s=createMemberInvitations({db,secret:runtime.secret,target:fixture,config:{baseUrl:'http://127.0.0.1:19501'},now:()=>new Date(clock),mailer:{send:async m=>{token=m.tokenUrl.split('=')[1];if(status==='captured')await direct(tx=>tx.researchProjectMembership.updateMany({where:{researchProjectId:fixture.projectId,accountId:manager.accountId},data:{status:'disabled'}}));return{status,messageId:randomUUID(),digest:'a'.repeat(64)};}}});
  if(status==='captured')await assert.rejects(s.issue(ctx,{email,requestKey:'issue-'+status+'-'+tag}),e=>e.status===403);else{const inv=await s.issue(ctx,{email,requestKey:'issue-'+status+'-'+tag});assert.equal(inv.deliveryStatus,status);}
  await assert.rejects(s.preview({user,ip:status+'-'+tag},{token}),e=>e.status===404);assert.equal(await direct(tx=>tx.researchProjectMembership.count({where:{accountId:user.accountId}})),0);
 }
}));
