import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';import {createNativeResearchDataPreflight} from '../../scripts/ai-research-data-preflight.mjs';
const api=await import('./research-data-staging.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const root='/Users/mac/aisciencesys/',{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,n)=>require(root+'app/server/src/'+p+'.ts')[n],engine=createNativeResearchDataPreflight({load,require}),rollback=Symbol('rollback-data-service');
test('current private upload, exact receipt, read-only batch preview/cancel and model admission use real app PG',async t=>{
 assert.equal(typeof api.createResearchDataStaging,'function');
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true)`,ids.tenant,ids.group,ids.project);
  const a=await tx.account.findUnique({where:{id:ids.owner}}),user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:a.id,authVersion:a.authVersion,role:a.role};
  const sid='rh-data-service-'+randomUUID();await tx.session.create({data:{id:sid,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:a.id,agentId:ids.tenant+'-kb-research',channel:'knowledge',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID(),title:'P04具名回滚服务'}});
  const access=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)}),objects=new Map();let puts=0;
  const storage={put:async(key,b)=>{puts++;objects.set(key,Buffer.from(b));},getBuffer:async key=>{if(!objects.has(key))throw Error('missing-object');return objects.get(key);}};
  const service=api.createResearchDataStaging({access,storage,engine}),buffer=Buffer.from('subject_id,score,flag\nP04-SYN-01,0,false\nP04-SYN-02,,true\n'),key='p04-upload-'+randomUUID();
  const counts=async()=>Promise.all([tx.subject.count({where:{tenantId:ids.tenant,researchProjectId:ids.project}}),tx.processingTask.count({where:{tenantId:ids.tenant,researchProjectId:ids.project}}),tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,sessionId:sid}}),tx.tokenQuotaReservation.count({where:{tenantId:ids.tenant,accountId:a.id}})]),before=await counts();
  const item=await service.upload(user,sid,{requestKey:key,filename:'synthetic.csv',buffer});assert.equal(item.state,'ready');assert.equal(item.kind,'research-data');
  assert.equal((await service.upload(user,sid,{requestKey:key,filename:'synthetic.csv',buffer})).id,item.id);assert.equal(puts,1);assert.equal((await service.receipt(user,sid,key)).item.id,item.id);
  assert.equal((await service.list(user,sid,{})).items[0].summary.sampleRows,undefined,'file lists deliver metadata, never old raw samples');assert.equal((await service.receipt(user,sid,key)).item.summary.sampleRows,undefined,'upload receipts do not deliver raw values');
  await assert.rejects(async()=>service.preview(user,sid,{requestKey:'bad-refs-'+randomUUID(),files:[null]}),e=>e.code==='DATA_INPUT_INVALID'&&e.status===400);
  await assert.rejects(service.upload(user,sid,{requestKey:key,filename:'synthetic.csv',buffer:Buffer.from('subject_id,score\nS01,1\n')}),e=>e.code==='DATA_REQUEST_CONFLICT');
  const refs=[{id:item.id,version:item.version}],pkey='p04-plan-'+randomUUID(),plan=await service.preview(user,sid,{requestKey:pkey,files:refs});assert.equal(plan.state,'previewed');assert.equal(plan.result.files[0].rowsRead,2);assert.equal(plan.result.confirmationReady,false);assert.equal(plan.result.files[0].sampleRows[0].values[1],'0');
  assert.deepEqual(plan.files,refs);assert.equal((await service.preview(user,sid,{requestKey:pkey,files:refs})).id,plan.id);assert.equal((await service.current(user,sid)).item.id,plan.id);
  await assert.rejects(api.assertNoResearchDataQuestion(tx,user,sid),e=>e.code==='DATA_ANALYSIS_UNAVAILABLE');assert.deepEqual(await counts(),before);
  await t.test('another session/account and stale reference are rejected',async()=>{
   await assert.rejects(service.preview(user,sid,{requestKey:'stale-'+randomUUID(),files:[{id:item.id,version:1}]}));
   const admin=await tx.account.findUnique({where:{id:ids.admin}});await assert.rejects(service.list({...user,accountId:ids.admin,authVersion:admin.authVersion,role:admin.role},sid,{}));
  });
  const sourceKey=[...objects.keys()][0],original=objects.get(sourceKey);objects.set(sourceKey,Buffer.from('tampered'));
  await assert.rejects(service.current(user,sid),e=>e.code==='DATA_SOURCE_CHANGED');objects.set(sourceKey,original);
  const cancelled=await service.cancel(user,sid,plan.id,{version:plan.version});assert.equal(cancelled.state,'cancelled');assert.equal((await service.cancel(user,sid,plan.id,{version:plan.version})).state,'cancelled');assert.equal((await service.list(user,sid,{})).items.length,1);assert.deepEqual(await counts(),before);
  assert(cancelled.result.files.every(f=>f.sampleRows.length===0));assert((await service.current(user,sid)).item.result.files.every(f=>f.sampleRows.length===0));assert((await service.planReceipt(user,sid,pkey)).item.result.files.every(f=>f.sampleRows.length===0));
  throw rollback;
 }),e=>e===rollback);
});
