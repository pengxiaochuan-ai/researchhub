import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAcademicContentService} from './service.mjs';

function fixture(recordPublicVersion){
 const state={contents:[],versions:[],events:[],audits:[],locks:0},controls={admission:true,auditFailure:false,deploymentActive:true};
 const accounts=new Map([['admin',{id:'admin',tenantId:'tenant',role:'tenant_admin',isTenantAdmin:true,status:'active',authVersion:0,tenant:{status:'active'}}],['member',{id:'member',tenantId:'tenant',role:'researcher',isTenantAdmin:false,status:'active',authVersion:0,tenant:{status:'active'}}]]);
 const tx={account:{findFirst:async({where})=>{const a=accounts.get(where.id);return a&&a.tenantId===where.tenantId&&a.status==='active'&&a.tenant.status==='active'&&a.authVersion===where.authVersion?a:null;}},auditLog:{create:async x=>{if(controls.auditFailure)throw Error('AUDIT_FAILURE');state.audits.push(x.data);}},
 async $queryRawUnsafe(sql,...v){
  if(sql.startsWith('SELECT set_config'))return[];
  if(sql.includes('FROM public.tenant'))return controls.deploymentActive?[{id:'tenant'}]:[];
  if(sql.includes('FROM rh_admission.application'))return controls.admission?[{status:'approved'}]:[];
  if(sql.startsWith('INSERT INTO rh_academic.content')){const r={id:v[0],tenant_id:v[1],hub_key:v[2],draft:JSON.parse(v[3]),revision:1,status:'draft',published_version_id:null,published_audience:null,first_published_at:null,updated_at:v[4],created_at:v[4]};state.contents.push(r);return[{...r}];}
  if(sql.startsWith('SELECT * FROM rh_academic.content'))return state.contents.filter(r=>r.tenant_id===v[0]&&r.hub_key===v[1]&&r.id===v[2]).map(r=>({...r}));
  if(sql.startsWith('SELECT * FROM rh_academic.event'))return state.events.filter(r=>r.tenant_id===v[0]&&r.actor_id===v[1]&&r.request_key===v[2]);
  if(sql.startsWith('INSERT INTO rh_academic.version')){state.versions.push({id:v[0],content_id:v[1],tenant_id:v[2],hub_key:v[3],payload:JSON.parse(v[4]),published_at:v[5]});return[];}
  if(sql.startsWith('UPDATE rh_academic.content')){const r=state.contents.find(r=>r.id===v[0]&&r.tenant_id===v[1]&&r.hub_key===v[2]&&r.revision===v[3]);if(!r)return[];Object.assign(r,{draft:JSON.parse(v[4]),status:v[5],published_version_id:v[6],published_audience:v[7],first_published_at:v[8],updated_at:v[9],published_hash:v[10],revision:r.revision+1});return[{...r}];}
  if(sql.startsWith('INSERT INTO rh_academic.event')){state.events.push({id:v[0],content_id:v[1],tenant_id:v[2],hub_key:v[3],actor_id:v[4],action:v[6],base_revision:v[7],revision:v[8],request_key:v[9],request_hash:v[10],result:JSON.parse(v[11])});return[];}
  if(sql.startsWith('SELECT c.id AS "contentId"'))return state.contents.filter(c=>c.tenant_id===v[0]&&c.hub_key===v[1]&&c.status==='published').flatMap(c=>{const current=state.versions.find(x=>x.id===c.published_version_id);if(current?.payload.audience!=='public')return[];const first=state.versions.filter(x=>x.content_id===c.id&&x.tenant_id===c.tenant_id&&x.hub_key===c.hub_key&&x.payload.audience==='public').sort((a,b)=>a.published_at-b.published_at||a.id.localeCompare(b.id))[0];return[{contentId:c.id,title:current.payload.title,type:current.payload.type,summary:current.payload.summary,firstPublicAt:first.published_at,proofVersionId:first.id}];});
  if(sql.startsWith('SELECT v.*')){const c=state.contents.find(r=>r.id===v[2]&&r.tenant_id===v[0]&&r.hub_key===v[1]&&r.status==='published');const r=state.versions.find(r=>r.id===c?.published_version_id);return r&&(!sql.includes("v.payload->>'audience'='public'")||r.payload.audience==='public')?[{...r,first_published_at:c.first_published_at}]:[];}
  throw Error('Unhandled fixture query: '+sql);
 }};
 const service=createAcademicContentService({tenantId:'tenant',recordPublicVersion,transact:async fn=>{const copy=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,copy);throw e;}},lockAuthorization:async()=>state.locks++,now:()=>new Date('2026-11-18T00:00:00Z')});
 return{state,accounts,controls,service,admin:{accountId:'admin',tenantId:'tenant',authVersion:0},member:{accountId:'member',tenantId:'tenant',authVersion:0}};
}
const full={title:'科研动态',body:'正文',source:'原创内容',rights:'内容责任人确认可在所选范围发布',audience:'public',resources:[{label:'成员资料',url:'https://example.org/private',audience:'members',rights:'成员许可'},{label:'公开资料',url:'https://example.org/open',audience:'public',rights:'公开许可'}]};
test('only committed public publishing records evidence; retry replays the original receipt',async()=>{
 let writes=0;
 const {service,state,admin}=fixture(async(tx,scope,id)=>{
  assert.deepEqual(scope,{tenantId:'tenant',hubKey:'lingshu-xinyu'});
  assert(state.versions.some(v=>v.content_id===id&&v.payload.audience==='public'));
  if(++writes===1)throw Error('LEDGER_WRITE_FAILED');
 });
 const {content:{id}}=await service.create(admin,{requestKey:'new-draft',draft:{...full,audience:'members'}});
 await service.publish(admin,id,{requestKey:'members-version',baseRevision:1});
 assert.equal(writes,0);
 await service.save(admin,id,{requestKey:'make-public',baseRevision:2,draft:full});
 const command={requestKey:'public-version',baseRevision:3};
 await assert.rejects(service.publish(admin,id,command),/LEDGER_WRITE_FAILED/);
 assert.equal(state.versions.length,1);assert.equal(state.contents[0].published_audience,'members');
 const result=await service.publish(admin,id,command);
 assert.deepEqual(await service.publish(admin,id,command),result);assert.equal(writes,2);
});
test('draft publication is fixed, public strips members resources and old resource keys stop after update',async()=>{
 const {service:s,state,admin}=fixture();const c=await s.create(admin,{requestKey:'create-001',draft:full});assert.equal(c.content.status,'draft');await assert.rejects(s.detail(null,c.content.id),e=>e.status===404);
 const pub=await s.publish(admin,c.content.id,{requestKey:'publish-001',baseRevision:1});assert.equal(pub.content.status,'published');const visible=await s.detail(null,c.content.id);assert.equal(visible.resources.length,1);assert.equal(visible.resources[0].label,'公开资料');assert.equal(JSON.stringify(visible).includes('private'),false);
 const key=visible.resources[0].key;assert.equal((await s.resource(null,c.content.id,key)).url,'https://example.org/open');
 await s.save(admin,c.content.id,{requestKey:'save-001',baseRevision:2,draft:{...full,title:'修改草稿'}});assert.equal((await s.detail(null,c.content.id)).title,'科研动态');
 await s.publish(admin,c.content.id,{requestKey:'publish-002',baseRevision:3});await assert.rejects(s.resource(null,c.content.id,key),e=>e.status===404);
 await s.withdraw(admin,c.content.id,{requestKey:'withdraw-001',baseRevision:4,reason:'撤下核对'});await assert.rejects(s.detail(null,c.content.id),e=>e.status===404);assert.equal(state.audits.length,5);
});
test('current dual admin flags and membership are checked, receipts pin complete original input',async()=>{
 const {service:s,admin,member,accounts,state}=fixture();await assert.rejects(s.create(member,{requestKey:'create-001',draft:full}),e=>e.status===403);
 accounts.get('admin').isTenantAdmin=false;await assert.rejects(s.create(admin,{requestKey:'create-001',draft:full}),e=>e.status===403);accounts.get('admin').isTenantAdmin=true;
 const body={requestKey:'create-001',draft:full},a=await s.create(admin,body);assert.deepEqual(await s.create(admin,body),a);assert.equal(state.contents.length,1);
 await assert.rejects(s.create(admin,{...body,draft:{...full,title:'换内容'}}),e=>e.status===409);
 await s.publish(admin,a.content.id,{requestKey:'publish-001',baseRevision:1});await assert.rejects(s.save(admin,a.content.id,{requestKey:'save-stale',baseRevision:1,draft:full}),e=>e.status===409);
 const receipt=await s.operation(admin,a.content.id,'publish-001',{action:'publish',baseRevision:'1',requestHash:state.events[1].request_hash});assert.equal(receipt.state,'committed');
 await assert.rejects(s.operation(admin,a.content.id,'publish-001',{action:'publish',baseRevision:'1',requestHash:'0'.repeat(64)}),e=>e.status===409);
 accounts.get('admin').isTenantAdmin=false;await assert.rejects(s.operation(admin,a.content.id,'publish-001',{}),e=>e.status===403);
});
test('unknown writes are proved under current permission without a second mutation, and audit failure rolls back',async()=>{
 const {service:s,admin,state,controls}=fixture();const {mutationHash}=await import('./service.mjs');const body={requestKey:'unknown-create',draft:{title:'未提交草稿'}};
 const hash=mutationHash('create',null,body),proof={action:'create',baseRevision:'0',requestHash:hash};
 assert.equal((await s.operation(admin,null,body.requestKey,proof)).state,'unsubmitted');assert.equal(state.contents.length,0);
 const created=await s.create(admin,body);assert.equal((await s.operation(admin,null,body.requestKey,proof)).result.content.id,created.content.id);
 const save={requestKey:'unknown-save',baseRevision:1,draft:{title:'另一草稿'}},saveProof={action:'save',baseRevision:'1',requestHash:mutationHash('save',created.content.id,save)};
 assert.equal((await s.operation(admin,created.content.id,save.requestKey,saveProof)).state,'unsubmitted');
 await s.save(admin,created.content.id,{...save,requestKey:'other-save'});assert.equal((await s.operation(admin,created.content.id,save.requestKey,saveProof)).state,'superseded');
 assert.equal(state.contents[0].revision,2);assert.equal(state.events.length,2);
 controls.auditFailure=true;await assert.rejects(s.create(admin,{requestKey:'audit-fails',draft:{title:'回滚'}}),/AUDIT_FAILURE/);assert.equal(state.contents.length,1);assert.equal(state.events.length,2);assert.equal(state.audits.length,2);
});
test('pending, stale sessions, inactive actors and non-admin raw role flags cannot enter service operations',async()=>{
 const {service:s,admin,member,accounts,controls}=fixture();controls.admission=false;await assert.rejects(s.detail(member,'any'),e=>e.code==='HUB_ADMISSION_REQUIRED');controls.admission=true;await assert.rejects(s.create({...admin,authVersion:1},{requestKey:'stale-create',draft:full}),e=>e.status===401);
 accounts.get('admin').status='disabled';await assert.rejects(s.create(admin,{requestKey:'inactive-create',draft:full}),e=>e.status===401);
 accounts.get('admin').status='active';accounts.get('admin').role='researcher';await assert.rejects(s.adminDetail(admin,'any'),e=>e.status===403);
 await assert.rejects(s.detail({...member,tenantId:'foreign'},'any'),e=>e.status===401);
 await assert.rejects(s.list(null,{member:'true'}),e=>e.status===400);
 await assert.rejects(s.operation(member,null,'random-key',{action:'create',baseRevision:'0',requestHash:'a'.repeat(64)}),e=>e.status===403);
});

