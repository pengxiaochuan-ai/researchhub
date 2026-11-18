import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-p2/fixture.json'));
const member=fixture.accounts.find(a=>a.kind==='member'),manager=fixture.accounts.find(a=>a.kind==='manager'),checks=[];
async function request(cookie,path,method='GET',body){const r=await fetch(base+'/api/'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{origin:base,'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{data=null;}return{status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function login(email,password){const r=await request(null,'auth/login','POST',{tenantSlug:runtime.ids.tenant,username:email,password});assert.equal(r.status,201,r.data?.message);assert(r.cookie);return r.cookie;}
const out=root+'researchhub/docs/testing/evidence/governance-p2-g03-2026-11-13/http-'+Date.now()+'/';mkdirSync(out,{recursive:true});
try{
 const admin=await login('admin@example.org',runtime.password),old=await login(member.email,member.password),ordinary=await login('owner@example.org',runtime.password),pm=await login(manager.email,manager.password);
 assert.equal((await request(ordinary,'governance-users/accounts')).status,403);
 let r=await request(admin,'governance-users/accounts?q=P2');assert.equal(r.status,200);assert.equal(r.data.total,2);assert(!JSON.stringify(r.data).includes('password'));checks.push('real tenant account list; ordinary403; credential-free projection');
 r=await request(pm,'governance-users/studies');assert.equal(r.status,200);assert(r.data.items.some(s=>s.researchProjectId===fixture.projectId));checks.push('ordinary authorized manager discovers new Study');
 const detail=await request(admin,'governance-users/accounts/'+member.id);assert.equal(detail.status,200);assert.equal(detail.data.status,'active');
 const input={status:'disabled',expectedVersion:detail.data.version,requestKey:randomUUID()};r=await request(admin,'governance-users/accounts/'+member.id+'/status','POST',input);assert.equal(r.status,200,r.data?.message);assert.equal(r.data.status,'disabled');const stopped=r.data;
 assert.equal((await request(old,'auth/me')).status,401);assert.equal((await request(old,'auth/renew','POST',{})).status,401);
 const replay=await request(admin,'governance-users/accounts/'+member.id+'/status','POST',input);assert.equal(replay.status,200);assert.deepEqual(replay.data,stopped);
 r=await request(admin,'governance-users/accounts/'+member.id+'/status','POST',{status:'active',expectedVersion:stopped.version,requestKey:randomUUID()});assert.equal(r.status,200,r.data?.message);assert.equal(r.data.authVersion,stopped.authVersion+1);
 assert.equal((await request(old,'auth/me')).status,401);assert.equal((await request(old,'auth/renew','POST',{})).status,401);await login(member.email,member.password);checks.push('real HTTP stop/restore each advance session version, old cookie cannot authenticate/renew after restore; exact replay unchanged');
 const path='governance-users/studies/'+fixture.projectId+'/members',query='?studyGroupId='+fixture.groupId;
 r=await request(admin,path+query);assert.equal(r.status,200,r.data?.message);let target=r.data.items.find(x=>x.accountId===member.id);assert(target);
 for(const roleKey of ['researcher','data_manager','project_manager']){
  const body={studyGroupId:fixture.groupId,expectedVersion:target.version,roleKey,status:'active',reason:'P2真实HTTP验收',requestKey:randomUUID()};r=await request(admin,path+'/'+member.id,'POST',body);assert.equal(r.status,200,r.data?.message);assert.equal(r.data.roleKey,roleKey);target={...target,version:r.data.updatedAt};
  const again=await request(admin,path+'/'+member.id,'POST',body);assert.deepEqual(again.data,r.data);
 }
 r=await request(admin,path+'/'+member.id,'POST',{studyGroupId:fixture.groupId,expectedVersion:target.version,roleKey:'researcher',status:'disabled',reason:'P2真实HTTP软移除验收',requestKey:randomUUID()});assert.equal(r.status,200);assert.equal(r.data.status,'disabled');
 r=await request(admin,path+query);const lead=r.data.items.find(x=>x.accountId===manager.id);r=await request(admin,path+'/'+manager.id,'POST',{studyGroupId:fixture.groupId,expectedVersion:lead.version,roleKey:'researcher',status:'disabled',reason:'最后负责人拒绝验证',requestKey:randomUUID()});assert.equal(r.status,409);assert.equal(r.data.code,'HUB_MEMBERS_LAST_MANAGER');checks.push('three legacy member roles, exact replay, explicit soft removal; last valid manager409');
 const headers={Cookie:admin,'X-Study-Group-Id':fixture.groupId,'X-Research-Project-Id':fixture.projectId};
 const context=await fetch(base+'/api/member-invitations/context',{headers});assert.equal(context.status,200);assert.equal((await context.json()).canInvite,true);checks.push('tenant admin invitation context without fake Study membership');
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,paidCalls:0,time:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,evidence:out+'result.json'}));
}catch(e){writeFileSync(out+'result.json',JSON.stringify({passed:false,checks,error:e.message,time:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed:false,checks,error:e.message,evidence:out+'result.json'}));process.exitCode=1;}
