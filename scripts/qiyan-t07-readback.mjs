// Read-only, exact synthetic T07 tasks; no submission, retry or billing writes.
import assert from 'node:assert/strict';import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {routeDigest} from '../server/ai-agent/skill-routing.mjs';import {assertLiteratureEvidence} from '../server/ai-agent/literature-session.mjs';import {acceptInterpretationOutput} from '../server/ai-agent/interpretation-output.mjs';
const named=process.argv.slice(2);assert(named.length&&named.every(id=>/^[a-z0-9]+$/.test(id)));
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8')),{env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const jobs=await withFixtureTransaction(env,'direct',async tx=>{
 const rows=await tx.knowledgeChatJob.findMany({where:{id:{in:named},tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]},studyGroupId:ids.group,researchProjectId:ids.project}});assert.equal(rows.length,named.length);
 return Promise.all(rows.map(async j=>{
  assert.equal(j.payload.hubSkillRoute.decision.mode,'hub-literature-interpretation');const e=assertLiteratureEvidence(j.payload.hubLiteratureEvidence);
  const parent=await tx.knowledgeChatJob.findFirst({where:{id:e.plan.parentJobId,tenantId:j.tenantId,accountId:j.accountId,sessionId:j.sessionId,status:'completed'}});assert(parent);assert.equal(assertLiteratureEvidence(parent.payload.hubLiteratureEvidence).hash,e.plan.parentEvidenceHash);
  assert(e.tools.every(t=>t.tool==='hub_fixed_interpretation_evidence'));
  const message=j.assistantMessageId?await tx.message.findUnique({where:{id:j.assistantMessageId}}):null;
  const reservations=await tx.tokenQuotaReservation.findMany({where:{tenantId:ids.tenant,requestKey:`chat:${j.sessionId}:${j.requestKey}`}});
  const usage=message?await tx.usageRecord.findMany({where:{tenantId:ids.tenant,messageId:message.id}}):await tx.usageRecord.findMany({where:{tenantId:ids.tenant,id:{in:reservations.map(r=>r.reconciliationUsageRecordId).filter(Boolean)}}});
  if(j.status==='completed'){
   assert.equal(message.meta.usedMock,false);assert.equal(message.meta.provenance.literatureRuntime.runtime,'hub-opencode');assert.equal(message.meta.provenance.literatureEvidence.hash,e.hash);assert.equal(message.meta.provenance.literatureOutput.textHash,routeDigest(message.content));
   assert.equal(usage.length,1);assert.equal(reservations.length,1);assert.equal(reservations[0].status,'settled');assert.equal(String(reservations[0].actualTokens),String(usage[0].totalTokens));
  }
  return{id:j.id,text:j.text,actor:j.accountId===ids.admin?'admin':'owner',status:j.status,errorCode:j.errorCode,errorMessage:j.errorMessage,evidence:e,content:message?.content,validation:message?.meta.provenance.literatureOutput,runtime:message?.meta.provenance.literatureRuntime,
   usage:usage.map(u=>({model:u.model,runtime:u.runtime,usedMock:u.usedMock,promptTokens:u.promptTokens,completionTokens:u.completionTokens,totalTokens:u.totalTokens,costEstimate:String(u.costEstimate)})),reservations:reservations.map(r=>({status:r.status,actualTokens:String(r.actualTokens),reservedTokens:String(r.reservedTokens)}))};
 }));
},{readOnly:true});
const traces=[],traceDir='../.tmp/researchhub-knowledge-local/ai-traces/';
for(const file of await readdir(traceDir)){
 if(!file.endsWith('.json'))continue;const t=JSON.parse(await readFile(traceDir+file,'utf8'));if(!named.includes(t.jobId)||!t.request)continue;
 const completed=jobs.find(j=>j.id===t.jobId)?.status==='completed';if(completed)assert.equal(t.httpStatus,200);assert.deepEqual(t.request.messages.map(m=>m.role),['system','user']);
 assert(![ids.tenant,ids.group,ids.project,ids.owner,ids.admin,'/Users/','owner@example.org','admin@example.org'].some(s=>JSON.stringify(t.request).includes(s)));
 const j=jobs.find(j=>j.id===t.jobId),bound=JSON.parse(t.request.messages[1].content);assert.deepEqual(bound.articles.map(a=>a.id),j.evidence.selected.map(s=>s.id));
 if(j.status==='completed'){const replay=acceptInterpretationOutput(t.response[0].message.content,j.evidence,{policy:j.validation.schema});assert.equal(replay.text,j.content);assert.deepEqual(replay.validation,j.validation);}
 traces.push({file,jobId:t.jobId,httpStatus:t.httpStatus,startedAt:t.startedAt,endedAt:t.endedAt,usage:t.usage,requestHash:routeDigest(t.request),responseHash:routeDigest(t.response??null)});
}
for(const j of jobs.filter(j=>j.status==='completed')){const ts=traces.filter(t=>t.jobId===j.id);assert.equal(ts.length,1);assert.equal(ts[0].usage.total_tokens,j.usage[0].totalTokens);}
const result={at:new Date().toISOString(),jobs,traces,newModelRequests:traces.length,totalTokens:jobs.flatMap(j=>j.usage).reduce((s,u)=>s+u.totalTokens,0),costEstimate:jobs.flatMap(j=>j.usage).reduce((s,u)=>s+Number(u.costEstimate),0)};
const dir='.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t07/';await mkdir(dir,{recursive:true});const path=dir+'readback-'+randomUUID()+'.json';await writeFile(path,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({path,tasks:jobs.map(j=>({id:j.id,actor:j.actor,status:j.status,error:j.errorMessage,selected:j.evidence.selected.map(s=>({id:s.id,pmid:s.pmid,title:s.title,coverage:s.pack.coverage.notice})),usage:j.usage,reservations:j.reservations})),newModelRequests:result.newModelRequests,totalTokens:result.totalTokens,costEstimate:result.costEstimate}));
