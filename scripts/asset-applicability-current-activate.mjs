// Explicit user-approved local registration. Startup must never create this event.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createApplicabilityCurrentAccess,APPLICABILITY_ACCESS_ACTION} from './asset-applicability-current-access.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-knowledge-local/',rt=JSON.parse(readFileSync(dir+'runtime.json')),ids=rt.ids;
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const access=createApplicabilityCurrentAccess(ids),sha=v=>createHash('sha256').update(v).digest('hex'),out=root+'researchhub/docs/testing/evidence/applicability-current-2026-11-10/'+Date.now()+'/';mkdirSync(out,{recursive:true});
const files=['wp09-scope.json','wp08-scope.json','wp07-scope.json','wp06-scope.json','ai-budget-20261022.json'],fileHashes=Object.fromEntries(files.map(f=>[f,sha(readFileSync(dir+f))]));
const snapshot=await withFixtureTransaction(env,'direct',async tx=>{
 const pending=await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,status:{in:['queued','processing']}},select:{id:true,status:true,attempts:true,startedAt:true,payload:true}});
 // Other read-only browser/PG suites left explicit unscheduled fixtures. Keep
 // them verbatim; any real job or dispatched fixture blocks this activation.
 assert(pending.every(j=>j.status==='queued'&&j.attempts===0&&j.startedAt===null&&j.payload?.testStage===true&&[undefined,'isolated-test'].includes(j.payload?.hubCommand?.consumerKey)),'LOCAL_AI_IN_FLIGHT');
 const role=await tx.permissionRole.findUnique({where:{id:ids.role}});assert.equal(role.tenantId,ids.tenant);assert(['artifact.read','artifact.create','artifact.edit','chat.use'].every(p=>role.buttonPermissions.includes(p)));
 const artifacts=await tx.$queryRaw`SELECT id,md5(row_to_json(t)::text) AS hash FROM research_artifact t WHERE "tenantId"=${ids.tenant}`;
 const versions=await tx.$queryRaw`SELECT id,md5(row_to_json(t)::text) AS hash FROM research_artifact_version t WHERE "tenantId"=${ids.tenant}`;
 return{role,artifacts,versions,unscheduledTestJobs:pending.map(j=>j.id)};
},{readOnly:true});
const event=await withFixtureTransaction(env,'direct',async tx=>{
 // Match the existing shared authorization-mutation lock, not a second lock family.
 const {createRequire}=await import('node:module'),require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 await require(root+'app/server/src/common/worker-publication.ts').lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});
 const prior=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:APPLICABILITY_ACCESS_ACTION,target:ids.project,meta:{path:['policyHash'],equals:access.registration.policyHash}}});
 const row=prior??await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:APPLICABILITY_ACCESS_ACTION,target:ids.project,meta:access.registration}});
 for(const accountId of [ids.owner,ids.admin]){const account=await tx.account.findUnique({where:{id:accountId}});const user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId,authVersion:account.authVersion};for(const op of ['U01','U02','U03'])await access.authorized(tx,user,op);}
 return{id:row.id,created:!prior};
});
for(const f of files)assert.equal(sha(readFileSync(dir+f)),fileHashes[f]);
writeFileSync(out+'baseline.json',JSON.stringify({...snapshot,fileHashes,registration:access.registration,event},null,2));
console.log(JSON.stringify({registered:true,eventCreated:event.created,legacyScopeAndLedgerUnchanged:true,roleChanged:false,modelCalls:0,evidence:out}));
