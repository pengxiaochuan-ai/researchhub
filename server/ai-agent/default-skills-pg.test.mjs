import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {loadSkillCatalog} from './skill-catalog.mjs';
import {createHubDefaultSkills} from './default-skills.mjs';

const require=createRequire(import.meta.url);
const {lockAuthorizationMutation}=require('../../../app/server/dist/common/worker-publication.js');
const {resolveEffectiveSkillCatalog}=require('../../../app/server/dist/agents/effective-skills-policy.js');
const {env}=loadFixtureInput(new URL('../../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
const catalog=await loadSkillCatalog(new URL('../../',import.meta.url));

async function inRollback(run){
 const rollback=new Error('ROLLBACK_QIYAN_DEFAULTS');
 await assert.rejects(()=>withFixtureTransaction(env,'direct',async tx=>{
  const tenantId='hub-defaults-'+randomUUID(),agentId=tenantId+'-agent',adminId=tenantId+'-admin';
  await tx.tenant.create({data:{id:tenantId,slug:tenantId,name:'具名合成默认技能事务测试'}});
  await tx.account.create({data:{id:adminId,tenantId,username:'admin@example.test',passwordHash:'synthetic-unusable',displayName:'合成管理员',role:'tenant_admin',isTenantAdmin:true}});
  await tx.agent.create({data:{id:agentId,tenantId,key:'qiyan',name:'合成岐研',type:'research',opencodeRoot:'unused-no-model'}});
  const admin={tenantId,accountId:adminId,authVersion:0};
  const make=transaction=>createHubDefaultSkills({scope:{product:'researchhub',allowedTenantIds:[tenantId]},tenantId,agentId,catalog,transaction,lockAuthorization:lockAuthorizationMutation,resolveEffectiveSkillCatalog});
  await run({tx,tenantId,agentId,admin,service:make(fn=>fn(tx)),make});throw rollback;
 }),e=>e===rollback);
}

test('real PG wildcard covers future zero-Study registration and respects overrides and unpublished skills',async()=>inRollback(async({tx,tenantId,admin,service,agentId})=>{
 const first=await service.install(admin);assert.equal(first.created,9);assert.equal(first.equipped,9);
 assert.deepEqual(await service.install(admin),{...first,created:0,equipped:0});
 const id=tenantId+'-future';await tx.account.create({data:{id,tenantId,username:'future@example.test',displayName:'新注册合成成员',passwordHash:'synthetic-unusable'}});
 assert.equal(await tx.researchProjectMembership.count({where:{tenantId,accountId:id}}),0);
 assert.equal(await tx.agentAccess.count({where:{tenantId,agentId}}),0);
 assert.equal((await service.list({tenantId,accountId:id,authVersion:0})).items.length,9);
 const defaults=await tx.skillAssignment.findMany({where:{tenantId,agentId}});
 await tx.skillAssignment.create({data:{tenantId,agentId,accountId:id,scopeKey:id,skillId:defaults[0].skillId,enabled:false}});
 assert.equal((await service.list({tenantId,accountId:id,authVersion:0})).items.length,8);
 await tx.skillAssignment.update({where:{id:defaults[1].id},data:{enabled:false}});await service.install(admin);
 assert.equal((await service.list({tenantId,accountId:id,authVersion:0})).items.length,7);
 await tx.skill.update({where:{id:defaults[2].skillId},data:{status:'draft'}});
 assert.equal((await service.list({tenantId,accountId:id,authVersion:0})).items.length,6);
 await assert.rejects(()=>service.install(admin),/HUB_SKILL_RELEASE_CHANGED/);
}));

test('real transaction rolls all nine releases and audits back if any assignment fails',async()=>inRollback(async({tx,tenantId,admin,make})=>{
 // A savepoint lets this test inspect the same transaction after a controlled failure.
 await tx.$executeRawUnsafe('SAVEPOINT qiyan_defaults');
 const service=make(async fn=>{
  let writes=0;
  const wrapped=new Proxy(tx,{get(target,key){
   if(key!=='skillAssignment')return target[key];
   return new Proxy(target.skillAssignment,{get(table,method){if(method!=='create')return table[method].bind(table);return async args=>{if(++writes===5)throw Error('SYNTHETIC_ASSIGNMENT_FAILURE');return table.create(args);};}});
  }});
  try{return await fn(wrapped);}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT qiyan_defaults');throw e;}
 });
 await assert.rejects(()=>service.install(admin),/SYNTHETIC_ASSIGNMENT_FAILURE/);
 assert.equal(await tx.skill.count({where:{tenantId}}),0);assert.equal(await tx.skillAssignment.count({where:{tenantId}}),0);assert.equal(await tx.auditLog.count({where:{tenantId}}),0);
}));

test('application-role RLS allows tenant-level append-only publication audit without a private Study',async()=>inRollback(async({tx,tenantId,admin,service})=>{
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true), set_config('app.study_group_id','',true), set_config('app.research_project_id','',true)",tenantId);
 const result=await service.install(admin);assert.equal(result.equipped,9);
 assert.equal((await service.list(admin)).items.length,9);
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_owner');
 assert.equal(await tx.auditLog.count({where:{tenantId}}),18);
 assert.equal(await tx.auditLog.count({where:{tenantId,researchProjectId:{not:null}}}),0);
}));
