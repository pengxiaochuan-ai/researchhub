import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json'));
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const out='docs/testing/evidence/article-evidence-gates-'+randomUUID();mkdirSync(out,{recursive:true});
const hash=v=>createHash('sha256').update(v).digest('hex');
const preserved=['../app/server/src/sessions/sessions.service.ts','../app/server/src/sessions/knowledge-chat-queue.service.ts','../app/server/src/orchestrator/orchestrator.service.ts',
  '../.tmp/researchhub-knowledge-local/ai-budget-20261022.json','pages/e01/src/RealEvidence.jsx','pages/e01/src/EvidenceFilterSkeleton.jsx','pages/e02/src/RealEvidenceDetail.jsx','pages/shared/HubAgentPanel.jsx'];
async function snapshot(){return withFixtureTransaction(env,'direct',async db=>{
  const sources={};for(const table of ['source_record','canonical_publication','review_decision','pmc_candidate','pmc_candidate_version','pmc_review_decision','pmc_article_decision']){
    const [r]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(string_agg(row_to_json(t)::text,E'\n' ORDER BY row_to_json(t)::text)) AS hash FROM rh_source.${table} t WHERE tenant_id=$1`,ids.tenant);sources[table]=r;
  }
  return {sources,roles:hash(JSON.stringify(await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}))),
    sessions:await db.session.count({where:{tenantId:ids.tenant}}),jobs:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant}}),
    files:Object.fromEntries(preserved.map(f=>[f,hash(readFileSync(f))]))};
},{readOnly:true});}
const before=await snapshot(),results=[];
const source='server/hub-sources/';
const pure=[...readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f),
  ...['search-query-plan','publication-classification','pmc-reading','pmc-schema','registry-detail-schema-contract','registry-detail-contract','guidance-clause-schema-contract','guidance-clause-contract','article-evidence'].map(f=>source+f+'.test.mjs'),
  ...['hub-agent-contract','hub-agent-orchestrator','knowledge-ai-contract','local-knowledge-config'].map(f=>'scripts/'+f+'.test.mjs')];
const gates=[['pure-component',process.execPath,['--test','--test-concurrency=1',...pure]],
  ['real-pg',process.execPath,['--test','--test-concurrency=1',...['article-evidence-pg','article-preflight','approved-source-chain-pg','bilingual-search-pg','publication-filters-pg'].map(f=>source+f+'.test.mjs')]],
  ['build','pnpm',['run','build']],['whitespace','git',['diff','--check']]];
for(const [name,command,args]of gates){const r=spawnSync(command,args,{encoding:'utf8',timeout:240000,maxBuffer:20*1024*1024}),log=(r.stdout??'')+(r.stderr??'');writeFileSync(out+'/'+name+'.log',log);results.push({name,exit:r.status,signal:r.signal,summary:log.split('\n').filter(l=>/^ℹ (tests|pass|fail)|^# (tests|pass|fail)|^✓ built/.test(l)),error:r.error?.message??null});if(r.status!==0)break;}
const after=await snapshot();let preservation=true;try{assert.deepEqual(after,before);}catch{preservation=false;}
const files=['server/hub-sources/article-evidence.mjs','server/hub-sources/article-evidence.test.mjs','server/hub-sources/article-evidence-pg.test.mjs','scripts/local-article-ai.mjs','scripts/local-knowledge-ai.mjs','scripts/hub-agent-contract.mjs','scripts/hub-agent-contract.test.mjs'];
const result={passed:results.length===gates.length&&results.every(x=>x.exit===0)&&preservation,at:new Date().toISOString(),results,before,after,preservation,
  codeHashes:Object.fromEntries(files.map(f=>[f,hash(readFileSync(f))])),provider:'FREE TEST DOUBLE ONLY inside unchanged original Orchestrator',actualModelRequests:0,persistentNewRows:0,
  limits:['not all legacy source integration tests: stale authVersion:0/initial-empty assumptions recorded in publication-filters report','B05/B06 UI acceptance and B07 real Provider/B08 independent review not claimed']};
writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,results,preservation,evidence:out}));if(!result.passed)process.exitCode=1;
