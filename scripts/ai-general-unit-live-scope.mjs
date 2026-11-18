// Own new local config fault only; business data and old config remain read-only.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {openGeneralUnitHarness,configFile,json,root,dir,save} from './ai-general-unit-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--local-config-fault']);const h=await openGeneralUnitHarness(),original=readFileSync(configFile),c=JSON.parse(original),old=json(root+'researchhub/.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json'),base='http://127.0.0.1:19501',checks=[];let passed=false,changed=false;
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:h.ids.tenant,username:'admin@example.org',password:h.runtime.password})});assert.equal(login.status,201);const cookie=login.headers.get('set-cookie').split(';')[0],headers={Cookie:cookie,Origin:base,'X-Study-Group-Id':h.ids.group,'X-Research-Project-Id':h.ids.project};
async function check(sid,status,target){const r=await fetch(base+'/api/sessions/'+sid+'/research-data-import-targets',{headers}),v=await r.json();checks.push({sid,status:r.status,code:v.code,targets:v.items?.map(i=>i.id)});assert.equal(r.status,status);if(target)assert.deepEqual(v.items.map(i=>i.id),[target]);}
try{
 await check(c.sessions[h.ids.admin],200,c.target.studyId);
 const drift=structuredClone(c);drift.registeredObjects[h.ids.admin].subjectIds[0]='unapproved-subject';writeFileSync(configFile+'.test-candidate',JSON.stringify(drift),{mode:0o600});renameSync(configFile+'.test-candidate',configFile);changed=true;
 await check(c.sessions[h.ids.admin],403);await check(old.sessions[h.ids.admin],200,old.target.studyId);
}finally{if(changed){writeFileSync(configFile+'.restore-candidate',original,{mode:0o600});renameSync(configFile+'.restore-candidate',configFile);}assert.deepEqual(readFileSync(configFile),original);save(dir+'live-scope-guard.json',{checks,restored:true,businessWrites:0,modelCalls:0});}
await check(c.sessions[h.ids.admin],200,c.target.studyId);passed=true;save(dir+'live-scope-guard.json',{passed,checks,restored:true,businessWrites:0,modelCalls:0});console.log(JSON.stringify({passed,checks:checks.length,restored:true,businessWrites:0,modelCalls:0}));
