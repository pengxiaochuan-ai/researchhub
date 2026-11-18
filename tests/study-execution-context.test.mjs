import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolPreparation,createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createPlatformAuth,presentIdentity} from '../src/platform-auth.js';
let identity;
try{identity=await import('../src/study-identity-scope.js');}catch{}
const requireIdentity=()=>assert.equal(typeof identity?.readStudyIdentityRoute,'function','strict Study identity route resolver must be implemented');
const plan={anchor:'enrollment',targetDayOffset:0,windowBeforeDays:1,windowAfterDays:2};
const protocol=(status,versionNumber=1)=>({id:'protocol-'+versionNumber,status,versionNumber,title:'合成方案'+versionNumber,visitPlans:[plan]});
const user={accountId:'actor',authVersion:2,displayName:'合成研究员',username:'synthetic@example.test',isTenantAdmin:false,studyGroups:[{id:'group',role:{name:'合成采集员'},researchProjects:[{id:'execution',roleKey:'researcher'}]}]};
const data={item:{study:{id:'study',studyGroupId:'group',executionProjectId:'execution',status:'active'}}};
const response=(value,status=200)=>({ok:status===200,status,json:async()=>structuredClone(value)});
const later=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

test('executing protocol is distinguished from approved without granting a collection capability',()=>{
 const value=protocolPreparation([protocol('draft',2),protocol('executing')]);
 assert.equal(value.status,'protocol_executing');assert.equal(value.label,'方案执行中');assert.equal(value.canStartCollection,false);assert.deepEqual(value.executingProtocol,{id:'protocol-1',versionNumber:1,title:'合成方案1'});assert(!value.message.includes('请完成研究启用核对'));
});
test('approved remains waiting activation and missing/unscheduled protocols never become execution-ready',()=>{
 assert.equal(protocolPreparation([protocol('approved')]).status,'protocol_approved');assert.equal(protocolPreparation([protocol('approved')]).label,'已批准，待启用');
 for(const input of [[],[protocol('draft')],[{...protocol('approved'),visitPlans:[{...plan,anchor:null}]}]]){const value=protocolPreparation(input);assert.equal(value.status,'protocol_required');assert.equal(value.canStartCollection,false);}
});
test('an executing flag with incomplete visit scheduling does not make a false ready claim',()=>{
 const value=protocolPreparation([{...protocol('executing'),visitPlans:[{...plan,windowAfterDays:null}]}]);assert.equal(value.status,'execution_needs_check');assert.equal(value.canStartCollection,false);assert.match(value.message,/核对/);
});
test('only the five exact real study routes request identity scope; invalid/foreign routes never resolve',()=>{
 requireIdentity();
 for(const[path,search]of [['/pages/s01/','?researchStudy=1&studyId=study'],['/pages/s03/','?formalSubjects=1&studyId=study'],['/pages/s04/','?formalSubjects=1&studyId=study&subjectId=subject'],['/pages/s05/','?formalCapture=1&studyId=study&assignmentId=assignment'],['/pages/s09/','?formalCapture=1&studyId=study&visitId=visit']])assert.equal(identity.readStudyIdentityRoute(path,search).studyId,'study');
 for(const[path,search]of [['/pages/s01/','?researchStudy=1&studyId=study&studyId=other'],['/pages/s09/','?formalCapture=1&studyId=study&unknown=1'],['/pages/s04/','?formalSubjects=1&studyId=study'],['/pages/s09/','?formalCapture=0&studyId=study']])assert.equal(identity.readStudyIdentityRoute(path,search).scopeStatus,'invalid');
 assert.equal(identity.readStudyIdentityRoute('/pages/p01/','?studyId=study'),null);assert.equal(identity.readStudyIdentityRoute('/pages/s01/','?studyGroupId=g&researchProjectId=p'),null);
});
test('current authorized Study parent chain resolves exact scope with GET only',async()=>{
 requireIdentity();const calls=[],scope=identity.readStudyIdentityRoute('/pages/s09/','?formalCapture=1&studyId=study&visitId=visit');
 const resolved=await identity.resolveStudyIdentityScope(user,scope,{fetchImpl:async(path,init)=>{calls.push({path,init});return response(data);}});
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/research-studies/study');assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(resolved.studyGroupId,'group');assert.equal(resolved.researchProjectId,'execution');assert.equal(presentIdentity(user,resolved).roleName,'合成采集员 · Study研究成员');
});
test('Study scope lookup never selects another project or fabricates project-manager membership',async()=>{
 requireIdentity();const scope=identity.readStudyIdentityRoute('/pages/s01/','?researchStudy=1&studyId=study');
 const resolved=await identity.resolveStudyIdentityScope(user,scope,{fetchImpl:async()=>response({item:{study:{...data.item.study,executionProjectId:'other'}}})});
 const shown=presentIdentity(user,resolved);assert(!shown.roleName.includes('项目管理员'));assert.equal(shown.roleName,'已登录 · 当前研究访问已核对');
 const admin=presentIdentity({...user,isTenantAdmin:true,studyGroups:[]},{...resolved,scopeStatus:'resolved'});assert.equal(admin.roleName,'租户管理员 · 当前研究');
});
test('scope403/404/network/malformed replies preserve login and give useful research-only status',async()=>{
 requireIdentity();const scope=identity.readStudyIdentityRoute('/pages/s09/','?formalCapture=1&studyId=study');
 for(const status of [403,404,503]){
  const resolved=await identity.resolveStudyIdentityScope(user,scope,{fetchImpl:async()=>response({message:'synthetic'},status)}),shown=presentIdentity(user,resolved);assert.equal(shown.authenticated,true);assert.match(shown.roleName,status===503?/研究授权暂不可核对/:/当前研究不可访问/);
 }
 for(const fetchImpl of [async()=>{throw Error('synthetic network');},async()=>response({item:{study:{...data.item.study,id:'other'}}})]){const resolved=await identity.resolveStudyIdentityScope(user,scope,{fetchImpl});assert.equal(presentIdentity(user,resolved).authenticated,true);assert.match(presentIdentity(user,resolved).roleName,/研究授权暂不可核对/);}
});
test('invalid scoped links trigger no identity request and do not imply Study authorization',async()=>{
 requireIdentity();const scope=identity.readStudyIdentityRoute('/pages/s09/','?formalCapture=1&studyId=study&unknown=1');const resolved=await identity.resolveStudyIdentityScope(user,scope,{fetchImpl:()=>assert.fail('invalid links must not request')});assert.match(presentIdentity(user,resolved).roleName,/研究链接待核对/);
});
test('auth presents verified current Study scope only after its asynchronous authorized parent read',async()=>{
 const gate=later(),states=[],scope={studyId:'study',routeKey:'/pages/s01/?researchStudy=1&studyId=study'};let reads=0;
 const auth=createPlatformAuth({client:{me:async()=>user},setUser:v=>states.push(v),readScope:()=>scope,resolveScope:async(_user,input)=>{reads++;assert.equal(input.studyId,'study');await gate.promise;return{...input,studyGroupId:'group',researchProjectId:'execution',scopeStatus:'resolved'};}});
 const refreshing=auth.refresh();await Promise.resolve();assert.equal(reads,1);assert.match(states.at(-1).roleName,/正在核对研究授权/);gate.resolve();await refreshing;assert.equal(states.at(-1).roleName,'合成采集员 · Study研究成员');auth.dispose();
});
test('late scope response cannot overwrite another account or a new authVersion',async()=>{
 for(const next of [{...user,accountId:'next',displayName:'新账号',authVersion:3},{...user,authVersion:3}]){
  const gate=later(),states=[];let me=user,n=0;const scope={studyId:'study',routeKey:'route'};
  const auth=createPlatformAuth({client:{me:async()=>me},setUser:v=>states.push(v),readScope:()=>scope,resolveScope:async(_u,input)=>{if(++n===1)await gate.promise;return{...input,studyGroupId:'group',researchProjectId:'execution',scopeStatus:'resolved'};}});
  const old=auth.refresh();await Promise.resolve();me=next;await auth.refresh();gate.resolve();await old;assert.equal(states.at(-1).id,next.accountId);assert.equal(states.at(-1).authVersion,3);auth.dispose();
 }
});
test('late scope response cannot publish for a changed URL or disposed owner',async()=>{
 const gate=later(),states=[];let scope={studyId:'study',routeKey:'before'};const auth=createPlatformAuth({client:{me:async()=>user},setUser:v=>states.push(v),readScope:()=>scope,resolveScope:async(_u,input)=>{await gate.promise;return{...input,studyGroupId:'group',researchProjectId:'execution',scopeStatus:'resolved'};}});
 const p=auth.refresh();await Promise.resolve();scope={studyId:'other',routeKey:'after'};const count=states.length;gate.resolve();await p;assert.equal(states.length,count);auth.dispose();
});

