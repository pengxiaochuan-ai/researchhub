// Synthetic-only test utilities. No role grants, models, or edits to prior artifacts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createLocalResearchPlans} from '../../scripts/local-research-plans.mjs';
import {citationHash} from '../../scripts/guidance-plan-citation-contract.mjs';
import {editablePlanContent} from '../../scripts/research-plan-contract.mjs';
export const root=fileURLToPath(new URL('../../../',import.meta.url));
export const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
export const require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
require('@nestjs/common').Logger.overrideLogger(false);
export const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name];
export async function citationFixture(db,actor='owner'){
 await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
 await db.$executeRaw`SELECT set_config('app.study_group_id',${ids.group},true)`;
 await db.$executeRaw`SELECT set_config('app.research_project_id',${ids.project},true)`;
 assert.ok(await db.auditLog.findFirst({where:{tenantId:ids.tenant,action:'local_research_plan_authorized',target:ids.role}}),'Existing approved permissions required; never grant from test');
 const a=await db.account.findUniqueOrThrow({where:{id:ids[actor]}});
 const user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:a.id,role:a.role,authVersion:a.authVersion};
 let savepoint=0;
 const atomic=async cb=>{const name='citation_scope_'+(++savepoint);await db.$executeRawUnsafe('SAVEPOINT '+name);try{const value=await cb(db);await db.$executeRawUnsafe('RELEASE SAVEPOINT '+name);return value;}catch(e){await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+name);await db.$executeRawUnsafe('RELEASE SAVEPOINT '+name);throw e;}};
 const prisma={elevated:{...db,$transaction:atomic},app:db,forTenant:()=>db,withTenantTransaction:(_t,_g,_p,cb)=>atomic(cb)};
 const plans=await createLocalResearchPlans({root,ids,prisma,storage:{},knowledge:{},load,require,budget:{status:()=>({blocked:true})},own:()=>{throw Error('No session/model side effects allowed');}});
 const candidates=await db.researchArtifact.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:a.id,typeKey:'protocol_draft',status:'draft',deletedAt:null,idempotencyKey:{startsWith:'rh-plan-20261022:'}},orderBy:{createdAt:'desc'},take:100});
 let original;
 for(const row of candidates){try{const p=await plans.withDraft(user,row.id,'artifact.read',(_tx,p,state)=>state==='current'&&p.block.stage==='protocol_draft'&&p.block.confirmation?p:null);if(p){original=p;break;}}catch{}}
 assert.ok(original,'An existing current own confirmed synthetic protocol is required');
 const contentMd=editablePlanContent(original.v.contentMd),block={...original.block,operations:[],pending:null};
 for(const key of ['seal','guidanceCitations','design','executionPreparation'])delete block[key];
 const {canonicalArtifactJson}=require(root+'app/server/src/research-artifacts/research-artifact-integrity.ts');
 const Artifacts=load('research-artifacts/research-artifacts.service','ResearchArtifactsService');
 const artifacts=new Artifacts(prisma,{},null,null);
 const fresh=await artifacts.create(user,{title:'指南人工引用本轮合成夹具 '+actor,typeKey:'protocol_draft',idempotencyKey:'rh-plan-20261022:'+a.id+':guidance-citation-'+randomUUID(),creationRequestHash:citationHash(original.a.id),contentMd:plans.formatContent(contentMd,block),contentBlocks:[{...block,seal:citationHash(canonicalArtifactJson(block))}]});
 return{user,plans,prisma,artifacts,planId:fresh.id,originalId:original.a.id,originalVersion:original.a.currentVersionNo,originalContent:original.v.contentMd};
}
