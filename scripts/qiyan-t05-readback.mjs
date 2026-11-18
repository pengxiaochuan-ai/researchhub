// Read only: records the exact named T05 tasks, provider traces and normal billing.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {routeDigest,routeExecutionInput} from '../server/ai-agent/skill-routing.mjs';
const named=process.argv.slice(2);assert(named.length&&named.every(s=>/^[a-z0-9]+$/.test(s)));
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const jobs=await withFixtureTransaction(env,'direct',async tx=>{
 const rows=await tx.knowledgeChatJob.findMany({where:{id:{in:named},tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]},studyGroupId:ids.group,researchProjectId:ids.project}});assert.equal(rows.length,named.length);
 return Promise.all(rows.map(async j=>{
  assert.equal(j.status,'completed');
  const m=await tx.message.findUnique({where:{id:j.assistantMessageId}}),r=j.payload.hubSkillRoute;
  assert.equal(m.meta.usedMock,false);assert.equal(m.meta.provenance.hubSkillRoute.snapshotHash,r.snapshotHash);
  const usage=await tx.usageRecord.findMany({where:{tenantId:ids.tenant,messageId:m.id}});assert.equal(usage.length,1);
  const reservations=await tx.tokenQuotaReservation.findMany({where:{tenantId:ids.tenant,requestKey:`chat:${j.sessionId}:${j.requestKey}`}});
  assert.equal(reservations.length,1);assert.equal(reservations[0].status,'settled');assert.equal(String(reservations[0].actualTokens),String(usage[0].totalTokens));
  return{id:j.id,text:j.text,status:j.status,accountId:j.accountId,route:r,execution:routeExecutionInput(r,j.text),assistantMessageId:m.id,
   contentHash:routeDigest(m.content),receipt:m.meta.provenance.hubSkillRoute,tools:m.meta.provenance.hubTools??m.meta.provenance.tools,
   scientificSections:m.meta.provenance.articleResponseValidation?.sections,
   usage:usage.map(u=>({id:u.id,model:u.model,usedMock:u.usedMock,totalTokens:u.totalTokens,promptTokens:u.promptTokens,completionTokens:u.completionTokens,costEstimate:String(u.costEstimate),runtime:u.runtime})),
   reservations:reservations.map(r=>({id:r.id,status:r.status,reservedTokens:String(r.reservedTokens),actualTokens:String(r.actualTokens)}))};
 }));
},{readOnly:true});
const traceDir='../.tmp/researchhub-knowledge-local/ai-traces/',traces=[];
for(const file of await readdir(traceDir)){
 if(!file.endsWith('.json'))continue;
 const t=JSON.parse(await readFile(traceDir+file,'utf8'));if(!named.includes(t.jobId)||!t.request)continue;
 const j=jobs.find(j=>j.id===t.jobId);assert.equal(t.httpStatus,200);
 let query;try{query=JSON.parse(t.request.messages.at(-1).content).question;}catch{}
 if(j.route.decision.mode==='existing-fixed-article')assert.equal(query,j.execution.query);
 traces.push({file,jobId:t.jobId,startedAt:t.startedAt,endedAt:t.endedAt,endpoint:t.endpoint,httpStatus:t.httpStatus,model:t.model,usage:t.usage,query,
  continuationInstructionSent:t.request.messages[0]?.content.includes('question已恢复该用户原问题'),requestHash:routeDigest(t.request),responseHash:routeDigest(t.response)});
}
for(const j of jobs){const t=traces.filter(t=>t.jobId===j.id);assert.equal(t.length,1);assert.equal(t[0].usage.total_tokens,j.usage[0].totalTokens);if(j.route.decision.previousJobId)assert(t[0].continuationInstructionSent);}
const result={at:new Date().toISOString(),syntheticOnly:true,jobs,traces,newModelRequests:traces.length,totalTokens:jobs.reduce((s,j)=>s+j.usage[0].totalTokens,0),costEstimate:jobs.reduce((s,j)=>s+Number(j.usage[0].costEstimate),0)};
const dir='.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t05/';await mkdir(dir,{recursive:true});const path=dir+'readback-'+randomUUID()+'.json';await writeFile(path,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({path,tasks:jobs.map(j=>({id:j.id,status:j.status,adapter:j.receipt.adapter,previousJobId:j.receipt.previousJobId,usage:j.usage,reservations:j.reservations})),totalTokens:result.totalTokens,costEstimate:result.costEstimate}));