test('public activity uses first public version rather than first internal publication and projects no private history',async()=>{
 const {service:s,state,admin}=fixture();const c=await s.create(admin,{requestKey:'activity-create',draft:{...full,audience:'members',summary:'公开后摘要'}}),id=c.content.id;
 await s.publish(admin,id,{requestKey:'activity-internal',baseRevision:1});
 assert.deepEqual(await s.publicActivitySources(),[]);
 state.versions[0].published_at=new Date('2026-11-01T00:00:00Z');state.contents[0].first_published_at=new Date('2026-11-01T00:00:00Z');
 await s.save(admin,id,{requestKey:'activity-save',baseRevision:2,draft:{...full,summary:'公开摘要'}});
 await s.publish(admin,id,{requestKey:'activity-public',baseRevision:3});
 const rows=await s.publicActivitySources();assert.equal(rows.length,1);assert.equal(rows[0].firstPublicAt,'2026-11-18T00:00:00.000Z');assert.equal(rows[0].summary,'公开摘要');assert.match(rows[0].proofRef,/^academic-public-version:/);
 for(const forbidden of ['rights','resources','body','draft','actorId','publishedAudience'])assert.equal(forbidden in rows[0],false);
 await s.save(admin,id,{requestKey:'activity-new-draft',baseRevision:4,draft:{...full,title:'未公开的新标题'}});
 assert.equal((await s.publicActivitySources())[0].title,full.title);
 await s.withdraw(admin,id,{requestKey:'activity-withdraw',baseRevision:5,reason:'合成撤下'});assert.deepEqual(await s.publicActivitySources(),[]);
});
