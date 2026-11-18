import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchStudiesService} from './commands.mjs';
const principal={accountId:'account-a',tenantId:'tenant-a',authVersion:0};
test('WF12 authorized Study context carries the current title and separate read-only workflow hints without granting operators',async()=>{
 const f=setup();f.state.study={id:'study-a',tenant_id:'tenant-a',project_intent_id:'intent-a',execution_project_id:'execution-a',study_group_id:'group-a',created_at:new Date()};f.state.projectMember={roleKey:'researcher'};f.state.groupMember={role:{tenantId:'tenant-a',status:'active',menuPermissions:['workbench'],buttonPermissions:['data.analyze']}};
 const c=await f.service.resolveResearchStudy(principal,'study-a');assert.equal(c.studyTitle,'研究');assert.deepEqual(c.workflowCapabilities,{canReadVisits:true,canReadAnalysis:true,canReadReports:false});assert.equal(c.capabilities.canCollect,false);
 const page=await f.service.overview(principal,'study-a');assert.deepEqual(page.item.workflowCapabilities,c.workflowCapabilities);assert.equal(f.state.writes,0);
 f.state.groupMember.role.buttonPermissions='data.analyze artifact.read';assert.deepEqual((await f.service.overview(principal,'study-a')).item.workflowCapabilities,{canReadVisits:true,canReadAnalysis:false,canReadReports:false});
 f.state.projectMember=null;await assert.rejects(f.service.overview(principal,'study-a'),e=>e.status===404);f.state.account.role='tenant_admin';f.state.account.isTenantAdmin=true;assert.deepEqual((await f.service.overview(principal,'study-a')).item.workflowCapabilities,{canReadVisits:true,canReadAnalysis:true,canReadReports:true});
});
function setup(overrides={},nativeLock){
 const state={row:{id:'intent-a',tenant_id:'tenant-a',owner_id:'account-a',title:'研究',question:'',pico:{p:'',i:'',c:'',o:''},research_type:'',hub_key:null,status:'draft',version:1,created_at:new Date(),updated_at:new Date()},writes:0,receipts:new Map(),group:[],roles:[],account:{id:'account-a',tenantId:'tenant-a',authVersion:0,isTenantAdmin:false,role:'researcher',status:'active',tenant:{status:'active'}}};
 const events=[],locks=[];const tx={account:{findFirst:async()=>{events.push('account');return state.account;}},studyGroup:{findMany:async()=>state.group,findFirst:async()=>({id:'group-a',status:'active'})},studyGroupMembership:{findMany:async()=>[],findFirst:async()=>state.groupMember??null},auditLog:{create:async()=>{throw Error('RLS_AUDIT_RETURNING_DENIED');},createMany:async()=>({count:1})},researchProject:{findFirst:async()=>({id:'execution-a',name:'研究',status:'active'})},researchProjectMembership:{findFirst:async()=>state.projectMember??null,count:async()=>0},subject:{count:async()=>0},studyTask:{count:async()=>0},studyProtocolVersion:{findMany:async()=>[]},$queryRaw:async(strings)=>strings.join('').includes('study_binding')?[state.study].filter(Boolean):[]};
 const repo={setContext:async()=>events.push('scope'),roles:async()=>state.roles,findIntent:async(_tx,_u,id)=>id===state.row.id?state.row:null,binding:async()=>state.study??null,present:r=>({id:r.id,title:r.title,question:r.question,pico:r.pico,researchType:r.research_type,hubKey:r.hub_key,version:r.version,status:r.status,study:null}),getReceipt:async(_tx,_u,key)=>state.receipts.get(key),saveReceipt:async(_tx,_u,op)=>{state.receipts.set(op.key,{request_hash:op.hash,action:op.action,target_id:op.target,result:op.result});},updateIntent:async(_tx,_u,_id,version,input,status)=>{assert.equal(version,state.row.version);state.writes++;state.row={...state.row,title:input.title,version:version+1,status};return 1;},...overrides};
 const sqlLocks=[];tx.$executeRaw=async(strings,...values)=>{sqlLocks.push({sql:strings.join(''),values});return 1;};
 // Unit fixture for the current native admission guard; never a runtime bypass.
 tx.$queryRawUnsafe=async(sql)=>{if(sql==='SELECT set_config($1,$2,true)')return[];assert.equal(sql,'SELECT status FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND account_id=$3');return[{status:state.admissionStatus??'approved'}];};
 const prisma={withTenantTransaction:async(tenant,_group,_project,fn)=>{assert.equal(tenant,principal.tenantId);events.push('transaction');return fn(tx);}};
 const service=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:['tenant-a']},lockAuthorization:nativeLock??(async(_tx,id,options)=>{if(options?.includeOfficial)locks.push('official');locks.push(id);events.push('lock');}),createResearchProject:async()=>{throw Error('must not execute');},repository:repo});return{service,state,events,locks,sqlLocks};
}
test('current identity is checked after transaction authorization lock; stale claimed admin cannot grant authority',async()=>{
 const{service,state,events}=setup();assert.equal((await service.context({...principal,isTenantAdmin:true})).creationGroups.length,0);assert.deepEqual(events.slice(0,4),['transaction','lock','account','scope']);
 state.account.authVersion=1;await assert.rejects(service.context(principal),e=>e.status===401);
});
test('inactive tenant and platform admin cannot read business content',async()=>{
 const{service,state}=setup();state.account.tenant.status='disabled';await assert.rejects(service.detail(principal,'intent-a'),e=>e.status===401);
 state.account.tenant.status='active';state.account.role='platform_admin';state.account.isTenantAdmin=true;await assert.rejects(service.detail(principal,'intent-a'),e=>e.status===403);
});
test('WF12 non-approved admission stays blocked before exposing title or workflow hints',async()=>{const f=setup();f.state.admissionStatus='pending';f.state.account.role='tenant_admin';f.state.account.isTenantAdmin=true;await assert.rejects(f.service.overview(principal,'study-a'),e=>e.code==='HUB_ADMISSION_REQUIRED');assert.equal(f.state.writes,0);});
test('CAS mismatch does not mutate, retry of successful request returns original result after version advanced',async()=>{
 const{service,state}=setup();await assert.rejects(service.update(principal,'intent-a',{title:'changed',expectedVersion:2,requestKey:'request-cas'}),e=>e.status===409);assert.equal(state.writes,0);
 const body={title:'updated',expectedVersion:1,requestKey:'request-updated'};const first=await service.update(principal,'intent-a',body);assert.equal(first.item.version,2);assert.deepEqual(await service.update(principal,'intent-a',body),first);assert.equal(state.writes,1);
 await assert.rejects(service.update(principal,'intent-a',{...body,title:'other'}),e=>e.code==='RESEARCH_REQUEST_KEY_CONFLICT');assert.equal(state.writes,1);
});
test('current permission is checked before exposing an earlier receipt',async()=>{
 const{service,state}=setup();const body={title:'updated',expectedVersion:1,requestKey:'request-revoked'};await service.update(principal,'intent-a',body);state.row.owner_id='another-account';await assert.rejects(service.update(principal,'intent-a',body),e=>e.status===403);
});
test('no writable group retains draft and never invokes execution creator',async()=>{
 const{service,state}=setup();await assert.rejects(service.createStudy(principal,'intent-a',{expectedVersion:1,requestKey:'request-no-group'}),e=>e.code==='RESEARCH_CREATION_SCOPE_REQUIRED');assert.equal(state.writes,0);assert.equal(state.row.status,'draft');
});
test('tenant allowlist is enforced before opening database transaction',async()=>{
 const{service,events}=setup();await assert.rejects(service.context({...principal,tenantId:'other'}),e=>e.status===401);assert.equal(events.length,0);
});

