import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501',s=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const out=root+'researchhub/docs/testing/evidence/research-identity-directory-implementation-2026-11-03/identity-api/';mkdirSync(out,{recursive:true});
const checks=[],network=[];
const preserved=()=>withFixtureTransaction(env,'direct',async tx=>(await tx.$queryRaw`SELECT md5(jsonb_agg(to_jsonb(a)-'researchProfile'-'researchProfileVersion'-'researchProfileEstablishedAt'-'researchProfileLastMutation' ORDER BY id)::text) hash FROM public.account a WHERE "tenantId"=${s.ids.tenant} AND id IN (${s.ids.owner},${s.ids.admin})`)[0].hash,{readOnly:true});
async function login(role){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:s.ids.tenant,username:role+'@example.org',password:s.password})});assert.equal(r.status,201);return r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');}
async function request(cookie,path,method='GET',body,expected=200,origin=base){const r=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();network.push({path,method,status:r.status,code:d.code});assert.equal(r.status,expected,JSON.stringify({path,code:d.code}));if(r.ok&&path.includes('research-'))assert.equal(r.headers.get('cache-control'),'no-store');return d;}
const path='/api/account-access/research-profile',before=await preserved();
try{
 const owner=await login('owner'),admin=await login('admin'),p=await request(admin,path),ownerBefore=await request(owner,path),key=randomUUID(),command={expectedVersion:p.version,requestKey:key,changes:{biography:'仅本机科研身份接口合成验证；不公开、不授予Study权限。'}};
 const r=await request(admin,path,'PATCH',command);assert.equal(r.level,p.level);assert.equal(r.version,p.version+1);
 assert.deepEqual(await request(admin,path,'PATCH',command),r);assert.deepEqual(await request(admin,path+'/receipts/'+key+'?baseVersion='+p.version),r);
 await request(admin,path,'PATCH',{...command,changes:{biography:'different'}},409);
 await request(admin,path,'PATCH',{...command,requestKey:randomUUID()},409);
 assert.deepEqual(await request(owner,path),ownerBefore);checks.push('real-own-private-draft-cas-idempotency-receipt-two-account-isolation');
 await request(owner,path+'?accountId='+s.ids.admin,'GET',undefined,400);
 await request(owner,path,'PATCH',{expectedVersion:ownerBefore.version,requestKey:randomUUID(),changes:{isTenantAdmin:true}},400);
 await request(admin,path,'PATCH',{expectedVersion:r.version,requestKey:randomUUID(),changes:{orcid:'0000-0000-0000-0000'}},422);
 await request(admin,path,'PATCH',command,403,'https://evil.example.test');
 await request('',path,'GET',undefined,401);checks.push('real-unknown-scope-privilege-orcid-origin-anonymous-rejected');
 await request(admin,path,'PATCH',{x:'a'.repeat(49152)},413);checks.push('identity-only-48k-parser');
 for(const cookie of [owner,admin])for(const old of ['/api/auth/me','/api/account-access/profile']){const d=await request(cookie,old);assert(!JSON.stringify(d).includes('researchProfile'));assert(!JSON.stringify(d).includes('verificationPreparation'));}checks.push('legacy-auth-and-account-dto-do-not-leak-private-profile');
 assert.equal(await preserved(),before);checks.push('original-account-columns-auth-version-role-and-password-preserved');
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,network,syntheticOnly:true,paidCalls:0,externalEmails:0},null,2));console.log(JSON.stringify({passed:true,checks,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:e.message,checks,network},null,2));throw e;}