test('a scoped lookup failure is research-specific and never falsely expires a verified login',async()=>{
 requireIdentity();let expired=0;const states=[],scope=identity.readStudyIdentityRoute('/pages/s01/','?researchStudy=1&studyId=study');
 const auth=createPlatformAuth({client:{me:async()=>user},setUser:v=>states.push(v),readScope:()=>scope,resolveScope:(u,s)=>identity.resolveStudyIdentityScope(u,s,{fetchImpl:async()=>response({},403)}),onExpired:()=>expired++});
 await auth.refresh();assert.equal(states.at(-1).id,user.accountId);assert.equal(states.at(-1).authenticated,true);assert.match(states.at(-1).roleName,/当前研究不可访问/);assert.equal(expired,0);auth.dispose();
});
test('an administrator without group membership uses only the verified Study context, never a fabricated project role',async()=>{
 requireIdentity();const admin={...user,isTenantAdmin:true,studyGroups:[]},scope=identity.readStudyIdentityRoute('/pages/s09/','?formalCapture=1&studyId=study');
 const resolved=await identity.resolveStudyIdentityScope(admin,scope,{fetchImpl:async()=>response(data)});assert.equal(presentIdentity(admin,resolved).roleName,'租户管理员 · 当前研究');
});

test('an acceptance fixture cannot supply the official Study executing status',()=>{
 const value=protocolPreparation([{...protocol('executing'),acceptanceFixture:true},protocol('approved',2)]);assert.equal(value.status,'protocol_approved');assert.equal(value.executingProtocol,undefined);assert.equal(value.canStartCollection,false);
});

