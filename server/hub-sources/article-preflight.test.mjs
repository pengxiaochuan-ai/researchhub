// Characterization probes for B01, not the new article-AI implementation.
// Only new, uncommitted test rows are written; every write transaction rolls back.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {listVisiblePmc} from './pmc-visible.mjs';
import {runHubSourceSearch,assertCurrentAiSources,assertHubPublicationSources} from './agent-retrieval.mjs';

const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const scope={tenantId:ids.tenant,hubKey:'lingshu-xinyu'};
const hash=text=>createHash('sha256').update(text).digest('hex');
const marker='ba-preflight-'+randomUUID();
const evidence={at:new Date().toISOString(),probe:marker,modelRequests:0,persistentFixtureWrites:0,gates:[]};
const observedFiles=['scripts/local-knowledge.mjs','scripts/local-knowledge-ai.mjs',
  'server/hub-sources/read-controller.mjs','server/hub-sources/visible-repository.mjs',
  'server/hub-sources/pmc-visible.mjs','server/hub-sources/agent-retrieval.mjs',
  '../app/server/src/sessions/sessions.service.ts'];
const beforeHashes=Object.fromEntries(observedFiles.map(path=>[path,hash(readFileSync(path))]));
const budgetPath='../.tmp/researchhub-knowledge-local/ai-budget-20261022.json';
const budgetBefore=hash(readFileSync(budgetPath));
const guarded=async(fn,{readOnly=true,kind='app'}={})=>{
  const identity=await assertFixtureTarget(env);assert.equal(identity.databaseName,'wp01_test_full_baseline');
  return withFixtureTransaction(env,kind,async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    await db.$executeRaw`SELECT set_config('app.study_group_id',${ids.group},true)`;
    await db.$executeRaw`SELECT set_config('app.research_project_id',${ids.project},true)`;
    return fn(db);
  },{readOnly});
};
const account=async(db,id=ids.owner)=>{
  const row=await db.account.findFirst({where:{id,tenantId:ids.tenant,status:'active'},
    select:{id:true,role:true,authVersion:true,isTenantAdmin:true}});assert.ok(row);
  return{accountId:row.id,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,
    role:row.role,authVersion:row.authVersion,isTenantAdmin:row.isTenantAdmin};
};
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {SessionsService}=require('./src/sessions/sessions.service.ts');
const unused=new Proxy({},{get(){throw Error('PREFLIGHT_OUT_OF_SCOPE_SERVICE');}});

after(()=>{
  const path='docs/planning/bilingual-article-ai-2026-11-02/preflight.json';
  const dir='docs/testing/evidence/bilingual-preflight/';mkdirSync(dir,{recursive:true});
  if(existsSync(path)){
    const previous=JSON.parse(readFileSync(path,'utf8'));
    writeFileSync(dir+previous.probe+'.json',JSON.stringify(previous,null,2));
  }
  evidence.observedFiles=Object.entries(beforeHashes).map(([path,before])=>({path,before,
    after:hash(readFileSync(path)),unchanged:before===hash(readFileSync(path))}));
  evidence.budgetLedgerUnchanged=budgetBefore===hash(readFileSync(budgetPath));
  evidence.passed=evidence.gates.length===3&&evidence.budgetLedgerUnchanged;
  writeFileSync(path,JSON.stringify(evidence,null,2));
  writeFileSync(dir+marker+'.json',JSON.stringify(evidence,null,2));
  assert.equal(evidence.budgetLedgerUnchanged,true,'BUDGET_LEDGER_CHANGED_DURING_PREFLIGHT');
});

test('B01 PostgreSQL can apply all concept groups before pagination rather than combining separate first pages',()=>guarded(async db=>{
  const data=JSON.stringify([{id:'01',title:'acupuncture only'},{id:'02',title:'depression only'},
    {id:'03',title:'acupuncture for depression'},{id:'04',title:'针灸与抑郁'}]);
  const groups=JSON.stringify([['acupuncture','针灸'],['depression','抑郁']]);
  const page=async cursor=>db.$queryRaw`
    SELECT x.id FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,title text)
    WHERE x.id>${cursor} AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(${groups}::jsonb) AS g(terms)
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(g.terms) AS t(term)
        WHERE strpos(lower(x.title),lower(t.term))>0))
    ORDER BY x.id LIMIT 1`;
  assert.deepEqual(await page(''),[{id:'03'}]);assert.deepEqual(await page('03'),[{id:'04'}]);
  assert.deepEqual(await page('04'),[]);
  evidence.gates.push({name:'pg-filter-before-page',passed:true,productionQueryPlanImplemented:false});
}));

