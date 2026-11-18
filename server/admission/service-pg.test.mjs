import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withRollback,runtime} from '../wp02/test-support.mjs';
import {createAdmissionService,assertApprovedInTransaction} from './service.mjs';
import {requestHash,decisionInput} from './policy.mjs';

test('real PG: fixed material, no implicit approval, exceptional supplement, CAS, replay, actor and tenant isolation',async()=>withRollback(async({db,direct})=>{
 await db.transaction(async tx=>{if(!(await tx.$queryRawUnsafe("SELECT to_regnamespace('rh_admission')::text AS schema"))[0].schema)for(const sql of readFileSync(new URL('./schema.sql',import.meta.url),'utf8').split(/^-- statement\s*$/m))await tx.$executeRawUnsafe(sql.trim());});
 const tenantId=runtime.ids.tenant;
 const adminAccount=await direct(tx=>tx.account.findFirst({where:{id:runtime.ids.admin},select:{id:true,tenantId:true,displayName:true,emailNormalized:true,authVersion:true,role:true,isTenantAdmin:true,passwordHash:true}}));
 assert.equal(adminAccount.isTenantAdmin,true);
 const admin={accountId:adminAccount.id,tenantId,authVersion:adminAccount.authVersion};
 const svc=createAdmissionService({tenantId,transact:db.transaction,lockAuthorization:async()=>{}});
 if((await svc.self(admin)).status==='unregistered')await db.transaction(tx=>svc.legacyInTransaction(tx,admin,adminAccount,'test-legacy-'+randomUUID()));
 const id=randomUUID(),email='f01-'+id+'@example.test';
 const a=await direct(tx=>tx.account.create({data:{id,tenantId,username:email,passwordHash:adminAccount.passwordHash,displayName:'F01 合成申请人',role:'researcher',emailNormalized:email,emailVerifiedAt:new Date()},select:{id:true,tenantId:true,displayName:true,emailNormalized:true,authVersion:true}}));
 const user={accountId:id,tenantId,authVersion:a.authVersion};
 assert.equal((await svc.self(user)).status,'unregistered');
 await assert.rejects(svc.assertApproved(user),e=>e.code==='HUB_ADMISSION_REQUIRED');
 await db.transaction(tx=>svc.registerInTransaction(tx,a,'f01-register-'+id));
 let own=await svc.self(user);assert.equal(own.status,'pending');assert.deepEqual(own.material,{registration:{displayName:a.displayName,email}});
 const lastPage=await svc.list(admin,{status:'all',page:'100000'});assert.equal(lastPage.page,Math.max(1,Math.ceil(lastPage.total/20)));assert(lastPage.items.length>0);
 const adminSelf=await svc.self(admin);
 await assert.rejects(svc.decide(admin,adminSelf.id,{action:'approve',baseRevision:adminSelf.revision,requestKey:'self-review-'+id}),e=>e.code==='HUB_ADMISSION_SELF_REVIEW');
 await assert.rejects(svc.list(user),e=>e.status===403);
 await assert.rejects(svc.self({...user,tenantId:'other-tenant'}),e=>e.status===401);
 await assert.rejects(svc.self({...user,authVersion:user.authVersion+1}),e=>e.status===401);
 await direct(tx=>tx.account.update({where:{id:admin.accountId},data:{isTenantAdmin:false}}));await assert.rejects(svc.list(admin),e=>e.status===403);
 await direct(tx=>tx.account.update({where:{id:admin.accountId},data:{isTenantAdmin:true,status:'disabled'}}));await assert.rejects(svc.list(admin),e=>e.status===401);
 await direct(tx=>tx.account.update({where:{id:admin.accountId},data:{status:'active'}}));
 const request={action:'needs_information',reason:'请补充本次研究用途',baseRevision:own.revision,requestKey:'need-'+id};
 const proof={applicationId:own.id,action:request.action,baseRevision:String(request.baseRevision),requestHash:requestHash({id:own.id,...decisionInput(request)})};
 assert.equal((await svc.operation(admin,request.requestKey,proof)).state,'unsubmitted');
 await direct(tx=>tx.account.update({where:{id},data:{emailNormalized:'changed-'+email}}));
 await assert.rejects(svc.decide(admin,own.id,request),e=>e.code==='HUB_ADMISSION_EMAIL_CHANGED');
 await direct(tx=>tx.account.update({where:{id},data:{emailNormalized:email}}));
 const first=await svc.decide(admin,own.id,request);assert.equal(first.status,'needs_information');assert.deepEqual(await svc.decide(admin,own.id,request),first);
 assert.equal((await svc.operation(admin,request.requestKey,proof)).state,'committed');
 await assert.rejects(svc.operation(admin,request.requestKey,{...proof,requestHash:'0'.repeat(64)}),e=>e.status===409);
 await assert.rejects(svc.decide(admin,own.id,{...request,reason:'changed'}),e=>e.status===409);
 const body={action:'supplement',text:'用于合成科研样例',baseRevision:first.revision,requestKey:'supplement-'+id};
 await svc.submit(user,body);own=await svc.self(user);assert.equal(own.materialVersion,2);assert.deepEqual(own.material.registration,{displayName:a.displayName,email});
 const rejected=await svc.decide(admin,own.id,{action:'reject',reason:'材料不符合本次要求',baseRevision:own.revision,requestKey:'reject-'+id});
 assert.equal((await svc.self(user)).canResubmit,false);
 await assert.rejects(svc.submit(user,{action:'resubmit',text:'不得自行重申',baseRevision:rejected.revision,requestKey:'denied-resubmit-'+id}),e=>e.code==='HUB_ADMISSION_RESUBMISSION_NOT_ALLOWED');
 // A separate real registration exercises explicitly permitted resubmission.
 const secondId=randomUUID(),secondEmail='f01-'+secondId+'@example.test';
 const second=await direct(tx=>tx.account.create({data:{id:secondId,tenantId,username:secondEmail,passwordHash:adminAccount.passwordHash,displayName:'F01 可重申样例',emailNormalized:secondEmail,emailVerifiedAt:new Date()},select:{id:true,tenantId:true,displayName:true,emailNormalized:true,authVersion:true}}));
 const secondUser={accountId:secondId,tenantId,authVersion:second.authVersion};await db.transaction(tx=>svc.registerInTransaction(tx,second,'register-'+secondId));
 const secondOwn=await svc.self(secondUser),allowed=await svc.decide(admin,secondOwn.id,{action:'reject',reason:'补充后可重申',allowResubmit:true,baseRevision:1,requestKey:'allow-'+secondId});
 assert.equal((await svc.self(secondUser)).canResubmit,true);await svc.submit(secondUser,{action:'resubmit',text:'仅补充指定要求',baseRevision:allowed.revision,requestKey:'resubmit-'+secondId});
 const secondPending=await svc.self(secondUser);assert.equal(secondPending.status,'pending');assert.equal(secondPending.canResubmit,false);assert.equal(secondPending.material.registration.email,secondEmail);
 // Continue approval and replay checks against this pending application.
 own=secondPending;
 await assert.rejects(svc.decide(admin,own.id,{action:'approve',baseRevision:1,requestKey:'stale-'+id}),e=>e.status===409);
 const approval={action:'approve',baseRevision:own.revision,requestKey:'approve-'+id};
 const approved=await svc.decide(admin,own.id,approval);assert.equal(approved.status,'approved');
 await direct(tx=>tx.account.update({where:{id:admin.accountId},data:{role:'researcher',isTenantAdmin:false}}));
 await assert.rejects(svc.operation(admin,approval.requestKey),e=>e.status===403);
 await direct(tx=>tx.account.update({where:{id:admin.accountId},data:{role:'tenant_admin',isTenantAdmin:true}}));
 await svc.assertApproved(secondUser);assert.deepEqual((await svc.operation(admin,approval.requestKey)).result,approved);
 await assert.rejects(svc.operation(user,approval.requestKey),e=>e.status===404);
 await assert.rejects(svc.submit(secondUser,{...body,action:'resubmit',baseRevision:approved.revision,requestKey:'resubmit-'+id}),e=>e.status===409);
 assert.equal(await direct(tx=>tx.studyGroupMembership.count({where:{accountId:id}})),0);
 assert.equal(await direct(tx=>tx.researchProjectMembership.count({where:{accountId:id}})),0);
 await direct(async tx=>{
  await tx.$executeRawUnsafe('SAVEPOINT f01_rls');
  try{
   await assertApprovedInTransaction(tx,secondUser);
   await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
   const hidden=await tx.$queryRawUnsafe('SELECT id FROM rh_admission.application WHERE account_id=$1',admin.accountId);assert.equal(hidden.length,0);
   await assert.rejects(tx.$executeRawUnsafe('UPDATE rh_admission.event SET reason=$1 WHERE application_id=$2','tampered',own.id));
  }finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT f01_rls');}
 });
 await direct(async tx=>{await assertApprovedInTransaction(tx,secondUser);await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');});
}));
