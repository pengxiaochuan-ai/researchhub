import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFullStudyMethodsFacade} from './full-study-methods-facade.mjs';
import {createFullStudyBatchSource} from '../server/research-analysis/full-study-batch-source.mjs';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const exceptions=require('@nestjs/common');
const {FormalDescriptiveRuns}=require('./src/research-methods/formal-descriptive-runs.ts');
const {descriptiveReference,buildDescriptiveInput}=require('./src/research-methods/descriptive-analysis-policy.ts');
const {canonicalManifestHash}=require('./src/research-methods/data-quality-release-policy.ts');
const {createDescriptiveJobCapabilityIssuer}=require('./src/research-methods/descriptive-job-contract.ts');

const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
const user={...scope,accountId:'actor',authVersion:1,role:'tenant_admin',isTenantAdmin:true};
const context={studyId:'study',rootSnapshotId:'root'};
const items=['one','two','three'].map(id=>({skillKey:'descriptive-statistics',idempotencyKey:'original-'+id,input:{studyId:'study',snapshotId:id}}));
const command={requestKey:'review-parent',conclusion:'confirmed',comment:'核对完毕'};
const hash='a'.repeat(64);
const conflict=code=>new exceptions.ConflictException({code});

function fixture({useRealGuard=false}={}){
 const committed={rows:[],audits:[],reviews:[],bindings:{}},log=[],hooks={},instances=new Set();
 let ticks=0, lastTransaction=Promise.resolve();
 function txFor(data){
  return {
   _state:data,$executeRaw:async()=>0,$queryRaw:async()=>[],agent:{findMany:async()=>[{id:'agent'}]},skill:{findUnique:async()=>skill},
   session:{findFirst:async()=>null,create:async()=>({id:'session'})},
   researchMethodRun:{
    findUnique:async({where})=>structuredClone(data.rows.find(r=>where.id?r.id===where.id:r.idempotencyKey===where.tenantId_idempotencyKey.idempotencyKey)??null),
    create:async({data:fields})=>{const row={...fields,id:'run-'+fields.inputSummary.snapshotId,updatedAt:new Date(++ticks),createdAt:new Date(ticks)};data.rows.push(row);return structuredClone(row);},
    update:async({where,data:fields})=>{const row=data.rows.find(r=>r.id===where.id);assert.equal(row.status,where.status);assert.equal(+row.updatedAt,+where.updatedAt);if(where.inputHash)assert.equal(row.inputHash,where.inputHash);Object.assign(row,fields,{updatedAt:new Date(++ticks)});return structuredClone(row);}
   },
   auditLog:{create:async({data:fields})=>{data.audits.push(fields);return fields;},findUnique:async({where})=>data.audits.find(a=>a.id===where.id)??null},
   researchMethodReview:{findFirst:async({where})=>data.reviews.findLast(r=>r.runId===where.runId),create:async({data:fields})=>{const review={...fields,id:'review-'+fields.runId};data.reviews.push(review);return review;}}
  };
 }
 const worker={async execute(_key,input,id){
  log.push('worker:'+id);assert.equal(committed.rows.find(r=>r.id===id)?.status,'running','Worker started before dispatch commit');
  if(hooks.worker)await hooks.worker(id);
  const outputs={manifestHash:input.manifestHash,rowCount:1,statisticalUnit:'subject',columns:{x:{type:'number',total:1,observed:1,missing:0,status:'single_observation',min:0,max:0,mean:0,median:0,sampleStdDev:null}}};
  const numericEvidence=[];function visit(v,path){if(typeof v==='number')numericEvidence.push({name:path,value:v,operator:'descriptive-summary',operatorVersion:'descriptive-v1',assumptions:['manifestHash:'+hash]});else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))visit(x,path?path+'.'+k:k);}
  visit(outputs,'');return{executorKey:'descriptive-statistics',executorVersion:'descriptive-v1',workerVersion:'t19-1',ok:true,status:'accepted',outputs,numericEvidence,warnings:[],limitations:[]};
 }};
 const methods={descriptiveRuns(){
  const instance=new FormalDescriptiveRuns({prisma:{},worker,resolver:{},grant:async()=>({})});
  instances.add(instance);
  instance.transaction=(_user,fn,operation)=>{
   // The native outer transaction takes the official and tenant locks. Model
   // their serial order, including independent per-run basis-blocked cleanup.
   const pending=lastTransaction.then(async()=>{
    const draft=structuredClone(committed),tx=txFor(draft);log.push('begin');
    if(operation)await instance.beforeLocks(tx,_user,operation);const value=await fn(tx);await hooks.commit?.(tx.phase);Object.assign(committed,draft);
    log.push('commit:'+(tx.phase??'cleanup'));return value;
   });
   lastTransaction=pending.catch(()=>{});return pending;
  };
  instance.accountAuthority=async()=>user;instance.workerFeature=async()=>{};instance.agentAuthority=async()=>({id:'skill',key:'descriptive-statistics',version:1,status:'published'});
  instance.authority=async(tx,u,who)=>{await hooks.authority?.(tx.phase,who);return{user:u,grant:{id:'skill',version:1}};};
  instance.reviewRole=async(tx,u,g)=>{assert.equal(u,user);assert.equal(g,scope.studyGroupId);await hooks.reviewRole?.(tx);return 'tenant_admin';};
  if(hooks.customize)hooks.customize(instance);return instance;
 }};
 const withBatchResolver=async(tx,u,s,study,root,snapshots,phase,fn)=>{
  tx.phase=phase;assert.deepEqual(s,scope);assert.equal(u,user);assert.equal(study,context.studyId);assert.equal(root,context.rootSnapshotId);
  log.push('root:'+phase);await hooks.root?.(phase);
  const guarded=Object.create(tx);
  const resolver={async assertCurrent(actual,u,s,study,id,p){
   assert.equal(actual,guarded);assert.equal(p,phase);assert(snapshots.includes(id));log.push('slice:'+phase+':'+id);await hooks.slice?.(phase,id);
   return{basis:{studyId:study,snapshotId:id,manifestHash:hash,sapVersion:'sap',variableMapVersion:'map'},manifest:{statisticalUnit:'subject',rowCount:1,subjectCount:1,variables:[{key:'x',valueType:'number'}],rows:[{subjectId:'s',cells:[{key:'x',value:0,missing:null}]}]}};
  }};
  if(!useRealGuard)return fn(resolver,guarded);
  const fixedCase={scope,subjects:[{id:'s'}]};
  const real=createFullStudyBatchSource({
   authorize:async()=>{},validateCase:async()=>fixedCase,
   assertCurrent:async(_tx,_u,_s,_study,id,p)=>{
    if(id===root)return {basis:{studyId:study,snapshotId:root},manifest:{schemaVersion:'full-study-simulation-root-v2',studyId:study,scope,caseMetadata:fixedCase,quality:{modalities:{files:[]}}}};
    const current=await resolver.assertCurrent(guarded,u,s,study,id,p);
    current.basis.rootSnapshotId=root;
    Object.assign(current.manifest,{schemaVersion:'full-study-simulation-slice-v2',rootSnapshotId:root});
    return current;
   },
  });
  return real(tx,u,s,study,root,snapshots,phase,fn);
 };
 const facade=createFullStudyMethodsFacade(methods,{withBatchResolver,descriptiveReference,canonicalManifestHash,buildDescriptiveInput,exceptions});
 return {facade,committed,log,hooks,instances,methods};
}
const skill={id:'skill',backend:{lib:'research-methods-worker',call:'descriptive-statistics',executorKey:'descriptive-statistics',operatorVersion:'descriptive-v1',runtime_state:'ready'},rules:{llm_forbidden:true},ioContract:{version:1}},operator={agentId:'agent',skillId:'skill',skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'descriptive-v1',configurationHash:canonicalManifestHash({backend:skill.backend,rules:skill.rules,ioContract:skill.ioContract})};
function jobFixture(){
 const f=fixture({useRealGuard:true}),issuer=createDescriptiveJobCapabilityIssuer();let generation=1;const cap=issuer.issue({jobId:'job',generation,scope,studyId:'study',actorId:user.accountId,authVersion:user.authVersion,mode:'compute'});
 const contexts=items.map((item,i)=>({scope,operator,capability:cap,target:{jobId:'job',targetId:'target'+i,studyId:'study',snapshotId:item.input.snapshotId,methodKey:item.idempotencyKey,runId:null,inputHash:null}}));
 const adapter={capabilities:issuer,beforeLocks:async(tx,_u,op)=>{assert(tx._state,'Native fence must use physical tx, never protected source view');const b=issuer.read(op.context?.capability);if(!b||b.generation!==generation)throw Object.assign(Error('lost'),{code:'DESCRIPTIVE_JOB_FENCE_LOST'});f.log.push('job:'+op.kind);},verify:async()=>{},beforeDispatch:async(tx)=>{assert(tx._state);},bind:async(tx,_u,op,row)=>{tx._state.bindings[op.context.target.targetId]={runId:row.runId,inputHash:row.inputHash};},outcome:async(tx)=>{assert(tx._state);}};
 f.hooks.customize=instance=>{instance.deps.jobAdapter=adapter;instance.deps.prisma.withTenantTransaction=(_t,_g,_p,fn)=>instance.transaction(user,fn);};return{...f,contexts,lose:()=>generation++};
}
test('job public prepare/resume use one physical Job fence before each shared root and preserve third-argument operation',async()=>{
 const f=jobFixture();let prepared;const native=f.methods.descriptiveRuns();await native.transaction(user,async tx=>{prepared=await f.facade.prepareJobBatchInTransaction(tx,user,f.contexts,context);});
 assert.equal(prepared.length,3);assert.equal(f.committed.rows.length,3);assert.equal(Object.keys(f.committed.bindings).length,3);
 const bound=f.contexts.map((c,i)=>({...c,target:{...c.target,...f.committed.bindings[c.target.targetId]}}));await f.facade.resumeJobBatch(user,bound,context);
 assert.deepEqual(f.committed.rows.map(r=>r.status),Array(3).fill('needs_review'));assert.equal(f.log.filter(x=>x==='root:snapshot').length,1);assert.equal(f.log.filter(x=>x==='root:dispatch').length,1);assert.equal(f.log.filter(x=>x==='root:publish').length,1);
 for(const phase of ['dispatch','publish'])assert(f.log.indexOf('job:'+phase)<f.log.indexOf('root:'+phase));
});
test('job lease lost before shared source or independent cleanup performs no Native failure/audit',async()=>{
 const f=jobFixture(),native=f.methods.descriptiveRuns();await native.transaction(user,tx=>f.facade.prepareJobBatchInTransaction(tx,user,f.contexts,context));const bound=f.contexts.map(c=>({...c,target:{...c.target,...f.committed.bindings[c.target.targetId]}}));
 f.hooks.root=phase=>{if(phase==='publish'){f.lose();throw conflict('ANALYSIS_BASIS_STALE');}};
 await assert.rejects(f.facade.resumeJobBatch(user,bound,context));assert(f.committed.rows.every(r=>r.status==='running'));assert.equal(f.committed.audits.filter(a=>a.action==='research_method_basis_blocked').length,0);
});
test('Job mapped resolver rejects wrong physical tx, cross-phase access and captured expired frame',async()=>{
 const f=jobFixture(),captures=[];f.hooks.customize=(original=>instance=>{original(instance);const current=instance.current;instance.current=async function(...args){const resolver=this.resolver();captures.push({resolver,tx:args[0],phase:args[3],snapshot:args[2].snapshotId});await assert.rejects(resolver.assertCurrent({},user,scope,'study',args[2].snapshotId,args[3]));await assert.rejects(resolver.assertCurrent(args[0],user,scope,'study',args[2].snapshotId,args[3]==='publish'?'dispatch':'publish'));return current.apply(this,args);};})(f.hooks.customize);
 const native=f.methods.descriptiveRuns();await native.transaction(user,tx=>f.facade.prepareJobBatchInTransaction(tx,user,f.contexts,context));const c=captures[0];await assert.rejects(c.resolver.assertCurrent(c.tx,user,scope,'study',c.snapshot,c.phase));assert.equal(f.log.filter(s=>s==='root:snapshot').length,1);
});
test('Job dispatch source failure after lost lease and permission/DB failures cannot enter scientific cleanup',async()=>{
 for(const kind of ['lost','permission','database']){const f=jobFixture(),native=f.methods.descriptiveRuns();await native.transaction(user,tx=>f.facade.prepareJobBatchInTransaction(tx,user,f.contexts,context));const bound=f.contexts.map(c=>({...c,target:{...c.target,...f.committed.bindings[c.target.targetId]}})),error=kind==='lost'?conflict('ANALYSIS_BASIS_STALE'):kind==='permission'?new exceptions.ForbiddenException({code:'METHOD_AUTHORIZATION_REVOKED'}):Object.assign(Error('database unavailable'),{code:'P2010'});f.hooks.root=phase=>{if(phase==='dispatch'){if(kind==='lost')f.lose();throw error;}};await assert.rejects(f.facade.resumeJobBatch(user,bound,context),e=>e===error);assert(f.committed.rows.every(r=>r.status==='queued'));assert.equal(f.committed.audits.filter(a=>a.action==='research_method_basis_blocked').length,0);assert.equal(f.log.filter(s=>s.startsWith('worker:')).length,0);}
});
test('actual Native Job publication accepts first authorize-only and batch finish callbacks without legacy proof protocol',async()=>{
 for(const batch of [false,true]){const f=jobFixture(),contexts=batch?f.contexts:f.contexts.slice(0,1),native=f.methods.descriptiveRuns();await native.transaction(user,tx=>f.facade.prepareJobBatchInTransaction(tx,user,contexts,context));const bound=contexts.map(c=>({...c,target:{...c.target,...f.committed.bindings[c.target.targetId]}}));let finished=0,authorized=0;
  await f.facade.resumeJobBatch(user,bound,context,{authorizePublication:async tx=>{assert(tx._state);authorized++;},...(batch?{finishInTransaction:async(tx,current)=>{assert(tx._state);assert(current.manifest);finished++;}}:{})});assert.equal(authorized,1);assert.equal(finished,batch?1:0);assert(f.committed.rows.every(r=>r.status==='needs_review'));assert.equal(f.committed.audits.filter(a=>a.action==='research_method_run_publish').length,contexts.length);
 }
});
test('three native computations share one root per committed phase, with distinct per-child hashes, claims, dispatch and publication',async()=>{
 const f=fixture();await f.facade.createBatchFromWorkbench(user,items,context);
 assert.deepEqual(f.log.filter(x=>x.startsWith('root:')),['root:snapshot','root:dispatch','root:publish']);
 assert(f.log.indexOf('commit:dispatch')<f.log.indexOf('worker:run-one'));assert.equal(f.instances.size,3);
 assert.deepEqual(f.committed.rows.map(r=>r.status),Array(3).fill('needs_review'));assert.equal(new Set(f.committed.rows.map(r=>r.inputHash)).size,3);
 assert.equal(new Set(f.committed.rows.map(r=>r.environment.claim)).size,3);assert.equal(f.committed.audits.length,9);
 for(const p of ['snapshot','dispatch','publish'])assert.equal(f.log.filter(x=>x.startsWith('slice:'+p)).length,3);
 await f.facade.createBatchFromWorkbench(user,items,context);assert.equal(f.log.filter(x=>x.startsWith('worker:')).length,3);assert.equal(f.committed.audits.length,9);
});
test('snapshot and dispatch commit failure starts no worker or publish and does not mark source invalid',async()=>{
 for(const phase of ['snapshot','dispatch']){const f=fixture(),failure=Error('commit failure');f.hooks.commit=p=>{if(p===phase)throw failure;};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===failure);assert(!f.log.some(x=>x.startsWith('worker:')));assert(f.committed.rows.every(r=>r.status==='queued'));}
});
test('publish guard rechecks after worker, stale root takes native independent cleanup, revoked authority never marks basis invalid',async()=>{
 for(const stale of [true,false]){const f=fixture(),failure=stale?conflict('ANALYSIS_BASIS_STALE'):new exceptions.ForbiddenException({code:'METHOD_AUTHORIZATION_REVOKED'});
 f.hooks.root=phase=>{if(phase==='publish')throw failure;};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===failure);
 assert.equal(f.committed.audits.filter(a=>a.action==='research_method_run_publish').length,0);
 assert.equal(f.committed.rows.filter(r=>r.stage==='basis-invalid').length,stale?3:0);}
});
test('native review of batch rolls back all siblings on second role denial, then writes once per frozen child using original derived key',async()=>{
 const f=fixture();await f.facade.createBatchFromWorkbench(user,items,context);
 const rows=structuredClone(f.committed.rows),failure=new exceptions.ForbiddenException({code:'METHOD_REVIEW_FORBIDDEN'});let n=0;
 f.hooks.reviewRole=()=>{if(++n===2)throw failure;};
 await assert.rejects(f.facade.reviewBatch(user,rows,command,context),e=>e===failure);assert.equal(f.committed.reviews.length,0);assert(f.committed.rows.every(r=>r.status==='needs_review'));
 delete f.hooks.reviewRole;await f.facade.reviewBatch(user,rows,command,context);assert.equal(f.committed.reviews.length,3);
 const audits=f.committed.audits.filter(a=>a.action==='research_method_run_review');
 for(const r of rows)assert.equal(audits.find(a=>a.target===r.id)?.meta.requestKey,'full-review-'+canonicalManifestHash({requestKey:command.requestKey,runId:r.id}));
});
test('malformed, duplicate and oversized targets fail before transaction or worker',async()=>{
 for(const bad of [[],[...items,items[0]],[items[0],items[0]],[{...items[0],input:{studyId:'foreign',snapshotId:'one'}}]]){const f=fixture();await assert.rejects(f.facade.createBatchFromWorkbench(user,bad,context));assert.deepEqual(f.log,[]);}
});
test('mixed replay preserves an existing running execution and dispatches only missing members',async()=>{
 const f=fixture();
 await f.facade.createBatchFromWorkbench(user,[items[0]],context);
 const known=f.committed.rows[0];known.status='running';known.stage='descriptive-dispatched';
 const oldClaim=known.environment.claim;
 const result=await f.facade.createBatchFromWorkbench(user,items,context);
 assert.deepEqual(result.map(r=>r.status),['running','needs_review','needs_review']);
 assert.equal(result[0].environment.claim,oldClaim);
 assert.deepEqual(f.log.filter(x=>x.startsWith('worker:')),['worker:run-one','worker:run-two','worker:run-three']);
});
test('Worker error stays a native per-child failed outcome while peers publish in the same fresh transaction',async()=>{
 const f=fixture();f.hooks.worker=id=>{if(id==='run-two')throw Error('worker did not finish');};
 const result=await f.facade.createBatchFromWorkbench(user,items,context);
 assert.deepEqual(result.map(r=>r.status),['needs_review','failed','needs_review']);
 assert.equal(result[1].numericEvidence,undefined);
 assert.equal(f.committed.audits.filter(a=>a.action==='research_method_run_failed').length,1);
 assert.equal(f.log.filter(s=>s==='root:publish').length,1);
});
test('an authorization error tagged by native current never writes basis-invalid, while a single stale slice marks only itself',async()=>{
 for(const denied of [true,false]){
  const f=fixture(),error=denied?new exceptions.ForbiddenException({code:'FULL_STUDY_FORBIDDEN'}):conflict('ANALYSIS_BASIS_STALE');
  f.hooks.slice=(phase,id)=>{if(phase==='publish'&&id==='two')throw error;};
  await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===error);
  assert.deepEqual(f.committed.rows.filter(r=>r.stage==='basis-invalid').map(r=>r.id),denied?[]:['run-two']);
  assert.equal(f.committed.audits.filter(a=>a.action==='research_method_run_publish').length,0);
 }
});
test('failed root protection is not a scientific source result and cannot erase native progress',async()=>{
 const f=fixture(),error=conflict('FULL_STUDY_BATCH_SOURCE_UNPROTECTED');
 f.hooks.root=p=>{if(p==='publish')throw error;};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===error);
 assert.deepEqual(f.committed.rows.map(r=>r.status),['running','running','running']);
 assert.equal(f.committed.audits.filter(a=>a.action==='research_method_basis_blocked').length,0);
});
test('a missing phase callback before dispatch or after dispatch releases every waiting sibling without speculative work',{timeout:1800},async()=>{
 for(const phase of ['dispatch','publish']){
  const f=fixture(),error=Error('native failed before '+phase),original=FormalDescriptiveRuns.prototype.execute;
  f.hooks.customize=api=>{api.execute=async function(u,r){
   if(r.id!=='run-two')return original.call(this,u,r);
   if(phase==='publish')await this.transaction(u,async()=>({}));
   throw error;
  };};
  await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===error);
  assert.equal(f.log.filter(x=>x.startsWith('worker:')).length,phase==='dispatch'?0:2);
  assert.equal(f.committed.audits.filter(a=>a.action==='research_method_run_publish').length,0);
 }
});
test('rollbacks at publish commit release all callers and retries of the original keys never execute running rows again',async()=>{
 const f=fixture(),error=Error('connection lost at publish');
 f.hooks.commit=p=>{if(p==='publish')throw error;};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===error);
 assert(f.committed.rows.every(r=>r.status==='running'));delete f.hooks.commit;
 await f.facade.createBatchFromWorkbench(user,items,context);
 assert.equal(f.log.filter(x=>x.startsWith('worker:')).length,3);
 assert(f.committed.rows.every(r=>r.status==='running'));
});
test('one mismatched native input hash blocks publication and only marks the specific changed basis',async()=>{
 const f=fixture();
 // Make the publish recheck of this slice produce a different input hash.
 f.hooks.customize=api=>{const nativeHash=api.hash;api.hash=function(input,basis,version){
  const value=nativeHash.call(this,input,basis,version);
  return basis.snapshotId==='two'&&f.log.includes('root:publish')?'0'.repeat(64):value;
 };};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e.getResponse?.().code==='METHOD_RUN_CHANGED');
 assert.deepEqual(f.committed.rows.filter(r=>r.stage==='basis-invalid').map(r=>r.id),['run-two']);
 assert(f.committed.rows.every(r=>r.artifactRefs===undefined));
});
test('real quality gate rejection at publish marks affected runs stale and never publishes values',async()=>{
 const {assertQualityReleased}=require('./src/research-methods/data-quality-release-policy.ts');
 const f=fixture();f.hooks.root=p=>{if(p==='publish')assertQualityReleased({status:'stale',manifestHash:hash},hash);};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e.code==='QUALITY_GATE_STALE');
 assert.equal(f.committed.rows.filter(r=>r.stage==='basis-invalid').length,3);
});
test('review requires the same validated parent key format as the original operation',async()=>{
 const f=fixture();await f.facade.createBatchFromWorkbench(user,items,context);
 await assert.rejects(f.facade.reviewBatch(user,structuredClone(f.committed.rows),{...command,requestKey:'x'},context));
 assert.equal(f.committed.reviews.length,0);
});

