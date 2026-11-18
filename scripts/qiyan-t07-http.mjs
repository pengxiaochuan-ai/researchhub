// Free T07 ambiguity checks only. No supported interpretation task is submitted.
import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const password=(await readFile('../.tmp/researchhub-knowledge-local/体验账号.txt','utf8')).match(/以上账号共用本次随机密码：([^\r\n]+)/)[1];
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),base='http://127.0.0.1:19502/api',origin='http://127.0.0.1:19501',prefix='t07-negative-'+randomUUID(),requests=[];
for(const actor of ['owner','admin']){
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password})});assert.equal(login.status,201);
 const headers={Origin:origin,'Content-Type':'application/json',Cookie:login.headers.get('set-cookie').split(';')[0],'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const quota=await(await fetch(base+'/knowledge/ai-status',{headers})).json();if(!quota.quota.canStart){requests.push({actor,skipped:'normal-business-token-quota',code:quota.quota.code});continue;}
 const session=await(await fetch(base+'/sessions/hub-source',{method:'POST',headers,body:JSON.stringify({agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu'})})).json();assert(session.id);
 for(const [i,text]of ['解读第四篇','比较第一、第二篇','比较第一篇和最后一篇','比较第一篇和PMID123','解读第二篇但不要第三篇'].entries()){
  const r=await fetch(base+'/sessions/'+session.id+'/knowledge-messages',{method:'POST',headers,body:JSON.stringify({text,kbIds:[],requestKey:prefix+'-'+actor+'-'+i})}),b=await r.json();assert.equal(r.status,422);assert.equal(b.code,'HUB_SKILL_CLARIFICATION');requests.push({actor,text,status:r.status,code:b.code});
 }
}
const newJobs=await withFixtureTransaction(env,'direct',tx=>tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,requestKey:{startsWith:prefix}}}),{readOnly:true});assert.equal(newJobs,0);
const result={at:new Date().toISOString(),requests,newJobs,modelCalls:0},dir='.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t07/';await mkdir(dir,{recursive:true});const path=dir+prefix+'.json';await writeFile(path,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({path,...result}));
