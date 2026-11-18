// A new account and narrowly scoped role for genuine researcher UI acceptance.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment,requireServer} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--prepare-researcher']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const pointer=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-current.json')),accepted=JSON.parse(readFileSync(pointer.acceptedFile));assert(accepted.syntheticOnly&&accepted.runId.startsWith('rh-t06-http-'));
const suffix=randomUUID().slice(0,8),runId=accepted.runId+'-researcher-'+suffix,password=randomBytes(24).toString('base64url'),passwordHash=await requireServer('bcryptjs').hash(password,10);
const result=await withFixtureTransaction(env,'direct',async tx=>{
 const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;assert.equal(marker.manifest.syntheticOnly,true);assert.equal(marker.manifest.studyId,accepted.study.id);const scope=marker.manifest.scope;
 const tenant=await tx.tenant.findUnique({where:{id:scope.tenantId},select:{slug:true}});assert(tenant);
 const role=await tx.permissionRole.create({data:{id:runId+'-role',tenantId:scope.tenantId,key:'synthetic-capture-'+suffix,name:'合成科研采集成员',menuPermissions:['workbench','subjects'],buttonPermissions:['subject.create','study.execute','form.fill'],dataScope:'project'}});
 const account=await tx.account.create({data:{id:runId+'-account',tenantId:scope.tenantId,username:'synthetic-capture-'+suffix+'@example.org',passwordHash,displayName:'合成采集研究者',role:'researcher',isTenantAdmin:false}});
 const groupMembership=await tx.studyGroupMembership.create({data:{tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,accountId:account.id,roleId:role.id,isDefault:true}});
 const projectMembership=await tx.researchProjectMembership.create({data:{...scope,accountId:account.id,roleKey:'researcher',isDefault:true}});
 const manifest={syntheticOnly:true,runId,parentRunId:accepted.runId,scope,studyId:accepted.study.id,accountId:account.id,roleId:role.id,groupMembershipId:groupMembership.id,projectMembershipId:projectMembership.id,purpose:'new-researcher-role-acceptance',existingAccountOrRoleChanged:false};
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(manifest)}::jsonb)`;
 return {...manifest,tenantSlug:tenant.slug,username:account.username};
});
const response=await fetch('http://127.0.0.1:19501/api/auth/login',{method:'POST',headers:{Origin:'http://127.0.0.1:19501','Content-Type':'application/json'},body:JSON.stringify({tenantSlug:result.tenantSlug,username:result.username,password})});assert.equal(response.status,201,'NEW_SYNTHETIC_RESEARCHER_LOGIN_FAILED');
const cookie=response.headers.get('set-cookie')?.split(';')[0];assert(cookie);
const subjects=await fetch('http://127.0.0.1:19501/api/research-studies/'+accepted.study.id+'/subjects',{headers:{Cookie:cookie}});assert.equal(subjects.status,200);const page=await subjects.json();assert.deepEqual(page.capabilities,{canRead:true,canCreate:true,canExecute:true});
const release=await fetch('http://127.0.0.1:19501/api/research-studies/'+accepted.study.id+'/protocols/'+accepted.protocolId+'/release',{headers:{Cookie:cookie}});assert.equal(release.status,200);assert.equal((await release.json()).capabilities.canManageRelease,false);
const privateFile=workspaceRoot+'.tmp/researchhub-workflow/t06-researcher-session.json';writeFileSync(privateFile,JSON.stringify({...result,cookie,password,acceptedFile:pointer.acceptedFile},null,2),{mode:0o600});
const evidence={passed:true,at:new Date().toISOString(),syntheticOnly:true,studyId:accepted.study.id,accountId:result.accountId,role:'researcher',menuPermissions:['workbench','subjects'],buttonPermissions:['subject.create','study.execute','form.fill'],dataScope:'project',actualLogin:true,actualSubjectCapabilities:page.capabilities,actualCanManageRelease:false,existingAccountOrRoleChanged:false};
writeFileSync(workspaceRoot+'researchhub/docs/testing/evidence/research-t06-2026-11-12/researcher-role.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:true,role:'researcher',privateSessionFile:privateFile,existingAccountOrRoleChanged:false}));