test('the actual guarded transaction accepts native create, dispatch, publish and review writes for all members',async()=>{
 const f=fixture({useRealGuard:true});
 const rows=await f.facade.createBatchFromWorkbench(user,items,context);
 const reviewed=await f.facade.reviewBatch(user,rows,command,context);
 assert.deepEqual(reviewed.map(r=>r.status),['completed','completed','completed']);
 assert.equal(f.committed.audits.length,12);
});
test('native participation withdrawal at dispatch blocks every target before a Worker and preserves native per-row blocked audit',async()=>{
 const f=fixture(),error=conflict('PARTICIPATION_CAPTURE_BLOCKED');
 f.hooks.root=phase=>{if(phase==='dispatch')throw error;};
 await assert.rejects(f.facade.createBatchFromWorkbench(user,items,context),e=>e===error);
 assert.equal(f.log.filter(x=>x.startsWith('worker:')).length,0);
 assert.equal(f.committed.audits.filter(a=>a.action==='research_method_basis_blocked').length,3);
});
test('publish and parent proof see the same guarded transaction; parent proof is released after commit',async()=>{
 const f=fixture({useRealGuard:true}),events=[];
 const result=await f.facade.createBatchAndProve(user,items,context,{
  authorizePublication:async physical=>{assert.equal(typeof physical.$queryRaw,'function');events.push('scope');},
  provePublication:async(resolver,view,current)=>{
   events.push('proof');
   assert.equal(current.basis.snapshotId,context.rootSnapshotId);
   assert(f.committed.rows.every(r=>r.status==='running'));
   for(const item of items){
    const row=await view.researchMethodRun.findUnique({where:{id:'run-'+item.input.snapshotId}});
    assert.equal(row.status,'needs_review');
    const childSource=await resolver.assertCurrent(view,user,scope,context.studyId,item.input.snapshotId,'publish');
    const checked=await f.facade.verifyProcessRunInTransaction(view,user,row,childSource);
    assert.equal(checked.inputHash,row.inputHash);
   }
   await view.auditLog.create({data:{...scope,accountId:user.accountId,action:'parent-finished',target:'group'}});
   return {executionConfirmed:true};
  },
 });
 assert.deepEqual(events,['scope','proof']);assert.deepEqual(result,{kind:'published',receipt:{executionConfirmed:true}});
 assert.equal(f.committed.audits.at(-1).action,'parent-finished');assert.equal(f.committed.audits.length,10);
 assert.deepEqual(f.log.filter(l=>l.startsWith('root:')),['root:snapshot','root:dispatch','root:publish']);
});
test('scope, parent proof and commit failure never publish a partial native batch or parent proof',async()=>{
 for(const when of ['scope','proof','commit']){
  const f=fixture({useRealGuard:true}),error=Error(when);let called=false;
  if(when==='commit')f.hooks.commit=phase=>{if(phase==='publish')throw error;};
  await assert.rejects(f.facade.createBatchAndProve(user,items,context,{
   authorizePublication:async()=>{if(when==='scope')throw error;},
   provePublication:async(_resolver,view)=>{
    called=true;await view.auditLog.create({data:{...scope,accountId:user.accountId,action:'parent-finished',target:'group'}});
    if(when==='proof')throw error;return {executionConfirmed:true};
   },
  }),e=>e===error);
  assert.equal(called,when!=='scope');assert(f.committed.rows.every(r=>r.status==='running'));
  assert.equal(f.committed.audits.length,6);assert.equal(f.log.filter(x=>x.startsWith('worker:')).length,3);
 }
});
test('mixed or fully existing native members use the independent proof without rerunning an old Worker',async()=>{
 const f=fixture(),hooks={authorizePublication:()=>assert.fail('mixed batch must use standalone proof'),provePublication:()=>assert.fail('mixed members never share a partial publish frame')};
 await f.facade.createBatchFromWorkbench(user,items.slice(0,1),context);
 for(let i=0;i<2;i++)assert.deepEqual(await f.facade.createBatchAndProve(user,items,context,hooks),{kind:'existing'});
 assert.equal(f.log.filter(x=>x.startsWith('worker:')).length,3);
});
test('a revoked Study role or mismatched current Study binding aborts all native publications',async()=>{
 for(const code of ['RESEARCH_FORBIDDEN','FULL_STUDY_BINDING_CHANGED']){
  const f=fixture({useRealGuard:true}),revoked=Object.assign(Error(code),{code,status:code==='RESEARCH_FORBIDDEN'?403:409});
  await assert.rejects(f.facade.createBatchAndProve(user,items,context,{
   authorizePublication:async()=>{throw revoked;},
   provePublication:async()=>assert.fail('parent proof entered after losing Study scope'),
  }),e=>e===revoked);
  assert.equal(f.committed.audits.length,6);assert(f.committed.rows.every(r=>r.status==='running'));
  assert(!f.log.includes('root:publish'));assert.equal(f.log.filter(l=>l.startsWith('worker:')).length,3);
 }
});
test('failed Worker results use standalone fresh proof and never run a second Worker',async()=>{
 const f=fixture({useRealGuard:true});f.hooks.worker=async id=>{if(id==='run-two')throw Error('synthetic Worker failure');};
 const result=await f.facade.createBatchAndProve(user,items,context,{
  authorizePublication:async()=>{},provePublication:async()=>assert.fail('failed member needs independent proof'),
 });
 assert.deepEqual(result,{kind:'failed'});assert.deepEqual(f.committed.rows.map(r=>r.status),['needs_review','failed','needs_review']);
 assert.equal(f.committed.audits.length,9);assert.equal(f.log.filter(l=>l.startsWith('worker:')).length,3);
});
test('a changed per-child basis fails original live/inputHash verification before publishing any parent or child audit',async()=>{
 const f=fixture({useRealGuard:true});
 await assert.rejects(f.facade.createBatchAndProve(user,items,context,{
  authorizePublication:async()=>{},
  provePublication:async(resolver,view)=>{
   for(const item of items){
    const snapshotId=item.input.snapshotId;
    const row=await view.researchMethodRun.findUnique({where:{id:'run-'+snapshotId}});
    const proof=await resolver.assertCurrent(view,user,scope,context.studyId,snapshotId,'publish');
    if(snapshotId==='two')proof.basis={...proof.basis,manifestHash:'b'.repeat(64)};
    await f.facade.verifyProcessRunInTransaction(view,user,row,proof);
   }
   assert.fail('changed basis reached FINISHED');
  },
 }),e=>e.code==='METHOD_RUN_CHANGED');
 assert(f.committed.rows.every(r=>r.status==='running'));assert.equal(f.committed.audits.length,6);
});
