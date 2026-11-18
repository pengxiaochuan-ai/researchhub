// Free, read-only replay of the reported failure through the unchanged core.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {parseArticleResponse,articleCoreText,restoreArticleCoreResult,verifyArticleResponse} from './article-response-policy.mjs';
import {articleToolResult} from '../server/hub-sources/article-evidence.mjs';
import {HUB_TOOL_KB_ID} from './hub-agent-contract.mjs';
import {assertAnswer} from './knowledge-ai-contract.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const rt=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json'));
const jobId='cmw4onwb2001hlurayz7wx0ux',hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const snapshot=()=>withFixtureTransaction(env,'direct',async db=>({
 job:await db.knowledgeChatJob.findFirst({where:{id:jobId,tenantId:rt.ids.tenant}}),
 jobs:await db.knowledgeChatJob.count({where:{tenantId:rt.ids.tenant}}),messages:await db.message.count({where:{tenantId:rt.ids.tenant}}),
 roles:hash(await db.permissionRole.findMany({where:{tenantId:rt.ids.tenant},orderBy:{id:'asc'}}))
}),{readOnly:true});
const before=await snapshot();assert.equal(before.job.status,'failed');
const pack=before.job.payload.articleEvidence,traceDir='../.tmp/researchhub-knowledge-local/ai-traces/';
const trace=readdirSync(traceDir).filter(f=>f.endsWith('.json')&&!f.endsWith('-runtime.json')).map(f=>JSON.parse(readFileSync(traceDir+f))).find(t=>t.jobId===jobId);
assert.equal(trace.httpStatus,200);assert.equal(trace.finishReason,'stop');
const accepted=parseArticleResponse(trace.response[0].message.content,pack),tool=articleToolResult(pack);
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {OrchestratorService}=require('./src/orchestrator/orchestrator.service.ts');
let replayed=0,retrieved=0;
const provider={chat:async()=>{replayed++;return{text:articleCoreText(accepted),usedMock:false,usage:trace.usage,route:{model:trace.model,profileId:'stored-response-offline-replay',fallbackIndex:0}};},chatWithTools:()=>{throw Error('REPLAY_NO_TOOL_LOOP');}};
const tools={toolDefs:()=>[{type:'function',function:{name:'kb_search',parameters:{type:'object',properties:{query:{type:'string'}}}}}],execute:async()=>{retrieved++;return tool;}};
const core=new OrchestratorService({},provider,{},{},tools),result=await core.run({user:{tenantId:rt.ids.tenant,accountId:rt.ids.admin},userMessage:before.job.text,history:[],ctx:{kbAgent:true,agentKind:'research',tools:['knowledge.search'],kbIds:[HUB_TOOL_KB_ID],model:{provider:'deepseek',model:'deepseek-v4-pro',maxTokens:1536}}});
assert.equal(replayed,1);assert.equal(retrieved,1);assertAnswer({...result,finalText:accepted.citationText},[pack.source]);
const restored=restoreArticleCoreResult(result,accepted,pack);verifyArticleResponse(accepted.validation,pack,restored.finalText);
assert.equal(restored.finalText,accepted.text);assert(accepted.numericEvidence.some(f=>/https?:/.test(f.text)));
const after=await snapshot();assert.deepEqual(before,after);
const out='docs/testing/evidence/ai01-agent-free-replay-'+randomUUID();mkdirSync(out,{recursive:true});
const evidence={passed:true,at:new Date().toISOString(),reportedJobId:jobId,unchangedFailedJob:true,unchangedCountsRoles:true,realProviderCalls:0,newBusinessWrites:0,offlineReplay:true,originalKnownUsage:trace.usage,sourceQuoteUrlsPreserved:true,receiptVerified:true,coreProvenance:result.provenance,deliveredTextHash:hash(restored.finalText),note:'Stored real response replay is not a new delivered task or professional acceptance.'};
writeFileSync(out+'/result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:true,evidence:out,realProviderCalls:0}));
