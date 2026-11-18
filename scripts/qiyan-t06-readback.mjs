// Exact named synthetic tasks only: read-only acceptance, no task submission.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {routeDigest} from '../server/ai-agent/skill-routing.mjs';
import {assertLiteratureEvidence} from '../server/ai-agent/literature-session.mjs';
const auditInitial=process.argv.includes('--audit-initial'),named=process.argv.slice(2).filter(s=>s!=='--audit-initial');assert(named.length&&named.every(s=>/^[a-z0-9]+$/.test(s)));
if(auditInitial)assert.deepEqual(named,['cmw5yuart0003lu9xxy3uv704'],'only the preserved pre-fix synthetic request may be audited without the final privacy assertion');
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const jobs=await withFixtureTransaction(env,'direct',async tx=>{
 const rows=await tx.knowledgeChatJob.findMany({where:{id:{in:named},tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]},studyGroupId:ids.group,researchProjectId:ids.project}});assert.equal(rows.length,named.length);
 return Promise.all(rows.map(async j=>{
  assert(['completed','failed'].includes(j.status));assert.equal(j.payload.hubSkillRoute.decision.mode,'hub-literature-search');
  const evidence=assertLiteratureEvidence(j.payload.hubLiteratureEvidence);
  const reservations=await tx.tokenQuotaReservation.findMany({where:{tenantId:ids.tenant,requestKey:`chat:${j.sessionId}:${j.requestKey}`}});
  const m=j.assistantMessageId?await tx.message.findUnique({where:{id:j.assistantMessageId}}):null;
  const usage=m?await tx.usageRecord.findMany({where:{tenantId:ids.tenant,messageId:m.id}}):[];
  if(j.status==='completed'){
   assert.equal(m.meta.usedMock,false);const p=m.meta.provenance;
   assert.equal(p.literatureEvidence.hash,evidence.hash);assert.equal(p.literatureOutput.evidenceHash,evidence.hash);assert.equal(p.literatureOutput.textHash,routeDigest(m.content));
   assert.equal(p.literatureRuntime.runtime,'hub-opencode');assert.equal(p.literatureRuntime.providerCalls,1);
   assert.equal(usage.length,1);assert.equal(reservations.length,1);assert.equal(reservations[0].status,'settled');assert.equal(String(reservations[0].actualTokens),String(usage[0].totalTokens));
  }
  return{id:j.id,actor:j.accountId===ids.admin?'admin':'owner',text:j.text,status:j.status,errorCode:j.errorCode,errorMessage:j.errorMessage,evidence,content:m?.content,output:m?.meta?.provenance?.literatureOutput,runtime:m?.meta?.provenance?.literatureRuntime,
   usage:usage.map(u=>({model:u.model,usedMock:u.usedMock,promptTokens:u.promptTokens,completionTokens:u.completionTokens,totalTokens:u.totalTokens,costEstimate:String(u.costEstimate),runtime:u.runtime})),
   reservations:reservations.map(r=>({status:r.status,reservedTokens:String(r.reservedTokens),actualTokens:String(r.actualTokens)}))};
 }));
},{readOnly:true});
const traces=[],dir='../.tmp/researchhub-knowledge-local/ai-traces/';
for(const file of await readdir(dir)){
 if(!file.endsWith('.json'))continue;const t=JSON.parse(await readFile(dir+file,'utf8'));if(!named.includes(t.jobId)||!t.request)continue;
 assert.equal(t.httpStatus,200);assert.equal(t.request.model,'deepseek-v4-pro');
 const privateScopeDetected=[ids.tenant,ids.group,ids.project,ids.owner,ids.admin,'owner@example.org','admin@example.org','/Users/'].some(value=>JSON.stringify(t.request).includes(value));
 if(!auditInitial){
  assert(!privateScopeDetected,'private scope must not enter public model input');assert.deepEqual(t.request.messages.map(m=>m.role),['system','user']);
  const bound=JSON.parse(t.request.messages[1].content),j=jobs.find(j=>j.id===t.jobId);
  assert.equal(bound.question,j.evidence.plan.question);assert.equal(bound.plan.hash,j.evidence.plan.hash);
  if(j.text==='继续')assert(JSON.stringify(bound.continuation).includes('继续'),'continuation must reach the real provider, anchored to the original public question');
 }
 traces.push({file,jobId:t.jobId,startedAt:t.startedAt,endedAt:t.endedAt,endpoint:t.endpoint,httpStatus:t.httpStatus,model:t.model,usage:t.usage,privateScopeDetected,requestHash:routeDigest(t.request),responseHash:routeDigest(t.response)});
}
for(const j of jobs.filter(j=>j.status==='completed')){const t=traces.filter(t=>t.jobId===j.id);assert.equal(t.length,1);assert.equal(t[0].usage.total_tokens,j.usage[0].totalTokens);}
const result={at:new Date().toISOString(),syntheticOnly:true,jobs,traces,newModelRequests:traces.length,totalTokens:jobs.reduce((s,j)=>s+j.usage.reduce((v,u)=>v+u.totalTokens,0),0),costEstimate:jobs.reduce((s,j)=>s+j.usage.reduce((v,u)=>v+Number(u.costEstimate),0),0)};
const path='.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t06/readback-'+randomUUID()+'.json';await mkdir('.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t06',{recursive:true});await writeFile(path,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({path,auditInitial,privateScopeDetected:traces.some(t=>t.privateScopeDetected),tasks:jobs.map(j=>({id:j.id,actor:j.actor,status:j.status,errorMessage:j.errorMessage,pmids:j.evidence.external?.sources.map(s=>s.pmid),usage:j.usage,reservations:j.reservations})),newModelRequests:result.newModelRequests,totalTokens:result.totalTokens,costEstimate:result.costEstimate}));
