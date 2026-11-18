import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=new URL('../../',import.meta.url).pathname,dir=root+'.tmp/researchhub-p2/';mkdirSync(dir,{recursive:true,mode:0o700});
const file=dir+'fixture.json',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const {lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const save=()=>writeFileSync(file,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{tenantId:runtime.ids.tenant,createdAt:new Date().toISOString(),groupId:'rh-p2-20261113-group',projectId:'rh-p2-20261113-project',accounts:['manager','member'].map(kind=>({kind,email:`p2-${kind}-20261113@example.test`,password:'P2!'+randomBytes(24).toString('base64url'),registrationKey:randomUUID(),confirmationKey:randomUUID()}))};
assert.equal(state.tenantId,runtime.ids.tenant);save();
const app=(fn,readOnly=false)=>withFixtureTransaction(env,'app',async tx=>{await tx.$executeRaw`SELECT set_config('app.tenant_id',${state.tenantId},true)`;return fn(tx);},{readOnly});
const snapshot=await app(async tx=>({count:await tx.account.count({where:{tenantId:state.tenantId}}),tenant:await tx.tenant.findUnique({where:{id:state.tenantId},select:{quotaSeats:true}}),accounts:await tx.account.findMany({where:{tenantId:state.tenantId,username:{in:state.accounts.map(a=>a.email)}},select:{id:true,username:true}})}),true);
for(const a of snapshot.accounts)assert.equal(state.accounts.find(x=>x.email===a.username)?.id,a.id,'P2_UNKNOWN_EXISTING_ACCOUNT');
if(!state.seatsPrepared){
 assert.equal(snapshot.count,12);assert.equal(snapshot.tenant.quotaSeats,10);assert.equal(snapshot.accounts.length,0);
 await withFixtureTransaction(env,'direct',async tx=>{await lockAuthorizationMutation(tx,state.tenantId,{includeOfficial:true});assert.equal(await tx.account.count({where:{tenantId:state.tenantId}}),12);const updated=await tx.tenant.updateMany({where:{id:state.tenantId,quotaSeats:10},data:{quotaSeats:14}});assert.equal(updated.count,1);});
 state.seatsPrepared=true;save();
}else assert.equal(snapshot.tenant.quotaSeats,14);
async function post(path,body){const r=await fetch('http://127.0.0.1:19501/api/account-access/'+path,{method:'POST',headers:{origin:'http://127.0.0.1:19501','content-type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Object.assign(Error(result.code??'P2_REGISTRATION_FAILED'),{status:r.status});return result;}
for(const a of state.accounts){
 if(a.id)continue;
 await post('registrations',{email:a.email,requestKey:a.registrationKey});
 const maildir=root+'.tmp/researchhub-wp02/mail/';
 const messages=readdirSync(maildir).filter(x=>/^[a-f0-9-]{8,100}\.json$/.test(x)).map(x=>JSON.parse(readFileSync(maildir+x,'utf8'))).filter(m=>m.to===a.email&&m.purpose==='register'&&Date.parse(m.capturedAt)>=Date.parse(state.createdAt)).sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
 assert.equal(messages.length,1,'P2_REGISTRATION_MAIL_UNCONFIRMED');const token=messages[0].text.match(/#verify=([A-Za-z0-9_-]{43})/)?.[1];assert(token);
 const result=await post('registration-confirmations',{token,displayName:a.kind==='manager'?'P2合成研究负责人':'P2合成研究成员',password:a.password,requestKey:a.confirmationKey});assert.equal(result.created,true);
 const row=await app(tx=>tx.account.findFirst({where:{tenantId:state.tenantId,username:a.email},select:{id:true,role:true,isTenantAdmin:true}}),true);assert.equal(row.role,'researcher');assert.equal(row.isTenantAdmin,false);a.id=row.id;save();
 await app(async tx=>{assert.equal(await tx.studyGroupMembership.count({where:{tenantId:state.tenantId,accountId:a.id}}),0);});
}
if(!state.studyPrepared){
 await app(async tx=>{
  await lockAuthorizationMutation(tx,state.tenantId,{includeOfficial:true});
  const role=await tx.permissionRole.findFirst({where:{id:'wp02-invite-3a7f7604-manager',tenantId:state.tenantId,status:'active'}}),reader=await tx.permissionRole.findFirst({where:{id:'wp02-invite-3a7f7604-reader',tenantId:state.tenantId,status:'active'}});
  assert(role?.menuPermissions.includes('group_admin')&&role.buttonPermissions.includes('member.manage'));assert.deepEqual(reader?.menuPermissions,[]);assert.deepEqual(reader.buttonPermissions,[]);
  await tx.studyGroup.create({data:{id:state.groupId,tenantId:state.tenantId,slug:'p2-users-20261113',name:'P2用户权限闭环20261113'}});
  await tx.$executeRaw`SELECT set_config('app.study_group_id',${state.groupId},true),set_config('app.research_project_id',${state.projectId},true)`;
  await tx.researchProject.create({data:{id:state.projectId,tenantId:state.tenantId,studyGroupId:state.groupId,code:'P2-20261113',name:'P2用户权限闭环20261113'}});
  for(const a of state.accounts)await tx.studyGroupMembership.create({data:{tenantId:state.tenantId,studyGroupId:state.groupId,accountId:a.id,roleId:a.kind==='manager'?role.id:reader.id}});
  const manager=state.accounts.find(a=>a.kind==='manager');await tx.researchProjectMembership.create({data:{tenantId:state.tenantId,studyGroupId:state.groupId,researchProjectId:state.projectId,accountId:manager.id,roleKey:'project_manager'}});
 });state.studyPrepared=true;save();
}
console.log(JSON.stringify({ready:true,accounts:state.accounts.length,groupId:state.groupId,projectId:state.projectId,seats:14,privateManifest:file}));
