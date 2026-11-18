// Free negative checks only. This never sends a supported literature task.
import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const password=(await readFile('../.tmp/researchhub-knowledge-local/体验账号.txt','utf8')).match(/以上账号共用本次随机密码：([^\r\n]+)/)[1];
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),base='http://127.0.0.1:19502/api',prefix='t06-negative-'+randomUUID(),requests=[],quotas=[];
for(const actor of ['owner','admin']){
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:'http://127.0.0.1:19501','Content-Type':'application/json'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password})});assert.equal(login.status,201);
 const headers={Origin:'http://127.0.0.1:19501','Content-Type':'application/json',Cookie:login.headers.get('set-cookie').split(';')[0],'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const ready=await(await fetch(base+'/knowledge/ai-status',{headers})).json();quotas.push({actor,quota:ready.quota});
 const session=await(await fetch(base+'/sessions/hub-source',{method:'POST',headers,body:JSON.stringify({agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu'})})).json();assert(session.id);
 for(const [i,text,code]of [[0,'检索针灸治疗失眠但排除产后患者','HUB_SKILL_CLARIFICATION'],[1,'检索张三的失眠，电话13800138000','HUB_SKILL_CLARIFICATION'],[2,'翻译本篇全文包括表格','HUB_SKILL_RUNTIME_UNAVAILABLE'],[3,'帮我检索文献','HUB_SKILL_CLARIFICATION']]){
  const r=await fetch(base+'/sessions/'+session.id+'/knowledge-messages',{method:'POST',headers,body:JSON.stringify({text,kbIds:[],requestKey:prefix+'-'+actor+'-'+i})});const b=await r.json();assert.equal(r.status,422);assert.equal(b.code,code);requests.push({actor,test:i,status:r.status,code:b.code});
 }
}
const newJobs=await withFixtureTransaction(env,'direct',tx=>tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,requestKey:{startsWith:prefix}}}),{readOnly:true});assert.equal(newJobs,0);
const result={at:new Date().toISOString(),prefix,requests,quotas,newJobs,modelCalls:0};const dir='.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t06/';await mkdir(dir,{recursive:true});const path=dir+prefix+'.json';await writeFile(path,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({path,...result}));
