import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./research-data-import-access.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const user={tenantId:'t',accountId:'owner',authVersion:5},source={sessionId:'session',studyGroupId:'sg',researchProjectId:'source'},target={studyId:'study',studyGroupId:'sg',executionProjectId:'target'},grant={id:'grant',version:1,account_id:'owner',status:'active',expires_at:new Date(Date.now()+60000),capabilities:['profile.create','visit.import','result.read'],objects:{subjectIds:[],visitIds:[]}};
function setup(){const events=[],tx={$queryRawUnsafe:async(sql,...values)=>{events.push({sql,values});if(sql.includes('study_binding'))return[{id:'study'}];if(sql.includes('research_data_import_access'))return[grant];if(sql.includes('research_data_imports'))return[];return[];}};return{events,tx,auth:api.createResearchDataImportAccess({authorizeRead:async()=>{events.push({nativeRead:true});return{...user,role:'researcher',isTenantAdmin:false};}})};}
test('scoped import authorization preserves native current read/feature checks and binds source, Study and expiry',async()=>{
 assert.equal(typeof api.createResearchDataImportAccess,'function');const {auth,tx,events}=setup();const current=await auth.currentInTx(tx,user,target,source,{scopeKey:'round',capability:'profile.create'});
 assert.equal(current.actor.accountId,'owner');assert.deepEqual(current.permissionRef,{kind:'study_grant',id:'grant',version:1});assert(events[0].nativeRead);assert(events.some(e=>e.values?.includes(source.sessionId)&&e.values?.includes(target.studyId)));
});
test('self scope is insufficient for history: an existing object must be in this round receipts or registered objects',async()=>{
 assert.equal(typeof api.createResearchDataImportAccess,'function');const {auth,tx}=setup();await assert.rejects(auth.currentInTx(tx,user,target,source,{scopeKey:'round',capability:'visit.import',subjectId:'old-self',visitId:'old-visit'}),e=>e.code==='DATA_IMPORT_OBJECT_FORBIDDEN');
});
test('expired, revoked, unknown capability or stale grant version does not authorize import',async()=>{
 assert.equal(typeof api.createResearchDataImportAccess,'function');for(const options of [{scopeKey:'round',capability:'form.fill'},{scopeKey:'round',capability:'profile.create',permissionRef:{kind:'study_grant',id:'grant',version:2}}]){const {auth,tx}=setup();await assert.rejects(auth.currentInTx(tx,user,target,source,options));}
 const original=grant.expires_at;grant.expires_at=new Date(0);try{const {auth,tx}=setup();await assert.rejects(auth.currentInTx(tx,user,target,source,{scopeKey:'round',capability:'profile.create'}));}finally{grant.expires_at=original;}
});
