import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fixtureEnvironment,requireServer,workspaceRoot as root} from './research-creation-fixture.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createGovernanceAudit} from '../server/governance-audit/service.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment(),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.match(runtime.ids.tenant,/^rh-kb-local-/);
requireServer('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {normalizeAuditEvidence}=requireServer(root+'app/server/src/audit/sensitive-audit-policy.ts');
const out=root+'researchhub/docs/testing/evidence/governance-p5-2026-11-13/';mkdirSync(out,{recursive:true});
try{
 const result=await withFixtureTransaction(env,'direct',async tx=>{
  assert.equal((await tx.$queryRaw`SHOW transaction_read_only`)[0].transaction_read_only,'on');
  const scope={tenantId:runtime.ids.tenant};
  const accounts=await tx.account.findMany({where:{...scope,id:{in:[runtime.ids.owner,runtime.ids.admin]}},select:{id:true,role:true,isTenantAdmin:true,status:true,authVersion:true}}),admin=accounts.find(a=>a.id===runtime.ids.admin),owner=accounts.find(a=>a.id===runtime.ids.owner);
  const user={...scope,accountId:admin.id,role:admin.role,authVersion:admin.authVersion};
  const service=createGovernanceAudit({transact:async(_p,cb)=>cb(tx),normalize:normalizeAuditEvidence});
  const first=await service.list(user,{take:'5'}),next=await service.list(user,{take:'5',skip:'5',cursor:first.nextCursor});assert.equal(new Set([...first.items,...next.items].map(r=>r.id)).size,first.items.length+next.items.length);
  await assert.rejects(()=>service.list({...user,accountId:owner.id,role:'tenant_admin',authVersion:owner.authVersion},{}),{status:403});
  await assert.rejects(()=>service.list({...user,authVersion:admin.authVersion+1},{}),{status:403});
  await assert.rejects(()=>service.list({...user,tenantId:runtime.ids.tenant+'-foreign'},{}),{status:403});
  const actions=['researchhub.protocol.approve','researchhub.protocol.return','directory_team_review','directory_decision_approve','update_account','pi_project_member_change','researchhub.source_review.receipt','hub.token.reconciled'],details=[];
  for(const action of actions){const page=await service.list(user,{action,take:'1'});for(const item of page.items){const d=await service.detail(user,item.id);assert.equal(d.id,item.id);assert(!('meta'in d));details.push({id:d.id,action,status:d.evidence.status,fields:d.evidence.fields,navigation:d.navigation});}}
  assert(details.some(d=>d.action==='researchhub.protocol.approve'&&d.status==='verified'),'PROTOCOL_PROOF_REQUIRED');
  assert(details.some(d=>d.action==='directory_team_review'&&d.status==='verified'),'TEAM_PROOF_REQUIRED');
  assert(details.some(d=>d.action==='update_account'&&d.status==='verified'),'ACCOUNT_PROOF_REQUIRED');
  const byAction=await tx.auditLog.groupBy({by:['action'],where:scope,_count:true});
  return{passed:true,readOnly:true,accounts,firstPage:first.items.map(r=>r.id),secondPage:next.items.map(r=>r.id),total:first.total,details,actionCounts:byAction.map(r=>({action:r.action,count:r._count})),businessWrites:0,modelCalls:0,time:new Date().toISOString()};
 },{readOnly:true});
 writeFileSync(out+'readonly-pg.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,total:result.total,details:result.details.map(d=>({action:d.action,status:d.status})),businessWrites:0,modelCalls:0}));
}catch(e){const failure={passed:false,error:String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(-800),businessWrites:0,modelCalls:0};writeFileSync(out+'readonly-pg-failure-'+Date.now()+'.json',JSON.stringify(failure,null,2));console.log(JSON.stringify(failure));process.exitCode=1;}
