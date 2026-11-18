// Free replay of one named synthetic task's saved Provider output. All DB
// transactions are READ ONLY; historical messages/receipts are never rewritten.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {routeDigest} from '../server/ai-agent/skill-routing.mjs';
import {assertLiteratureEvidence,literatureSynthesisInput} from '../server/ai-agent/literature-session.mjs';
import {acceptLiteratureOutput} from '../server/ai-agent/literature-output.mjs';
const root='/Users/mac/aisciencesys/',out='.tmp/ai-followup-fix-2026-11-11',traceDir=root+'.tmp/researchhub-knowledge-local/ai-traces/';
const jobId='cmwc2nq5m001llulnl9bckcjx',sessionId='cmwc2np1v001flulncp9ax98r';
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const digest=v=>routeDigest(JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x)));
const snapshot=()=>withFixtureTransaction(env,'direct',async tx=>{
 const result={};
 for(const name of ['permissionRole','tokenQuotaGrant','tokenQuotaReservation','usageRecord','auditLog','knowledgeChatJob','message']){
  const rows=await tx[name].findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}});
  result[name]={count:rows.length,hash:digest(rows)};
 }
 return result;
},{readOnly:true});
const traces=()=>readdirSync(traceDir).filter(f=>f.endsWith('.json')).sort().map(name=>({name,hash:digest(readFileSync(traceDir+name,'utf8'))}));
const before=await snapshot(),traceBefore=traces();
const {job,message}=await withFixtureTransaction(env,'direct',async tx=>{
 const job=await tx.knowledgeChatJob.findFirst({where:{id:jobId,sessionId,tenantId:ids.tenant,accountId:ids.admin}});
 assert.equal(job?.status,'completed');
 return{job,message:await tx.message.findUnique({where:{id:job.assistantMessageId}})};
},{readOnly:true});
const evidence=assertLiteratureEvidence(job.payload.hubLiteratureEvidence);
const actualTraces=traceBefore.map(({name})=>({name,value:JSON.parse(readFileSync(traceDir+name))})).filter(t=>t.value.jobId===jobId);
const trace=actualTraces.find(t=>t.value.request?.messages?.some(m=>m.role==='user'&&JSON.parse(m.content).sources));assert(trace);
const raw=trace.value.response[0].message.content,original=JSON.parse(trace.value.request.messages.find(m=>m.role==='user').content);
assert.deepEqual(original.sources,evidence.selected.map(({id,title,text,coverage})=>({id,title,text,coverage})));
assert.equal(original.directionFacts.version,'hub-direction-consistency.v2');
assert(message.content.includes('且未提及随访时间'));assert(message.content.includes('未报告倦怠结局，未提及随访'));
const accepted=acceptLiteratureOutput(raw,evidence);
assert.deepEqual(accepted,acceptLiteratureOutput(raw,structuredClone(evidence)));
assert.equal(accepted.validation.directionPolicyVersion,'hub-direction-consistency.v3');
const checks=['P2','P6'].map(id=>{
 const source=evidence.selected.find(s=>s.id===id),fact=accepted.validation.directionFacts.sources.find(s=>s.id===id),item=accepted.validation.items.find(s=>s.id===id);
 assert.equal(fact.followUp.state,'reported');
 assert(item.consistency.issues.some(i=>i.code==='FOLLOW_UP_OVERGENERALIZED'));
 assert(!item.reason.includes('未提及随访'));
 for(const q of fact.quotes){assert.equal(source[q.field].slice(q.offset,q.offset+q.text.length),q.text);assert.equal(q.hash,routeDigest({field:q.field,offset:q.offset,text:q.text}));}
 if(id==='P2')assert(fact.quotes.some(q=>q.text.includes('were invited to complete an online survey 1 week before the workshop and 3 months afterwards')));
 if(id==='P6')assert(fact.quotes.some(q=>q.text.includes('Perceived stress, measured with the 10-item Perceived Stress Scale, decreased significantly from baseline to 1 and 3 months ( P < .001)')));
 return{id,pmid:source.pmid,state:fact.followUp.state,issueCodes:item.consistency.issues.map(i=>i.code),quotes:fact.quotes};
});
const nextInput=JSON.parse(literatureSynthesisInput({query:job.text,literature:evidence}));
assert.deepEqual(nextInput.directionFacts,accepted.validation.directionFacts);
assert(accepted.text.includes('评估时点不等于干预结束后的随访'));
assert.deepEqual(await snapshot(),before);assert.deepEqual(traces(),traceBefore);
mkdirSync(out,{recursive:true});
writeFileSync(out+'/replayed-answer.md',accepted.text);
writeFileSync(out+'/replay-validation.json',JSON.stringify(accepted.validation,null,2));
writeFileSync(out+'/fixed-input-v3.json',JSON.stringify(nextInput,null,2));
writeFileSync(out+'/browser-projection.json',JSON.stringify({jobId,sessionId,messageId:message.id,oldContent:message.content,accepted},null,2));
writeFileSync(out+'/replay.json',JSON.stringify({passed:true,jobId,sessionId,originalPolicy:original.directionFacts.version,newPolicy:accepted.validation.directionPolicyVersion,evidenceHash:evidence.hash,traceFile:trace.name,modelCalls:0,dbReadOnly:true,deterministic:true,preserved:before,providerTracesUnchanged:true,checks,coverage:'Saved real Provider output replay, not a new generated or persisted answer'},null,2));
console.log(JSON.stringify({passed:true,modelCalls:0,dbReadOnly:true,historyAndLedgerUnchanged:true,checks:checks.map(({id,state,issueCodes})=>({id,state,issueCodes}))}));
