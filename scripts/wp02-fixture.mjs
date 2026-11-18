import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-wp02/',file=dir+'invitation-fixture.json';
export async function ensureInvitationFixture({env,ids,runKey}){
 assert.match(runKey,/^wp02-invite-[a-f0-9]{8}$/);
 if(existsSync(file)){
  const fixture=JSON.parse(readFileSync(file));assert.equal(fixture.tenantId,ids.tenant);assert.equal(fixture.inviterId,ids.admin);
  await withFixtureTransaction(env,'direct',async tx=>{const project=await tx.researchProject.findFirst({where:{id:fixture.projectId,tenantId:ids.tenant,studyGroupId:fixture.groupId}});assert(project,'WP02_FIXTURE_MISSING_NO_AUTO_REPAIR');},{readOnly:true});return fixture;
 }
 const f={runKey,tenantId:ids.tenant,inviterId:ids.admin,groupId:runKey+'-group',projectId:runKey+'-study',managerRoleId:runKey+'-manager',readerRoleId:runKey+'-reader'};
 await withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','wp01:tenant:'+ids.tenant);
  const tenant=await tx.tenant.findFirst({where:{id:ids.tenant,status:'active'}}),admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active'}});assert(tenant&&admin,'WP02_PARENT_MISSING');
  const groups=await tx.studyGroup.count({where:{tenantId:ids.tenant}});assert(groups<tenant.quotaStudyGroups,'WP02_GROUP_QUOTA_CONFIRMATION_REQUIRED');
  const inserted=await tx.$queryRawUnsafe('INSERT INTO wp01_meta.fixture_run (run_id,manifest) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING run_id',runKey,JSON.stringify({syntheticOnly:true,purpose:'WP02-invitation-closed-loop',...f}));assert.equal(inserted.length,1,'WP02_FIXTURE_CONFLICT');
  await tx.studyGroup.create({data:{id:f.groupId,tenantId:ids.tenant,slug:runKey,name:'WP02成员邀请合成验证组',createdBy:ids.admin}});
  await tx.researchProject.create({data:{id:f.projectId,tenantId:ids.tenant,studyGroupId:f.groupId,code:runKey,name:'WP02成员邀请合成Study',createdBy:ids.admin}});
  await tx.permissionRole.create({data:{id:f.managerRoleId,tenantId:ids.tenant,key:f.managerRoleId,name:'WP02新Study邀请管理',menuPermissions:['group_admin'],buttonPermissions:['member.manage']}});
  await tx.permissionRole.create({data:{id:f.readerRoleId,tenantId:ids.tenant,key:f.readerRoleId,name:'WP02新Study只读成员',menuPermissions:[],buttonPermissions:[]}});
  await tx.studyGroupMembership.create({data:{tenantId:ids.tenant,studyGroupId:f.groupId,accountId:ids.admin,roleId:f.managerRoleId}});
  await tx.researchProjectMembership.create({data:{tenantId:ids.tenant,studyGroupId:f.groupId,researchProjectId:f.projectId,accountId:ids.admin,roleKey:'project_manager'}});
  await tx.auditLog.createMany({data:[{tenantId:ids.tenant,accountId:ids.admin,action:'wp02_synthetic_invitation_scope_initialized',target:f.projectId,meta:{runKey,groupId:f.groupId,minimalOnly:true}}]});
 });mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(file,JSON.stringify(f,null,2),{mode:0o600,flag:'wx'});return f;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert.equal(process.argv[2],'initialize');const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');const{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
 const f=await ensureInvitationFixture({env,ids,runKey:'wp02-invite-'+randomUUID().slice(0,8)});console.log(JSON.stringify({initialized:true,runKey:f.runKey,originalRolesUnchanged:true,scope:f.projectId}));
}
