import test from 'node:test';
import assert from 'node:assert/strict';
import {REPORT_CONTEXT,assertReportContextPrincipal,assertReportContextSource,buildReportContextRegistration,reportContextSourceError} from './research-assets-report-context.mjs';
import {createReportContextPrisma} from './local-research-assets-report-context.mjs';
const c=()=>structuredClone(REPORT_CONTEXT);
test('local source adapter admits only the approved project on app transactions without broadening the shared startup gate',async()=>{
 const sets=[],tx={$executeRawUnsafe:async(...args)=>sets.push(args)},ids={tenant:'t',group:'g'};let calls=0;
 const prisma={withTenantTransaction(){throw Error('OLD_SCOPE_ONLY');},app:{$transaction:async run=>{calls++;return run(tx);}}};
 const bridge=createReportContextPrisma({ids,prisma});assert.equal(await bridge.withTenantTransaction('t','g',c().projectId,t=>t),tx);assert.equal(calls,1);assert(sets.some(x=>x.includes(c().projectId)));
 for(const args of [['other','g',c().projectId],['t','other',c().projectId],['t','g','other']])await assert.rejects(()=>bridge.withTenantTransaction(...args,()=>{}),e=>e.status===403);
 assert.equal(calls,1);
});
test('known source authorization and version errors remain 403/409 while unknown faults are not relabelled',()=>{
 for(const status of [401,403,404,409]){const e=reportContextSourceError(Object.assign(Error('native'),{status,code:'REPORT_SOURCE_INVALID'}));assert.equal(e.status,status);assert.equal(e.code,'ASSET_CATALOG_REPORT_CONTEXT_SOURCE_INVALID');}
 const unknown=Error('database failure');assert.equal(reportContextSourceError(unknown),unknown);
});
const principal=()=>({tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:c().projectId,accountId:'rh-kb-local-b0e2af9d-admin',isTenantAdmin:true,displayName:'合成管理员'});
const source=()=>({artifact:{id:c().reportId,tenantId:principal().tenantId,studyGroupId:principal().studyGroupId,researchProjectId:c().projectId,ownerAccountId:principal().accountId,status:'released',currentVersionNo:1,title:'真实方法合成报告'},version:{id:'version-1',versionNo:1,contentHash:c().hash,contentMd:'# 固定报告'},basis:{studyId:c().studyId},source:{id:c().runId}});
test('only the named current admin and source project enter before any source delivery',()=>{
 assertReportContextPrincipal(principal());
 for(const v of [{accountId:'rh-kb-local-b0e2af9d-owner'},{isTenantAdmin:false},{researchProjectId:'rh-kb-local-b0e2af9d-project'},{tenantId:'other'},{studyGroupId:'other'}])assert.throws(()=>assertReportContextPrincipal({...principal(),...v}));
});
test('native verified source must bind report version, hash, actual study and method run',()=>{
 assertReportContextSource(source(),principal());
 for(const mutate of [s=>s.artifact.status='approved',s=>s.artifact.ownerAccountId='other',s=>s.version.versionNo=2,s=>s.version.contentHash='a'.repeat(64),s=>s.basis.studyId='other',s=>s.source.id='other',s=>s.artifact.researchProjectId='other']){const s=source();mutate(s);assert.throws(()=>assertReportContextSource(s,principal()));}
});
const input=()=>({purpose:'历史报告引用与研究讨论',limitations:'合成材料，不作为新研究结论',rightsEvidence:'本人原创合成材料，限本Study私有登记及审核',requestKey:'context-register-0001'});
test('textarea notes accept ordinary newlines without accepting hidden control characters',()=>{
 const value=buildReportContextRegistration({...input(),purpose:'历史引用\n研究讨论',rightsEvidence:'本人原创合成材料\n限本Study私有审核'},source(),principal());
 assert.equal(value.metadata.purpose,'历史引用\n研究讨论');assert.throws(()=>buildReportContextRegistration({...input(),purpose:'hidden\u0001control'},source(),principal()));
});
test('server binds native fixed content, provenance and private policy rather than client supplied facts',()=>{
 const v=buildReportContextRegistration(input(),source(),principal());
 assert.equal(v.kind,'publication');assert.equal(v.sourceKind,'artifact');assert.equal(v.contentMd,source().version.contentMd);
 assert.deepEqual(v.policy.discoveryRecipients,[]);assert.equal(v.sourceBindings[0].id,c().reportId);assert.equal(v.metadata.author,principal().displayName);
 assert.deepEqual(buildReportContextRegistration(input(),source(),principal()),v);
});
test('unknown input, empty purpose, invalid key and excessive fields are rejected',()=>{
 for(const v of [{contentMd:'替换统计结果'},{ownerAccountId:'other'},{purpose:''},{rightsEvidence:''},{requestKey:'x'},{limitations:'x'.repeat(2001)}])assert.throws(()=>buildReportContextRegistration({...input(),...v},source(),principal()));
});
