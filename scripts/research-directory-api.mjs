// Explicit synthetic-only acceptance. Direct database probes are read-only; no fixture/role writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {visibleProjects} from './my-research-overview.mjs';

const base='http://127.0.0.1:19501';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function validatePage(page){
 assert(page&&Array.isArray(page.items)&&Number.isSafeInteger(page.total)&&page.total>=0);
 assert(page.nextCursor===null||typeof page.nextCursor==='string');assert.equal(typeof page.capabilities?.canCreateProject,'boolean');
 for(const item of page.items){assert(['intent','execution'].includes(item.kind));assert.equal(typeof item.key,'string');assert.equal(typeof item.title,'string');assert.equal(typeof item.summary,'string');assert(Array.from(item.summary).length<=160);assert(Number.isFinite(Date.parse(item.updatedAt)));assert.equal(typeof item.capabilities?.canEdit,'boolean');assert.equal(typeof item.capabilities?.canOpenStudy,'boolean');
  for(const link of Object.values(item.links??{})){const url=new URL(link,base);assert.equal(url.origin,base);assert(link.startsWith('/pages/'));assert(!url.hash);}
  assert(item.links?.primary);if(item.kind==='execution'){assert.equal(item.intentId,undefined);assert.equal(item.studyId,undefined);}
 }
 return page;
}
function primaryApi(item){
 const url=new URL(item.links.primary,base),params=url.searchParams;
 if(url.pathname==='/pages/q01/'&&params.get('researchCreation')==='1'&&params.get('projectIntentId')===item.intentId)return'/research-projects/'+encodeURIComponent(item.intentId);
 if(url.pathname==='/pages/s01/'&&params.get('researchStudy')==='1'&&params.get('studyId')===item.studyId)return'/research-studies/'+encodeURIComponent(item.studyId);
 if(url.pathname==='/pages/s01/'&&params.get('studyGroupId')===item.studyGroupId&&params.get('researchProjectId')===item.executionProjectId)return'/research-directory/execution/'+encodeURIComponent(item.executionProjectId)+'?'+new URLSearchParams({studyGroupId:item.studyGroupId});
 throw Error('DIRECTORY_PRIMARY_LINK_UNSUPPORTED');
}
function offlineCheck(){
 const item={key:'execution:p1',kind:'execution',id:'p1',title:'既有受邀研究',summary:'可见简介',status:'active',updatedAt:'2026-11-11T00:00:00.000Z',studyGroupId:'g1',executionProjectId:'p1',links:{primary:'/pages/s01/?studyGroupId=g1&researchProjectId=p1'},capabilities:{canEdit:false,canOpenStudy:true}};
 validatePage({items:[item],total:1,nextCursor:null,capabilities:{canCreateProject:true}});assert.equal(primaryApi(item),'/research-directory/execution/p1?studyGroupId=g1');
 assert.throws(()=>validatePage({items:[{...item,summary:'字'.repeat(161)}],total:1,nextCursor:null,capabilities:{canCreateProject:true}}));
 assert.throws(()=>validatePage({items:[{...item,links:{primary:'https://other.invalid/pages/s01/'}}],total:1,nextCursor:null,capabilities:{canCreateProject:true}}));
 console.log(JSON.stringify({ready:true,offline:true,networkRequests:0,databaseConnections:0,checks:['directory_contract','same_origin_openable_route_mapping','summary_limit','external_link_rejected']}));
}
async function runAcceptance(){
 const out=workspaceRoot+'researchhub/docs/testing/evidence/research-directory-unification-2026-11-11/';mkdirSync(out,{recursive:true});
 const checks=[],network=[],roles={},cookies=new Map();let stage='guard';
 const save=value=>writeFileSync(out+'api.json',JSON.stringify(value,null,2));
 try{
  const env=fixtureEnvironment();await assertFixtureTarget(env);
  const stateFile=workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json',stateBytes=readFileSync(stateFile,'utf8'),state=JSON.parse(stateBytes);
  assert(state.ready);assert.match(state.key,/^rh-kb-local-[a-f0-9]{8}$/);for(const value of Object.values(state.ids))assert.equal(typeof value,'string');
  const [registered]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${state.key}`,{readOnly:true});
  assert.equal(registered?.manifest?.purpose,'ResearchHub-local-knowledge-standing');assert.equal(registered.manifest.syntheticOnly,true);assert.deepEqual(registered.manifest.ids,state.ids);
  const snapshot=()=>withFixtureTransaction(env,'direct',async db=>({
   projects:await db.researchProject.findMany({where:{tenantId:state.ids.tenant},select:{id:true,studyGroupId:true,name:true,description:true,status:true,createdBy:true,updatedAt:true},orderBy:{id:'asc'}}),
   roles:await db.permissionRole.findMany({where:{tenantId:state.ids.tenant},select:{id:true,status:true,menuPermissions:true,buttonPermissions:true,dataScope:true},orderBy:{id:'asc'}}),
   groupMembers:await db.studyGroupMembership.findMany({where:{tenantId:state.ids.tenant},select:{id:true,studyGroupId:true,accountId:true,roleId:true,status:true},orderBy:{id:'asc'}}),
   projectMembers:await db.researchProjectMembership.findMany({where:{tenantId:state.ids.tenant},select:{id:true,studyGroupId:true,researchProjectId:true,accountId:true,roleKey:true,status:true},orderBy:{id:'asc'}}),
   intents:await db.$queryRaw`SELECT id,owner_id,title,question,pico,hub_key,status,version,updated_at FROM rh_research.project_intent WHERE tenant_id=${state.ids.tenant} ORDER BY id`,
   bindings:await db.$queryRaw`SELECT * FROM rh_research.study_binding WHERE tenant_id=${state.ids.tenant} ORDER BY id`,
   hubRoles:await db.$queryRaw`SELECT * FROM rh_research.hub_role WHERE tenant_id=${state.ids.tenant} ORDER BY hub_key,account_id`
  }),{readOnly:true});
  const beforeHash=hash(await snapshot());checks.push('guarded_synthetic_database_and_existing_standing_runtime_identity');
  async function request(role,path,status=200){const response=await fetch(base+'/api'+path,{headers:{Accept:'application/json',Cookie:cookies.get(role)??'','x-study-group-id':state.ids.group,'x-research-project-id':state.ids.project},redirect:'error',signal:AbortSignal.timeout(20000)});network.push({role,path,method:'GET',status:response.status,at:new Date().toISOString()});const body=await response.json();assert.equal(response.status,status,JSON.stringify({role,path,expected:status,actual:response.status,code:body.code}));return body;}
  async function login(role){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:state.ids.tenant,username:role+'@example.org',password:state.password}),redirect:'error',signal:AbortSignal.timeout(20000)});network.push({role,path:'/auth/login',method:'POST',status:response.status,at:new Date().toISOString()});assert.equal(response.status,201,'SYNTHETIC_LOGIN_'+role);cookies.set(role,response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; '));assert.equal((await response.json()).user.accountId,state.ids[role]);}
  async function allPages(role,{limit=20,q}={}){let cursor=null,total,iterations=0;const items=[],seen=new Set();do{assert(++iterations<=1000,'DIRECTORY_PAGINATION_DID_NOT_FINISH');const query=new URLSearchParams({limit:String(limit),...(q!==undefined?{q}:{}),...(cursor?{cursor}:{})}),page=validatePage(await request(role,'/research-directory?'+query));total??=page.total;assert.equal(page.total,total,'DIRECTORY_TOTAL_CHANGED_DURING_READ');assert(page.items.length<=limit);items.push(...page.items);cursor=page.nextCursor;if(cursor){assert(!seen.has(cursor),'DIRECTORY_CURSOR_REPEATED');seen.add(cursor);}}while(cursor);assert.equal(items.length,total);assert.equal(new Set(items.map(i=>i.key)).size,total);for(let i=1;i<items.length;i++)assert(Date.parse(items[i-1].updatedAt)>=Date.parse(items[i].updatedAt));return{items,total};}
  stage='http';for(const role of ['owner','admin','viewer'])await login(role);
  await request('anonymous','/research-directory',401);
  const legacyBefore={};
  for(const role of ['owner','admin','viewer']){
   const overview=await request(role,'/my-research/overview');legacyBefore[role]=overview;
   assert(Array.isArray(overview.studyGroups));assert(Array.isArray(overview.drafts));assert(Array.isArray(overview.tasks));assert(Number.isSafeInteger(overview.summary.projectCount));
   const expectedLegacy=await withFixtureTransaction(env,'direct',async db=>{
    const [groups,memberships]=await Promise.all([
     db.studyGroupMembership.findMany({where:{tenantId:state.ids.tenant,accountId:state.ids[role],status:'active'},include:{studyGroup:true,role:true}}),
     db.researchProjectMembership.findMany({where:{tenantId:state.ids.tenant,accountId:state.ids[role],status:'active'},include:{researchProject:true}})
    ]);return visibleProjects(groups,memberships,state.ids.tenant).flatMap(g=>g.projects.map(p=>p.id)).sort();
   },{readOnly:true});
   const legacyIds=overview.studyGroups.flatMap(g=>g.projects.map(p=>p.id));assert.deepEqual([...legacyIds].sort(),expectedLegacy);assert.equal(overview.summary.projectCount,expectedLegacy.length);
   const full=await allPages(role),preview=validatePage(await request(role,'/research-directory?limit=5'));
   assert.equal(preview.total,full.total);assert.deepEqual(preview.items,full.items.slice(0,5));assert.equal(preview.capabilities.canCreateProject,true);
   for(const id of expectedLegacy)assert(full.items.some(item=>item.executionProjectId===id),'LEGACY_INVITED_PROJECT_DROPPED');
   const fullContent=new Map();for(const item of full.items){const primary=primaryApi(item),detail=await request(role,primary);if(primary.startsWith('/research-directory/execution/')){assert.equal(detail.project.id,item.executionProjectId);assert.equal(detail.group.id,item.studyGroupId);assert.equal(typeof detail.project.canOpenDesignWorkspace,'boolean');assert(!Object.hasOwn(detail,'counts'));const old=overview.studyGroups.flatMap(g=>g.projects).find(p=>p.id===item.executionProjectId);if(old?.canOpenDesignWorkspace)assert.equal(detail.project.canOpenDesignWorkspace,true,'EXISTING_DESIGN_HINT_LOST');fullContent.set(item.key,detail.project.description??'');}
    else if(primary.startsWith('/research-studies/')){assert.equal(detail.item.study.id,item.studyId);fullContent.set(item.key,detail.item.project.question??'');}
    else{assert.equal(detail.item.id,item.intentId);fullContent.set(item.key,detail.item.question??'');}
    if(item.kind==='intent'&&primary.startsWith('/research-directory/execution/')){const intent=await request(role,'/research-projects/'+encodeURIComponent(item.intentId));fullContent.set(item.key,intent.item.question??'');}
   }
   let searchTerm=null,searchCount=0;if(full.items.length){const target=full.items.at(-1);searchTerm=Array.from(target.title.trim()).slice(0,32).join('');assert(searchTerm);const searched=await allPages(role,{limit:5,q:searchTerm});assert(searched.items.some(i=>i.key===target.key),'SEARCH_DID_NOT_FIND_ITEM_OUTSIDE_PREVIEW');const expected=full.items.filter(item=>(item.title+' '+(fullContent.get(item.key)??item.summary)).toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()));assert.deepEqual(searched.items.map(i=>i.key),expected.map(i=>i.key));searchCount=searched.total;}
   roles[role]={total:full.total,previewKeys:preview.items.map(i=>i.key),allKeys:full.items.map(i=>i.key),legacyProjectIds:expectedLegacy,primaryRoutesVerified:full.items.length,search:{performed:searchTerm!==null,matched:searchCount,targetOutsidePreview:full.items.length>5}};
   if(role==='owner'&&preview.nextCursor){await request(role,'/research-directory?'+new URLSearchParams({cursor:preview.nextCursor,q:'changed-search'}),400);await request('viewer','/research-directory?'+new URLSearchParams({cursor:preview.nextCursor}),400);}
  }
  checks.push('owner_admin_viewer_exact_total_all_pages_no_duplicates_preview_is_full_list_prefix');
  checks.push('all_existing_historical_and_invited_projects_preserved_and_every_primary_route_opens');
  checks.push('server_search_across_full_scope_including_beyond_first_five');
  checks.push('legacy_execution_detail_metadata_and_existing_design_hint_preserved');
  for(const query of [{limit:'0'},{limit:'101'},{q:'x'.repeat(201)},{cursor:'!invalid'},{accountId:state.ids.admin}])await request('owner','/research-directory?'+new URLSearchParams(query),400);
  await request('owner','/research-directory/execution/'+encodeURIComponent(state.ids.project)+'?'+new URLSearchParams({studyGroupId:'nonexistent-group'}),404);
  const foreign=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-creation/rh-create-39ca8c05/accepted.json')).project.study;
  await request('owner','/research-directory/execution/'+encodeURIComponent(foreign.executionProjectId)+'?'+new URLSearchParams({studyGroupId:foreign.studyGroupId}),404);
  checks.push('unauthenticated_scope_cursor_actor_query_and_foreign_execution_denials');
  for(const role of ['owner','admin','viewer'])assert.deepEqual(await request(role,'/my-research/overview'),legacyBefore[role],'OLD_OVERVIEW_CONTRACT_OR_CONTENT_CHANGED');
  assert.equal(hash(await snapshot()),beforeHash,'BUSINESS_DATA_OR_ROLES_CHANGED');assert.equal(hash(readFileSync(stateFile,'utf8')),hash(stateBytes),'STANDING_RUNTIME_CONFIGURATION_CHANGED');
  checks.push('old_overview_full_study_groups_summary_tasks_drafts_and_business_state_unchanged');
  save({passed:true,at:new Date().toISOString(),syntheticOnly:true,base,checks,roles,network,directDatabaseMode:'read-only',businessMutations:0,roleChanges:0,modelCalls:0,production:false,professionalAcceptance:false});
  console.log(JSON.stringify({passed:true,checks,totals:Object.fromEntries(Object.entries(roles).map(([role,value])=>[role,value.total])),evidence:out+'api.json'}));
 }catch(error){const safe=String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,1200);save({passed:false,at:new Date().toISOString(),syntheticOnly:true,base,stage,checks,roles,network,error:{type:error.constructor.name,code:error.code,message:safe},directDatabaseMode:'read-only',businessMutations:0,roleChanges:0,modelCalls:0});console.error(JSON.stringify({passed:false,stage,message:safe,evidence:out+'api.json'}));process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length===3&&process.argv[2]==='--offline-check')offlineCheck();
 else{assert.deepEqual(process.argv.slice(2),['--local-synthetic']);await runAcceptance();}
}