test('intent ownership does not retain execution overview access after Study membership is revoked',async()=>{
 const{service,state}=setup();state.study={id:'study-a',tenant_id:'tenant-a',project_intent_id:'intent-a',execution_project_id:'execution-a',study_group_id:'group-a',hub_key:null,created_at:new Date()};
 assert.equal((await service.detail(principal,'intent-a')).capabilities.canEdit,true);
 await assert.rejects(service.overview(principal,'study-a'),e=>e.status===404||e.status===403);
});

test('inconsistent current tenant-admin identity is denied before capabilities',async()=>{
 const{service,state}=setup();state.account.role='researcher';state.account.isTenantAdmin=true;
 await assert.rejects(service.context(principal),e=>e.status===403);
});
test('Study handoff resolves an authorized scope and rejects nested transaction opening',async()=>{
 const{service,state}=setup();state.study={id:'study-a',tenant_id:'tenant-a',project_intent_id:'intent-a',execution_project_id:'execution-a',study_group_id:'group-a',hub_key:null,created_at:new Date()};state.account.role='tenant_admin';state.account.isTenantAdmin=true;
 assert.equal(typeof service.resolveResearchStudy,'function');const context=await service.resolveResearchStudy(principal,'study-a');assert.equal(context.executionProjectId,'execution-a');
 await assert.rejects(service.withResearchStudyTransaction(principal,'study-a','read',()=>service.context(principal)),e=>e.code==='RESEARCH_NESTED_TRANSACTION');
});

