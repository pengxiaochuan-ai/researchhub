import test,{after} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createConversationCommands} from '../server/ai-agent/conversation-commands.mjs';
const root='/Users/mac/aisciencesys/',require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {KnowledgeChatQueueService}=require(root+'app/server/src/sessions/knowledge-chat-queue.service.ts');
const {parseDeploymentScope}=require(root+'app/server/src/common/deployment-scope.ts');
const {withWorkerPublication}=require(root+'app/server/src/common/worker-publication.ts');
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');await assertFixtureTarget(env);const db=fixtureClient(env.WP01_TEST_DIRECT_URL);after(()=>db.$disconnect());
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const scope=parseDeploymentScope({DEPLOYMENT_ID:'rh-command-worker-check',DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:ids.tenant,DEFAULT_TENANT_ID:ids.tenant,ENABLED_WORKER_KINDS:'knowledge-chat'});
const u={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,role:'researcher',authVersion:0};
const owner={tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId};
async function fixture(){
 const sid='rh-aiq-worker-'+randomUUID(),events=[];await db.session.create({data:{id:sid,...owner,agentId:ids.tenant+'-kb-research',channel:'knowledge',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID()}});
 const prisma={elevated:db,app:db};let releaseFirst,startedFirst;const held=new Promise(r=>{releaseFirst=r;}),started=new Promise(r=>{startedFirst=r;});let heldOnce=false;
 const queue=new KnowledgeChatQueueService(prisma,{assertKnowledgeSession:async(user,id)=>{assert.equal(user.accountId,u.accountId);assert.equal(id,sid);return db.session.findUnique({where:{id}});},
  sendMessage:async(user,id,text,opts)=>{
   events.push({text,phase:'start',id:opts.execution.claim.taskId});if(!heldOnce){heldOnce=true;startedFirst();await held;}
   if(text==='合成队列故障检查')throw Error('SYNTHETIC_QUEUE_EXPECTED_FAILURE');
   return withWorkerPublication(prisma,scope,opts.execution.claim,async(tx)=>{
    const message=await tx.message.create({data:{tenantId:u.tenantId,sessionId:id,role:'assistant',content:'合成队列机制检查完成；不是模型回答或科研结果。',meta:{syntheticQueueMechanicsOnly:true}}});
    const result=await tx.knowledgeChatJob.updateMany({where:{id:opts.execution.claim.taskId,status:'processing',executionToken:opts.execution.claim.executionToken,workerOwner:opts.execution.claim.workerOwner},data:{status:'completed',assistantMessageId:message.id,completedAt:new Date()}});assert.equal(result.count,1);events.push({text,phase:'complete'});return{message};
   });
  }},scope); // Never onModuleInit: never scans historical tasks.
 const commands=createConversationCommands({tenantId:ids.tenant,consumerKey:'isolated-worker-check',transaction:fn=>db.$transaction(fn),authorize:async(_tx,user,id)=>{assert.equal(id,sid);assert.equal(user.accountId,u.accountId);return user;},stage:async(tx,_user,job)=>{
  const p=await tx.knowledgeChatJob.findFirst({where:{sessionId:sid,status:'completed'},orderBy:[{createdAt:'desc'},{id:'desc'}]});return{...job.payload,testParentId:p?.id??null};
 },schedule:(user,id,input)=>queue.enqueue(user,id,input)});
 const add=text=>commands.submit(u,sid,{text,requestKey:'rh-worker-'+randomUUID(),kbIds:[]});
 const wait=async check=>{for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,30));}throw Error('Worker verification timed out');};
 return{sid,commands,events,add,started,releaseFirst,wait,queue};
}
test('actual old Worker claims once, commits success atomically and then the next command runs with completed predecessor',async()=>{
 const f=await fixture();try{
  const a=await f.add('合成队列第一项'),b=await f.add('合成队列第二项');await f.commands.tick(u,f.sid);await f.started;
  await f.commands.tick(u,f.sid);assert.equal(f.events.length,1);assert.equal((await f.commands.list(u,f.sid)).items.find(i=>i.id===b.id).status,'waiting');
  f.releaseFirst();await f.wait(async()=>{const j=await db.knowledgeChatJob.findFirst({where:{userMessageId:a.id}});return j?.status==='completed';});
  await f.commands.tick(u,f.sid);await f.wait(async()=>{const j=await db.knowledgeChatJob.findFirst({where:{userMessageId:b.id}});return j?.status==='completed';});
  const j1=await db.knowledgeChatJob.findFirst({where:{userMessageId:a.id}}),j2=await db.knowledgeChatJob.findFirst({where:{userMessageId:b.id}});assert.equal(j2.payload.testParentId,j1.id);assert.equal(j1.attempts,1);assert.equal(j2.attempts,1);
  assert.deepEqual(f.events.map(e=>e.phase),['start','complete','start','complete']);
  const c=await f.add('完成后再次发送的合成检查');await f.commands.tick(u,f.sid);
  await f.wait(async()=>{const j=await db.knowledgeChatJob.findFirst({where:{userMessageId:c.id}});return j?.status==='completed';});
  assert.equal((await db.knowledgeChatJob.findFirst({where:{userMessageId:c.id}})).attempts,1);
  assert.equal(await db.usageRecord.count({where:{tenantId:ids.tenant,sessionId:f.sid}}),0);
 }finally{f.releaseFirst();f.queue.onModuleDestroy();}
});
test('actual Worker failure pauses the next command; resume never replays the failed task',async()=>{
 const f=await fixture();try{
  const a=await f.add('合成队列故障检查'),b=await f.add('合成队列恢复检查');await f.commands.tick(u,f.sid);await f.started;f.releaseFirst();
  await f.wait(async()=>{const j=await db.knowledgeChatJob.findFirst({where:{userMessageId:a.id}});return j?.status==='failed';});await f.commands.tick(u,f.sid);
  assert((await f.commands.list(u,f.sid)).paused);assert.equal(f.events.length,1);
  await f.commands.resume(u,f.sid);await f.commands.tick(u,f.sid);await f.wait(async()=>{const j=await db.knowledgeChatJob.findFirst({where:{userMessageId:b.id}});return j?.status==='completed';});
  assert.equal((await db.knowledgeChatJob.findFirst({where:{userMessageId:a.id}})).attempts,1);assert.equal(f.events.filter(e=>e.text==='合成队列故障检查').length,1);
 }finally{f.releaseFirst();f.queue.onModuleDestroy();}
});