test('B01 old Session service accepts scoped text context and old JSON fields round-trip a full evidence pack, all rolled back',async()=>{
  const rollback='EXPECTED_'+marker;let sessionId;
  await assert.rejects(()=>guarded(async db=>{
    const user=await account(db);
    const binding={recordId:'pmc-PMC13672493',articleVersion:'synthetic-'+marker,
      rawSha256:'a'.repeat(64),reviewVersion:'article:1'};
    const contextKey='hub-article:v1:'+Buffer.from(JSON.stringify(binding)).toString('base64url');
    assert.ok(Buffer.byteLength(contextKey)<=768);
    const sessions=new SessionsService({forTenant:()=>db},unused,unused,unused,unused,unused);
    const first=await sessions.ensureKnowledgeSession(user,ids.tenant+'-kb-research',contextKey,marker);
    const again=await sessions.ensureKnowledgeSession(user,ids.tenant+'-kb-research',contextKey,marker);
    assert.equal(first.id,again.id);sessionId=first.id;
    const pack={binding,policyVersion:'preflight-only',fragments:Array.from({length:6},(_,i)=>({
      field:'body',offset:i*1000,length:1000,text:('合成片段'+i).repeat(200).slice(0,1000)}))};
    for(const f of pack.fragments)f.textHash=hash(f.text);
    pack.packHash=hash(JSON.stringify(pack));
    const userMessage=await db.message.create({data:{tenantId:ids.tenant,sessionId,role:'user',content:marker}});
    const assistant=await db.message.create({data:{tenantId:ids.tenant,sessionId,role:'assistant',content:'回滚合成占位，未调用模型。',meta:{provenance:{articleEvidence:pack}}}});
    const job=await db.knowledgeChatJob.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,
      researchProjectId:ids.project,sessionId,accountId:user.accountId,roleSnapshot:user.role,
      requestKey:marker,status:'failed',text:marker,payload:{articleEvidence:pack,kbIds:[]},
      userMessageId:userMessage.id,assistantMessageId:assistant.id,errorCode:'PREFLIGHT_NO_EXECUTION',completedAt:new Date()}});
    const stored=await db.message.findUnique({where:{id:assistant.id}});
    const queued=await db.knowledgeChatJob.findUnique({where:{id:job.id}});
    assert.deepEqual(stored.meta.provenance.articleEvidence,pack);assert.deepEqual(queued.payload.articleEvidence,pack);
    assert.equal((await db.session.findUnique({where:{id:sessionId}})).contextKey,contextKey);
    evidence.gates.push({name:'old-context-and-json-roundtrip',passed:true,authVersion:user.authVersion,
      contextBytes:Buffer.byteLength(contextKey),packBytes:Buffer.byteLength(JSON.stringify(pack)),
      rows:'new rollback session/message/failed-job only',realQueueExecution:false});
    throw Error(rollback);
  },{readOnly:false}),new RegExp(rollback));
  await guarded(async db=>{
    assert.equal(await db.session.findUnique({where:{id:sessionId}}),null);
    assert.equal(await db.knowledgeChatJob.count({where:{requestKey:marker}}),0);
  });
});

test('B01 current source lock and revalidation can reject an invalid later fragment before assistant INSERT in the same transaction',async()=>{
  const rollback='EXPECTED_FENCE_'+marker;
  await assert.rejects(()=>guarded(async db=>{
    const principal=await account(db),items=await listVisiblePmc({db,...scope});
    const item=items.find(x=>x.id==='pmc-PMC13672493')||items[0];assert.ok(item);
    const search=await runHubSourceSearch({db,...scope,principal,query:item.title.slice(0,70)});
    const source=search.meta.sources.find(s=>s.pmcRecordId===item.id);assert.ok(source);
    const before=await db.message.count({where:{tenantId:ids.tenant,content:marker}});
    await assertHubPublicationSources({db,...scope,principal,sources:[source]});
    await assertCurrentAiSources({db,...scope,principal,sources:[source]});
    const invalidLater={...source,snippetHash:'0'.repeat(64)};
    await assert.rejects(async()=>{
      // Sequential checks occur on this same real PG transaction before INSERT.
      for(const fragment of [source,invalidLater])await assertCurrentAiSources({db,...scope,principal,sources:[fragment]});
      await db.message.create({data:{tenantId:ids.tenant,sessionId:'never-reached',role:'assistant',content:marker}});
    },/HUB_SOURCE_CHANGED/);
    assert.equal(await db.message.count({where:{tenantId:ids.tenant,content:marker}}),before);
    evidence.gates.push({name:'source-lock-and-later-fragment-rejection',passed:true,
      article:item.id,reviewVersion:source.reviewVersion,authVersion:principal.authVersion,
      newArticleEvidenceValidatorImplemented:false});
    throw Error(rollback);
  },{readOnly:false,kind:'direct'}),new RegExp(rollback));
});
