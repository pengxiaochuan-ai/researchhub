import assert from 'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{randomUUID}from'node:crypto';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='docs/testing/evidence/ai-history-actions-20261118';
const{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);mkdirSync(out,{recursive:true});
const headers={Origin:base,'Content-Type':'application/json','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
async function login(role){const r=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({tenantSlug:ids.tenant,username:role+'@example.org',password})});assert.equal(r.status,201);const cookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');return async(method,path,body)=>{const r=await fetch(base+'/api'+path,{method,headers:{...headers,Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};};}
const clients={admin:await login('admin'),owner:await login('owner')},report={date:'2026-11-18',modelCalls:0,sessions:{},checks:[]};
for(const role of ['admin','owner']){const c=clients[role],agent=(await c('GET','/agents')).body[0];assert(agent);const created=await c('POST','/sessions/hub-source',{agentId:agent.id,hubKey:'lingshu-xinyu',conversationKey:randomUUID()});assert.equal(created.status,201);const sid=created.body.id;report.sessions[role]=sid;
 const mutation=body=>c('PATCH',`/sessions/${sid}/history-action`,body);
 assert.equal((await mutation({action:'rename',title:'合成会话管理验收-'+role})).status,200);
 assert.equal((await mutation({action:'pin',pinned:true})).status,200);
 let history=(await c('GET','/sessions/hub-source/history?page=1&limit=20')).body;assert.equal(history.items[0].id,sid);assert.equal(history.items[0].manuallyNamed,true);assert.equal(history.items[0].pinned,true);
 assert.equal((await mutation({action:'pin',pinned:false})).status,200);
 assert.equal((await mutation({action:'rename',title:''})).status,400);
 assert.equal((await clients[role==='admin'?'owner':'admin']('PATCH',`/sessions/${sid}/history-action`,{action:'delete'})).status,404);
 if(role==='owner'){assert.equal((await mutation({action:'delete'})).status,200);history=(await c('GET','/sessions/hub-source/history?page=1&limit=20')).body;assert(!history.items.some(x=>x.id===sid));assert.equal((await c('GET',`/sessions/${sid}/knowledge-state?limit=60`)).status,404);}
 report.checks.push(role+': rename persisted, pin order, unpin, invalid input rejected, other account denied'+(role==='owner'?', soft delete and direct-read denial':''));}
writeFileSync(out+'/http-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
