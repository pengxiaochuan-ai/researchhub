import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {loadArticleEvidence,assertCurrentArticleEvidence,articleToolResult,articleContextKey} from './article-evidence.mjs';
import {createArticleAi} from '../../scripts/local-article-ai.mjs';
import {HUB_TOOL_KB_ID,hubAnswerProvenance} from '../../scripts/hub-agent-contract.mjs';
import {assertAnswer} from '../../scripts/knowledge-ai-contract.mjs';
import {assertArticleQualitativeAnswer,articleModelMessages,articleModelInputProof,renderArticleModelResponse} from '../../scripts/article-ai-output.mjs';
import {parseArticleResponse,articleResponseMessages,articleResponseInputProof} from '../../scripts/article-response-policy.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const scope={tenantId:ids.tenant,hubKey:'lingshu-xinyu'},marker='b04-'+randomUUID();
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {SessionsService}=require('./src/sessions/sessions.service.ts');
const {createKnowledgeQueueRecords}=require('./src/sessions/knowledge-chat-queue.service.ts');
const {lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const {OrchestratorService}=require('./src/orchestrator/orchestrator.service.ts');
const unused=new Proxy({},{get(){throw Error('B04_OUT_OF_SCOPE');}});
async function fixture(fn,{write=false}={}){
  assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
  const execute=()=>withFixtureTransaction(env,write?'direct':'app',async db=>{
    for(const [k,v]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project]])await db.$executeRaw`SELECT set_config(${k},${v},true)`;
    const users={};for(const role of ['owner','admin']){const a=await db.account.findUnique({where:{id:ids[role]}});users[role]={accountId:a.id,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,role:a.role,authVersion:a.authVersion,isTenantAdmin:a.isTenantAdmin};}
    await fn(db,users);if(write)throw Error('B04_EXPECTED_ROLLBACK');
  },{readOnly:!write});
  if(write)await assert.rejects(execute,/B04_EXPECTED_ROLLBACK/);else await execute();
}
test('B04 real approved PMC pack reconstructs all fragments, current versions and both account authorization',()=>fixture(async(db,users)=>{
  for(const principal of Object.values(users)){
    const args={db,...scope,principal,recordId:'pmc-PMC13672493'},r=await loadArticleEvidence(args);
    assert(r.pack.fragments.length>=2);assert(r.pack.coverage.characters<=6000);
    await assertCurrentArticleEvidence({...args,pack:JSON.parse(JSON.stringify(r.pack))});
    const corrupt=structuredClone(r.pack);corrupt.fragments.at(-1).textHash='0'.repeat(64);
    await assert.rejects(()=>assertCurrentArticleEvidence({...args,pack:corrupt}),/ARTICLE_EVIDENCE_CHANGED/);
    await assert.rejects(()=>assertCurrentArticleEvidence({...args,principal:{...principal,authVersion:9999},pack:r.pack}),/SCOPE_REJECTED/);
  }
}));
test('B08 actual originals map all paragraphs and retain each sealed v1 result while v2 restores missing scientific limitations',()=>fixture(async(db,users)=>{
  for(const [role,total]of [['owner',33],['admin',72]]){
    const saved=JSON.parse(readFileSync('docs/testing/evidence/article-ai-real-b07-8264b496-4382-4391-bf5f-b00db15c7924/'+role+'-result.json'));
    const args={db,...scope,principal:users[role],recordId:saved.binding.recordId};
    const old=saved.answer.meta.provenance.articleEvidence;
    await assertCurrentArticleEvidence({...args,pack:old});
    const {pack}=await loadArticleEvidence(args);
    assert.equal(pack.policyVersion,'rh-article-evidence-v2');assert.notEqual(pack.packHash,old.packHash);
    assert.equal(pack.coverage.mapping.total,total);assert.equal(pack.coverage.mapping.matched,total);
    assert.deepEqual(pack.coverage.mapping.failedAnchors,[]);assert(pack.fragments.every(f=>f.complete===true));
    assert(pack.fragments.length<=6&&pack.coverage.characters<=6000);
    const text=pack.fragments.map(f=>f.text).join(' ');
    if(role==='owner'){
      assert.match(text,/remained partially unresolved/);assert.match(text,/subjective questionnaires and sleep diaries/);
      assert(pack.fragments.some(f=>f.locator.anchor==='part-39'));assert(pack.fragments.some(f=>f.locator.anchor==='part-51'));
      assert.throws(()=>assertArticleQualitativeAnswer(saved.answer.content,pack),/ARTICLE_AI_NUMERIC_REJECTED/);
    }else{
      assert(pack.fragments.some(f=>f.locator.anchor==='part-60'));
      assert.match(text,/weak recommendation/);assert.match(text,/post-treatment anxiety/);assert.match(text,/women with breast cancer/);
      assert(pack.omissions.includes('results-role-not-applicable-review'));
    }
    const service=createArticleAi({ids,prisma:{withTenantTransaction:(_t,_g,_p,fn)=>fn(db)},sessionsInTx:tx=>new SessionsService({forTenant:()=>tx},unused,unused,unused,unused,unused),lockAuthorizationMutation,admission:()=>{throw Error('NO_PAID_CALL');}});
    const session=await db.session.findUnique({where:{id:saved.sessionId}}),message=await db.message.findUnique({where:{id:saved.answer.id}});
    const [shown]=await service.projectMessages(db,users[role],session,[message]);
    assert.equal(shown.meta.sourceStatus,'current');assert.equal(shown.content,saved.answer.content);
    assert.deepEqual(shown.meta.provenance.articleEvidence,old);
    const forged=structuredClone(old);forged.fragments.at(-1).text+=' forged';
    await assert.rejects(()=>assertCurrentArticleEvidence({...args,pack:forged}),/ARTICLE_EVIDENCE_CHANGED/);
  }
}));
test('B04 original Session and queue JSON retain fixed pack; lost receipts recover by GET and active duplicate has no extra row',()=>fixture(async(db,{owner,admin})=>{
  // B07 now has real completed sessions on the approved stock. Never write those old sessions,
  // even in a rollback probe; this queue test owns an entirely new synthetic parent instead.
  const run=marker+'-session-run',candidate=marker+'-session-candidate',version=marker+'-session-version',pmcid='PMC99001002';
  await db.$executeRaw`INSERT INTO rh_source.pmc_run(id,tenant_id,hub_key,campaign_key,query_sha256,query_text,keyword_version) VALUES(${run},${ids.tenant},'lingshu-xinyu','pmc-first-2199-11-03',${'a'.repeat(64)},'B06 rollback synthetic parent','b06')`;
  await db.$executeRaw`INSERT INTO rh_source.pmc_candidate(id,tenant_id,hub_key,run_id,campaign_key,pmcid,selected_rank) VALUES(${candidate},${ids.tenant},'lingshu-xinyu',${run},'pmc-first-2026-10-31',${pmcid},1)`;
  await db.$executeRaw`INSERT INTO rh_source.pmc_candidate_version(id,tenant_id,hub_key,candidate_id,campaign_key,pmcid,article_version,raw_sha256,license_uri,title,abstract_text,body_text,tables_json,expected_asset_count) VALUES(${version},${ids.tenant},'lingshu-xinyu',${candidate},'pmc-first-2026-10-31',${pmcid},${pmcid+'.1'},${'b'.repeat(64)},'https://creativecommons.org/licenses/by/4.0/','B06 synthetic fixed article','Synthetic abstract only.','Methods: synthetic design. Results: uncertain. Discussion: limited scope.','[]'::jsonb,1)`;
  await db.$executeRaw`INSERT INTO rh_source.pmc_article_decision(tenant_id,hub_key,version_id,visibility,reviewer_id) VALUES(${ids.tenant},'lingshu-xinyu',${version},'public',${ids.admin})`;
  const prisma={withTenantTransaction:(_t,_g,_p,fn)=>fn(db)},sessionsInTx=tx=>new SessionsService({forTenant:()=>tx},unused,unused,unused,unused,unused);
  let admission=0;
  const a=createArticleAi({ids,prisma,sessionsInTx,lockAuthorizationMutation,admission:()=>{admission++;}});
  const principal=owner,{pack}=await loadArticleEvidence({db,...scope,principal,recordId:'pmc-'+pmcid});
  const initial=await a.context(owner,pack.binding.recordId);assert.equal(initial.existingSessionId,null);
  assert.deepEqual(initial.evidence,pack);assert.equal(initial.execution.canStart,false);
  const s=await a.ensure(owner,pack.binding),again=await a.ensure(owner,pack.binding);assert.equal(s.id,again.id);
  assert.equal((await a.context(owner,pack.binding.recordId)).existingSessionId,s.id);
  assert.equal((await a.context(admin,pack.binding.recordId)).existingSessionId,null);
  const queue={enqueue:async(user,sessionId,input)=>createKnowledgeQueueRecords(new Proxy(db,{get(target,k){if(k!=='knowledgeChatJob')return target[k];return new Proxy(target[k],{get(model,method){return method==='create'?args=>a.onJobCreate(db,args,next=>model.create(next)):model[method];}});}}),{user,sessionId,...input})};
  const body={text:'请只解释当前文章的研究局限',requestKey:marker+'-first',kbIds:[]};
  const first=await a.enqueue(owner,s.id,body,queue),second=await a.enqueue(owner,s.id,{...body,requestKey:marker+'-second'},queue);
  assert.equal(first.id,second.id);assert.equal(admission,1);
  assert.equal(await db.knowledgeChatJob.count({where:{sessionId:s.id}}),1);
  // The real queue primitive creates userMessage before create hook. In production the competing
  // transaction rolls back on ARTICLE_PENDING; this nested probe must explicitly rollback that savepoint.
  const recovered=await a.context(owner,pack.binding.recordId,body.requestKey);
  assert.equal(recovered.latestTask.id,first.id);assert.equal(recovered.latestTask.inputHash,first.inputHash);
  assert.equal((await a.context(owner,pack.binding.recordId,marker+'-unknown')).latestTask,null);
  await assert.rejects(()=>a.enqueue(owner,s.id,{...body,text:'另一条问题'},queue),/ARTICLE_REQUEST_KEY_CONFLICT/);
  await assert.rejects(()=>a.prepare(admin,s.id,first.id),/会话|不存在|ARTICLE/);
  await db.knowledgeChatJob.update({where:{id:first.id},data:{status:'processing'}});
  const turn=await a.prepare(owner,s.id,first.id);assert.equal(articleToolResult(turn.pack).meta.sources.length,1);
  const order=[];
  const tools={toolDefs:()=>[{type:'function',function:{name:'kb_search',description:'B04 fixed article test',parameters:{type:'object',properties:{query:{type:'string'}}}}}],execute:async(_u,name,args)=>{
    assert.equal(name,'kb_search');assert.equal(JSON.parse(args).kbId,HUB_TOOL_KB_ID);
    await assertCurrentArticleEvidence({db,...scope,principal:owner,pack:turn.pack});order.push('fixed-article-PG');return articleToolResult(turn.pack);
  }};
  let actualInputProof,parsedResponse;
  const provider={chatWithTools:()=>{throw Error('NO_TOOL_LOOP');},chat:async messages=>{
    const text=JSON.stringify(messages);assert(text.includes(pmcid));assert(text.includes(turn.pack.fragments[0].text));
    const complete=articleResponseMessages(messages[0].content,body.text,turn.pack),input=JSON.parse(complete[1].content);
    assert.equal(input.fragments.length,turn.pack.fragments.length);for(let i=0;i<input.fragments.length;i++)assert.equal(input.fragments[i].text,turn.pack.fragments[i].text);
    actualInputProof=articleResponseInputProof(complete,turn.pack,body.text);
    const reply=Object.fromEntries(['researchType','observations','limitations','relevance'].map(k=>[k,{text:'作者报告临床观察，不能据此推断因果。',fragmentIds:['fragment-1']}]));
    assert(!text.includes('pmc-PMC99001001'));order.push('free-provider-double');
    parsedResponse=parseArticleResponse(JSON.stringify(reply),turn.pack);
    return{text:parsedResponse.text,usedMock:false,usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130},route:{model:'deepseek-v4-pro',profileId:'B04_FREE_TEST_DOUBLE_NOT_PROVIDER',fallbackIndex:0}};
  }};
  const core=new OrchestratorService({},provider,{},{},tools);
  const result=await core.run({user:owner,userMessage:body.text,history:[],ctx:{kbAgent:true,agentKind:'research',tools:['knowledge.search'],kbIds:[HUB_TOOL_KB_ID],model:{provider:'deepseek',model:'deepseek-v4-pro',maxTokens:1536},kbGrounding:turn.pack.coverage.notice}});
  assert.deepEqual(order,['fixed-article-PG','free-provider-double']);assert.equal(result.provenance.kbAnswerFastPath,true);
  assertAnswer(result,[turn.pack.source]);
  assertArticleQualitativeAnswer(result.finalText,turn.pack);
  assert.equal(actualInputProof.packHash,turn.pack.packHash);assert.equal(actualInputProof.fragments.length,turn.pack.fragments.length);
  const actualResponse={articleInputProof:actualInputProof,articleAcceptedText:parsedResponse.text,articleResponseValidation:parsedResponse.validation,articleNumericEvidence:parsedResponse.numericEvidence};
  await a.validate(db,{...turn,user:owner,jobId:first.id,...actualResponse});
  await assert.rejects(()=>a.validate(db,{...turn,user:owner,jobId:first.id}),/ARTICLE_RESPONSE_CHANGED/);
  const changed=structuredClone(turn);changed.pack.fragments.at(-1).text+=' forged';
  await assert.rejects(()=>a.validate(db,{...changed,user:owner,jobId:first.id}),/ARTICLE_EVIDENCE_CHANGED/);
  const message=await db.message.create({data:{tenantId:ids.tenant,sessionId:s.id,role:'assistant',content:result.finalText,meta:{provenance:{...hubAnswerProvenance([turn.pack.source],order,turn.pack),articleModelInput:actualInputProof,articleResponseValidation:parsedResponse.validation,articleNumericEvidence:parsedResponse.numericEvidence}}}});
  await db.knowledgeChatJob.update({where:{id:first.id},data:{status:'completed',assistantMessageId:message.id}});
  const shown=await a.state(owner,s,{messages:[message]});assert.equal(shown.messages[0].meta.sourceStatus,'current');
  const swapped=structuredClone(message);swapped.meta.provenance.hubSources[0].pmcRecordId='pmc-PMC99001003';
  const hidden=await a.projectMessages(db,owner,s,[swapped]);assert.equal(hidden[0].meta.sourceStatus,'restricted');
  assert.equal(hidden[0].meta.provenance,undefined);
  assert.deepEqual((await a.source(owner,s,message)).articleEvidence,turn.pack);
  // Both callers pass the readonly precheck before either queue INSERT. The second
  // real primitive is forced behind the first INSERT, then its whole txn savepoint
  // is rolled back exactly as the unchanged Queue does on a create-hook exception.
  let arrivals=0,release,finish;
  const both=new Promise(r=>release=r),firstDone=new Promise(r=>finish=r);
  const racingQueue={enqueue:async(user,sessionId,input)=>{
    const ordinal=++arrivals;if(arrivals===2)release();await both;
    if(ordinal===1){try{return await queue.enqueue(user,sessionId,input);}finally{finish();}}
    await firstDone;await db.$executeRawUnsafe('SAVEPOINT b04_competing_enqueue');
    try{return await queue.enqueue(user,sessionId,input);}catch(e){await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT b04_competing_enqueue');throw e;}
  }};
  const [left,right]=await Promise.all(['left','right'].map(side=>a.enqueue(owner,s.id,{...body,requestKey:marker+'-'+side},racingQueue)));
  assert.equal(left.id,right.id);assert.equal(admission,2);
  assert.equal(await db.knowledgeChatJob.count({where:{sessionId:s.id}}),2);
  assert.equal(await db.message.count({where:{sessionId:s.id,role:'user'}}),2);
  await db.knowledgeChatJob.update({where:{id:left.id},data:{status:'failed',errorCode:'KNOWLEDGE_CHAT_FAILED',errorMessage:'ARTICLE_AI_NUMERIC_REJECTED'}});
  const failed=await a.state(owner,s,{messages:[]});assert.equal(failed.jobs.find(j=>j.id===left.id).errorCode,'ARTICLE_AI_NUMERIC_REJECTED');
  assert.equal((await a.context(owner,pack.binding.recordId,left.requestKey)).latestTask.errorCode,'ARTICLE_AI_NUMERIC_REJECTED');
  await db.knowledgeChatJob.update({where:{id:left.id},data:{errorMessage:'PRIVATE_STACK_OR_SECRET_DO_NOT_EXPOSE'}});
  const unknown=await a.state(owner,s,{messages:[]});assert.equal(unknown.jobs.find(j=>j.id===left.id).errorCode,'KNOWLEDGE_CHAT_FAILED');assert(!JSON.stringify(unknown.jobs).includes('PRIVATE_STACK'));
},{write:true}));

