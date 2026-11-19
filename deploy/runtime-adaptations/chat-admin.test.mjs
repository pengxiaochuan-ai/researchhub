import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{Module}from'node:module';import{fileURLToPath}from'node:url';import{runtimeDependencies}from'../../server/research-runtime/dependencies.mjs';import{knowledgeAdminTransform}from'../knowledge-admin-adaptation.mjs';
import{mkdtempSync,mkdirSync,symlinkSync,rmSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{applyKnowledgeAdminAdaptation}from'../knowledge-admin-adaptation.mjs';
const{require}=runtimeDependencies(),ts=require('typescript'),root=process.env.HUB_CORE_TEST_ROOT;
function compile(source,name,helper){const filename=fileURLToPath(new URL('../../../app/server/src/common/'+name,import.meta.url)),mod=new Module(filename);mod.filename=filename;mod.paths=require.resolve.paths('@nestjs/common');const native=mod.require.bind(mod);mod.require=p=>p.endsWith('hub-knowledge-admin')?helper:native(p);mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,filename);return mod.exports;}
function setup(){
 const h=compile(readFileSync(new URL('./hub-knowledge-admin.ts',import.meta.url),'utf8'),'hub-knowledge-admin.ts'),user={tenantId:'tenant',accountId:'admin',authVersion:0,role:'tenant_admin',isTenantAdmin:true},state={access:true,approved:true,owner:'admin',context:'hub:lingshu-xinyu',modelTools:['knowledge.search']};
 const session={id:'session',tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'admin',agentId:'tenant-kb-research',channel:'knowledge',contextKey:state.context,deletedAt:null};
 const tx={account:{findFirst:async()=>({id:'admin'})},studyGroup:{findFirst:async()=>({id:'group'})},researchProject:{findFirst:async()=>({id:'project'})},knowledgeChatJob:{findUnique:async()=>({id:'task',tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:state.owner,sessionId:'session'})},session:{findUnique:async()=>({...session,contextKey:state.context})},agent:{findFirst:async()=>({id:'tenant-kb-research'})},agentAccess:{findFirst:async()=>state.access?{id:'access'}:null},$executeRawUnsafe:async()=>1,$queryRawUnsafe:async()=>state.approved?[{status:'approved'}]:[]};
 return{h,user,state,tx};
}
test('Hub chat admin worker binds actual Hub session, named access and current admission without membership',async()=>{
 const{h,user,state,tx}=setup();assert.equal(await h.authorizeHubKnowledgeAdminWorker(tx,user,{kind:'knowledge-chat',taskId:'task'},{product:'researchhub'},'group','project'),true);
 for(const key of ['access','approved']){state[key]=false;await assert.rejects(h.authorizeHubKnowledgeAdminWorker(tx,user,{kind:'knowledge-chat',taskId:'task'},{product:'researchhub'},'group','project'));state[key]=true;}
 state.owner='other';await assert.rejects(h.authorizeHubKnowledgeAdminWorker(tx,user,{kind:'knowledge-chat',taskId:'task'},{product:'researchhub'},'group','project'));state.owner='admin';state.context='kb:private';await assert.rejects(h.authorizeHubKnowledgeAdminWorker(tx,user,{kind:'knowledge-chat',taskId:'task'},{product:'researchhub'},'group','project'));
});
test('native HTTP dispatch includes only KnowledgeController and HubChatController admin compatibility',{skip:!root},async()=>{
 const{h,user}=setup(),{StudyGroupGuard}=compile(knowledgeAdminTransform('src/common/guards/study-group.guard.ts',readFileSync(root+'/src/common/guards/study-group.guard.ts','utf8')),'guards/study-group.guard.ts',h);
 const tx={account:{findFirst:async()=>({id:'admin'})},studyGroup:{findFirst:async()=>({id:'group'})},researchProject:{findFirst:async()=>({id:'project'})},$executeRaw:async()=>1},prisma={elevated:{$transaction:fn=>fn(tx)},forTenant:()=>{throw Error('NATIVE_MEMBERSHIP_PATH');}},reflector={getAllAndOverride:k=>k==='requireStudyGroup'||k==='requireResearchProject'},req={user,headers:{'x-study-group-id':'group','x-research-project-id':'project'}},ctx={getHandler:()=>()=>{},getClass:()=>class HubChatController{},switchToHttp:()=>({getRequest:()=>req})};
 const old=process.env.DEPLOYMENT_PRODUCT;process.env.DEPLOYMENT_PRODUCT='researchhub';try{assert.equal(await new StudyGroupGuard(reflector,prisma).canActivate(ctx),true);ctx.getClass=()=>class OtherController{};await assert.rejects(new StudyGroupGuard(reflector,prisma).canActivate(ctx),/NATIVE_MEMBERSHIP_PATH/);}finally{if(old===undefined)delete process.env.DEPLOYMENT_PRODUCT;else process.env.DEPLOYMENT_PRODUCT=old;}
});
test('admin tool grant intersects a multi-tool config with knowledge.search only',()=>{
 const{h}=setup(),{load}=runtimeDependencies();
 const keys=load('common/tool-catalog','effectiveRuntimeToolKeys')('research',['knowledge.search','skill.invoke','file.read','artifact.read','knowledge.write'],h.hubChatAdminToolPermissions());
 assert.deepEqual(keys,['knowledge.search']);
});
test('private adaptation rejects canonical aliases and symlink targets before opening source files',()=>{
 const temp=mkdtempSync(join(tmpdir(),'rh-core-adaptation-'));try{const source=join(temp,'source');mkdirSync(source);symlinkSync(source,join(temp,'alias'));for(const output of [source+'/',join(temp,'alias')])assert.throws(()=>applyKnowledgeAdminAdaptation({source,output}),/CORE_KNOWLEDGE_ADAPTATION_TARGET_REJECTED/);}finally{rmSync(temp,{recursive:true,force:true});}
});
test('native worker rejects every non-search requirement even with a multi-tool active config',{skip:!root},async()=>{
 const{h,user,state,tx}=setup();state.modelTools=['knowledge.search','file.read','artifact.read','skill.invoke','knowledge.write'];
 tx.account.findUnique=async()=>({...user,id:user.accountId,status:'active',tenant:{status:'active'}});tx.agent.findUnique=async()=>({id:'tenant-kb-research',tenantId:'tenant',type:'research',status:'active'});tx.agentConfig={findFirst:async()=>({tools:state.modelTools})};
 const{assertWorkerAuthorized}=compile(knowledgeAdminTransform('src/common/worker-authorization.ts',readFileSync(root+'/src/common/worker-authorization.ts','utf8')),'worker-authorization.ts',h),scope={product:'researchhub',allowedTenantIds:['tenant'],enabledWorkerKinds:['knowledge-chat']},ref={kind:'knowledge-chat',taskId:'task',tenantId:'tenant'};
 assert.equal((await assertWorkerAuthorized(tx,scope,ref,{toolKeys:['knowledge.search']})).accountId,'admin');
 for(const key of state.modelTools.filter(k=>k!=='knowledge.search'))await assert.rejects(assertWorkerAuthorized(tx,scope,ref,{toolKeys:[key]}));
});
