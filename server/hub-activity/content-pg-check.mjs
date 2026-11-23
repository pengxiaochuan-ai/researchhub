// Explicitly invoked integration test; creates only new synthetic content inside a rollback transaction.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAcademicContentService} from '../academic-content/service.mjs';

export async function verifyPublicContentActivityRollback({withRollback,ids}){
 return withRollback(async({db,direct})=>{
 const tenantId=ids.tenant,account=await direct(tx=>tx.account.findUnique({where:{id:ids.admin},select:{id:true,authVersion:true}}));
 const admin={tenantId,accountId:account.id,authVersion:account.authVersion},tag=randomUUID();
 let date=new Date('2026-11-22T12:00:00Z');
 const svc=createAcademicContentService({tenantId,transact:db.transaction,lockAuthorization:async()=>{},now:()=>date});
 const draft={title:'Hub动态原创合成核验 '+tag,summary:'仅用于软件日期及公开权限验证',body:'原创软件测试文本，非真实学术资讯。',source:'软件测试原创',rights:'原创合成，仅供软件验证',audience:'members',resources:[]};
 const made=await svc.create(admin,{requestKey:'activity-create-'+tag,draft}),id=made.content.id;
 await svc.publish(admin,id,{requestKey:'activity-internal-'+tag,baseRevision:1});
 assert.equal((await svc.publicActivitySources()).some(x=>x.id===id),false);
 date=new Date('2026-11-23T12:00:00Z');
 await svc.save(admin,id,{requestKey:'activity-save-'+tag,baseRevision:2,draft:{...draft,audience:'public'}});
 await svc.publish(admin,id,{requestKey:'activity-public-'+tag,baseRevision:3});
 const row=(await svc.publicActivitySources()).find(x=>x.id===id);
 assert.equal(row.firstPublicAt,date.toISOString());
 assert.equal((await svc.adminDetail(admin,id)).publishedAt,'2026-11-22T12:00:00.000Z');
 assert.deepEqual(Object.keys(row).sort(),['firstPublicAt','id','proofRef','summary','title','type']);
 date=new Date('2026-11-23T13:00:00Z');
 await svc.withdraw(admin,id,{requestKey:'activity-withdraw-'+tag,baseRevision:4,reason:'合成验证撤下'});
 assert.equal((await svc.publicActivitySources()).some(x=>x.id===id),false);
 await svc.publish(admin,id,{requestKey:'activity-restore-'+tag,baseRevision:5});
 assert.equal((await svc.publicActivitySources()).find(x=>x.id===id).firstPublicAt,'2026-11-23T12:00:00.000Z');
 // A public-app transaction cannot obtain internal history simply by SELECTing the raw table.
 await direct(async tx=>{
  await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.hub_key','lingshu-xinyu',true),set_config('app.account_id','',true),set_config('app.auth_version','',true)",tenantId);
  await tx.$executeRawUnsafe('SAVEPOINT public_activity_rls');
  try{await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_academic.version WHERE content_id=$1',id)).length,0);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT public_activity_rls');}
 });
 });
}