test('draft audit succeeds without SELECT permission on a null-project audit row',async()=>{
 const{service}=setup();
 // Production app RLS permits INSERT but not RETURNING for null-project audit rows.
 const body={title:'审计验证',expectedVersion:1,requestKey:'audit-insert-only'};
 const result=await service.update(principal,'intent-a',body);assert.equal(result.item.version,2);
});
test('Hub owner creation scope requires the intent to bind that exact Hub',async()=>{
 const{service,state}=setup();state.group=[{id:'group-a',name:'研究组'}];state.roles=[{hub_key:'hub-a',study_group_id:'group-a'}];
 assert.equal((await service.context(principal)).creationGroups.length,1);
 assert.equal((await service.detail(principal,'intent-a')).creationGroups.length,0);
 await assert.rejects(service.createStudy(principal,'intent-a',{expectedVersion:1,requestKey:'request-no-hub'}),e=>e.code==='RESEARCH_CREATION_SCOPE_REQUIRED');
 state.row.hub_key='hub-b';assert.equal((await service.detail(principal,'intent-a')).creationGroups.length,0);
 state.row.hub_key='hub-a';assert.equal((await service.detail(principal,'intent-a')).creationGroups.length,1);
});
test('trusted Study review transaction acquires official before tenant and preserves default scope',async()=>{
 const f=setup();f.state.study={id:'study-a',tenant_id:'tenant-a',project_intent_id:'intent-a',execution_project_id:'execution-a',study_group_id:'group-a',hub_key:null,created_at:new Date()};f.state.account.role='tenant_admin';f.state.account.isTenantAdmin=true;
 assert.equal(await f.service.withResearchStudyTransaction(principal,'study-a','read',async()=> 'read',{includeOfficial:true}),'read');
 assert.deepEqual(f.locks,['official','tenant-a']);
 f.locks.length=0;await f.service.withResearchStudyTransaction(principal,'study-a','read',async()=>{});assert.deepEqual(f.locks,['tenant-a']);
});
test('trusted transaction options cannot accept arbitrary lock scopes and retain current identity check',async()=>{
 const f=setup();await assert.rejects(async()=>f.service.withResearchStudyTransaction(principal,'study-a','read',async()=>{},{includeOfficial:'tenant-b'}),e=>e.status===400);assert.equal(f.events.length,0);
 await assert.rejects(async()=>f.service.withResearchStudyTransaction(principal,'study-a','read',async()=>{},{lockTenant:'tenant-b'}),e=>e.status===400);assert.equal(f.events.length,0);
 f.state.account.authVersion=1;await assert.rejects(f.service.withResearchStudyTransaction(principal,'study-a','read',async()=>{throw Error('must not run');},{includeOfficial:true}),e=>e.status===401);assert.deepEqual(f.locks,['official','tenant-a']);
});
test('trusted official option uses the real native official namespace before the tenant namespace',async()=>{
 const {runtimeDependencies}=await import('../research-runtime/dependencies.mjs');const native=runtimeDependencies().load('common/worker-publication','lockAuthorizationMutation');
 const f=setup({},native);f.state.study={id:'study-a',tenant_id:'tenant-a',project_intent_id:'intent-a',execution_project_id:'execution-a',study_group_id:'group-a',hub_key:null,created_at:new Date()};f.state.account.role='tenant_admin';f.state.account.isTenantAdmin=true;
 await f.service.withResearchStudyTransaction(principal,'study-a','read',async()=>{},{includeOfficial:true});
 assert.deepEqual(f.sqlLocks.map(q=>q.values[0]),['wp01:official','wp01:tenant:tenant-a']);
 f.sqlLocks.length=0;await f.service.withResearchStudyTransaction(principal,'study-a','read',async()=>{});assert.deepEqual(f.sqlLocks.map(q=>q.values[0]),['wp01:tenant:tenant-a']);
});
