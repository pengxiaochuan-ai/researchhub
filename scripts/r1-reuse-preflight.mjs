// R1-01 only: existing report GETs + at most two explicitly approved D01 tasks.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {buildR1TaskFixtureRows,validateR1FixtureRows} from './r1-task-fixtures.mjs';

assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-r1-d01']);
const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-knowledge-local/';
const runtime=JSON.parse(readFileSync(dir+'runtime.json','utf8'));
const reportFixtures=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/report-fixtures.json','utf8'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const target=await assertFixtureTarget(env);
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const budgetHash=()=>digest(readFileSync(dir+'ai-budget-20261022.json','utf8'));
const scope={tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:'rh-kb-local-b0e2af9d-project'};
assert.equal(runtime.ids.tenant,scope.tenantId);assert.equal(runtime.ids.group,scope.studyGroupId);assert.equal(runtime.ids.project,scope.researchProjectId);
const accounts=['rh-kb-local-b0e2af9d-owner','rh-kb-local-b0e2af9d-admin'];
assert.deepEqual([runtime.ids.owner,runtime.ids.admin],accounts);
const purpose='ResearchHub-R1-20261102-two-own-read-tasks';
const read=callback=>withFixtureTransaction(env,'direct',callback,{readOnly:true});
async function preserved(){
 return read(async tx=>{
  const artifacts=await tx.researchArtifact.findMany({where:{...scope,ownerAccountId:{in:accounts}},orderBy:{id:'asc'}});
  const versions=await tx.researchArtifactVersion.findMany({where:{artifactId:{in:artifacts.map(a=>a.id)}},include:{sources:true},orderBy:{id:'asc'}});
  const roles=await tx.permissionRole.findMany({where:{tenantId:scope.tenantId},orderBy:{id:'asc'}});
  const groups=await tx.studyGroupMembership.findMany({where:{tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,accountId:{in:accounts}},orderBy:{id:'asc'}});
  const projects=await tx.researchProjectMembership.findMany({where:{...scope,accountId:{in:accounts}},orderBy:{id:'asc'}});
  return {artifacts:artifacts.length,versions:versions.length,artifactHash:digest(artifacts),versionHash:digest(versions),authorizationHash:digest({roles,groups,projects})};
 });
}
const before={data:await preserved(),budgetHash:budgetHash()},checks=[],responses=[],cookies={};
const runId='rh-r1-20261102-'+randomUUID().replaceAll('-','').slice(0,8);
const output=root+'researchhub/docs/testing/evidence/r1-reuse-2026-11-02/'+runId+'/';
mkdirSync(output,{recursive:true,mode:0o700});
const save=(name,value)=>writeFileSync(output+name,JSON.stringify(value,null,2)+'\n',{mode:0o600});
async function request(actor,path){
 assert(/^\/api\/(?:auth\/me$|my-research\/overview$|research-plan-drafts\/|sessions\/)/.test(path),'R1_API_PATH_REJECTED');
 const res=await fetch('http://127.0.0.1:19501'+path,{headers:{Cookie:cookies[actor],'X-Study-Group-Id':scope.studyGroupId,'X-Research-Project-Id':scope.researchProjectId},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 const body=await res.json();responses.push({actor,path,status:res.status,code:body.code??null,at:new Date().toISOString()});return {status:res.status,body};
}
try{
 for(const actor of ['owner','admin']){
  const login=await fetch('http://127.0.0.1:19501/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:scope.tenantId,username:actor+'@example.org',password:runtime.password}),redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.equal(login.status,201);cookies[actor]=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  const me=await request(actor,'/api/auth/me');assert.equal(me.status,200);assert.equal(me.body.accountId,runtime.ids[actor]);
  const f=reportFixtures[actor];assert.match(f.reportPath,/^\/api\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-collections\/[A-Za-z0-9_-]+\/method-runs\/[A-Za-z0-9_-]+\/report-drafts\/[A-Za-z0-9_-]+$/);
  const reportChecks=[];
  for(const no of [1,2]){
   const response=await request(actor,f.reportPath+'/versions/'+no);assert.equal(response.status,200);const v=response.body;
   assert.equal(v.id,f.reportId);assert.equal(v.version,no);assert.equal(v.sourceStatus,'current');assert(v.contentMd.length>0);assert.equal(v.facts.method.runId,f.runId);
   const actual=await read(tx=>tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:f.reportId,versionNo:no}},include:{sources:true,artifact:true}}));
   assert(actual);assert.equal(actual.artifact.ownerAccountId,runtime.ids[actor]);assert.equal(actual.artifact.createdBy,runtime.ids[actor]);
   for(const [k,val] of Object.entries(scope))assert.equal(actual.artifact[k],val);
   assert.equal(actual.contentHash,digest(v.contentMd));assert.equal(actual.contentMd,v.contentMd);assert.equal(actual.contentBlocks[0].factsHash,v.factsHash);assert.equal(actual.sources.length,v.sourceRows.length);
   reportChecks.push({reportId:v.id,version:no,currentVersion:v.currentVersion,sourceStatus:v.sourceStatus,contentHash:actual.contentHash,factsHash:v.factsHash,sourceCount:v.sourceRows.length,planId:f.planId,collectionId:f.collectionId,runId:f.runId});
  }
  const other=reportFixtures[actor==='owner'?'admin':'owner'];
  const forbidden=await request(actor,other.reportPath+'/versions/1');assert.equal(forbidden.status,403);assert(!forbidden.body.contentMd&&!forbidden.body.facts&&!forbidden.body.notes);
  checks.push({actor,session:true,versions:reportChecks,otherOwnerDenied:true});
 }
 // No task mutation until both original report chains actually read successfully.
 const fixtures=await withFixtureTransaction(env,'direct',async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${purpose}))`;
  const previous=await tx.$queryRaw`SELECT run_id,manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'=${purpose}`;
  assert(previous.length<=1,'R1_FIXTURE_MANIFEST_CONFLICT');
  let rows,created=false,id=runId;
  if(previous.length){id=previous[0].run_id;rows=previous[0].manifest.tasks;validateR1FixtureRows(id,rows);}
  else{
   rows=buildR1TaskFixtureRows(id);validateR1FixtureRows(id,rows);
   assert.equal(await tx.tenant.count({where:{id:scope.tenantId,status:'active'}}),1);
   assert.equal(await tx.studyGroup.count({where:{id:scope.studyGroupId,tenantId:scope.tenantId,status:'active'}}),1);
   assert.equal(await tx.researchProject.count({where:{id:scope.researchProjectId,tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,status:'active'}}),1);
   for(const accountId of accounts){
    assert.equal(await tx.account.count({where:{id:accountId,tenantId:scope.tenantId,status:'active'}}),1);
    assert.equal(await tx.researchProjectMembership.count({where:{...scope,accountId,status:'active'}}),1);
   }
   assert.equal(await tx.studyTask.count({where:{id:{in:rows.map(r=>r.id)}}}),0,'R1_FIXTURE_ID_EXISTS');
   const manifest={syntheticOnly:true,purpose,approved:'2026-11-02-user-R1-D01',scope,tasks:rows};
   const reservation=await tx.$queryRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES (${id},${JSON.stringify(manifest)}::jsonb) ON CONFLICT DO NOTHING RETURNING run_id`;
   assert.equal(reservation.length,1,'R1_FIXTURE_RESERVATION_CONFLICT');
   const inserted=await tx.studyTask.createMany({data:rows});assert.equal(inserted.count,2);created=true;
  }
  const select=Object.fromEntries(Object.keys(rows[0]).map(k=>[k,true]));
  const actual=await tx.studyTask.findMany({where:{...scope,id:{in:rows.map(r=>r.id)}},select});
  validateR1FixtureRows(id,rows.map(r=>actual.find(a=>a.id===r.id)));
  return {runId:id,created,taskIds:rows.map(r=>r.id),rows};
 });
 for(const actor of ['owner','admin']){
  const overview=await request(actor,'/api/my-research/overview');assert.equal(overview.status,200);
  const ownTasks=overview.body.tasks.filter(t=>fixtures.taskIds.includes(t.id));
  assert.equal(ownTasks.length,actor==='owner'?1:0); // P01 intentionally lists only open statuses.
 }
 const after={data:await preserved(),budgetHash:budgetHash()};assert.deepEqual(after,before);
 save('result.json',{passed:true,checkedAt:new Date().toISOString(),syntheticOnly:true,database:target.databaseName,checks,responses,fixtures,before,after,newModelCalls:0,newRolePermissions:0,r1PagesConnected:false});
 console.log(JSON.stringify({passed:true,checks:checks.length,reportVersionGets:4,crossOwnerDenials:2,fixtures:{runId:fixtures.runId,created:fixtures.created,count:fixtures.rows.length},preserved:true,newModelCalls:0,evidence:output}));
}catch(error){save('failure.json',{passed:false,message:error.message,responses,newModelCalls:0});throw error;}
