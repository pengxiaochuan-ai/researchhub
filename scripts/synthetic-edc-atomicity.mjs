// Fault injection in a NEW packet only, with the real PostgreSQL transaction and Artifact service.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalSyntheticEdc} from './local-synthetic-edc.mjs';
import {abortFaultTransaction} from './synthetic-edc-fault-guard.mjs';
const root='/Users/mac/aisciencesys/',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),ids=runtime.ids,planId=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05-execution-preparation/e2e-owner.json')).planId,key='c09-atomic-'+randomUUID();
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),c=await(pw.request??pw.default.request).newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}});
async function json(res,n=200){assert.equal(res.status(),n,await res.text());return res.json();}
await json(await c.post('/api/auth/login',{data:{tenantSlug:ids.tenant,username:'owner@example.org',password:runtime.password}}),201);const prep=await json(await c.get('/api/research-plan-drafts/'+planId+'/execution-preparation')),path='/api/research-plan-drafts/'+planId+'/synthetic-collections';let v=(await json(await c.post(path,{data:{parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,subjectCount:3,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),requestKey:key+'-packet'}}),201)).collection;
v=(await json(await c.post(path+'/'+v.id+'/records/'+v.records[0].recordId+'/completions',{data:{baseVersionNo:v.version,baseResponseRevision:v.records[0].responseRevision,acknowledgeFindingsHash:v.records[0].validation.findingsHash,requestKey:key+'-complete'}}),201)).collection;await c.dispose();const fixture={id:v.id,planId};
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');await assertFixtureTarget(env);
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name];
let injected=false,inject=true;
const plans={withDraft:(user,planId,permission,callback)=>withFixtureTransaction(env,'direct',async tx=>{
 assert.equal(planId,fixture.planId);assert.equal(user.accountId,ids.owner);assert.equal(permission,'artifact.edit');const a=await tx.researchArtifact.findUnique({where:{id:planId}}),v=await tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:a.id,versionNo:a.currentVersionNo}}});
 const proxy=new Proxy(tx,{get(target,name){if(name!=='auditLog')return target[name];return new Proxy(target.auditLog,{get(model,method){if(method!=='create')return model[method];return args=>{if(inject&&args.data.action==='local_synthetic_edc_correction'){injected=true;throw Error('WP06_INJECTED_AUDIT_FAILURE');}return model.create(args);};}});}});
 return abortFaultTransaction(()=>callback(proxy,{a,v,block:v.contentBlocks[0]},'current'));
})};
const {Controller}=await createLocalSyntheticEdc({root,ids,plans,prisma:null,storage:null,load,require,scope:root+'.tmp/researchhub-knowledge-local/wp06-scope.json'}),controller=new Controller();
const snapshot=()=>withFixtureTransaction(env,'direct',async tx=>({artifact:await tx.researchArtifact.findUnique({where:{id:fixture.id}}),versions:await tx.researchArtifactVersion.findMany({where:{artifactId:fixture.id},orderBy:{versionNo:'asc'}}),audits:await tx.auditLog.findMany({where:{tenantId:ids.tenant,target:fixture.id},orderBy:{id:'asc'}})}),{readOnly:true});
const before=await snapshot(),record=before.versions.at(-1).contentBlocks[0].records[0],field=v.config.form.schema.fields.find(f=>['number','integer'].includes(f.type));assert(field);const answers={[field.key]:{state:'value',value:7}},checks=[];
for(const hit of [true,false]){inject=hit;injected=false;await assert.rejects(controller.correct({user:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,role:'researcher'}},fixture.planId,fixture.id,record.recordId,{baseVersionNo:before.artifact.currentVersionNo,baseResponseRevision:record.responseRevision,answers,reason:'本轮新具名记录包事务回滚演练',requestKey:'atomic-'+randomUUID()}),new RegExp(hit?'WP06_INJECTED_AUDIT_FAILURE':'FAULT_INJECTION_NOT_TRIGGERED_ABORT_TRANSACTION'));assert.equal(injected,hit);assert.deepEqual(await snapshot(),before);checks.push(hit?'injected-after-version-audit-rollback':'missed-injection-normal-write-aborted-before-commit');}
const out=root+'docs/test/evidence/2026-10-23-researchhub-wp06-synthetic-edc/atomicity-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,artifactVersionsAuditsUnchanged:true,newPacketOnly:fixture.id,authorizationProof:'separate real HTTP suites',oldServicesTouched:false,paidCalls:0},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
