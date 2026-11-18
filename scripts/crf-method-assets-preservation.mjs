// Metadata-only checks. No initializer, grant update, recovery or model request.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget, withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const mode=process.argv[2];assert(['baseline','verify'].includes(mode));
const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-wp08-crf-method-assets/',file=dir+'preservation.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
const old=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/preservation.json'));
const sources=old.sources.map(s=>({path:s.path,sha256:sha(readFileSync(root+s.path))}));
assert.deepEqual(sources,old.sources,'OLD_SOURCE_CHANGED');
const processes=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});
assert.equal(processes,old.processes,'OLD_PROCESS_CHANGED');
const rows={};for(const table of Object.keys(old.rows)){
 assert.match(table,/^[a-z_]+$/);
 rows[table]=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM public."${table}" t ORDER BY id`),{readOnly:true});
}
const ids=runtime.ids;
const authorization=await withFixtureTransaction(env,'direct',async tx=>{
 const role=await tx.permissionRole.findUnique({where:{id:ids.role}});
 assert(role?.tenantId===ids.tenant&&['artifact.read','artifact.create','artifact.edit','chat.use'].every(k=>role.buttonPermissions.includes(k)),'EXISTING_PERMISSION_MISSING');
 const actors=[];for(const actor of ['owner','admin']){
  const account=await tx.account.findUnique({where:{id:ids[actor]}}),membership=await tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[actor],status:'active'}});
  assert(account?.status==='active'&&account.tenantId===ids.tenant&&membership,'EXISTING_MEMBERSHIP_MISSING');
  actors.push({actor,account:sha(JSON.stringify(account)),membership:sha(JSON.stringify(membership))});
 }
 return {role:sha(JSON.stringify(role)),actors};
},{readOnly:true});
const ledgerPath=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledger=readFileSync(ledgerPath),budget=JSON.parse(ledger);
assert.equal(budget.records.length,79);assert.equal(budget.limitMicroCny,5_000_000);assert(budget.records.every(r=>r.status==='known'));
const priorScopes=Object.fromEntries(['wp06-scope.json','wp07-scope.json'].map(p=>[p,sha(readFileSync(root+'.tmp/researchhub-knowledge-local/'+p))]));
const value={sources,processes,rows,authorization,schemaHash:sha(readFileSync(root+'app/server/prisma/schema.prisma')),ledgerHash:sha(ledger),idsHash:sha(JSON.stringify(ids)),priorScopes};
if(mode==='baseline'){
 assert(!existsSync(file),'BASELINE_ALREADY_EXISTS');
 const fixtures=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/report-fixtures.json'));
 const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
 const request=pw.request??pw.default.request,roots=[];
 for(const actor of ['owner','admin']){
  const f=fixtures[actor],context=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}});
  try{
   const login=await context.post('/api/auth/login',{data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(login.status(),201,'LOCAL_SYNTHETIC_LOGIN_FAILED');
   const res=await context.get(f.reportPath);assert.equal(res.status(),200,'PRIOR_REPORT_UNAVAILABLE');const report=await res.json();
   assert.equal(report.sourceStatus,'current','PRIOR_REPORT_STALE');assert.equal(report.version,report.currentVersion,'PRIOR_REPORT_NOT_HEAD');assert.equal(report.facts.ai.status,'current','PRIOR_ACTUAL_AI_MISSING');
   roots.push({accountId:ids[actor],planId:f.planId,collectionId:f.collectionId,runId:f.runId,reportId:report.id,reportVersion:report.version,reportPath:f.reportPath});
  }finally{await context.dispose();}
 }
 value.sourceRoots=roots;mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(file,JSON.stringify(value),{flag:'wx',mode:0o600});
}else{
 const before=JSON.parse(readFileSync(file));const {sourceRoots,...protectedBefore}=before;
 assert.deepEqual({...value,rows:undefined},{...protectedBefore,rows:undefined});
 for(const [table,entries] of Object.entries(before.rows)){const now=new Map(rows[table].map(r=>[r.id,r.digest]));for(const r of entries)assert.equal(now.get(r.id),r.digest,'PRIOR_ROW_CHANGED:'+table);}
}
console.log(JSON.stringify({passed:true,mode,database:target.databaseName,protectedSources:sources.length,protectedTables:Object.keys(rows).length,protectedRows:Object.values(mode==='verify'?JSON.parse(readFileSync(file)).rows:rows).reduce((n,r)=>n+r.length,0),sourceReports:2,existingAuthorizationSufficient:true,ledgerRecords:budget.records.length,ledgerUnchanged:true,oldProcessesUnchanged:true,dbWrites:0,modelCalls:0}));
