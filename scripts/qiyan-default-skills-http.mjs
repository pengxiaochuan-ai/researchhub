// Real local HTTP verification. Uses existing synthetic credentials; never prints cookies/passwords.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const workspace=new URL('../../',import.meta.url),base='http://127.0.0.1:19502/api',origin='http://127.0.0.1:19501';
const {ids}=JSON.parse(await readFile(new URL('.tmp/researchhub-knowledge-local/runtime.json',workspace),'utf8'));
const text=await readFile(new URL('.tmp/researchhub-knowledge-local/体验账号.txt',workspace),'utf8');
const password=text.match(/以上账号共用本次随机密码：([^\r\n]+)/)?.[1];assert(password);
async function get(path,cookie,status=200){const response=await fetch(base+path,{headers:{Origin:origin,...(cookie?{Cookie:cookie}:{})}});assert.equal(response.status,status,path);return response.json();}
async function login(username,password){const response=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:ids.tenant,username,password})});assert.equal(response.status,201);return response.headers.get('set-cookie')?.split(';')[0];}
const results=[];
await get('/qiyan-ai/skills',null,401);
for(const username of ['owner@example.org','admin@example.org','viewer@example.org','uninvited@example.org']){
 const cookie=await login(username,password),catalog=await get('/qiyan-ai/skills',cookie),me=await get('/auth/me',cookie);
 assert.equal(catalog.items.length,9);assert(catalog.items.every(s=>s.equipped&&s.executionReady===false));
 assert.equal(new Set(catalog.items.map(s=>s.key)).size,9);assert(!JSON.stringify(catalog).includes('scopeKey'));
 await get('/qiyan-ai/skills?accountId=other',cookie,400);
 results.push({account:username,effectiveSkills:9,studyCount:me.studyGroups.length,executionReady:false,foreignIdentityQueryRejected:true});
}
const account=JSON.parse(await readFile(new URL('.tmp/researchhub-wp02/api-account.json',workspace),'utf8'));
assert(account.created);const cookie=await login(account.email,account.reset?account.newPassword:account.password);
const me=await get('/auth/me',cookie);
assert.equal((await get('/qiyan-ai/skills',cookie)).items.length,9);
results.push({account:'existing-wp02-registration',effectiveSkills:9,studyCount:me.studyGroups.length});
assert(results.some(r=>r.studyCount===0),'ZERO_STUDY_ACCOUNT_NOT_OBSERVED');
const result={at:new Date().toISOString(),syntheticOnly:true,realHttp:true,anonymousRejected:true,modelCalls:0,results};
const dir=fileURLToPath(new URL('../.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/defaults-2026-11-07/',import.meta.url));
await mkdir(dir,{recursive:true,mode:0o700});await writeFile(dir+'http.json',JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify(result));
