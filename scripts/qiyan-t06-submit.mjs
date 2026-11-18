// Explicit manual synthetic acceptance submission; one task, never retries.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const actor=process.argv[2],text=process.argv[3];assert(['owner','admin'].includes(actor)&&text?.length<=100);
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const password=(await readFile('../.tmp/researchhub-knowledge-local/体验账号.txt','utf8')).match(/以上账号共用本次随机密码：([^\r\n]+)/)[1];
const base='http://127.0.0.1:19502/api',origin='http://127.0.0.1:19501';
const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password})});assert.equal(login.status,201);
const headers={Origin:origin,'Content-Type':'application/json',Cookie:login.headers.get('set-cookie').split(';')[0],'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const quota=await(await fetch(base+'/knowledge/ai-status',{headers})).json();assert.equal(quota.quota.canStart,true,'normal Token quota unavailable: do not top up');
const session=await(await fetch(base+'/sessions/hub-source',{method:'POST',headers,body:JSON.stringify({agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu'})})).json();assert(session.id);
const requestKey='t06-acceptance-'+randomUUID(),r=await fetch(base+'/sessions/'+session.id+'/knowledge-messages',{method:'POST',headers,body:JSON.stringify({text,kbIds:[],requestKey})}),job=await r.json();
console.log(JSON.stringify({actor,sessionId:session.id,requestKey,status:r.status,job:{id:job.id,status:job.status,code:job.code,message:job.message}}));assert(r.ok);
