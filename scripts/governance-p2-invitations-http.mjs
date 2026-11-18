import assert from 'node:assert/strict';import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';import {randomUUID} from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),f=JSON.parse(readFileSync(root+'.tmp/researchhub-p2/fixture.json'));
const privateFile=root+'.tmp/researchhub-p2/invitation-check.json',phase=process.argv[2];assert(['begin','finish'].includes(phase));
const headers={Origin:base,'Content-Type':'application/json','X-Study-Group-Id':f.groupId,'X-Research-Project-Id':f.projectId};
async function call(cookie,path,body){const response=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{...headers,Cookie:cookie??''},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function login(email,password){const x=await call(null,'auth/login',{tenantSlug:r.ids.tenant,username:email,password});assert.equal(x.status,201);return x.cookie;}
const admin=await login('admin@example.org',r.password),member=f.accounts.find(a=>a.kind==='member'),manager=f.accounts.find(a=>a.kind==='manager');
function token(email){const dir=root+'.tmp/researchhub-wp02/mail/';const rows=readdirSync(dir).filter(n=>/^[a-f0-9-]{8,100}\.json$/.test(n)).map(n=>JSON.parse(readFileSync(dir+n))).filter(m=>m.to===email&&m.purpose==='invite').sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));const value=rows[0]?.text.match(/#invite=([A-Za-z0-9_-]{43})/)?.[1];assert(value);return value;}
const save=state=>writeFileSync(privateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});
if(phase==='begin'){
 assert(!existsSync(privateFile),'P2_INVITATION_CHECK_ALREADY_STARTED');const state={startedAt:new Date().toISOString(),issueKey:randomUUID(),revokeKey:randomUUID(),resendKey:randomUUID(),acceptKey:randomUUID()};save(state);
 let x=await call(admin,'member-invitations',{email:member.email,requestKey:state.issueKey});assert.equal(x.status,201,x.data.message);assert.equal(x.data.deliveryStatus,'captured');state.invitation=x.data;state.originalToken=token(member.email);save(state);
 x=await call(admin,'member-invitations',{email:manager.email,requestKey:randomUUID()});assert.equal(x.status,201);state.revokedId=x.data.id;
 const revoked=await call(admin,'member-invitations/'+x.data.id+'/revocations',{baseVersion:x.data.version,requestKey:state.revokeKey});assert.equal(revoked.status,200);assert.equal(revoked.data.status,'revoked');state.revokeVerified=true;save(state);
 const mc=await login(manager.email,manager.password);assert.equal((await call(mc,'member-invitation-previews',{token:token(manager.email)})).status,404);
 console.log(JSON.stringify({phase,passed:true,delivery:'captured',revokeVerified:true,resendAfter:state.invitation.resendAfter}));
}else{
 const state=JSON.parse(readFileSync(privateFile));assert(!state.finishedAt,'P2_INVITATION_CHECK_ALREADY_FINISHED');assert(Date.now()>=Date.parse(state.invitation.resendAfter),'P2_RESEND_WAIT_REQUIRED');
 const cookie=await login(member.email,member.password);
 let x=await call(admin,'member-invitations/'+state.invitation.id+'/resends',{baseVersion:state.invitation.version,requestKey:state.resendKey});assert.equal(x.status,200,x.data.message);assert.equal(x.data.deliveryStatus,'captured');
 assert.equal((await call(cookie,'member-invitation-previews',{token:state.originalToken})).status,404);
 const currentToken=token(member.email);assert.notEqual(currentToken,state.originalToken);
 x=await call(cookie,'member-invitation-previews',{token:currentToken});assert.equal(x.status,200,x.data.message);
 const body={token:currentToken,requestKey:state.acceptKey};x=await call(cookie,'member-invitation-acceptances',body);assert.equal(x.status,200,x.data.message);assert.equal(x.data.accepted,true);
 assert.deepEqual((await call(cookie,'member-invitation-acceptances',body)).data,x.data);state.finishedAt=new Date().toISOString();save(state);
 const out=root+'researchhub/docs/testing/evidence/governance-p2-g03-2026-11-13/invitations/';mkdirSync(out,{recursive:true});const result={passed:true,startedAt:state.startedAt,finishedAt:state.finishedAt,checks:['real local SMTP issue captured','revoke makes link unusable','60-second explicit resend rotates link','old token rejected','verified matching account explicit accepts current token','acceptance exact replay'],paidCalls:0};writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,evidence:out+'result.json'}));
}
