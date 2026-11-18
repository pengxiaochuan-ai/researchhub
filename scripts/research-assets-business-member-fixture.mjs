// The one approved synthetic identity/role. Prediction always rolls back;
// initialization creates no membership (accepting the real invitation does).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {BUSINESS_LOCAL_MEMBER} from '../server/research-assets/business-local.mjs';
import {ASSET_MEMBER_ROLE,ASSET_MEMBER_EMAIL,assetMemberRoleAllowed} from '../server/research-assets/member-local-invitation.mjs';
import {createMemberInvitations} from '../server/wp02/invitation-service.mjs';
import {createWp02Repository} from '../server/wp02/repository.mjs';
import {authorizeBusinessAssetStudy} from '../server/research-assets/business-access.mjs';
const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--rollback-predict','--initialize-approved-member'].includes(mode));
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const passwordHash=await require('bcryptjs').hash(runtime.password,10),{lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
const dir=new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/',import.meta.url),receipt=new URL('business-member-initialized.json',dir);
async function seed(tx){
 await lockAuthorizationMutation(tx,ids.tenant);await bindCatalogContext(tx,ids,ids.admin);
 await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','aisci-account-create:'+ids.tenant);
 assert.equal(await tx.account.count({where:{tenantId:ids.tenant,OR:[{id:BUSINESS_LOCAL_MEMBER},{username:ASSET_MEMBER_EMAIL}]}}),0,'Do not overwrite an existing account');
 assert.equal(await tx.permissionRole.count({where:{tenantId:ids.tenant,OR:[{id:ASSET_MEMBER_ROLE},{key:ASSET_MEMBER_ROLE}]}}),0,'Do not change an existing role');
 const tenant=await tx.tenant.findFirst({where:{id:ids.tenant,status:'active'},select:{quotaSeats:true}});assert(tenant);assert.equal(tenant.quotaSeats,14,'Approved seat baseline changed');assert.equal(await tx.account.count({where:{tenantId:ids.tenant}}),19,'Approved account baseline changed');
 assert.equal((await tx.tenant.updateMany({where:{id:ids.tenant,status:'active',quotaSeats:14},data:{quotaSeats:20}})).count,1,'Seat CAS failed');
 await tx.account.create({data:{id:BUSINESS_LOCAL_MEMBER,tenantId:ids.tenant,username:ASSET_MEMBER_EMAIL,passwordHash,displayName:'合成资产科研人员',role:'researcher',isTenantAdmin:false}});
 await tx.$executeRawUnsafe('UPDATE account SET "emailNormalized"=$1,"emailVerifiedAt"=CURRENT_TIMESTAMP WHERE id=$2 AND "tenantId"=$3',ASSET_MEMBER_EMAIL,BUSINESS_LOCAL_MEMBER,ids.tenant);
 await tx.permissionRole.create({data:{id:ASSET_MEMBER_ROLE,tenantId:ids.tenant,key:ASSET_MEMBER_ROLE,name:'合成科研资产成员',menuPermissions:['artifacts'],buttonPermissions:['artifact.read','artifact.create','artifact.edit'],dataScope:'group'}});
 assert.equal(await tx.account.count({where:{tenantId:ids.tenant}}),20);
 await tx.auditLog.createMany({data:[{tenantId:ids.tenant,accountId:ids.admin,action:'research_asset_synthetic_member_initialized',target:BUSINESS_LOCAL_MEMBER,meta:{syntheticOnly:true,roleId:ASSET_MEMBER_ROLE,projectId:ids.project,membershipCreated:false,quotaSeatsBefore:14,quotaSeatsAfter:20,accountCountAfter:20}}]});
 return{accountId:BUSINESS_LOCAL_MEMBER,tenantId:ids.tenant,role:'researcher',authVersion:0};
}
let result;
if(mode==='--rollback-predict'){
 const rollback=Error('EXPECTED_MEMBER_PREDICTION_ROLLBACK');let completed=false;
 try{await withFixtureTransaction(env,'direct',async tx=>{
  const member=await seed(tx),admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant}}),db=createWp02Repository({tenantId:ids.tenant,transact:fn=>fn(tx),lockAuthorization:lockAuthorizationMutation});let token;
  const service=createMemberInvitations({db,secret:runtime.secret,config:{baseUrl:'http://127.0.0.1:19501'},target:{tenantId:ids.tenant,groupId:ids.group,projectId:ids.project,readerRoleId:ASSET_MEMBER_ROLE},allowTenantAdmin:true,readerRoleAllowed:assetMemberRoleAllowed,targetRoleName:'科研资产成员',mailer:{send:async mail=>{token=mail.tokenUrl.split('=')[1];return{status:'captured',messageId:'member-predict',digest:'a'.repeat(64)};}}});
  const ctx={user:{tenantId:ids.tenant,accountId:ids.admin,authVersion:admin.authVersion},groupId:ids.group,projectId:ids.project,ip:'c1-member-predict'};
  await service.issue(ctx,{email:ASSET_MEMBER_EMAIL,requestKey:'c1-member-predict-invite'});
  assert.equal((await service.preview({user:member,ip:'c1-member-predict'},{token})).targetRoleName,'科研资产成员');
  await service.accept({user:member,ip:'c1-member-predict'},{token,requestKey:'c1-member-predict-accept'});
  const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project};
  for(const permission of ['artifact.read','artifact.create','artifact.edit'])assert.equal((await authorizeBusinessAssetStudy({tx,user:member,scope,permission})).isTenantAdmin,false);
  for(const permission of ['artifact.review','artifact.release','artifact.archive'])await assert.rejects(authorizeBusinessAssetStudy({tx,user:member,scope,permission}),e=>e.status===403);
  await assert.rejects(authorizeBusinessAssetStudy({tx,user:member,scope:{...scope,researchProjectId:'rh-asset-detail-20261113-study-b'},permission:'artifact.read'}),e=>e.status===403);
  assert.equal(await tx.researchProjectMembership.count({where:{accountId:member.accountId,tenantId:ids.tenant}}),1);
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');completed=true;throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 assert(completed);result={passed:true,mode,at:new Date().toISOString(),roleExact:true,invitationAccepted:true,artifactActions:3,reviewReleaseArchiveAndBDenied:true,persistentAccountChanges:0,persistentRoleChanges:0,persistentMembershipChanges:0,modelCalls:0};
 writeFileSync(new URL('business-member-prediction.json',dir),JSON.stringify(result,null,2));
}else{
 assert(!existsSync(receipt),'Do not reinitialize');const predicted=JSON.parse(readFileSync(new URL('business-member-prediction.json',dir)));assert(predicted.passed&&predicted.reviewReleaseArchiveAndBDenied);
 await withFixtureTransaction(env,'direct',seed);result={passed:true,mode,at:new Date().toISOString(),accountId:BUSINESS_LOCAL_MEMBER,roleId:ASSET_MEMBER_ROLE,accountChanges:1,roleChanges:1,quotaSeatsBefore:14,quotaSeatsAfter:20,accountCountAfter:20,membershipChanges:0,assetChanges:0,modelCalls:0};writeFileSync(receipt,JSON.stringify(result,null,2),{flag:'wx'});
}
console.log(JSON.stringify(result));
