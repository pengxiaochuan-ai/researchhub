// B04 only: bind the existing Session/Queue JSON path, never change the old kernel.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {agentQuestionError} from '../src/agent-question.js';
import {articleContextKey,parseArticleContext,loadArticleEvidence,assertCurrentArticleEvidence,articleToolResult} from '../server/hub-sources/article-evidence.mjs';
import {verifyArticleNumericEvidence} from './article-numeric-evidence.mjs';
import {ARTICLE_RESPONSE_POLICY,isArticleResponsePolicy,articleInputSchema,verifyArticleResponse} from './article-response-policy.mjs';

const fail=(code,status=409)=>{throw Object.assign(new Error(code),{code,status});};
const inputHash=(binding,text)=>createHash('sha256').update(JSON.stringify({binding:articleContextKey(binding),text:text.trim(),kbIds:[]})).digest('hex');
const active=['queued','processing'];
const publicFailures=new Set(['ARTICLE_AI_NUMERIC_REJECTED','ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED','ARTICLE_EVIDENCE_CHANGED','QA_MODEL_TRUNCATED','ARTICLE_NO_DELIVERABLE_SECTIONS','ARTICLE_RESPONSE_CHANGED','ARTICLE_AI_JSON_INVALID','ARTICLE_AI_SCHEMA_REJECTED']);
export function createArticleAi({ids,prisma,sessionsInTx,lockAuthorizationMutation,admission,readPmcAsset,executionStatus=()=>({canStart:false,code:'TOKEN_QUOTA_UNAVAILABLE',message:'暂时无法核对 Token 额度；已有结果仍可查看。'})}){
  const pending=new AsyncLocalStorage(),agentId=ids.tenant+'-kb-research';
  const scope=(db,user)=>({db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',principal:user,...(readPmcAsset?{readPmcAsset}:{})});
  const transact=(user,fn)=>prisma.withTenantTransaction(user.tenantId,user.studyGroupId,user.researchProjectId,fn);
  const where=user=>({tenantId:ids.tenant,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId});
  const summary=j=>j?{id:j.id,status:j.status,requestKey:j.requestKey,inputHash:j.payload?.articleInputHash??null,
    userMessageId:j.userMessageId,assistantMessageId:j.assistantMessageId,errorCode:j.status==='failed'&&publicFailures.has(j.errorMessage)?j.errorMessage:j.errorCode,createdAt:j.createdAt}:null;
  async function own(db,user,sessionId){
    const ss=sessionsInTx(db),session=await ss.assertKnowledgeSession(user,sessionId);
    await ss.assertAgentAccess(user,session.agentId);
    const binding=parseArticleContext(session.contextKey);
    if(!binding||session.agentId!==agentId||user.tenantId!==ids.tenant)fail('ARTICLE_CONTEXT_INVALID',403);
    return {session,binding};
  }
  async function jobs(db,user,sessionId,requestKey){
    return db.knowledgeChatJob.findMany({where:{...where(user),sessionId,...(requestKey?{requestKey}:{})},
      orderBy:[{createdAt:'desc'},{id:'desc'}],take:requestKey?1:20});
  }
  async function context(user,recordId,requestKey){
    if(requestKey!==undefined&&(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(requestKey)))fail('ARTICLE_QUERY_INVALID',400);
    return transact(user,async db=>{
      const {pack}=await loadArticleEvidence({...scope(db,user),recordId});
      await sessionsInTx(db).assertAgentAccess(user,agentId);
      const session=await db.session.findFirst({where:{...where(user),agentId,channel:'knowledge',contextKey:articleContextKey(pack.binding),deletedAt:null,status:'active'}});
      const list=session?await jobs(db,user,session.id,requestKey):[];
      return {binding:pack.binding,title:pack.source.title,doi:pack.source.doi,sourceUrl:pack.source.sourceUrl,
        coverage:pack.coverage,omissions:pack.omissions,packHash:pack.packHash,evidence:pack,
        execution:await executionStatus(db,user,pack.binding),existingSessionId:session?.id??null,
        latestTask:summary(list[0]),...(requestKey?{requestKey,requestStatus:list.length?'found':'not_found'}:{})};
    });
  }
  async function ensure(user,binding){
    articleContextKey(binding);
    return transact(user,async db=>{
      await lockAuthorizationMutation(db,ids.tenant);
      const {pack}=await loadArticleEvidence({...scope(db,user),recordId:binding.recordId,binding});
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'rh-article-session:'+user.accountId+':'+user.studyGroupId+':'+user.researchProjectId+':'+articleContextKey(binding)},0))`;
      return sessionsInTx(db).ensureKnowledgeSession(user,agentId,articleContextKey(binding),'单篇文章 · '+pack.source.title.slice(0,130));
    });
  }
  async function findPrior(db,user,sessionId,input,binding){
    const prior=await db.knowledgeChatJob.findUnique({where:{tenantId_requestKey:{tenantId:ids.tenant,requestKey:input.requestKey}}});
    if(prior){if(prior.accountId!==user.accountId||prior.sessionId!==sessionId||prior.text!==input.text.trim()||
      prior.payload?.articleInputHash!==inputHash(binding,input.text))fail('ARTICLE_REQUEST_KEY_CONFLICT');return prior;}
    return db.knowledgeChatJob.findFirst({where:{...where(user),sessionId,status:{in:active}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  }
  async function enqueue(user,sessionId,input,queue){
    if(agentQuestionError(input.text)||
      typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey)||
      !Array.isArray(input.kbIds)||input.kbIds.length)fail('ARTICLE_INPUT_INVALID',400);
    const previous=await transact(user,async db=>{
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId},0))`;
      const {binding}=await own(db,user,sessionId);
      await loadArticleEvidence({...scope(db,user),recordId:binding.recordId,binding});
      return findPrior(db,user,sessionId,input,binding);
    });
    if(previous)return {...summary(previous),idempotent:true};
    try{return summary(await pending.run({user,sessionId,input},()=>queue.enqueue(user,sessionId,input)));}
    catch(e){if(e.code!=='ARTICLE_PENDING')throw e;return {...summary(e.job),idempotent:true};}
  }
  async function onJobCreate(db,args,next){
    const session=await db.session.findUnique({where:{id:args.data.sessionId}});
    if(!parseArticleContext(session?.contextKey))return next(args);
    const a=pending.getStore();
    if(!a||a.user.accountId!==args.data.accountId||a.sessionId!==session.id)fail('ARTICLE_CONTEXT_INVALID',403);
    await lockAuthorizationMutation(db,ids.tenant);
    const {binding}=await own(db,a.user,session.id);
    const prior=await findPrior(db,a.user,session.id,a.input,binding);
    if(prior)throw Object.assign(new Error('ARTICLE_PENDING'),{code:'ARTICLE_PENDING',job:prior});
    const {pack}=await loadArticleEvidence({...scope(db,a.user),recordId:binding.recordId,binding});
    if(!admission)fail('TOKEN_QUOTA_UNAVAILABLE',503);
    await admission(db,a.user,pack.binding);
    return next({...args,data:{...args.data,payload:{...args.data.payload,articleEvidence:pack,articleInputHash:inputHash(binding,args.data.text),articleResponsePolicy:ARTICLE_RESPONSE_POLICY}}});
  }
  async function prepareInTx(db,user,sessionId,jobId,lock=false){
    const {binding}=await own(db,user,sessionId);
    const j=await db.knowledgeChatJob.findFirst({where:{...where(user),id:jobId,sessionId}}),pack=j?.payload?.articleEvidence;
    if(!j||j.status!=='processing'||!pack||articleContextKey(pack.binding)!==articleContextKey(binding)||
      j.payload?.kbIds?.length!==0||j.payload?.attachments?.length||j.payload.articleInputHash!==inputHash(binding,j.text))fail('ARTICLE_JOB_CHANGED');
    const responsePolicyVersion=j.payload.articleResponsePolicy??null;if(responsePolicyVersion!==null&&!isArticleResponsePolicy(responsePolicyVersion))fail('ARTICLE_RESPONSE_CHANGED');
    await assertCurrentArticleEvidence({...scope(db,user),pack,lock});return {pack,sessionId,hubResult:articleToolResult(pack),responsePolicyVersion};
  }
  const prepare=(user,sid,jid)=>transact(user,db=>prepareInTx(db,user,sid,jid));
  async function validate(db,turn){
    const current=await prepareInTx(db,turn.user,turn.sessionId,turn.jobId,true);
    if(!isDeepStrictEqual(current.pack,turn.pack))fail('ARTICLE_EVIDENCE_CHANGED');
    if(isArticleResponsePolicy(current.responsePolicyVersion)){if(turn.articleInputProof?.schema!==articleInputSchema(current.responsePolicyVersion)||turn.articleInputProof?.responsePolicyVersion!==current.responsePolicyVersion||turn.articleResponseValidation?.schema!==current.responsePolicyVersion)fail('ARTICLE_RESPONSE_CHANGED');const rebuilt=verifyArticleResponse(turn.articleResponseValidation,current.pack,turn.articleAcceptedText);if(!isDeepStrictEqual(rebuilt.numericEvidence,turn.articleNumericEvidence))fail('ARTICLE_RESPONSE_CHANGED');}
    else if(turn.articleResponseValidation||turn.articleInputProof?.responsePolicyVersion)fail('ARTICLE_RESPONSE_CHANGED');
    else verifyArticleNumericEvidence(turn.articleNumericEvidence??[],current.pack);
  }
  async function projectMessages(db,user,session,messages){
    const binding=parseArticleContext(session.contextKey),result=[];
    for(const m of messages){if(m.role!=='assistant'){result.push(m);continue;}
      const pack=m.meta?.provenance?.articleEvidence;
      try{if(!pack||articleContextKey(pack.binding)!==articleContextKey(binding))fail('ARTICLE_EVIDENCE_CHANGED');
        if(!isDeepStrictEqual(m.meta.provenance.hubSources,[pack.source]))fail('ARTICLE_EVIDENCE_CHANGED');
        const j=await db.knowledgeChatJob.findFirst({where:{...where(user),sessionId:session.id,assistantMessageId:m.id,status:'completed'}});
        if(!j||!isDeepStrictEqual(j.payload?.articleEvidence,pack)||j.payload?.articleInputHash!==inputHash(binding,j.text))fail('ARTICLE_JOB_CHANGED');
        await assertCurrentArticleEvidence({...scope(db,user),pack});
        const policy=j.payload.articleResponsePolicy??null;
        if(isArticleResponsePolicy(policy)){if(m.meta.provenance.articleModelInput?.schema!==articleInputSchema(policy)||m.meta.provenance.articleModelInput?.responsePolicyVersion!==policy||m.meta.provenance.articleResponseValidation?.schema!==policy)fail('ARTICLE_RESPONSE_CHANGED');const rebuilt=verifyArticleResponse(m.meta.provenance.articleResponseValidation,pack,m.content);if(!isDeepStrictEqual(rebuilt.numericEvidence,m.meta.provenance.articleNumericEvidence))fail('ARTICLE_RESPONSE_CHANGED');}
        else if(policy!==null||m.meta.provenance.articleResponseValidation||m.meta.provenance.articleModelInput?.responsePolicyVersion)fail('ARTICLE_RESPONSE_CHANGED');
        else if(Object.hasOwn(m.meta.provenance,'articleNumericEvidence'))verifyArticleNumericEvidence(m.meta.provenance.articleNumericEvidence,pack);
        result.push({...m,meta:{...m.meta,sourceStatus:'current'}});
      }catch{result.push({...m,content:'该单篇回答的文章版本、来源或授权已失效，原回答与来源不再交付。',meta:{sourceStatus:'restricted'}});}
    }return result;
  }
  async function state(user,session,result){
    const binding=parseArticleContext(session.contextKey);let articleContext;
    try{articleContext=await context(user,binding.recordId);
      if(articleContextKey(articleContext.binding)!==articleContextKey(binding))throw Error();
    }catch{articleContext={binding,status:'restricted',message:'固定文章版本或当前授权已变化，不交付旧正文与来源。'};}
    return transact(user,async db=>({...result,messages:await projectMessages(db,user,session,result.messages),
      jobs:(await jobs(db,user,session.id)).map(summary),articleContext}));
  }
  async function source(user,session,message){
    return transact(user,async db=>{
      const [m]=await projectMessages(db,user,session,[message]);if(m.meta?.sourceStatus!=='current')fail('ARTICLE_SOURCE_RESTRICTED',403);
      return {...m.meta.provenance.articleEvidence.source,index:1,status:'current',articleEvidence:m.meta.provenance.articleEvidence};
    });
  }
  async function stagePendingInTx(db,user,job){
    const {binding}=await own(db,user,job.sessionId);
    const {pack}=await loadArticleEvidence({...scope(db,user),recordId:binding.recordId,binding});
    if(!admission)fail('TOKEN_QUOTA_UNAVAILABLE',503);await admission(db,user,pack.binding);
    return {...job.payload,articleEvidence:pack,articleInputHash:inputHash(binding,job.text),articleResponsePolicy:ARTICLE_RESPONSE_POLICY};
  }
  return {context,ensure,enqueue,onJobCreate,prepare,validate,state,source,projectMessages,stagePendingInTx};
}
