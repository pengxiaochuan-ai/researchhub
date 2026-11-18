// P06 read-only closure: preserve P05 objects and the old ledger, inspect only
// the two explicitly approved jobs and their ordinary business settlements.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root='/Users/mac/aisciencesys/';
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const dir='.tmp/ai-file-data-2026-11-12/';
const baseline=JSON.parse(readFileSync(dir+'p05-facts-1794564555453/result.json','utf8'));
const ledger=JSON.parse(readFileSync(dir+'p06-accounting-baseline.json','utf8'));
const cfg=JSON.parse(readFileSync(dir+'p05-authorized-scope.json','utf8'));
const checkpoints=['owner','admin'].map(actor=>({actor,...JSON.parse(readFileSync(dir+'p06-real-approved-2026-11-13/'+actor+'-checkpoint.json','utf8'))}));
const hash=rows=>createHash('sha256').update(JSON.stringify(rows,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');
const sorted=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
const out=dir+'p06-final-facts-'+Date.now();
mkdirSync(out,{recursive:true,mode:0o700});
try{
 const report=await withFixtureTransaction(env,'direct',async tx=>{
  const [mode]=await tx.$queryRawUnsafe('SHOW transaction_read_only');
  assert.equal(mode.transaction_read_only,'on');
  const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:cfg.target.executionProjectId};
  const counts={subjects:await tx.subject.count({where:scope}),enrollments:await tx.studyEnrollment.count({where:scope}),visits:await tx.subjectVisit.count({where:scope}),responses:await tx.formResponse.count({where:scope}),features:await tx.feature.count({where:{tenantId:ids.tenant,subject:{researchProjectId:cfg.target.executionProjectId}}}),processing:await tx.processingTask.count({where:scope})};
  assert.deepEqual(counts,baseline.counts);
  const subjects=await tx.subject.findMany({where:scope,select:{id:true,subjectId:true,createdBy:true,acceptanceFixture:true}});
  const visits=await tx.subjectVisit.findMany({where:scope,select:{id:true,subjectId:true,status:true,protocolVersionId:true,visitPlanId:true}});
  const responses=await tx.$queryRawUnsafe(`SELECT r.id,r.status,r.answers,r."lockedRevisionId",a.id AS "assignmentId",a."subjectId",a."subjectVisitId",a."formVersionId",a."createdBy",rev."revisionNo",rev."contentHash" FROM public.form_response r JOIN public.form_assignment a ON a.id=r."assignmentId" JOIN public.form_response_revision rev ON rev.id=r."currentRevisionId" AND rev."responseId"=r.id WHERE r."tenantId"=$1 AND r."studyGroupId"=$2 AND r."researchProjectId"=$3 ORDER BY r.id`,ids.tenant,ids.group,cfg.target.executionProjectId);
  for(const [key,rows] of Object.entries({subjects,visits,responses}))assert.deepEqual(sorted(rows),sorted(baseline[key]),key+' unchanged');
  const [grant]=await tx.$queryRawUnsafe('SELECT id,status,version,capabilities,expires_at,objects FROM rh_ai.research_data_import_access WHERE id=$1',cfg.grantId);
  assert.deepEqual(JSON.parse(JSON.stringify(grant)),baseline.grant);
  const accounts=await tx.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]}},select:{id:true,role:true,isTenantAdmin:true,status:true,authVersion:true}});
  assert.deepEqual(sorted(accounts),sorted(baseline.accounts.map(({actor,...a})=>a)));
  const imports=await tx.$queryRawUnsafe('SELECT id,state,snapshot,receipt,account_id FROM rh_ai.research_data_imports WHERE tenant_id=$1 AND scope_key=$2',ids.tenant,cfg.scopeKey);
  const comparable=imports.map(r=>({actor:r.account_id===ids.owner?'owner':'admin',id:r.id,state:r.state,mode:r.snapshot.mode,subjectCount:r.receipt?.subjects.length??0,visitCount:r.receipt?.visits.length??0}));
  assert.deepEqual(sorted(comparable),sorted(baseline.imports));
  const [{count:p05Files}]=await tx.$queryRawUnsafe(`SELECT count(*)::integer AS count FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=ANY($2::text[]) AND filename LIKE '%-P05-SYNTHETIC-%'`,ids.tenant,[ids.owner,ids.admin]);
  assert.equal(p05Files,baseline.p05Files);
  const original=await tx.tokenQuotaReservation.findMany({where:{id:{in:ledger.ids},tenantId:ids.tenant},select:{id:true,status:true,reservedTokens:true,actualTokens:true,settledAt:true,expiresAt:true,usedMock:true},orderBy:{id:'asc'}});
  assert.equal(original.length,152);assert.equal(hash(original),ledger.hash);
  const jobs=await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,sessionId:{in:Object.values(cfg.sessions)}},select:{id:true,sessionId:true,status:true}});
  assert.equal(jobs.length,2);
  const settlements=[];
  for(const c of checkpoints){
   assert.equal(c.state,'verified');assert.equal(c.providerCalls,1);assert.equal(c.status,'completed');
   assert(jobs.some(j=>j.id===c.jobId&&j.sessionId===c.sessionId&&j.status==='completed'));
   const reservation=await tx.tokenQuotaReservation.findFirst({where:{id:c.reservationId,tenantId:ids.tenant,accountId:ids[c.actor]},select:{id:true,status:true,actualTokens:true,usedMock:true}});
   assert(reservation);assert.equal(reservation.status,'settled');assert.equal(reservation.usedMock,false);assert.equal(Number(reservation.actualTokens),c.actualTokens);
   settlements.push({actor:c.actor,jobId:c.jobId,...reservation});
  }
  const newReservations=await tx.tokenQuotaReservation.findMany({where:{tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]},id:{notIn:ledger.ids}},select:{id:true}});
  assert.deepEqual(sorted(newReservations),sorted(settlements.map(({id})=>({id}))));
  return{passed:true,at:new Date().toISOString(),database:'wp01_test_full_baseline',readOnly:true,businessWrites:0,providerCalls:0,counts,p05Files,plans:imports.length,grantUnchanged:true,accountsUnchanged:true,sourceRecordsUnchanged:true,originalReservationsUnchanged:152,newSettlements:settlements,actualApprovedProviderRequests:2,actualApprovedTokens:settlements.reduce((n,r)=>n+Number(r.actualTokens),0)};
 },{readOnly:true});
 writeFileSync(out+'/result.json',JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2),{mode:0o600});
 console.log(JSON.stringify({passed:true,evidence:out,...report},(_,v)=>typeof v==='bigint'?v.toString():v));
}catch(e){
 writeFileSync(out+'/failure.json',JSON.stringify({code:e.code??e.name,message:['ERR_ASSERTION','TypeError'].includes(e.code??e.name)?e.message:undefined,stack:e instanceof TypeError?e.stack?.split('\n').slice(0,4):undefined},null,2),{mode:0o600});
 console.log(JSON.stringify({passed:false,evidence:out,code:e.code??e.name}));process.exitCode=1;
}
