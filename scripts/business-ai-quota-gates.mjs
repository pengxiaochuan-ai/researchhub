import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const out='docs/testing/evidence/business-ai-quota-gates-'+randomUUID();mkdirSync(out,{recursive:true});
const protectedPaths=['../app/server/src/billing/billing.service.ts','../app/server/src/billing/token-quota-policy.ts','../app/server/src/sessions/sessions.service.ts','../app/server/src/sessions/knowledge-chat-queue.service.ts','../app/server/src/orchestrator/orchestrator.service.ts','../.tmp/researchhub-knowledge-local/ai-budget-20261022.json'];
const before=Object.fromEntries(protectedPaths.map(p=>[p,sha(p)]));
const pure=[...readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f),...['knowledge-ai-contract','business-ai-quota','business-ai-provider','article-ai-output','article-response-policy','article-mixed-sentences','hub-agent-contract','hub-agent-orchestrator','article-ai-fee','article-ai-acceptance-fee','asset-applicability-fee'].map(f=>'scripts/'+f+'.test.mjs')];
const pg=['scripts/business-ai-quota-pg.test.mjs',...['article-evidence-pg','article-preflight','approved-source-chain-pg','bilingual-search-pg','publication-filters-pg'].map(f=>'server/hub-sources/'+f+'.test.mjs')];
const gates=[['pure-components',process.execPath,['--test','--test-concurrency=1',...pure]],['real-pg',process.execPath,['--test','--test-concurrency=1',...pg]],['build','pnpm',['run','build']],['whitespace','git',['diff','--check']]],results=[];
for(const[name,cmd,args]of gates){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:240000,maxBuffer:20*1024*1024}),log=(r.stdout??'')+(r.stderr??'');writeFileSync(out+'/'+name+'.log',log);results.push({name,exit:r.status,error:r.error?.message??null,summary:log.split('\n').filter(l=>/^ℹ (tests|pass|fail)|^# (tests|pass|fail)|^✓ built/.test(l))});if(r.status!==0)break;}
const after=Object.fromEntries(protectedPaths.map(p=>[p,sha(p)])),preservation=JSON.stringify(before)===JSON.stringify(after),passed=results.length===gates.length&&results.every(r=>r.exit===0)&&preservation;
writeFileSync(out+'/result.json',JSON.stringify({passed,at:new Date().toISOString(),results,preservation,before,after,providerCalls:0},null,2));console.log(JSON.stringify({passed,results,preservation,evidence:out}));if(!passed)process.exitCode=1;
