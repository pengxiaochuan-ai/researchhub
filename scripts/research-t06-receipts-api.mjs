// Actual HTTP recovery. Any archive state injection is restricted to this owned synthetic Study.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const pointer=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-current.json')),accepted=JSON.parse(readFileSync(pointer.acceptedFile));
assert(accepted.syntheticOnly&&accepted.runId.startsWith('rh-t06-http-'));
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json')),runtime=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));
const runId='t06-receipts-'+randomUUID().slice(0,8),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t06-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:19501',root='/research-studies/'+accepted.study.id,network=[],checks=[];
const direct=fn=>withFixtureTransaction(env,'direct',fn);let archived=false,scope;
async function request(path,{method='GET',body,status=200,role='admin'}={}){
 const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[role]??'',Origin:base,...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);network.push({at:new Date().toISOString(),path,method,role,status:response.status});
 assert.equal(response.status,status,JSON.stringify({path,expected:status,actual:response.status,code:data?.code}));return data;
}
async function setArchive(archive){
 await direct(async tx=>{
  const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;
  assert.equal(marker.manifest.syntheticOnly,true);assert.equal(marker.manifest.studyId,accepted.study.id);scope=marker.manifest.scope;
  assert.equal(scope.tenantId,runtime.ids.tenant);assert.equal(scope.researchProjectId,accepted.study.executionProjectId);
  const changed=await tx.studyProtocolVersion.updateMany({where:{...scope,id:accepted.protocolId,status:archive?'executing':'archived',acceptanceFixture:false},data:{status:archive?'archived':'executing'}});assert.equal(changed.count,1);
  await tx.auditLog.createMany({data:{...scope,accountId:runtime.ids.admin,action:'synthetic.protocol.receipt-recovery-state',target:accepted.protocolId,meta:{runId,from:archive?'executing':'archived',to:archive?'archived':'executing',purpose:'T06 historical receipt HTTP acceptance; synthetic state injection, not product archive API'}}});
 });archived=archive;
}
try{
 const originals=await direct(async tx=>{
  const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;assert(marker.manifest.syntheticOnly);assert.equal(marker.manifest.studyId,accepted.study.id);scope=marker.manifest.scope;
  const rows=await tx.$queryRaw`SELECT action,request_key,target_id,result FROM rh_research.operation WHERE tenant_id=${scope.tenantId} AND actor_id=${runtime.ids.admin} AND result->>'studyId'=${accepted.study.id} AND action IN ('subject.create','participation.record') ORDER BY created_at`;
  return {create:rows.find(r=>r.action==='subject.create'),record:rows.find(r=>r.action==='participation.record'&&r.target_id===accepted.cases.A.id)};
 });assert(originals.create&&originals.record);
 const createPath=root+'/subjects/receipts/'+originals.create.request_key,recordPath=root+'/subjects/'+accepted.cases.A.id+'/participation/receipts/'+originals.record.request_key;
 assert.deepEqual(await request(createPath),originals.create.result);assert.deepEqual(await request(recordPath),originals.record.result);
 await request(createPath,{status:403,role:'owner'});await request(recordPath,{status:403,role:'owner'});
 await request(root+'/subjects/'+accepted.cases.C.id+'/participation/receipts/'+originals.record.request_key,{status:404});
 await request(root+'/subjects/receipts/'+randomUUID(),{status:404});
 await request(root+'/subjects/'+accepted.cases.A.id+'/participation/receipts/'+randomUUID(),{status:404});
 checks.push('actual_original_create_and_participation_receipts_current_authority_wrong_target_and_missing_404');
 const created=await request(root+'/subjects',{method:'POST',body:{requestKey:randomUUID(),subjectId:'SYNTHETIC-RECEIPT-'+runId.slice(-8)}}),subjectId=created.subject.id;
 const state=await request(root+'/subjects/'+subjectId+'/participation');
 const body={requestKey:randomUUID(),expectedPolicyVersionId:state.policy.id,expectedPolicyHash:state.policy.contentHash,event:{kind:'screening',decision:'passed',method:'manual',effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'通用合成历史回执恢复验收'}};
 const saved=await request(root+'/subjects/'+subjectId+'/participation/events',{method:'POST',body});
 await setArchive(true);
 const unavailable=await request(root+'/subjects/'+subjectId+'/participation',{status:409});assert.equal(unavailable.code,'NO_EXECUTING_PROTOCOL');
 assert.deepEqual(await request(root+'/subjects/'+subjectId+'/participation/receipts/'+body.requestKey),saved);
 checks.push('actual_historical_receipt_200_while_unenrolled_participation_409_without_executing_protocol');
 await setArchive(false);await request(root+'/subjects/'+subjectId+'/participation');
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,studyId:accepted.study.id,runId,subjectId,checks,network,archiveStateWasGuardedFixtureInjection:true,archiveRestored:true,clinicalAcceptance:false,productionAcceptance:false},null,2));
 console.log(JSON.stringify({passed:true,checks,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,at:new Date().toISOString(),checks,network,message:String(error.message).slice(0,1300),archiveStateWasGuardedFixtureInjection:true},null,2));console.error(JSON.stringify({passed:false,message:String(error.message).slice(0,1000)}));process.exitCode=1;}
finally{if(archived)await setArchive(false);}