test('the actual overview reads only official protocol versions and does not mutate Study metadata or authorization',async()=>{
 const protocolRows=[{...protocol('executing'),acceptanceFixture:true},protocol('approved',2)],principal={accountId:'admin',tenantId:'tenant',authVersion:2},binding={id:'study',project_intent_id:'intent',execution_project_id:'execution',study_group_id:'group',created_at:new Date('2026-11-17T00:00:00Z')};let where;
 const tx={$queryRawUnsafe:async sql=>sql.startsWith('SELECT status FROM rh_admission')?[{status:'approved'}]:[],account:{findFirst:async()=>({id:'admin',tenantId:'tenant',authVersion:2,role:'tenant_admin',isTenantAdmin:true,status:'active',tenant:{status:'active'}})},researchProject:{findFirst:async()=>({id:'execution',name:'合成研究',status:'active'})},studyGroup:{findFirst:async()=>({id:'group',status:'active'})},researchProjectMembership:{findFirst:async()=>null,count:async()=>1},studyGroupMembership:{findFirst:async()=>null},subject:{count:async()=>2},studyTask:{count:async()=>0},studyProtocolVersion:{findMany:async query=>{where=query.where;return protocolRows.filter(p=>query.where.acceptanceFixture!==false||p.acceptanceFixture!==true);}},$queryRaw:async strings=>strings.join('').includes('study_binding')?[binding]:[]};
 const repository={setContext:async()=>{},roles:async()=>[],findIntent:async()=>({id:'intent'}),present:()=>({id:'intent',title:'合成课题'})};
 const service=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx)},scope:{product:'researchhub',allowedTenantIds:['tenant']},lockAuthorization:async()=>{},createResearchProject:()=>assert.fail('overview cannot create'),repository});
 const result=await service.overview(principal,'study');assert.equal(where.acceptanceFixture,false);assert.equal(result.item.counts.protocols,1);assert.equal(result.item.preparation.status,'protocol_approved');assert.equal(result.item.study.status,'active');assert.equal(result.item.preparation.canStartCollection,false);assert.equal(result.item.capabilities.canCollect,false);
});
