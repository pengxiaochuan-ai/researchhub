import test from 'node:test';import assert from 'node:assert/strict';
import {createDataAgentTargets} from './data-agent-targets.mjs';
const user={tenantId:'tenant',accountId:'owner',authVersion:2},source={...user,studyGroupId:'upload-group',researchProjectId:'upload-project'},ctx={tenantId:'tenant',studyId:'study',studyGroupId:'target-group',executionProjectId:'target-project',projectIntentId:'intent'};
function setup(){let denied=false,unavailable=false;const contexts=[];const tx={$queryRawUnsafe:async(_q,...args)=>{contexts.push(args);return[];}};const service=createDataAgentTargets({studies:{list:async()=>({items:[{title:'研究',study:{id:'study'}}],nextCursor:null}),withResearchStudyTransaction:async(_u,id,mode,run)=>{assert.equal(id,'study');assert.equal(mode,'read');return run(tx,ctx);}},sourceAccess:{transaction:async(_u,_s,run)=>run(tx,source),inTransaction:async(_t,_u,_s,run)=>run(tx,source)},authorizeIngest:async(_tx,u,g,p)=>{assert.equal(u.accountId,'owner');assert.equal(g,'target-group');assert.equal(p,'target-project');if(unavailable)throw Error('database unavailable');if(denied)throw Object.assign(Error('no upload permission'),{status:403});}});return{service,contexts,deny:()=>denied=true,fail:()=>unavailable=true};}
test('new conversations use current source ownership and native target rights, without first-project or old-session fallback',async()=>{
 const f=setup();assert.equal((await f.service.list(user,'new-conversation')).items[0].id,'study');
 await f.service.withTarget(user,'new-conversation','study',async(tx,binding)=>{assert.equal(binding.source.researchProjectId,'upload-project');assert.equal(binding.sourcePrincipal.researchProjectId,'upload-project');assert.equal(binding.target.executionProjectId,'target-project');assert.equal(binding.targetPrincipal.researchProjectId,'target-project');assert.equal(binding.targetPrincipal.accountId,user.accountId);assert.equal(binding.targetPrincipal.authVersion,user.authVersion);assert.equal(binding.source.sessionId,'new-conversation');assert(!('authorized' in binding));});
 assert(f.contexts.every(x=>x[0]==='target-group'&&x[1]==='target-project'));
});
test('Study read permission is not upload authority and outages never become an empty success',async()=>{
 const f=setup();f.deny();assert.deepEqual(await f.service.list(user,'new-session'),{items:[]});await assert.rejects(f.service.withTarget(user,'new-session','study',()=>assert.fail('write reached')));
 const g=setup();g.fail();await assert.rejects(g.service.list(user,'new-session'),/unavailable/);
});

test('invalid caller identity fails before any source or Study access',async()=>{
 const service=createDataAgentTargets({studies:{list:()=>assert.fail('list reached'),withResearchStudyTransaction:()=>assert.fail('Study reached')},sourceAccess:{transaction:()=>assert.fail('source reached'),inTransaction:()=>assert.fail('source reached')},authorizeIngest:()=>assert.fail('authority reached')});
 for(const invalid of [null,{}, {...user,tenantId:''},{...user,accountId:''},{...user,authVersion:undefined},{...user,authVersion:-1}]){
  await assert.rejects(service.list(invalid,'session'),{code:'DATA_AGENT_TARGET_REJECTED'});
  await assert.rejects(service.withTarget(invalid,'session','study',()=>assert.fail('operation reached')),{code:'DATA_AGENT_TARGET_REJECTED'});
 }
});

test('cross-tenant targets and a source whose owner or auth version changed never reach native writes',async()=>{
 for(const change of ['targetTenant','owner','authVersion','missingSource']){
  const restored=[],tx={$queryRawUnsafe:async(_q,...args)=>restored.push(args)};
  const service=createDataAgentTargets({studies:{list:async()=>({items:[],nextCursor:null}),withResearchStudyTransaction:async(_u,_id,_mode,run)=>run(tx,{...ctx,...(change==='targetTenant'?{tenantId:'other'}:{})})},sourceAccess:{transaction:async()=>{},inTransaction:async(_tx,_u,_sid,run)=>change==='missingSource'?undefined:run(tx,{...source,...(change==='owner'?{accountId:'other'}:change==='authVersion'?{authVersion:3}:{})})},authorizeIngest:()=>assert.fail('native authority reached')});
  await assert.rejects(service.withTarget(user,'session','study',()=>assert.fail('operation reached')),{code:'DATA_AGENT_TARGET_REJECTED'});
  assert.equal(restored.length,change==='targetTenant'?0:1);
 }
});

test('listing checks later pages and current source again for each target; cursor loops are rejected',async()=>{
 let sourceChecks=0,listed=0;const visited=[],tx={$queryRawUnsafe:async()=>{}};
 const service=createDataAgentTargets({studies:{list:async(_u,q)=>{listed++;return q.cursor?{items:[{title:'B',study:{id:'b'}},{title:'again',study:{id:'a'}}],nextCursor:null}:{items:[{title:'A',study:{id:'a'}}],nextCursor:'cursor-1'};},withResearchStudyTransaction:async(_u,id,_mode,run)=>{visited.push(id);return run(tx,{...ctx,studyId:id});}},sourceAccess:{transaction:async(_u,_sid,run)=>run(tx,source),inTransaction:async(_tx,_u,_sid,run)=>{sourceChecks++;return run(tx,source);}},authorizeIngest:async()=>{}});
 assert.deepEqual(await service.list(user,'new-session'),{items:[{id:'a',name:'A'},{id:'b',name:'B'}]});assert.equal(sourceChecks,2);assert.equal(listed,2);assert.deepEqual(visited,['a','b']);
 const loop=createDataAgentTargets({studies:{list:async()=>({items:[],nextCursor:'same'}),withResearchStudyTransaction:async()=>{}},sourceAccess:{transaction:async(_u,_sid,run)=>run(tx,source),inTransaction:async()=>{}},authorizeIngest:async()=>{}});
 await assert.rejects(loop.list(user,'session'),/DATA_AGENT_TARGET_CAPACITY/);
});

test('source revocation after initial check is an error, never a successful empty target list',async()=>{
 const tx={$queryRawUnsafe:async()=>{}},revoked=Object.assign(Error('revoked'),{status:403,code:'HUB_MATERIAL_ACCESS_REJECTED'});
 const service=createDataAgentTargets({studies:{list:async()=>({items:[{title:'A',study:{id:'study'}}],nextCursor:null}),withResearchStudyTransaction:async(_u,_id,_mode,run)=>run(tx,ctx)},sourceAccess:{transaction:async(_u,_sid,run)=>run(tx,source),inTransaction:async()=>{throw revoked;}},authorizeIngest:()=>assert.fail('authority reached')});
 await assert.rejects(service.list(user,'session'),{status:403,code:'HUB_MATERIAL_ACCESS_REJECTED'});
});
