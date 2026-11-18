// Offline preparation; execute only in an explicitly granted synthetic PG window.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,validateFixtureConfig,fixtureClient,readFixtureIdentity,checkFixtureIdentity,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalResearchPrisma} from './research-creation-local-integration.mjs';
import {extendLocalMethodPrisma} from './local-research-analysis.mjs';
import {createFullStudyMethodsFacade} from './full-study-methods-facade.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {setContext} from '../server/research-studies/repository.mjs';

assert.deepEqual(process.argv.slice(2),['--local-synthetic'],'CAPABILITY_PROFILE_EXPLICIT_SCOPE_REQUIRED');
const root=workspaceRoot,repo=root+'researchhub/',task='full-study-compute-tail-2026-11-16';
const json=p=>JSON.parse(readFileSync(p,'utf8')),normalize=x=>JSON.parse(JSON.stringify(x)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const previous=repo+'docs/testing/evidence/full-study-batch-performance-2026-11-16/native-audit/final-e1b4d77f/native-proof.json';
const accepted=json(previous),original156=json(repo+'docs/testing/evidence/'+task+'/live-freeze/run-9fb87de0/native-runs-156.json'),baseline39=json(repo+'docs/testing/evidence/'+task+'/actual/baseline/actual-method-runs.json'),runtime=json(root+'.tmp/researchhub-knowledge-local/runtime.json');
assert.equal(baseline39.runGroupId,'full-run-b45d1768-8f72-406a-9da5-cb083aead9db');assert.equal(baseline39.runs.length,39);const baseline={runs:[...original156.runs,...baseline39.runs].sort((a,b)=>a.id.localeCompare(b.id))};assert.equal(baseline.runs.length,195);assert.equal(new Set(baseline.runs.map(r=>r.id)).size,195);
const scope={tenantId:accepted.header.tenantId,studyGroupId:accepted.header.studyGroupId,researchProjectId:accepted.header.researchProjectId},studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25',groupId='full-run-0358f67e-e4d7-4e5f-b861-ed25db601745';
assert.equal(accepted.header.id,groupId);assert.equal(accepted.header.target,studyId);assert.equal(runtime.key,'rh-kb-local-b0e2af9d');assert.equal(runtime.ids.tenant,scope.tenantId);assert.equal(original156.runs.length,156);assert(baseline.runs.every(r=>r.inputSummary.studyId===studyId&&['tenantId','studyGroupId','researchProjectId'].every(k=>r[k]===scope[k])));
const ordered=accepted.header.meta.slices.map(t=>accepted.runs.find(r=>r.idempotencyKey===t.methodKey));assert(ordered.every(Boolean));assert.equal(new Set(ordered.map(r=>r.id)).size,39);assert(ordered.every(r=>r.inputSummary.studyId===studyId&&r.status==='completed'&&r.reviewStatus==='confirmed'));const ids=ordered.map(r=>r.id);
const out=repo+'docs/testing/evidence/'+task+'/profile/capabilities-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});const save=(name,x)=>writeFileSync(out+name,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
const env=fixtureEnvironment(),cfg=validateFixtureConfig(env);assert.equal(cfg.databaseName,'wp01_test_full_baseline');
const deps=runtimeDependencies(),load=deps.load,reads=new Set(['findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','findMany','count','aggregate','groupBy']);
const sourceFiles=['scripts/full-study-methods-capabilities.mjs','scripts/full-study-methods-facade.mjs','scripts/research-creation-local-integration.mjs','scripts/local-research-analysis.mjs','scripts/full-study-compute-tail-capabilities-profile.mjs','../app/server/src/research-methods/formal-descriptive-runs.ts','../app/server/src/research-methods/research-methods.service.ts','../app/server/src/common/worker-publication.ts'];
const beforeSources=Object.fromEntries(sourceFiles.map(p=>[p,sha(repo+p)]));
let user,current=null,failure,result;const phases=[],identities=[],forbidden={worker:0,quality:0,resolver:0,businessWrites:0};
function unused(kind){return new Proxy({}, {get(_target,key){return()=>{forbidden[kind]++;throw Error('CAPABILITY_PROFILE_'+kind.toUpperCase()+'_FORBIDDEN:'+String(key));};}});}
async function state(label){return withFixtureTransaction(env,'direct',async tx=>{
 const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${'rh-full-study-b230c34b'}`;assert(marker?.manifest?.syntheticOnly===true&&marker.manifest.studyId===studyId&&['tenantId','studyGroupId','researchProjectId'].every(k=>marker.manifest.scope[k]===scope[k]));
 const rows=normalize(await tx.researchMethodRun.findMany({where:{...scope,id:{in:baseline.runs.map(r=>r.id)}},orderBy:{id:'asc'}}));assert.deepEqual(rows,baseline.runs,'CAPABILITY_PROFILE_OLD195_CHANGED');
 const actor=await tx.account.findFirst({where:{id:runtime.ids.admin,tenantId:scope.tenantId,status:'active'},select:{id:true,tenantId:true,role:true,isTenantAdmin:true,authVersion:true}});assert(actor?.role==='tenant_admin'&&actor.isTenantAdmin===true&&Number.isSafeInteger(actor.authVersion));assert.equal(actor.id,accepted.header.accountId);
 return{label,actor:normalize(actor),rowsHash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),count:rows.length};
 },{readOnly:true});}
function counted(name,fn){const row=current.calls[name]??={count:0,totalMs:0,errors:0};row.count++;const start=performance.now();try{return Promise.resolve(fn()).then(value=>{row.totalMs+=performance.now()-start;return value;},error=>{row.totalMs+=performance.now()-start;row.errors++;throw error;});}catch(error){row.totalMs+=performance.now()-start;row.errors++;throw error;}}
function instrument(tx,phase){
 const delegates=new Map();return new Proxy(tx,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(key==='$queryRaw'||key==='$executeRaw')return(...args)=>{
   const strings=args[0];assert(Array.isArray(strings)&&Array.isArray(strings.raw));const sql=strings.join('?');
   if(key==='$executeRaw'){
    const authorization=sql==='SELECT pg_advisory_xact_lock(hashtextextended(?,0))'&&['wp01:official','wp01:tenant:'+scope.tenantId].includes(args[1]);
    const context=sql==="SELECT set_config('app.tenant_id',?,true),set_config('app.study_group_id',?,true),set_config('app.research_project_id',?,true)"&&args[1]===scope.tenantId&&args[2]===scope.studyGroupId&&args[3]===scope.researchProjectId;
    if(!authorization&&!context){forbidden.businessWrites++;throw Error('CAPABILITY_PROFILE_RAW_WRITE_REJECTED');}
   }else assert(sql==='SELECT id FROM public.session WHERE id=? FOR SHARE'||sql==='SELECT id FROM public.research_method_run WHERE id=? FOR UPDATE','CAPABILITY_PROFILE_RAW_QUERY_REJECTED');
   if(/FROM public\.research_method_run\b/.test(sql)&&/FOR UPDATE/.test(sql)){phase.nativeRunRowLockCalls++;phase.lockedRunIds.push(args[1]);}
   const name='raw.'+String(key)+(/pg_advisory_xact_lock/.test(sql)?'.authorization':/research_method_run/.test(sql)?'.method-run':/session/.test(sql)?'.session':'.other');return counted(name,()=>value.apply(target,args));
  };
  if(typeof key==='string'&&key.startsWith('$'))throw Error('CAPABILITY_PROFILE_UNSAFE_API_REJECTED');
  if(!value||typeof value!=='object')return typeof value==='function'?value.bind(target):value;
  if(!delegates.has(key))delegates.set(key,new Proxy(value,{get(model,method){const fn=Reflect.get(model,method,model);if(typeof fn!=='function')return fn;return(...args)=>{if(!reads.has(method)){forbidden.businessWrites++;throw Error('CAPABILITY_PROFILE_MODEL_WRITE_REJECTED');}return counted('model.'+String(key)+'.'+String(method),()=>fn.apply(model,args));};}}));return delegates.get(key);
 }});
}
// Local factory omits native fifth-argument transaction options. The QA physical
// runner explicitly enforces the original native 10s /5s budgets, never20s.
async function physical(callback){
 const phase=current;assert(phase);const client=fixtureClient(cfg.databaseUrl),entry={sequence:phase.transactions.length+1,timeoutMs:10000,maxWaitMs:5000,startedAt:new Date().toISOString()};phase.transactions.push(entry);const start=performance.now();
 try{return await client.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 10000');const identity=await readFixtureIdentity(tx);checkFixtureIdentity(cfg,'app',identity);identities.push({phase:phase.name,database:identity.database,role:identity.role,superuser:identity.superuser,bypassRls:identity.bypassRls});
  await setContext(tx,user,scope.studyGroupId,scope.researchProjectId);const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;entry.backendPid=pid;
  return callback(instrument(tx,phase));
 },{isolationLevel:'ReadCommitted',maxWait:5000,timeout:10000});}
 finally{entry.wallMs=performance.now()-start;entry.finishedAt=new Date().toISOString();await client.$disconnect();}
}
function nativeMethods(){
 const local=createLocalResearchPrisma({tenantId:scope.tenantId,transaction:physical}),originalTx=local.withTenantTransaction;
 local.withTenantTransaction=function(...args){current.withTenantTransactionCalls++;if(args[4]){assert.deepEqual(normalize(args[4]),{isolationLevel:'ReadCommitted',maxWait:5000,timeout:10000});current.nativeOptionCalls++;}else current.scopeLookupTransactions++;return originalTx.apply(this,args);};
 const extended=extendLocalMethodPrisma(local,scope.tenantId),prisma=new Proxy(extended,{get(target,key){const value=Reflect.get(target,key,target);if(key==='forTenant')return(...args)=>{current.forTenantCalls++;return value.apply(target,args);};return value;}});
 const features=new(load('tenants/tenant-features.service','TenantFeaturesService'))(prisma),Methods=load('research-methods/research-methods.service','ResearchMethodsService');
 const methods=new Methods(prisma,features,unused('worker'),unused('quality'),unused('resolver')),original=methods.descriptiveRuns;
 methods.descriptiveRuns=function(...args){const native=original.apply(this,args);for(const name of ['transaction','live','authority','actionCapabilities','reviewRole']){const fn=native[name];native[name]=function(...callArgs){return counted('native.'+name,()=>fn.apply(this,callArgs));};}return native;};
 return methods;
}
async function phase(name,callback){current={name,calls:{},forTenantCalls:0,withTenantTransactionCalls:0,nativeOptionCalls:0,scopeLookupTransactions:0,nativeRunRowLockCalls:0,lockedRunIds:[],transactions:[]};const record=current;phases.push(record);const start=performance.now();try{const values=normalize(await callback());record.wallMs=performance.now()-start;record.physicalTransactions=record.transactions.length;assert.equal(values.length,39);assert.equal(record.nativeRunRowLockCalls,39);assert.deepEqual(record.lockedRunIds,ids);save(name+'-values.json',values);return values;}finally{current=null;}}
try{
 await assertFixtureTarget(env);const before=await state('before');user={...scope,accountId:before.actor.id,authVersion:before.actor.authVersion,role:before.actor.role,isTenantAdmin:before.actor.isTenantAdmin};save('before.json',before);save('selected39-source-rows.json',ordered);
 const methods=nativeMethods(),facade=createFullStudyMethodsFacade(methods,{withBatchResolver:async()=>{throw Error('CAPABILITY_PROFILE_SOURCE_RESOLVER_FORBIDDEN');}});
 const old=await phase('original39',async()=>{const values=[];for(const id of ids)values.push(await methods.getDescriptiveCapabilities(user,id));return values;});
 const next=await phase('singleTransaction39',()=>facade.withDescriptiveCapabilities(user,ids,async get=>{const values=[];for(const id of ids)values.push(await get(id));return values;}));assert.deepEqual(next,old,'CAPABILITY_PROFILE_RAW_RESULTS_DIFFER');
 const after=await state('after');save('after.json',after);assert.deepEqual(after.actor,before.actor);assert.equal(after.rowsHash,before.rowsHash);assert(Object.values(forbidden).every(n=>n===0));
 assert.equal(phases[0].forTenantCalls,39);assert.equal(phases[0].withTenantTransactionCalls,78);assert.equal(phases[0].nativeOptionCalls,39);assert.equal(phases[0].scopeLookupTransactions,39);assert.equal(phases[0].physicalTransactions,78);
 assert.equal(phases[1].forTenantCalls,0);assert.equal(phases[1].withTenantTransactionCalls,1);assert.equal(phases[1].nativeOptionCalls,1);assert.equal(phases[1].scopeLookupTransactions,0);assert.equal(phases[1].physicalTransactions,1);
 for(const p of phases)for(const name of ['live','authority','actionCapabilities','reviewRole'])assert.equal(p.calls['native.'+name].count,39);
 result={passed:true,rawJsonArraysEqual:true,old195Unchanged:true,old156AndBaseline39Preserved:true,actorUnchanged:true};
}catch(error){failure={name:error.name,code:error.code??null,message:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[database-url-redacted]').slice(0,2000)};}
finally{
 const afterSources=Object.fromEntries(sourceFiles.map(p=>[p,sha(repo+p)])),sourcesUnchanged=sourceFiles.every(p=>beforeSources[p]===afterSources[p]);if(!sourcesUnchanged)failure??={code:'CAPABILITY_PROFILE_SOURCE_CHANGED'};
 const value={schemaVersion:'full-study-compute-tail-capability-profile-v1',at:new Date().toISOString(),...result,passed:Boolean(result?.passed&&!failure),failure:failure??null,studyId,groupId,scope,actor:user??null,phases,identities,forbidden,beforeSources,afterSources,httpCalls:0,workerCalls:forbidden.worker,businessWrites:forbidden.businessWrites,serviceReloads:0,limits:['Read cost on existing confirmed39, not actual needs-review UI tail execution.','Reference order is fixed by original group slice manifest and identical for both probes; not a claim of captured prior HTTP internal tie order.','Uses real native authority/live/role and actual app/RLS; no fake authority.','Original39 includes39 scoped lookup transactions plus39 native capability transactions; report78 versus1, not39 versus1.','Every physical measured transaction enforces original10s timeout/5s maxWait.','Physical transaction wall excludes disconnect; overall phase wall includes connection/setup/disconnect.','Does not establish full HTTP latency or target runtime enablement; fresh39 still required.']};save('result.json',value);console.log(JSON.stringify({passed:value.passed,phases:phases.map(p=>({name:p.name,wallMs:p.wallMs,physicalTransactions:p.physicalTransactions,withTenantTransactionCalls:p.withTenantTransactionCalls,forTenantCalls:p.forTenantCalls,runRowLocks:p.nativeRunRowLockCalls})),failure:value.failure,evidence:out}));if(!value.passed)process.exitCode=1;
}
