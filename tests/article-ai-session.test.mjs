import test from 'node:test';import assert from 'node:assert/strict';
import {readArticleAiRoute,articleAiHref,articleEvidenceHref,readArticleLocation,articleRawRange,articleInputHash,createArticleAiSession,ARTICLE_DEFAULT_QUESTION} from '../src/article-ai-session.js';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
import {realModeRouteState} from '../src/real-mode-route.js';
import {createKnowledgeClient} from '../src/knowledge-session.js';
const binding={recordId:'pmc-PMC99001001',articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1'};
const fragment={id:'fragment-1',field:'body',offset:0,length:15,text:'Synthetic body.',textHash:'b'.repeat(64),locator:{kind:'field-offset'}};
const pack={binding,policyVersion:'rh-article-evidence-v1',packHash:'c'.repeat(64),source:{pmcRecordId:binding.recordId,title:'Synthetic article',sourceUrl:'https://pmc.ncbi.nlm.nih.gov/articles/PMC99001001/'},coverage:{notice:'基于本次选取的原文片段，非全文逐字审阅',characters:15},omissions:[],fragments:[fragment]};
const article=()=>({binding,title:'Synthetic article',coverage:pack.coverage,evidence:pack,packHash:pack.packHash,omissions:[],execution:{canStart:true},existingSessionId:null,latestTask:null});
const setup=(overrides={})=>{
  const calls=[],views=[],receipts=[];let context=article(),state={articleContext:{binding},messages:[],jobs:[]};
  const client={get:async path=>{calls.push(['GET',path]);if(path==='/agents')return[{id:'research-agent',type:'research'}];if(path==='/knowledge/ai-status')return{budget:{blocked:false}};if(path.startsWith('/hub-sources/article-context/'))return structuredClone(context);if(path.endsWith('/knowledge-state?limit=60'))return structuredClone(state);throw Error('UNEXPECTED_GET '+path);},post:async(path,data)=>{calls.push(['POST',path,structuredClone(data)]);if(path==='/sessions/hub-source'){context.existingSessionId='session-1';return{id:'session-1'};}const j={id:'job-1',requestKey:data.requestKey,inputHash:receipts.at(-1).inputHash,status:'queued'};state.jobs=state.jobs.map(v=>v.id===j.id?{...j,...v}:v);return j;}};
  Object.assign(client,overrides.client);
  const {client:transport,...options}=overrides;
  const machine=createArticleAiSession({recordId:binding.recordId,client,onChange:s=>views.push(s),onRecovery:r=>receipts.push(r),wait:async()=>{},maxPolls:2,...options});
  return {machine,calls,views,receipts,get view(){return views.at(-1);},setContext:v=>context=v,setResult:v=>state=v};
};
test('completion receipt arriving before its message keeps readonly polling, never reports a model failure or resends',async()=>{
 let t,reads=0;
 t=setup({client:{get:async path=>{
  if(path==='/agents')return[{id:'research-agent',type:'research'}];
  if(path==='/knowledge/ai-status')return{quota:{blocked:false}};
  if(path.startsWith('/hub-sources/article-context/'))return article();
  const pending=t.receipts.at(-1),j={id:'job-1',requestKey:pending.requestKey,inputHash:pending.inputHash,status:'completed',assistantMessageId:'answer'};
  return{articleContext:{binding},jobs:[j],messages:++reads===1?[]:[{id:'answer',role:'assistant',content:'真实结果',meta:{sourceStatus:'current',provenance:{articleEvidence:pack}}}]};
 }}});
 await t.machine.open();await t.machine.send();
 assert.equal(reads,2);assert.equal(t.view.phase,'completed');assert.equal(t.view.answer.content,'真实结果');
 assert(!t.views.some(v=>v.phase==='failed'));assert.equal(t.calls.filter(c=>c[0]==='POST').length,2);
});
test('expired development budget cannot disable an article allowed by business token quota',async()=>{
  // The historical development field is deliberately hostile; it is not business admission.
  const t=setup({client:{get:async path=>path==='/agents'?[{id:'a',type:'research'}]:path==='/knowledge/ai-status'?{budget:{blocked:true,pricingExpired:true},quota:{blocked:false}}:article()}});
  await t.machine.open();await t.machine.send();
  assert(t.calls.some(c=>c[0]==='POST'),'business-authorized send must not be blocked by a historical development field');
});
test('strict article route and login roundtrip never fall into demo or carry caller context',()=>{
  const href=articleAiHref(binding.recordId);assert.equal(href,'/pages/ai01/?articleId=pmc-PMC99001001');
  assert.equal(readArticleAiRoute('?articleId=pmc-PMC99001001').recordId,binding.recordId);
  assert.equal(realModeRouteState('ai01','?articleId=pmc-PMC99001001',{configured:true}),'entry');
  assert.equal(safeAuthenticatedReturnTo(href),href);
  for(const q of ['?articleId=../../x','?articleId=pmc-PMC1&articleId=pmc-PMC2','?articleId=pmc-PMC1&tenantId=other','?requestKey=forged'])assert.equal(readArticleAiRoute(q).kind,'invalid');
  assert.equal(safeAuthenticatedReturnTo(href+'&returnTo=https://evil.example'),'/pages/p01/');
});
test('source backlink preserves all binding fields and raw text layout offsets, rejects mixed versions',()=>{
  const href=articleEvidenceHref(binding,fragment),location=readArticleLocation(new URL(href,'http://local').search);
  assert.deepEqual(location.binding,binding);assert.equal(location.field,'body');assert.equal(location.length,15);
  const range=articleRawRange('  Synthetic\n  body. More',0,15);assert.equal('  Synthetic\n  body. More'.slice(range.start,range.end),'Synthetic\n  body.');
  assert.throws(()=>articleEvidenceHref({...binding,recordId:'pmc-PMC2'},fragment));
  assert.throws(()=>readArticleLocation('?recordId=pmc-PMC99001001&evidenceField=body&evidenceOffset=-1'));
});
test('enter and refresh only GET the exact fixed article and never ensure or enqueue',async()=>{
  const s=setup();await s.machine.open();assert.equal(s.view.article.title,'Synthetic article');assert.equal(s.view.question,ARTICLE_DEFAULT_QUESTION);
  await s.machine.refresh();assert(s.calls.every(c=>c[0]==='GET'));assert.equal(s.view.sessionId,null);
});
test('known numeric validation failure explains the failed output instead of claiming source loss, never retries',async()=>{
 const requestKey='article-known-numeric-failure',inputHash=await articleInputHash(binding,ARTICLE_DEFAULT_QUESTION),j={id:'failed-numeric',status:'failed',requestKey,inputHash,errorCode:'ARTICLE_AI_NUMERIC_REJECTED',userMessageId:'u'};
 const t=setup({recovery:{requestKey,inputHash}});t.setContext({...article(),existingSessionId:'session-1',latestTask:j});t.setResult({articleContext:{binding},jobs:[j],messages:[{id:'u',role:'user',content:ARTICLE_DEFAULT_QUESTION}]});
 await t.machine.open();assert.equal(t.view.phase,'failed');assert.match(t.view.error,/数值.*来源.*语境/);assert.doesNotMatch(t.view.error,/来源失效/);assert.equal(t.view.question,ARTICLE_DEFAULT_QUESTION);assert(t.calls.every(c=>c[0]==='GET'));
});
test('new response policy distinguishes no usable sections from source or model protocol failure without POST',async()=>{
 const requestKey='article-no-deliverable-response',inputHash=await articleInputHash(binding,ARTICLE_DEFAULT_QUESTION),j={id:'failed-response',status:'failed',requestKey,inputHash,errorCode:'ARTICLE_NO_DELIVERABLE_SECTIONS',userMessageId:'u'};
 const t=setup({recovery:{requestKey,inputHash}});t.setContext({...article(),existingSessionId:'session-1',latestTask:j});t.setResult({articleContext:{binding},jobs:[j],messages:[{id:'u',role:'user',content:ARTICLE_DEFAULT_QUESTION}]});await t.machine.open();assert.match(t.view.error,/没有可交付/);assert.equal(t.view.question,ARTICLE_DEFAULT_QUESTION);assert(t.calls.every(c=>c[0]==='GET'));
});
test('lost ensure receipt first recovers existing session by GET without another POST or auto send',async()=>{
  let posts=0;const t=setup({client:{post:async()=>{posts++;throw Error('lost ensure response');}}});await t.machine.open();t.setContext({...article(),existingSessionId:'session-1'});
  await t.machine.send();assert.equal(t.view.sessionId,'session-1');assert.equal(t.view.phase,'uncertain');
  assert.equal(t.view.answer,null);assert(t.receipts.at(-1).requestKey);assert(t.calls.some(c=>c[1].includes('?requestKey=')));
  assert.equal(posts,1);
});
test('late running job stays running; completed old answer never masquerades as current result',async()=>{
  const s=setup();await s.machine.open();
  s.setResult({articleContext:{binding},jobs:[{id:'job-1',status:'processing'}],messages:[{id:'old-answer',role:'assistant',content:'old'}]});
  await s.machine.send();assert.equal(s.view.phase,'running');assert.equal(s.view.answer,null);assert.equal(s.view.question,ARTICLE_DEFAULT_QUESTION);
  await s.machine.refresh();assert.equal(s.calls.filter(c=>c[0]==='POST').length,2);
});
test('fixed article transport accepts only bounded readonly context and preserves scope headers',async()=>{
  const calls=[],client=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'study'}),fetchImpl:async(url,init)=>{calls.push({url,init});return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
  await client.get('/hub-sources/article-context/'+binding.recordId+'?requestKey=article-readonly');
  assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.headers['X-Research-Project-Id'],'study');
  await assert.rejects(client.post('/hub-sources/article-context/'+binding.recordId,{}));
  await assert.rejects(client.get('/hub-sources/article-context/'+binding.recordId+'?tenantId=other'));assert.equal(calls.length,1);
});
test('disposal/identity pause discards delayed evidence and never resumes with a mutation',async()=>{
  let release;const response=new Promise(r=>release=r);
  const s=setup({client:{get:async path=>path==='/agents'?[{id:'a',type:'research'}]:path==='/knowledge/ai-status'?{budget:{blocked:false}}:response}});
  const p=s.machine.open();s.machine.dispose();release(article());await p;
  assert(!s.views.some(x=>x.article?.title==='Synthetic article'));
});
test('browser input hash matches canonical backend contract, source-only title cannot substitute another article',async()=>{
  const {createHash}=await import('node:crypto');const {articleContextKey}=await import('../server/hub-sources/article-evidence.mjs');
  const expected=createHash('sha256').update(JSON.stringify({binding:articleContextKey(binding),text:ARTICLE_DEFAULT_QUESTION,kbIds:[]})).digest('hex');
  assert.equal(await articleInputHash(binding,'  '+ARTICLE_DEFAULT_QUESTION+'  '),expected);
  const s=setup();s.setContext({...article(),evidence:{...pack,source:{...pack.source,pmcRecordId:'pmc-PMC2'}}});await s.machine.open();assert.equal(s.view.kind,'restricted');assert.equal(s.view.article,null);
});
test('lost enqueue acknowledgement recovers only exact task, full reload restores question and completed provenance without POST',async()=>{
  const text='核对这篇文章',requestKey='article-saved-recovery',inputHash=await articleInputHash(binding,text);
  const job={id:'job-fresh',status:'completed',requestKey,inputHash,userMessageId:'user-fresh',assistantMessageId:'answer-fresh'};
  const result={articleContext:{binding},jobs:[job],messages:[{id:'user-fresh',role:'user',content:text},{id:'answer-old',role:'assistant',content:'not current'},{id:'answer-fresh',role:'assistant',content:'本次合成解读',meta:{sourceStatus:'current',provenance:{articleEvidence:pack}}}]};
  const s=setup({recovery:{requestKey,inputHash}});s.setContext({...article(),existingSessionId:'session-1',latestTask:job});s.setResult(result);await s.machine.open();
  assert.equal(s.view.phase,'completed');assert.equal(s.view.question,text);assert.equal(s.view.answer.id,'answer-fresh');assert(s.calls.every(x=>x[0]==='GET'));
  s.setResult({...result,jobs:[{...job,inputHash:'d'.repeat(64)}]});await s.machine.refresh();assert.equal(s.view.kind,'restricted');assert.equal(s.view.answer,null);
  let posts=0;const t=setup({client:{post:async(path,data)=>{posts++;if(path==='/sessions/hub-source')return{id:'session-1'};
    t.setContext({...article(),existingSessionId:'session-1',latestTask:{...job,requestKey:data.requestKey,inputHash:t.receipts.at(-1).inputHash,status:'processing'}});
    t.setResult({articleContext:{binding},jobs:[{...job,requestKey:data.requestKey,inputHash:t.receipts.at(-1).inputHash,status:'processing'}],messages:[]});throw Error('lost enqueue response');}}});
  await t.machine.open();await t.machine.send();assert.equal(posts,2);assert.equal(t.view.phase,'running');await t.machine.refresh();assert.equal(posts,2);
});
test('paid restriction prevents any POST and identity/source loss immediately clears delivered evidence',async()=>{
  const s=setup();s.setContext({...article(),execution:{canStart:false,code:'ARTICLE_PAID_NOT_APPROVED'}});await s.machine.open();await s.machine.send();assert(s.calls.every(x=>x[0]==='GET'));
  s.machine.pause();assert.equal(s.view.article,null);assert.equal(s.view.paused,true);await s.machine.open();assert(s.calls.every(x=>x[0]==='GET'));
  s.setContext({...article(),binding:{...binding,reviewVersion:'article:2'}});await s.machine.refresh();assert.equal(s.view.kind,'restricted');assert.equal(s.view.article,null);
});
test('completed real article state refreshes business quota and does not overwrite a newer unsent draft',async()=>{
 const text='原先发送的问题',requestKey='article-completed-fee',inputHash=await articleInputHash(binding,text),job={id:'done',status:'completed',requestKey,inputHash,userMessageId:'u',assistantMessageId:'a'};
 const s=setup({recovery:{requestKey,inputHash}});s.setContext({...article(),existingSessionId:'session-1',latestTask:job});
 s.setResult({articleContext:{...article(),execution:{canStart:false,quota:{blocked:true}}},jobs:[job],messages:[{id:'u',role:'user',content:text},{id:'a',role:'assistant',content:'本次回答。[1]',meta:{sourceStatus:'current',provenance:{articleEvidence:pack}}}]});
 await s.machine.open();assert.equal(s.view.article.execution.canStart,false);assert.equal(s.view.quota.blocked,true);s.machine.setQuestion('本人新修改但未发送的问题');await s.machine.refresh();assert.equal(s.view.question,'本人新修改但未发送的问题');assert(s.calls.every(c=>c[0]==='GET'));
});
test('generic session recovery is separate from article recovery and rejects mixed or repeated scope parameters',()=>{
 assert.deepEqual(readArticleAiRoute('?sessionId=owned-123'),{kind:'hub',sessionId:'owned-123'});
 for(const value of ['?sessionId=a&articleId=pmc-PMC99001001','?sessionId=a&requestKey=abcdefgh','?sessionId=a&sessionId=b','?sessionId=../../x'])assert.equal(readArticleAiRoute(value).kind,'invalid');
});
