import {AsyncLocalStorage} from 'node:async_hooks';
import {normalizeNetworkIntent} from './network-intent.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
export const COMMAND_SCHEMA='hub-conversation-command.v1';
export function commandScanQuery(tenantId,consumerKey,cursor){return{
 where:{tenantId,AND:[{meta:{path:['hubCommand','schema'],equals:COMMAND_SCHEMA}},{meta:{path:['hubCommand','consumerKey'],equals:consumerKey}},{OR:['waiting','paused','dispatched'].map(status=>({meta:{path:['hubCommand','status'],equals:status}}))}]},
 include:{session:true},...(cursor?{cursor:{id:cursor},skip:1}:{}),orderBy:{id:'asc'},take:200,
};}
const fail=(code,message,status=409)=>{throw Object.assign(Error(message),{code,publicMessage:message,status});};
const owner=u=>({tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId});
const pending=['waiting','paused'];
const command=m=>m?.meta?.hubCommand;
const checkText=text=>{const error=agentQuestionError(text);if(error)fail('HUB_COMMAND_INPUT_INVALID',error,400);return text.trim();};
// Advance even when every visited session is paused/revoked. Reset only after an
// empty page, so a full old page cannot permanently hide newer conversations.
export function createCommandScanner({readPage,processSession}){
 let cursor=null,busy=false;
 return async()=>{if(busy)return;busy=true;try{
  const page=await readPage(cursor);cursor=page.at(-1)?.id??null;
  const seen=new Set();for(const m of page){if(seen.has(m.sessionId))continue;seen.add(m.sessionId);await processSession(m).catch(()=>{});}
 }finally{busy=false;}};
}
export function createConversationCommands({tenantId,transaction,authorize,admit,revise,stage,schedule,consumerKey='isolated-test'}){
 const creating=new AsyncLocalStorage();
 const where=sid=>({tenantId,sessionId:sid,AND:[{meta:{path:['hubCommand','schema'],equals:COMMAND_SCHEMA}},{meta:{path:['hubCommand','consumerKey'],equals:consumerKey}}]});
 const audit=(tx,u,id,action)=>tx.auditLog.create({data:{tenantId,studyGroupId:u.studyGroupId,accountId:u.accountId,action,target:id}});
 async function locked(tx,u,sid){
  if(u?.tenantId!==tenantId)fail('HUB_COMMAND_ACCESS_DENIED','当前账号无法操作此会话。',403);
  const current=await authorize(tx,u,sid);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sid},0))`;return current;
 }
 const rows=(tx,sid)=>tx.message.findMany({where:{...where(sid),AND:[...where(sid).AND,{OR:[{meta:{path:['hubCommand','status'],equals:'waiting'}},{meta:{path:['hubCommand','status'],equals:'paused'}},{meta:{path:['hubCommand','status'],equals:'dispatched'}}]}]},orderBy:[{createdAt:'asc'},{id:'asc'}],take:100});
 async function item(tx,m){
  const c=command(m),j=c.jobId?await tx.knowledgeChatJob.findUnique({where:{id:c.jobId}}):null;
  if(c.jobId&&(!j||j.userMessageId!==m.id||j.sessionId!==m.sessionId||j.accountId!==c.accountId||j.tenantId!==tenantId))fail('HUB_COMMAND_PARENT_CHANGED','指令与执行记录无法核对，队列已暂停。');
  return{id:m.id,text:m.content,status:j?.status??c.status,version:c.version,requestKey:c.requestKey,networkIntent:normalizeNetworkIntent(c.networkIntent),errorMessage:c.errorMessage??null,pauseCode:c.pauseCode??null,createdAt:m.createdAt};
 }
 async function find(tx,sid,id){const m=await tx.message.findFirst({where:{...where(sid),id}});if(!m)fail('HUB_COMMAND_NOT_FOUND','待执行指令不存在。',404);return m;}
 async function change(tx,m,c,content=m.content){
  const meta={...m.meta,hubCommand:{...command(m),...c,version:command(m).version+1}};
  const r=await tx.message.updateMany({where:{...where(m.sessionId),id:m.id,meta:{equals:m.meta}},data:{content,meta}});
  if(r.count!==1)fail('HUB_COMMAND_VERSION_CONFLICT','指令状态已变化，请重新获取后操作。');return{...m,content,meta};
 }
 async function list(u,sid){return transaction(async tx=>{
  await authorize(tx,u,sid);const all=await rows(tx,sid),items=[];
  for(const m of all){const i=await item(tx,m);if(!['completed','failed','cancelled'].includes(i.status))items.push(i);}
  const processing=await tx.knowledgeChatJob.findFirst({where:{...owner(u),sessionId:sid,status:'processing'},select:{leaseExpiresAt:true}});
  const uncertain=Boolean(processing?.leaseExpiresAt&&new Date(processing.leaseExpiresAt).getTime()<Date.now());
  const latest=await tx.message.findMany({where:where(sid),orderBy:[{createdAt:'desc'},{id:'desc'}],take:20});
  const recent=[];for(const m of latest)recent.push(await item(tx,m));
  return{items,recent,paused:uncertain||items.some(i=>i.status==='paused'&&i.pauseCode!=='HUB_SKILL_CLARIFICATION'),uncertain};
 },u);}
 async function submit(u,sid,input){
  const text=checkText(input?.text),networkIntent=normalizeNetworkIntent(input?.networkIntent);if(typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey)||!Array.isArray(input.kbIds)||input.kbIds.length)fail('HUB_COMMAND_INPUT_INVALID','指令参数无效。',400);
  return transaction(async tx=>{
   const current=await locked(tx,u,sid);
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'hub-command:'+tenantId+':'+input.requestKey},0))`;
   const old=await tx.message.findFirst({where:{tenantId,AND:[{meta:{path:['hubCommand','schema'],equals:COMMAND_SCHEMA}},{meta:{path:['hubCommand','requestKey'],equals:input.requestKey}}]}});
   if(old){if(old.sessionId!==sid||command(old).accountId!==u.accountId||command(old).originalText!==text||normalizeNetworkIntent(command(old).networkIntent).enabled!==networkIntent.enabled)fail('HUB_COMMAND_REQUEST_CONFLICT','该发送编号已用于另一条指令。');return item(tx,old);}
   const admitted=await admit?.(tx,current,sid,{text,networkIntent});
   const all=await rows(tx,sid);let active=0;for(const m of all)if(!['completed','failed','cancelled'].includes((await item(tx,m)).status))active++;
   if(active>=100)fail('HUB_COMMAND_LIMIT','待执行指令已达100条，请处理后继续。',400);
   const meta={queueStatus:'waiting',hubCommand:{schema:COMMAND_SCHEMA,consumerKey,status:'waiting',version:1,requestKey:input.requestKey,originalText:text,networkIntent,accountId:current.accountId,authVersion:current.authVersion??null,revisions:[],...(admitted?.hubMediaSelection?{hubMediaSelection:admitted.hubMediaSelection}:{}),...(admitted?.hubPrivateSelection?{hubPrivateSelection:admitted.hubPrivateSelection}:{}),...(admitted?.hubResearchDataSelection?{hubResearchDataSelection:admitted.hubResearchDataSelection}:{})}};
   const m=await tx.message.create({data:{tenantId,sessionId:sid,role:'user',content:text,meta}});
   const touched=await tx.session.updateMany({where:{id:sid,...owner(current),status:'active',deletedAt:null},data:{updatedAt:m.createdAt}});
   if(touched.count!==1)fail('HUB_COMMAND_ACCESS_DENIED','当前账号无法操作此会话。',403);
   await audit(tx,current,m.id,'hub_command_enqueue');return item(tx,m);
  },u);
 }
 async function mutate(u,sid,id,input,cancel=false){return transaction(async tx=>{
  const current=await locked(tx,u,sid),m=await find(tx,sid,id),c=command(m);
  if(!pending.includes(c.status)||c.jobId||!Number.isSafeInteger(input?.version)||input.version!==c.version)fail('HUB_COMMAND_VERSION_CONFLICT','指令已开始执行或已被修改，请重新获取后操作。');
  const text=cancel?m.content:checkText(input.text),selection=cancel?{}:await revise?.(tx,current,sid,c,{text,networkIntent:normalizeNetworkIntent(c.networkIntent)})??{};
  const updated=await change(tx,m,{...selection,status:cancel?'cancelled':'waiting',errorMessage:null,pauseCode:null,revisions:[...c.revisions,{version:c.version,text:m.content,networkIntent:normalizeNetworkIntent(c.networkIntent)}],authVersion:current.authVersion??null},text);
  await audit(tx,current,id,cancel?'hub_command_cancel':'hub_command_edit');return item(tx,updated);
 },u);}
 async function resume(u,sid){return transaction(async tx=>{
  const current=await locked(tx,u,sid),failure=await tx.knowledgeChatJob.findFirst({where:{...owner(u),sessionId:sid,status:'failed'},orderBy:[{createdAt:'desc'},{id:'desc'}]});let resumed=0;
  for(const m of await rows(tx,sid)){const c=command(m);if(c.jobId||!pending.includes(c.status)||c.pauseCode==='HUB_SKILL_CLARIFICATION')continue;await change(tx,m,{status:'waiting',errorMessage:null,pauseCode:null,acknowledgedFailureId:failure?.id??null,authVersion:current.authVersion??null});await audit(tx,current,m.id,'hub_command_resume');resumed++;}
  return{resumed};
 },u);}
 async function tick(u,sid){
  const dispatch=await transaction(async tx=>{
   const current=await locked(tx,u,sid),active=await tx.knowledgeChatJob.findFirst({where:{...owner(u),sessionId:sid,status:{in:['queued','processing']}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
   if(active)return active.payload?.hubCommand?.schema===COMMAND_SCHEMA&&active.status==='queued'?{user:current,job:active}:null;
   const all=await rows(tx,sid);
   for(const old of all){if(!command(old).jobId)continue;const actual=await item(tx,old);if(['completed','failed'].includes(actual.status))await change(tx,old,{status:actual.status});}
   const prepare=m=>stage(tx,current,{text:m.content,payload:{kbIds:[],attachments:[],displayText:m.content,networkIntent:normalizeNetworkIntent(command(m).networkIntent),...(command(m).hubMediaSelection?{hubMediaSelection:command(m).hubMediaSelection}:{}),...(command(m).hubPrivateSelection?{hubPrivateSelection:command(m).hubPrivateSelection}:{}),...(command(m).hubResearchDataSelection?{hubResearchDataSelection:command(m).hubResearchDataSelection}:{})},sessionId:sid,userMessageId:m.id});
   let m;
   for(let candidate of all){
    let c=command(candidate);if(c.jobId||!pending.includes(c.status))continue;
    // Old pauses lack a typed cause. Reclassify only through the same free
    // admission checks; never infer permission to run from the displayed text.
    if(c.status==='paused'&&!c.pauseCode&&c.authVersion===(current.authVersion??null)){
     let code='HUB_COMMAND_PAUSED';
     try{await prepare(candidate);}catch(reason){if(!reason.status&&!reason.getStatus)throw reason;code=reason.code??code;}
     candidate=await change(tx,candidate,{pauseCode:code});c=command(candidate);
    }
    if(c.status==='paused'&&c.pauseCode==='HUB_SKILL_CLARIFICATION')continue;
    m=candidate;break;
   }
   if(!m||command(m).status==='paused')return null;
   const c=command(m),previous=await tx.knowledgeChatJob.findFirst({where:{...owner(u),sessionId:sid},orderBy:[{createdAt:'desc'},{id:'desc'}]});
   if(previous?.status==='failed'&&c.acknowledgedFailureId!==previous.id){await change(tx,m,{status:'paused',errorMessage:'上一项未完成，后续指令已暂停。'});return null;}
   if(c.authVersion!==(current.authVersion??null)){await change(tx,m,{status:'paused',errorMessage:'当前身份已变化，请核对后继续队列。'});return null;}
   let payload;try{payload=await prepare(m);}
   catch(reason){if(!reason.status&&!reason.getStatus)throw reason;const r=reason.getResponse?.();
    if(['HUB_PRIVATE_MATERIAL_PARSING','HUB_PRIVATE_WAITING_PREVIOUS'].includes(reason.code)){
     if(c.pauseCode!==reason.code)await change(tx,m,{status:'waiting',pauseCode:reason.code,errorMessage:reason.publicMessage});
     return null;
    }
    await change(tx,m,{status:'paused',pauseCode:reason.code??'HUB_COMMAND_PAUSED',errorMessage:reason.publicMessage??r?.message??'本条暂不能执行，请核对问题、来源或额度后继续。'});return null;}
   const data={...owner(current),sessionId:sid,roleSnapshot:current.role,requestKey:c.requestKey,text:m.content,status:'queued',userMessageId:m.id,payload:{...payload,hubCommand:{schema:COMMAND_SCHEMA,consumerKey,commandId:m.id}}};
   const job=await creating.run(data,()=>tx.knowledgeChatJob.create({data}));
   await change(tx,m,{status:'dispatched',jobId:job.id,errorMessage:null});await audit(tx,current,m.id,'hub_command_dispatch');return{user:current,job};
  },u);
  if(dispatch)await schedule(dispatch.user,sid,{text:dispatch.job.text,requestKey:dispatch.job.requestKey,kbIds:[]});
 }
 return{list,submit,edit:(u,s,id,v)=>mutate(u,s,id,v),cancel:(u,s,id,v)=>mutate(u,s,id,v,true),resume,tick,
  onJobCreate(tx,args,next,fallback){const data=creating.getStore();if(!data)return fallback();if(args.data!==data)fail('HUB_COMMAND_INPUT_INVALID','指令提交上下文不一致。');return next(args);},
 };
}
