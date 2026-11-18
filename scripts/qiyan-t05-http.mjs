// Free negative verification only; never sends a supported model task.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=new URL('../../',import.meta.url),base='http://127.0.0.1:19502/api';
const {ids}=JSON.parse(await readFile(new URL('.tmp/researchhub-knowledge-local/runtime.json',root),'utf8'));
const password=(await readFile(new URL('.tmp/researchhub-knowledge-local/体验账号.txt',root),'utf8')).match(/以上账号共用本次随机密码：([^\r\n]+)/)[1];
const {env}=loadFixtureInput(fileURLToPath(new URL('.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',root)));
const prefix='t05-negative-'+randomUUID(),receipts=[];
for(const actor of ['owner','admin']){
 const response=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:'http://127.0.0.1:19501','Content-Type':'application/json'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password})});assert.equal(response.status,201);
 const cookie=response.headers.get('set-cookie').split(';')[0];
 const headers={Origin:'http://127.0.0.1:19501','Content-Type':'application/json',Cookie:cookie,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const sessionResponse=await fetch(base+'/sessions/hub-source',{method:'POST',headers,body:JSON.stringify({agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu'})});assert.equal(sessionResponse.status,201);const session=await sessionResponse.json();
 for(const [suffix,text,expected]of [['search','在PubMed搜索针灸治疗焦虑的新随机试验','HUB_SKILL_RUNTIME_UNAVAILABLE'],['translate','翻译本篇全文包括表格','HUB_SKILL_RUNTIME_UNAVAILABLE'],['ambiguous','解读报告','HUB_SKILL_CLARIFICATION']]){
  const r=await fetch(base+'/sessions/'+session.id+'/knowledge-messages',{method:'POST',headers,body:JSON.stringify({text,kbIds:[],requestKey:prefix+'-'+actor+'-'+suffix})});
  const body=await r.json();assert.equal(r.status,422);assert.equal(body.code,expected);receipts.push({actor,task:suffix,status:r.status,code:body.code});
 }
}
const count=await withFixtureTransaction(env,'direct',tx=>tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,requestKey:{startsWith:prefix}}}),{readOnly:true});assert.equal(count,0);
const result={at:new Date().toISOString(),prefix,syntheticOnly:true,requests:receipts,newJobs:count,modelCalls:0};
const dir=fileURLToPath(new URL('../.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t05/',import.meta.url));await mkdir(dir,{recursive:true,mode:0o700});await writeFile(dir+prefix+'.json',JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(result));
