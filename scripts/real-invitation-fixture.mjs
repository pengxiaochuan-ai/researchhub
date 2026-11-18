// One named WP02 continuation fixture. Never repairs a revoked grant or historical fixture.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

process.umask(0o077);
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=root+'.tmp/researchhub-real-entry/';
const file=dir+'invitation-fixture.json';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const account=JSON.parse(readFileSync(dir+'account.json','utf8'));
const mode=process.argv[2];
assert(['check','initialize','verify'].includes(mode),'EXPECTED_CHECK_INITIALIZE_OR_VERIFY');

async function inspect(tx){
  const tenant=await tx.tenant.findFirst({where:{id:ids.tenant,status:'active'}});
  const admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active'}});
  const users=await tx.$queryRawUnsafe(
    'SELECT id,status,"emailNormalized" AS email,"emailVerifiedAt" AS verified_at FROM public.account WHERE "tenantId"=$1 AND username=$2',
    ids.tenant,account.email,
  );
  const groups=await tx.studyGroup.count({where:{tenantId:ids.tenant}});
  const invitee=users[0];
  const memberships=invitee?await tx.studyGroupMembership.count({where:{tenantId:ids.tenant,accountId:invitee.id}}):null;
  return {tenant,admin,invitee,groups,memberships};
}
function assertReady(s){
  assert(s.tenant&&s.admin,'SYNTHETIC_PARENT_MISSING');
  assert(s.invitee?.status==='active'&&s.invitee.email===account.email&&s.invitee.verified_at,'INVITEE_NOT_VERIFIED');
  assert.equal(s.memberships,0,'INVITEE_ALREADY_HAS_PRIVATE_STUDY');
  assert(s.groups<s.tenant.quotaStudyGroups,'SYNTHETIC_GROUP_QUOTA_EXHAUSTED');
}

if(mode==='check'){
  assert.equal(existsSync(file),false,'CURRENT_ROUND_FIXTURE_ALREADY_EXISTS');
  const state=await withFixtureTransaction(env,'direct',inspect,{readOnly:true});
  assertReady(state);
  console.log(JSON.stringify({ready:true,syntheticOnly:true,freeStudySlots:state.tenant.quotaStudyGroups-state.groups,adminActive:true,inviteeVerified:true,inviteePrivateStudyCount:0}));
}else if(mode==='initialize'){
  assert.equal(existsSync(file),false,'CURRENT_ROUND_FIXTURE_ALREADY_EXISTS');
  const runKey='real-invite-'+randomUUID().slice(0,8);
  const fixture={runKey,tenantId:ids.tenant,inviterId:ids.admin,inviteeEmail:account.email,groupId:runKey+'-group',projectId:runKey+'-study',managerRoleId:runKey+'-manager',readerRoleId:runKey+'-reader'};
  await withFixtureTransaction(env,'direct',async tx=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','wp01:tenant:'+ids.tenant);
    const state=await inspect(tx);assertReady(state);
    const reserved=await tx.$queryRawUnsafe('INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING run_id',runKey,JSON.stringify({syntheticOnly:true,purpose:'ResearchHub-real-entry-invitation',...fixture}));
    assert.equal(reserved.length,1,'FIXTURE_RUN_CONFLICT');
    await tx.studyGroup.create({data:{id:fixture.groupId,tenantId:ids.tenant,slug:runKey,name:'真实入口邀请联调合成组',createdBy:ids.admin}});
    await tx.researchProject.create({data:{id:fixture.projectId,tenantId:ids.tenant,studyGroupId:fixture.groupId,code:runKey,name:'真实入口邀请联调合成Study',createdBy:ids.admin}});
    await tx.permissionRole.create({data:{id:fixture.managerRoleId,tenantId:ids.tenant,key:fixture.managerRoleId,name:'本轮新Study邀请管理',menuPermissions:['group_admin'],buttonPermissions:['member.manage']}});
    await tx.permissionRole.create({data:{id:fixture.readerRoleId,tenantId:ids.tenant,key:fixture.readerRoleId,name:'本轮新Study只读成员',menuPermissions:[],buttonPermissions:[]}});
    await tx.studyGroupMembership.create({data:{tenantId:ids.tenant,studyGroupId:fixture.groupId,accountId:ids.admin,roleId:fixture.managerRoleId}});
    await tx.researchProjectMembership.create({data:{tenantId:ids.tenant,studyGroupId:fixture.groupId,researchProjectId:fixture.projectId,accountId:ids.admin,roleKey:'project_manager'}});
    await tx.auditLog.create({data:{tenantId:ids.tenant,accountId:ids.admin,action:'real_entry_synthetic_invitation_scope_initialized',target:fixture.projectId,meta:{runKey,groupId:fixture.groupId,minimalOnly:true}}});
  });
  mkdirSync(dir,{recursive:true,mode:0o700});
  writeFileSync(file,JSON.stringify(fixture,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({initialized:true,syntheticOnly:true,runKey,scope:fixture.projectId,oldStudyUnchanged:true}));
}else{
  const fixture=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(fixture.tenantId,ids.tenant);assert.equal(fixture.inviterId,ids.admin);assert.equal(fixture.inviteeEmail,account.email);
  const scope=await withFixtureTransaction(env,'direct',async tx=>{
    const [group,project,manager,reader,adminMember,adminProject,marker]=await Promise.all([
      tx.studyGroup.findFirst({where:{id:fixture.groupId,tenantId:ids.tenant}}),
      tx.researchProject.findFirst({where:{id:fixture.projectId,tenantId:ids.tenant,studyGroupId:fixture.groupId}}),
      tx.permissionRole.findFirst({where:{id:fixture.managerRoleId,tenantId:ids.tenant}}),
      tx.permissionRole.findFirst({where:{id:fixture.readerRoleId,tenantId:ids.tenant}}),
      tx.studyGroupMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:fixture.groupId,accountId:ids.admin}}),
      tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:fixture.groupId,researchProjectId:fixture.projectId,accountId:ids.admin}}),
      tx.$queryRawUnsafe('SELECT run_id FROM wp01_meta.fixture_run WHERE run_id=$1',fixture.runKey),
    ]);
    assert(group&&project&&manager&&reader&&adminMember&&adminProject&&marker.length===1,'FIXTURE_MISSING_NO_AUTO_REPAIR');
    assert.deepEqual(manager.menuPermissions,['group_admin']);assert.deepEqual(manager.buttonPermissions,['member.manage']);
    assert.deepEqual(reader.menuPermissions,[]);assert.deepEqual(reader.buttonPermissions,[]);
    assert.equal(adminMember.roleId,fixture.managerRoleId);assert.equal(adminProject.roleKey,'project_manager');
    return {groupId:group.id,projectId:project.id};
  },{readOnly:true});
  console.log(JSON.stringify({verified:true,syntheticOnly:true,...scope,oldStudyUnchanged:true}));
}
