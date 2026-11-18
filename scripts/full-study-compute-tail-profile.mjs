// Guarded one-transaction, rollback-only measurement. Never imported by product code.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig,fixtureClient,readFixtureIdentity,checkFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createSimulationAdmission} from '../server/research-simulation/admission.mjs';
import {createFullStudyCore} from '../server/research-analysis/full-study-core.mjs';
import {createFullStudySourcePairReader} from '../server/research-analysis/full-study-source-pair.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
import {setContext} from '../server/research-studies/repository.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8')),dir=workspaceRoot+'.tmp/real-study-full-simulation-2026-11-13/';
const performanceLabel=process.argv[3]==='--performance'?process.argv[4]:null;
assert(process.argv[2]==='--local-synthetic'&&((process.argv.length===3)||(process.argv.length===4&&process.argv[3]==='--after')||(process.argv.length===5&&/^(before|after-[1-9][0-9]?)$/.test(performanceLabel??''))),'PROFILE_LOCAL_SYNTHETIC_REQUIRED');const after=process.argv.includes('--after');
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=json(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'),b=json(dir+'bootstrap.json'),targets=json(dir+'targets.json'),journal=json(dir+(performanceLabel?'analysis-corrected-journal.json':'analysis-initial-journal.json'));
assert.equal(runtime.key,'rh-kb-local-b0e2af9d');assert.equal(b.scope.tenantId,runtime.ids.tenant);assert.equal(journal.studyId,b.study.id);assert.equal(typeof journal.snapshotId,'string');
await withFixtureTransaction(env,'direct',async tx=>{
 const rows=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'studyId'=${b.study.id} AND manifest->>'tenantId'=${b.scope.tenantId}`;
 assert.equal(rows.length,1);const m=rows[0].manifest;assert(m.syntheticOnly===true&&m.caseId===b.manifest.caseId&&m.studyGroupId===b.scope.studyGroupId&&m.scope.researchProjectId===b.scope.researchProjectId);
},{readOnly:true});
let firstLockWaitMs=null,lockAcquiredAt=null;const stats=new Map(),calls=new Map(),modelCache=new Map(),deps=runtimeDependencies(),admission=createSimulationAdmission({targets});
function measured(key,fn,args){
 const row=stats.get(key)??{key,count:0,totalMs:0,maxMs:0,errors:0};stats.set(key,row);row.count++;
 const digest=fullStudyHash({key,args});calls.set(digest,(calls.get(digest)??0)+1);if(!row.args)row.args=new Set();row.args.add(digest);
 const start=performance.now(),done=error=>{const elapsed=performance.now()-start;row.totalMs+=elapsed;row.maxMs=Math.max(row.maxMs,elapsed);if(error)row.errors++;else if(key==='raw.SELECT.authorization_lock'&&firstLockWaitMs===null){firstLockWaitMs=elapsed;lockAcquiredAt=performance.now();}};
 try{const result=fn(...args);if(result&&typeof result.then==='function')return result.then(value=>{done();return value;},error=>{done(error);throw error;});done();return result;}catch(error){done(error);throw error;}
}
const sqlKey=args=>{const sql=Array.isArray(args[0])?args[0].join(''):'';assert(/^\s*SELECT\b/i.test(sql)&&!/[;]\s*\S/.test(sql),'PROFILE_SQL_WRITE_REJECTED');if(/pg_advisory_xact_lock/.test(sql))return'raw.SELECT.authorization_lock';const table=/\bFROM\s+((?:public|rh_analysis|rh_research)\.[a-z_]+)/i.exec(sql)?.[1]??'expression';return'raw.SELECT.'+table+(/FOR\s+(UPDATE|SHARE)/i.test(sql)?'.row_lock':'');};
function instrument(tx){return new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key==='$queryRaw'||key==='$executeRaw')return(...args)=>measured(sqlKey(args),value.bind(target),args);if(typeof key==='string'&&key.startsWith('$'))throw Error('PROFILE_UNSAFE_API_REJECTED');if(!value||typeof value!=='object')return typeof value==='function'?value.bind(target):value;if(modelCache.has(key))return modelCache.get(key);const model=new Proxy(value,{get(delegate,method){const fn=Reflect.get(delegate,method,delegate);if(typeof fn!=='function')return fn;if(!['findFirst','findUnique','findMany','findFirstOrThrow','findUniqueOrThrow','count','aggregate','groupBy'].includes(method))throw Error('PROFILE_MODEL_WRITE_REJECTED');return(...args)=>measured(String(key)+'.'+String(method),fn.bind(delegate),args);}});modelCache.set(key,model);return model;}});}
// Instrument native call duration without hashing/copying the transaction object.
const nativeLoad=(path,name)=>{const original=deps.load(path,name);if(typeof original!=='function')return original;return function(...args){return measured('native.'+path+'.'+name,(..._ignored)=>original(...args),args.map((x,i)=>i===0&&x&&typeof x==='object'&&typeof x.$queryRaw==='function'?'<transaction>':x));};};
const pairs=performanceLabel&&performanceLabel!=='before'?createFullStudySourcePairReader({require:deps.require,load:nativeLoad}):undefined;
const core=createFullStudyCore({load:nativeLoad,resolveCase:admission.resolveCase,readResponsePair:pairs?.readPair}),cfg=validateFixtureConfig(env),client=fixtureClient(cfg.databaseUrl),rollback=Error('PROFILE_ROLLBACK_ONLY');let result;
try{
 await client.$transaction(async raw=>{
  checkFixtureIdentity(cfg,'app',await readFixtureIdentity(raw));
  await raw.$executeRawUnsafe('SET LOCAL statement_timeout = 15000');
  await raw.$executeRaw`SELECT set_config('app.tenant_id',${b.scope.tenantId},true),set_config('app.study_group_id',${b.scope.studyGroupId},true),set_config('app.research_project_id',${b.scope.researchProjectId},true)`;
  const a=await raw.account.findFirst({where:{id:runtime.ids.admin,tenantId:b.scope.tenantId},select:{id:true,tenantId:true,role:true,isTenantAdmin:true,authVersion:true,status:true}});assert(a?.role==='tenant_admin'&&a.isTenantAdmin===true&&a.status==='active');const user={...a,accountId:a.id};await setContext(raw,user,b.scope.studyGroupId,b.scope.researchProjectId);
  const [snapshot]=await raw.$queryRaw`SELECT id,plan_id,review_id,manifest_hash FROM rh_analysis.snapshot WHERE tenant_id=${b.scope.tenantId} AND study_group_id=${b.scope.studyGroupId} AND research_project_id=${b.scope.researchProjectId} AND study_id=${b.study.id} AND id=${journal.snapshotId}`;assert(snapshot);
  const [plan]=await raw.$queryRaw`SELECT * FROM rh_analysis.plan WHERE tenant_id=${b.scope.tenantId} AND study_id=${b.study.id} AND id=${snapshot.plan_id}`;
  const [review]=await raw.$queryRaw`SELECT * FROM rh_analysis.plan_review WHERE tenant_id=${b.scope.tenantId} AND plan_id=${snapshot.plan_id} AND id=${snapshot.review_id}`;assert.equal(plan.definition.schemaVersion,'full-study-simulation-v2');assert.equal(review.decision,'approved');
  const tx=instrument(raw),start=performance.now();await core.authorize(tx,user,b.scope,b.study.id);const projected=await core.project(tx,user,b.scope,b.study.id,plan,review);
  assert.equal(projected.manifestHash,snapshot.manifest_hash,'PROFILE_CURRENT_SNAPSHOT_CHANGED');
  result={syntheticOnly:true,rollbackOnly:true,currentSnapshotMatched:true,manifestHash:projected.manifestHash,workerCalls:0,httpCalls:0,profile:'single-current-full-core-project',at:new Date().toISOString(),wallMs:performance.now()-start,firstAuthorizationLockWaitMs:firstLockWaitMs,afterFirstAuthorizationLockMs:lockAcquiredAt===null?null:performance.now()-lockAcquiredAt,observations:projected.manifest.rowCount,slices:projected.manifest.slices.length,stats:[...stats.values()].map(({args,...row})=>({...row,uniqueArguments:args.size,repeatedArguments:row.count-args.size})).sort((a,b)=>b.totalMs-a.totalMs),uniqueExactCalls:calls.size,repeatedExactCalls:[...calls.values()].reduce((n,count)=>n+Math.max(0,count-1),0)};
  throw rollback;
 },{maxWait:8000,timeout:120000});
}catch(error){if(error!==rollback){console.error(JSON.stringify({profileFailed:true,code:error.code??null,sqlState:error.meta?.code??null,reason:String(error.message).startsWith('PROFILE_')?error.message:'PROFILE_SOURCE_OR_DATABASE_REJECTED'}));process.exitCode=1;}}finally{await client.$disconnect();}
if(!result)process.exit(1);const output=workspaceRoot+'researchhub/docs/testing/evidence/'+'full-study-compute-tail-2026-11-16/profile/';mkdirSync(output,{recursive:true});const resultFile=output+(performanceLabel?'core-project-'+performanceLabel+'.json':after?'core-project-after.json':'core-project.json');writeFileSync(resultFile,JSON.stringify(result,null,2)+'\n',{...(performanceLabel?{flag:'wx'}:{})});console.log(JSON.stringify({wallMs:result.wallMs,firstAuthorizationLockWaitMs:result.firstAuthorizationLockWaitMs,afterFirstAuthorizationLockMs:result.afterFirstAuthorizationLockMs,observations:result.observations,slices:result.slices,topDatabaseCalls:result.stats.filter(s=>!s.key.startsWith('native.')).slice(0,12),evidence:resultFile}));