test('B04 only new rollback fixtures exercise source withdrawal/version change, stale history and final publication rejection',()=>fixture(async(db,{owner})=>{
  const run=marker+'-run',candidate=marker+'-candidate',version=marker+'-version',pmcid='PMC99001001';
  await db.$executeRaw`INSERT INTO rh_source.pmc_run(id,tenant_id,hub_key,campaign_key,query_sha256,query_text,keyword_version)
    VALUES(${run},${ids.tenant},'lingshu-xinyu','pmc-first-2199-11-03',${'a'.repeat(64)},'B04 rollback synthetic only','b04')`;
  await db.$executeRaw`INSERT INTO rh_source.pmc_candidate(id,tenant_id,hub_key,run_id,campaign_key,pmcid,selected_rank)
    VALUES(${candidate},${ids.tenant},'lingshu-xinyu',${run},'pmc-first-2026-10-31',${pmcid},1)`;
  await db.$executeRaw`INSERT INTO rh_source.pmc_candidate_version(id,tenant_id,hub_key,candidate_id,campaign_key,pmcid,article_version,raw_sha256,license_uri,title,abstract_text,body_text,tables_json,expected_asset_count)
    VALUES(${version},${ids.tenant},'lingshu-xinyu',${candidate},'pmc-first-2026-10-31',${pmcid},${pmcid+'.1'},${'c'.repeat(64)},'https://creativecommons.org/licenses/by/4.0/','B04 synthetic fixed article','Synthetic abstract only.','Methods: synthetic design. Results: uncertain. Discussion: limited scope.','[{"label":"A","rows":[["synthetic"]]}]'::jsonb,1)`;
  const decide=visibility=>db.$executeRaw`INSERT INTO rh_source.pmc_article_decision(tenant_id,hub_key,version_id,visibility,reviewer_id) VALUES(${ids.tenant},'lingshu-xinyu',${version},${visibility},${ids.admin})`;
  await decide('public');
  const args={db,...scope,principal:owner,recordId:'pmc-'+pmcid},{pack}=await loadArticleEvidence(args);
  await assertCurrentArticleEvidence({...args,pack,lock:true});
  const before=await db.message.count({where:{tenantId:ids.tenant,content:marker}});
  for(const mutation of [
    ()=>db.$executeRaw`UPDATE rh_source.pmc_candidate_version SET body_text='changed later body' WHERE id=${version}`,
    ()=>decide('withheld'),
    ()=>db.$executeRaw`UPDATE rh_source.pmc_candidate_version SET article_version=${pmcid+'.2'} WHERE id=${version}`,
  ]){
    await db.$executeRawUnsafe('SAVEPOINT b04_change');await mutation();
    await assert.rejects(()=>assertCurrentArticleEvidence({...args,pack,lock:true}),/ARTICLE_|HUB_SOURCE_CHANGED/);
    await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT b04_change');
    await assertCurrentArticleEvidence({...args,pack});
  }
  assert.equal(await db.message.count({where:{tenantId:ids.tenant,content:marker}}),before);
  const canonical=await db.$queryRaw`SELECT ${JSON.stringify(pack)}::jsonb AS pack`;
  await assertCurrentArticleEvidence({...args,pack:canonical[0].pack});
  const ss=tx=>new SessionsService({forTenant:()=>tx},unused,unused,unused,unused,unused);
  const a=createArticleAi({ids,prisma:{withTenantTransaction:(_t,_g,_p,fn)=>fn(db)},sessionsInTx:ss,lockAuthorizationMutation,admission:()=>{throw Error('NO_PROVIDER');}});
  const s=await a.ensure(owner,pack.binding),text='请仅核对这篇合成文章',key=marker+'-withdraw';
  const m=await db.message.create({data:{tenantId:ids.tenant,sessionId:s.id,role:'assistant',content:'只作合成核对。[1]',meta:{provenance:hubAnswerProvenance([pack.source],[],pack)}}});
  const userMessage=await db.message.create({data:{tenantId:ids.tenant,sessionId:s.id,role:'user',content:text}});
  const inputHash=createHash('sha256').update(JSON.stringify({binding:articleContextKey(pack.binding),text,kbIds:[]})).digest('hex');
  const j=await db.knowledgeChatJob.create({data:{...{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project},accountId:owner.accountId,roleSnapshot:owner.role,sessionId:s.id,text,requestKey:key,status:'completed',userMessageId:userMessage.id,assistantMessageId:m.id,payload:{kbIds:[],attachments:[],articleEvidence:pack,articleInputHash:inputHash}}});
  assert.equal((await a.state(owner,s,{messages:[m]})).messages[0].meta.sourceStatus,'current');
  await db.knowledgeChatJob.update({where:{id:j.id},data:{payload:{kbIds:[],attachments:[],articleEvidence:pack,articleInputHash:inputHash,articleResponsePolicy:'rh-article-response.v3'}}});
  const raw=Object.fromEntries(['researchType','observations','limitations','relevance'].map(k=>[k,{text:'本次合成资料不足以判断疗效。',fragmentIds:['fragment-1']}]));
  raw.observations.text+='评分降至七。';const v3=parseArticleResponse(JSON.stringify(raw),pack,{policy:'rh-article-response.v3'});
  const projected={...m,content:v3.text,meta:{...m.meta,provenance:{...m.meta.provenance,articleModelInput:{schema:'rh-article-response-input.v3',responsePolicyVersion:'rh-article-response.v3'},articleResponseValidation:v3.validation,articleNumericEvidence:v3.numericEvidence}}};
  assert.equal((await a.state(owner,s,{messages:[projected]})).messages[0].meta.sourceStatus,'current');
  assert.equal((await a.state(owner,s,{messages:[{...projected,content:projected.content+' tampered'}]})).messages[0].meta.sourceStatus,'restricted');
  const missing=structuredClone(projected);delete missing.meta.provenance.articleResponseValidation;
  assert.equal((await a.state(owner,s,{messages:[missing]})).messages[0].meta.sourceStatus,'restricted');
  const downgraded=structuredClone(projected);delete downgraded.meta.provenance.articleResponseValidation;delete downgraded.meta.provenance.articleModelInput;downgraded.meta.provenance.articleNumericEvidence=[];downgraded.content='tampered v3 answer [1]';
  assert.equal((await a.state(owner,s,{messages:[downgraded]})).messages[0].meta.sourceStatus,'restricted');
  await db.knowledgeChatJob.update({where:{id:j.id},data:{status:'processing'}});
  const running=await a.prepare(owner,s.id,j.id);
  const accepted={...running,user:owner,jobId:j.id,articleInputProof:projected.meta.provenance.articleModelInput,articleAcceptedText:v3.text,articleResponseValidation:v3.validation,articleNumericEvidence:v3.numericEvidence};
  await a.validate(db,accepted);
  await assert.rejects(()=>a.validate(db,{...accepted,articleAcceptedText:v3.text+' forged'}),/ARTICLE_RESPONSE_CHANGED/);
  // New v4 jobs and historical v3 receipts must not be interchangeable even
  // when this particular response renders to the same words.
  const payload4={...(await db.knowledgeChatJob.findUnique({where:{id:j.id}})).payload,articleResponsePolicy:'rh-article-response.v4'};
  await db.knowledgeChatJob.update({where:{id:j.id},data:{payload:payload4}});
  const v4=parseArticleResponse(JSON.stringify(raw),pack),run4=await a.prepare(owner,s.id,j.id);
  const accepted4={...run4,user:owner,jobId:j.id,articleInputProof:{schema:'rh-article-response-input.v4',responsePolicyVersion:'rh-article-response.v4'},articleAcceptedText:v4.text,articleResponseValidation:v4.validation,articleNumericEvidence:v4.numericEvidence};
  await a.validate(db,accepted4);
  await assert.rejects(()=>a.validate(db,{...accepted4,articleInputProof:accepted.articleInputProof}),/ARTICLE_RESPONSE_CHANGED/);
  await assert.rejects(()=>a.validate(db,{...accepted4,articleResponseValidation:v3.validation}),/ARTICLE_RESPONSE_CHANGED/);
  await db.knowledgeChatJob.update({where:{id:j.id},data:{status:'completed'}});
  const projection4={...projected,content:v4.text,meta:{...projected.meta,provenance:{...projected.meta.provenance,articleModelInput:accepted4.articleInputProof,articleResponseValidation:v4.validation,articleNumericEvidence:v4.numericEvidence}}};
  assert.equal((await a.state(owner,s,{messages:[projection4]})).messages[0].meta.sourceStatus,'current');
  for(const schema of [undefined,'unknown','rh-article-response-input.v3']){
    const proof={...accepted4.articleInputProof,schema};
    await db.knowledgeChatJob.update({where:{id:j.id},data:{status:'processing'}});
    await assert.rejects(()=>a.validate(db,{...accepted4,articleInputProof:proof}),/ARTICLE_RESPONSE_CHANGED/);
    await db.knowledgeChatJob.update({where:{id:j.id},data:{status:'completed'}});
    const changed={...projection4,meta:{...projection4.meta,provenance:{...projection4.meta.provenance,articleModelInput:proof}}};
    assert.equal((await a.state(owner,s,{messages:[changed]})).messages[0].meta.sourceStatus,'restricted');
  }
  assert.equal((await a.state(owner,s,{messages:[projected]})).messages[0].meta.sourceStatus,'restricted');
  await db.knowledgeChatJob.update({where:{id:j.id},data:{status:'processing',payload:{...payload4,articleResponsePolicy:'rh-article-response.v3'}}});
  await decide('withheld');
  await assert.rejects(()=>a.validate(db,{...running,user:owner,jobId:j.id}),/ARTICLE_|HUB_SOURCE_CHANGED/);
  await db.knowledgeChatJob.update({where:{id:j.id},data:{status:'completed'}});
  const hidden=await a.state(owner,s,{messages:[m]});assert.equal(hidden.articleContext.status,'restricted');
  assert.equal(hidden.messages[0].meta.sourceStatus,'restricted');assert.equal(hidden.messages[0].meta.provenance,undefined);
  await assert.rejects(()=>a.source(owner,s,m),/ARTICLE_SOURCE_RESTRICTED/);
},{write:true}));

test('B04 final source lock actually excludes concurrent article-update lock while preserving stock',()=>fixture(async(db,{owner})=>{
  const args={db,...scope,principal:owner,recordId:'pmc-PMC13672493'},{pack}=await loadArticleEvidence(args);
  await assertCurrentArticleEvidence({...args,pack,lock:true});
  await assert.rejects(()=>withFixtureTransaction(env,'direct',async other=>{
    await other.$queryRaw`SELECT id FROM rh_source.pmc_candidate WHERE tenant_id=${ids.tenant} AND pmcid='PMC13672493' FOR UPDATE NOWAIT`;
  }),e=>e.meta?.code==='55P03'||/lock|55P03/i.test(e.message));
},{write:true}));
