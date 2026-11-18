// Real local HTTP -> real SMTP inbox -> explicit confirmation. No SQL success fixture.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-wp02/',file=dir+'api-account.json',base='http://127.0.0.1:19502/api',inbox='http://127.0.0.1:19507';
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const state=existsSync(file)?JSON.parse(readFileSync(file)): {key:randomUUID().slice(0,8),password:randomBytes(18).toString('base64url'),newPassword:randomBytes(18).toString('base64url')};
state.email??='wp02-api-'+state.key+'@example.test';const save=()=>writeFileSync(file,JSON.stringify(state,null,2),{mode:0o600});save();
async function call(path,body,cookie,method='POST',expected=200){const r=await fetch(base+path,{method,headers:{Origin:'http://127.0.0.1:19501',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,expected,'WP02_API_STATUS:'+path+':'+r.status);return{data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
let inboxCookie;const sessionFile=dir+'inbox-session.json';
if(existsSync(sessionFile))inboxCookie=JSON.parse(readFileSync(sessionFile)).cookie;
if(!inboxCookie||(await fetch(inbox+'/messages',{headers:{Cookie:inboxCookie}})).status!==200){
 const {bootstrap}=JSON.parse(readFileSync(dir+'mail/inbox-credentials.json'));
 const r=await fetch(inbox+'/session',{method:'POST',headers:{Origin:inbox,'Content-Type':'application/json'},body:JSON.stringify({bootstrap})});assert.equal(r.status,200);inboxCookie=r.headers.get('set-cookie').split(';')[0];writeFileSync(sessionFile,JSON.stringify({cookie:inboxCookie}),{mode:0o600});
}
async function latest(purpose){const listing=await(await fetch(inbox+'/messages',{headers:{Cookie:inboxCookie}})).json(),m=listing.items.find(m=>m.to===state.email&&m.purpose===purpose);assert(m,'WP02_REAL_MAIL_NOT_CAPTURED');const body=await(await fetch(inbox+'/messages/'+m.id,{headers:{Cookie:inboxCookie}})).json();const token=body.text.match(/#(?:verify|reset)=([A-Za-z0-9_-]{43})/)?.[1];assert(token,'WP02_MAIL_LINK_MISSING');return{token,id:m.id,digest:m.digest};}
if(!state.created){
 await call('/account-access/registrations',{email:state.email,requestKey:'api-register-'+state.key},null,'POST',202);
 const m=await latest('register');state.registerReceipt={id:m.id,digest:m.digest};
 const payload={token:m.token,password:state.password,displayName:'WP02接口合成成员',requestKey:'api-confirm-'+state.key};
 const results=await Promise.all([call('/account-access/registration-confirmations',payload,null,'POST',201),call('/account-access/registration-confirmations',payload,null,'POST',201)]);assert(results.every(r=>r.data.created));state.created=true;save();
}
let session=await call('/auth/login',{tenantSlug:ids.tenant,username:state.email,password:state.reset?state.newPassword:state.password},null,'POST',201);
const me=(await call('/auth/me',null,session.cookie,'GET')).data;assert.equal(me.studyGroups.length,0);assert.equal(me.role,'researcher');assert.equal(me.isTenantAdmin,false);state.accountId=me.accountId;save();
if(!state.reset){
 await call('/account-access/password-resets',{email:state.email,requestKey:'api-reset-'+state.key},null,'POST',202);const m=await latest('reset');state.resetReceipt={id:m.id,digest:m.digest};
 await call('/account-access/password-reset-confirmations',{token:m.token,password:state.newPassword,requestKey:'api-reset-confirm-'+state.key});
 await call('/auth/me',null,session.cookie,'GET',401);state.reset=true;save();
 session=await call('/auth/login',{tenantSlug:ids.tenant,username:state.email,password:state.newPassword},null,'POST',201);
}
const profile=(await call('/account-access/profile',null,session.cookie,'GET')).data;assert.equal(profile.emailVerified,true);assert.equal(profile.email,state.email);
mkdirSync(root+'docs/test/evidence/2026-10-23-researchhub-wp02/',{recursive:true});
const result={at:new Date().toISOString(),passed:true,realHttp:true,realSmtp:true,syntheticOnly:true,registration:true,independentConcurrentConfirmations:2,zeroMembership:true,passwordReset:true,oldCookieRevoked:true,receipts:{register:state.registerReceipt,reset:state.resetReceipt}};
writeFileSync(root+'docs/test/evidence/2026-10-23-researchhub-wp02/account-api.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,realHttp:true,realSmtp:true,zeroMembership:true,reset:true,oldCookieRevoked:true}));
