import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const api=await import('./conversation-commands.mjs').catch(()=>({}));
const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);const db=fixtureClient(env.WP01_TEST_DIRECT_URL);after(()=>db.$disconnect());
const {ids}=JSON.parse(readFileSync('/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/runtime.json'));
const user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,role:'researcher',authVersion:1};
const accountScope=u=>({tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId});
async function setup(){
 assert.equal(typeof api.createConversationCommands,'function','persistent conversation commands are not implemented');
 const sid='rh-aiq-'+randomUUID(),scheduled=[];let revoked=false;
 await db.session.create({data:{id:sid,...accountScope(user),agentId:ids.tenant+'-kb-research',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID(),channel:'knowledge'}});
 const options={tenantId:ids.tenant,transaction:(fn)=>db.$transaction(fn),authorize:async(tx,u,id)=>{
  const row=await tx.session.findFirst({where:{...accountScope(u),id}});if(!row||revoked)throw Object.assign(Error('denied'),{status:403});return u;
 },stage:async(_tx,_u,job)=>({...job.payload,testStage:true}),schedule:async(u,sid,input)=>scheduled.push({u,sid,input})};
 const commands=api.createConversationCommands(options);return{sid,commands,scheduled,options,revoke:()=>{revoked=true;}};
}
const input=text=>({text,requestKey:'rh-aiq-'+randomUUID(),kbIds:[]});
const job=id=>db.knowledgeChatJob.findFirst({where:{userMessageId:id}});
test('network consent is frozen for idempotency, edit, revisions and actual queued job payload',async()=>{
 const h=await setup(),on={schema:'hub-network-intent.v1',enabled:true},off={schema:'hub-network-intent.v1',enabled:false};
 const body={...input('查找公开医学指南'),networkIntent:on},a=await h.commands.submit(user,h.sid,body);
 assert.deepEqual(a.networkIntent,on);assert.deepEqual((await h.commands.submit(user,h.sid,body)).networkIntent,on);
 await assert.rejects(h.commands.submit(user,h.sid,{...body,networkIntent:off}),e=>e.status===409);
 const edited=await h.commands.edit(user,h.sid,a.id,{text:'查找公开科研指南',version:a.version});assert.deepEqual(edited.networkIntent,on);
 const message=await db.message.findUnique({where:{id:a.id}});assert.deepEqual(message.meta.hubCommand.revisions[0].networkIntent,on);
 await h.commands.tick(user,h.sid);assert.deepEqual((await job(a.id)).payload.networkIntent,on);
 const b=await h.commands.submit(user,h.sid,input('仅依据Hub资料'));assert.deepEqual(b.networkIntent,off);
});
test('new questions persist last activity and original first titles across history reload; retries do not retouch time',async()=>{
 const {hubHistoryQuery,projectHubHistory}=await import('../../scripts/hub-conversation-history.mjs');
 const h=await setup(),old=new Date('2026-09-01T00:00:00Z');
 await db.session.update({where:{id:h.sid},data:{updatedAt:old}});
 const body=input('首次输入的完整科研问题'),a=await h.commands.submit(user,h.sid,body);
 const query=hubHistoryQuery(user,ids.tenant+'-kb-research');query.where.id=h.sid;
 const reloaded=projectHubHistory((await db.session.findMany(query))[0]);
 assert.equal(new Date(reloaded.updatedAt).getTime(),new Date(a.createdAt).getTime());
 assert.equal(reloaded.title,body.text);assert.equal(reloaded.hasPrompt,true);
 await h.commands.edit(user,h.sid,a.id,{text:'编辑后的科研问题',version:a.version});
 assert.equal(projectHubHistory((await db.session.findMany(query))[0]).title,body.text);
 await h.commands.submit(user,h.sid,body);
 assert.equal((await db.session.findUnique({where:{id:h.sid}})).updatedAt.getTime(),new Date(a.createdAt).getTime());
 const other=hubHistoryQuery({...user,accountId:ids.admin},ids.tenant+'-kb-research');other.where.id=h.sid;
 assert.equal((await db.session.findMany(other)).length,0);assert.equal(await job(a.id),null);
});
test('clarification preserves the editable question without blocking a later clear question, including legacy pauses',async()=>{
 for(const legacy of [false,true]){
  const h=await setup(),commands=api.createConversationCommands({...h.options,stage:async(_tx,_u,j)=>{
   if(j.text==='含义不明确的问题')throw Object.assign(Error('clarify'),{code:'HUB_SKILL_CLARIFICATION',status:422,publicMessage:'请补充研究问题。'});return j.payload;
  }});
  const a=await commands.submit(user,h.sid,input('含义不明确的问题'));await commands.tick(user,h.sid);
  if(legacy){const m=await db.message.findUnique({where:{id:a.id}});const {pauseCode,...c}=m.meta.hubCommand;await db.message.update({where:{id:a.id},data:{meta:{...m.meta,hubCommand:c}}});}
  const b=await commands.submit(user,h.sid,input('检索针灸治疗抑郁'));await commands.tick(user,h.sid);
  assert.equal((await job(b.id))?.status,'queued');assert.equal(await job(a.id),null);
  const view=await commands.list(user,h.sid);assert.equal(view.items.find(i=>i.id===a.id).pauseCode,'HUB_SKILL_CLARIFICATION');assert.equal(view.paused,false);
  const pending=view.items.find(i=>i.id===a.id);await commands.cancel(user,h.sid,a.id,{version:pending.version});
 }
});
test('a quota or authorization pause continues to stop later questions',async()=>{
 const h=await setup(),commands=api.createConversationCommands({...h.options,stage:async()=>{throw Object.assign(Error('quota'),{code:'QUOTA_BLOCKED',status:403});}});
 await commands.submit(user,h.sid,input('检索针灸治疗抑郁'));await commands.tick(user,h.sid);
 const b=await commands.submit(user,h.sid,input('检索针灸治疗失眠'));await commands.tick(user,h.sid);
 assert.equal(await job(b.id),null);assert.equal((await commands.list(user,h.sid)).paused,true);
});
test('an untyped legacy pause which now prepares successfully remains paused, never implicitly resumed',async()=>{
 const h=await setup(),a=await h.commands.submit(user,h.sid,input('原暂停问题'));
 const m=await db.message.findUnique({where:{id:a.id}});await db.message.update({where:{id:m.id},data:{meta:{...m.meta,hubCommand:{...m.meta.hubCommand,status:'paused'}}}});
 const b=await h.commands.submit(user,h.sid,input('检索针灸治疗抑郁'));await h.commands.tick(user,h.sid);
 assert.equal(await job(a.id),null);assert.equal(await job(b.id),null);assert.equal((await h.commands.list(user,h.sid)).paused,true);
});
test('editing a clarification to a clear question restores normal dispatch and failure barriers still apply',async()=>{
 const h=await setup(),commands=api.createConversationCommands({...h.options,stage:async(_tx,_u,j)=>{if(j.text==='模糊问题')throw Object.assign(Error('clarify'),{code:'HUB_SKILL_CLARIFICATION',status:422});return j.payload;}});
 const a=await commands.submit(user,h.sid,input('模糊问题'));await commands.tick(user,h.sid);
 const current=(await commands.list(user,h.sid)).items.find(i=>i.id===a.id);await commands.edit(user,h.sid,a.id,{text:'检索针灸治疗抑郁',version:current.version});await commands.tick(user,h.sid);
 assert.equal((await job(a.id)).status,'queued');await db.knowledgeChatJob.update({where:{id:(await job(a.id)).id},data:{status:'failed'}});
 const b=await commands.submit(user,h.sid,input('模糊问题')),c=await commands.submit(user,h.sid,input('检索针灸治疗失眠'));await commands.tick(user,h.sid);
 assert.equal(await job(b.id),null);assert.equal(await job(c.id),null);assert.equal((await commands.list(user,h.sid)).paused,true);
});
test('scanner advances beyond a full page of blocked sessions instead of starving newer sessions',async()=>{
 assert.equal(typeof api.createCommandScanner,'function');const visited=[],pages=[[{id:'a',sessionId:'blocked'},{id:'b',sessionId:'blocked'}],[{id:'c',sessionId:'fresh'}],[]],cursors=[];
 const scan=api.createCommandScanner({readPage:async cursor=>{cursors.push(cursor);return pages.shift();},processSession:async m=>{visited.push(m.sessionId);if(m.sessionId==='blocked')throw Error('revoked');}});
 await scan();await scan();assert.deepEqual(visited,['blocked','fresh']);assert.deepEqual(cursors,[null,'b']);
});
test('actual PG cursor query reaches the third session after 200 paused command records',async()=>{
 assert.equal(typeof api.commandScanQuery,'function');const consumer='isolated-fairness-'+randomUUID(),prefix='rh-aiq-scan-'+randomUUID(),sessions=[];
 for(let n=0;n<3;n++){const sid=prefix+'-session-'+n;sessions.push(sid);await db.session.create({data:{id:sid,...accountScope(user),agentId:ids.tenant+'-kb-research',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID(),channel:'knowledge',title:'合成队列公平扫描验证'}});}
 await db.message.createMany({data:Array.from({length:201},(_,n)=>({id:prefix+'-'+String(n).padStart(3,'0'),tenantId:ids.tenant,sessionId:sessions[n<100?0:n<200?1:2],role:'user',content:'合成公平扫描夹具，不是科研任务',meta:{hubCommand:{schema:api.COMMAND_SCHEMA,consumerKey:consumer,status:'paused'}}}))});
 const visited=[];const scan=api.createCommandScanner({readPage:cursor=>db.message.findMany(api.commandScanQuery(ids.tenant,consumer,cursor)),processSession:async m=>{visited.push(m.sessionId);throw Error('synthetic paused');}});
 await scan();await scan();assert(visited.includes(sessions[2]));
});
test('persistent FIFO waits for actual success, edits by CAS, cancels softly and survives new service instance',async()=>{
 const h=await setup(),a=await h.commands.submit(user,h.sid,input('检索针灸治疗抑郁'));
 const b=await h.commands.submit(user,h.sid,input('比较上述两篇论文'));
 assert.equal(a.status,'waiting');assert.equal((await h.commands.list(user,h.sid)).items.length,2);
 await h.commands.tick(user,h.sid);assert.equal(h.scheduled.length,1);
 assert.equal((await job(a.id)).status,'queued');
 await h.commands.tick(user,h.sid);assert.equal(h.scheduled.length,2,'queued dispatch can be safely awakened again but no new task is created');
 assert.equal(await job(b.id),null);
 await assert.rejects(h.commands.edit(user,h.sid,a.id,{text:'不能改已派发',version:a.version}),e=>e.status===409);
 const changed=await h.commands.edit(user,h.sid,b.id,{text:'解读上述第一篇论文',version:b.version});assert.equal(changed.version,b.version+1);
 await assert.rejects(h.commands.edit(user,h.sid,b.id,{text:'陈旧编辑',version:b.version}),e=>e.status===409);
 const c=await h.commands.submit(user,h.sid,input('仅依据已审核资料，针灸治疗失眠研究有哪些局限？'));
 await h.commands.cancel(user,h.sid,c.id,{version:c.version});assert.equal((await db.message.findUnique({where:{id:c.id}})).meta.hubCommand.status,'cancelled');assert.equal(await job(c.id),null);
 const recovered=api.createConversationCommands(h.options);assert.equal((await recovered.list(user,h.sid)).items.find(i=>i.id===b.id).text,'解读上述第一篇论文');
 await db.knowledgeChatJob.update({where:{id:(await job(a.id)).id},data:{status:'completed'}});await recovered.tick(user,h.sid);
 assert.equal((await job(b.id)).status,'queued');assert.equal(await job(c.id),null);
});
test('failed predecessor pauses without scheduling; explicit resume does not retry the failed task',async()=>{
 const h=await setup(),a=await h.commands.submit(user,h.sid,input('检索针灸治疗抑郁')),b=await h.commands.submit(user,h.sid,input('比较上述两篇论文'));
 await h.commands.tick(user,h.sid);await db.knowledgeChatJob.update({where:{id:(await job(a.id)).id},data:{status:'failed',errorCode:'TEST_KNOWN_FAILURE'}});
 const n=h.scheduled.length;await h.commands.tick(user,h.sid);
 assert.equal((await h.commands.list(user,h.sid)).paused,true);assert.equal(h.scheduled.length,n);
 await h.commands.resume(user,h.sid);await h.commands.tick(user,h.sid);
 assert.equal((await job(a.id)).status,'failed');assert.equal((await job(b.id)).status,'queued');
});
test('idempotent submission, owner isolation, current authorization and concurrent edit conflict are enforced',async()=>{
 const h=await setup(),body=input('检索针灸治疗抑郁'),a=await h.commands.submit(user,h.sid,body);
 assert.equal((await h.commands.submit(user,h.sid,body)).id,a.id);
 await assert.rejects(h.commands.submit(user,h.sid,{...body,text:'改用另一个问题'}),e=>e.status===409);
 await assert.rejects(h.commands.list({...user,accountId:ids.admin},h.sid),e=>e.status===403);
 const races=await Promise.allSettled([h.commands.edit(user,h.sid,a.id,{text:'检索针灸治疗失眠',version:a.version}),h.commands.edit(user,h.sid,a.id,{text:'检索电针治疗焦虑',version:a.version})]);
 assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
 h.revoke();await assert.rejects(h.commands.tick(user,h.sid));assert.equal(h.scheduled.length,0);
});
