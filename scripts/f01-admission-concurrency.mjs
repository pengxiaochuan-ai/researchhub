// Explicit bounded synthetic fixture; preserves its audit, never changes live tenant.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {target} from './f01-admission-migration.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createAdmissionService} from '../server/admission/service.mjs';
import {HUB_KEY} from '../server/admission/policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),tenantId='f01-concurrency-20261117';
export async function run(){
 const {env,ids}=target();await assertFixtureTarget(env);
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
 const transact=fn=>withFixtureTransaction(env,'direct',fn);
 const svc=createAdmissionService({tenantId,transact,lockAuthorization:lockAuthorizationMutation});
 const admin1={tenantId,accountId:tenantId+'-admin1',authVersion:0},admin2={...admin1,accountId:tenantId+'-admin2'},user={...admin1,accountId:tenantId+'-applicant'};
 const before=await transact(async tx=>({accounts:await tx.account.count({where:{tenantId:ids.tenant}}),quota:(await tx.tenant.findUnique({where:{id:ids.tenant},select:{quotaSeats:true}})).quotaSeats}));
 const existed=await transact(tx=>tx.tenant.findUnique({where:{id:tenantId},select:{id:true}}));
 if(!existed){
  const passwordHash=await require('bcryptjs').hash(randomUUID()+randomUUID(),12);
  await transact(async tx=>{
   assert.equal(await tx.tenant.count({where:{id:tenantId}}),0);
   await tx.tenant.create({data:{id:tenantId,slug:tenantId,name:'F01 独立并发合成验收',quotaSeats:3,quotaStudyGroups:0}});
   await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id',$1,true)",tenantId);
   await tx.$executeRawUnsafe('INSERT INTO rh_hub.hub(tenant_id,hub_key,name,summary,status,scope_status) VALUES($1,$2,$3,$4,$5,$6)',tenantId,HUB_KEY,'灵枢心域（并发合成验收）','仅F01三账号、无科研数据','active','confirmed');
   for(const [actor,name,admin]of [[admin1,'合成审核员一',true],[admin2,'合成审核员二',true],[user,'合成申请人',false]]){
    const email=actor.accountId+'@example.test',a=await tx.account.create({data:{id:actor.accountId,tenantId,username:email,displayName:name,emailNormalized:email,emailVerifiedAt:new Date(),passwordHash,role:admin?'tenant_admin':'researcher',isTenantAdmin:admin},select:{id:true,tenantId:true,displayName:true,emailNormalized:true,authVersion:true}});
    if(admin)await svc.legacyInTransaction(tx,admin1,a,'bootstrap-'+actor.accountId);else await svc.registerInTransaction(tx,a,'register-'+actor.accountId);
   }
   await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  });
 }
 const own=await svc.self(user),requests=[{action:'approve',baseRevision:1,requestKey:tenantId+'-decide1'},{action:'needs_information',reason:'合成并发要求',baseRevision:1,requestKey:tenantId+'-decide2'}];
 let result;
 if(own.revision===1){
  // Each transact creates its own Prisma connection and real committed transaction.
  const attempts=await Promise.allSettled([svc.decide(admin1,own.id,requests[0]),svc.decide(admin2,own.id,requests[1])]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
  const winner=attempts.findIndex(x=>x.status==='fulfilled');assert.deepEqual(await svc.decide([admin1,admin2][winner],own.id,requests[winner]),attempts[winner].value);
  result={realIndependentConnections:true,oneCommitted:true,oneConflict409:true,replayUnchanged:true,winner:winner+1};
 }else{assert.equal(own.revision,2);result={existingFixture:true,notReexecuted:true};}
 const evidence=await transact(async tx=>{
  const events=await tx.$queryRawUnsafe('SELECT action,actor_id AS "actorId",revision,request_key AS "requestKey" FROM rh_admission.event WHERE tenant_id=$1 AND application_id=$2 ORDER BY revision',tenantId,own.id);
  assert.equal(events.length,2);assert.equal(events[1].revision,2);
  assert.equal(await tx.account.count({where:{tenantId}}),3);assert.equal(await tx.studyGroup.count({where:{tenantId}}),0);assert.equal(await tx.agentAccess.count({where:{tenantId}}),0);
  const after={accounts:await tx.account.count({where:{tenantId:ids.tenant}}),quota:(await tx.tenant.findUnique({where:{id:ids.tenant},select:{quotaSeats:true}})).quotaSeats};assert.deepEqual(after,before);
  return{...result,tenantId,applicationId:own.id,events,originalTenantUnchanged:true,accounts:3,quotaSeats:3,groups:0,at:new Date().toISOString(),syntheticOnly:true};
 });
 const out=root+'researchhub/docs/testing/evidence/f01-admission-2026-11-17/';mkdirSync(out,{recursive:true});writeFileSync(out+'concurrency.json',JSON.stringify(evidence,null,2));return evidence;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.equal(process.argv[2],'--run');run().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});}
