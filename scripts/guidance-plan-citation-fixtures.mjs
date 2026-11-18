// Creates only the two named current-task synthetic drafts. Prior rows stay read-only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {citationFixture,root,ids,require} from '../tests/helpers/guidance-citation-fixture.mjs';
import {citationHash} from './guidance-plan-citation-contract.mjs';
import {makeDesignWorkspaceUrl} from '../src/research-design-session.js';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const dir=root+'.tmp/researchhub-guidance-citations/',file=dir+'fixture.json',budget=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json';
const {canonicalArtifactJson}=require(root+'app/server/src/research-artifacts/research-artifact-integrity.ts');
const hash=v=>citationHash(canonicalArtifactJson(v));
const setScope=async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;await db.$executeRaw`SELECT set_config('app.study_group_id',${ids.group},true)`;await db.$executeRaw`SELECT set_config('app.research_project_id',${ids.project},true)`;};
await assertFixtureTarget(env);assert.ok(['--create','--verify'].includes(process.argv[2]));
if(process.argv[2]==='--create'){
 if(existsSync(file))throw Error('Named fixture already exists; use --verify, never create replacements silently');
 const before=await withFixtureTransaction(env,'app',async db=>{await setScope(db);return{versions:(await db.researchArtifactVersion.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project}})).map(v=>({id:v.id,sha:hash(v)})),role:hash(await db.permissionRole.findUniqueOrThrow({where:{id:ids.role}}))};},{readOnly:true});
 const fixtures=[];
 for(const actor of ['owner','admin'])fixtures.push(await withFixtureTransaction(env,'app',async db=>{const f=await citationFixture(db,actor);return{actor,planId:f.planId,basisPlanId:f.originalId,basisVersion:f.originalVersion,url:makeDesignWorkspaceUrl('s07',{studyGroupId:ids.group,researchProjectId:ids.project},f.planId)};}));
 mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(file,JSON.stringify({schema:1,ids:{tenant:ids.tenant,group:ids.group,project:ids.project},fixtures,before,budgetSha:citationHash(readFileSync(budget))},null,2),{mode:0o600});
 console.log(JSON.stringify({created:true,fixtures,file}));
}else{
 const f=JSON.parse(readFileSync(file));assert.deepEqual(f.ids,{tenant:ids.tenant,group:ids.group,project:ids.project});
 await withFixtureTransaction(env,'app',async db=>{await setScope(db);assert.equal(hash(await db.permissionRole.findUniqueOrThrow({where:{id:ids.role}})),f.before.role);for(const before of f.before.versions){const v=await db.researchArtifactVersion.findUniqueOrThrow({where:{id:before.id}});assert.equal(hash(v),before.sha,'Prior artifact version changed: '+before.id);}for(const fixture of f.fixtures){const a=await db.researchArtifact.findUniqueOrThrow({where:{id:fixture.planId}});assert.equal(a.ownerAccountId,ids[fixture.actor]);}},{readOnly:true});
 assert.equal(citationHash(readFileSync(budget)),f.budgetSha,'AI ledger changed');console.log(JSON.stringify({verified:true,priorVersions:f.before.versions.length,fixtures:f.fixtures.length,roleAndAiLedgerUnchanged:true}));
}
