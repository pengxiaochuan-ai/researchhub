import test from 'node:test';
import assert from 'node:assert/strict';
import * as contract from './hub-agent-contract.mjs';
test('readonly Hub routing cannot mistake a negated creation request for write permission; original question survives synthesis',()=>{
 assert.equal(typeof contract.hubCoreQuestion,'string');assert.equal(typeof contract.bindHubSynthesisQuestion,'function');
 const query='请概括这篇研究局限，不新增计算。';
 const messages=[{role:'system',content:'保持系统指令'},{role:'user',content:'用户问题：'+contract.hubCoreQuestion+'\n\n【确定性知识库工具证据】\n[1] 来源'}];
 const bound=contract.bindHubSynthesisQuestion(messages,query);assert(bound[1].content.startsWith('用户问题：'+query+'\n'));assert(bound[1].content.endsWith('[1] 来源'));assert.equal(bound[0].content,messages[0].content);
 assert.throws(()=>contract.bindHubSynthesisQuestion([{role:'user',content:'其他输入'}],query));
});
import { HUB_CONTEXT_KEY, HUB_TOOL_KB_ID, isHubSession, assertHubToolResult, hubAnswerProvenance, projectHubMessages } from './hub-agent-contract.mjs';
import {articleContextKey,buildArticleEvidencePack} from '../server/hub-sources/article-evidence.mjs';

test('article branch cannot fall through to general Hub or private KB and seals its own provenance',()=>{
  const item={id:'pmc-PMC99001001',title:'Synthetic article',doi:null,sourceUrl:'https://pmc.ncbi.nlm.nih.gov/articles/PMC99001001/',sourceName:'PubMed Central',articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1',aiReviewVersion:'article:1',body:'Only this article.',bodyDisplayVersion:'article:1',bodyAiReviewVersion:'article:1'};
  const pack=buildArticleEvidencePack(item),contextKey=articleContextKey(pack.binding);
  assert.equal(isHubSession({contextKey}),true);
  const p=hubAnswerProvenance([pack.source],[],pack);
  assert.equal(p.answerScope,'fixed-reviewed-article');assert.deepEqual(p.articleEvidence,pack);
  assert.throws(()=>hubAnswerProvenance([{...pack.source,pmcRecordId:'pmc-PMC99001002'}],[],pack),/ARTICLE_EVIDENCE_CHANGED/);
});

test('Hub conversation has a distinct context and never becomes a Study KB source', () => {
  assert.equal(HUB_CONTEXT_KEY, 'hub:lingshu-xinyu');
  assert.equal(isHubSession({contextKey:HUB_CONTEXT_KEY}), true);
  assert.equal(isHubSession({contextKey:'kb:lingshu-xinyu'}), false);
  assert.notEqual(HUB_TOOL_KB_ID, 'lingshu-xinyu');
  const source={index:1,sourceRecordId:'rhsr-'+'a'.repeat(40),snippetHash:'b'.repeat(64)};
  const result={result:'[1] 合成来源',mutated:false,meta:{toolName:'hub_source_search',sources:[source]}};
  assert.deepEqual(assertHubToolResult(result),[source]);
  const provenance=hubAnswerProvenance([source],[{tool:'hub_source_search'}]);
  assert.equal(provenance.sourcePolicy,'rh-hub-reviewed-source-v1');
  assert.equal(provenance.sourceType,'hub-reviewed-publication');
  assert.equal('knowledgeSources' in provenance,false);
  assert.deepEqual(provenance.hubSources,[source]);
});

test('Hub tool rejects empty, mutating and old KB-shaped results', () => {
  for(const value of [null,{result:'none',mutated:false,meta:{toolName:'hub_source_search',sources:[]}},{result:'[1] old',mutated:false,meta:{sources:[{docId:'kb-doc'}]}},{result:'[1] bad',mutated:true,meta:{toolName:'hub_source_search',sources:[{sourceRecordId:'rhsr-'+'a'.repeat(40)}]}}])
    assert.throws(()=>assertHubToolResult(value),/HUB_AGENT_NO_EVIDENCE/);
});

test('external Hub metadata uses a separate tagged citation type', () => {
  const source={index:1,externalDocumentId:'rhed-'+'a'.repeat(40),snippetHash:'b'.repeat(64)};
  assert.deepEqual(assertHubToolResult({result:'[1] 外部来源元数据',mutated:false,
    meta:{toolName:'hub_source_search',sources:[source]}}),[source]);
  assert.equal(hubAnswerProvenance([source],[]).sourceType,'hub-reviewed-external-metadata');
  assert.throws(()=>assertHubToolResult({result:'[1] bad',mutated:false,
    meta:{toolName:'hub_source_search',sources:[{...source,sourceRecordId:'rhsr-'+'c'.repeat(40)}]}}),/HUB_AGENT_NO_EVIDENCE/);
});

test('reviewed PMC source is accepted as a distinct Hub citation', () => {
  const source={index:1,pmcRecordId:'pmc-PMC13691533',snippetHash:'b'.repeat(64)};
  assert.deepEqual(assertHubToolResult({result:'[1] PMC',mutated:false,
    meta:{toolName:'hub_source_search',sources:[source]}}),[source]);
  assert.equal(hubAnswerProvenance([source],[]).sourceType,'hub-reviewed-pmc-article');
  assert.throws(()=>assertHubToolResult({result:'[1] bad',mutated:false,
    meta:{toolName:'hub_source_search',sources:[{...source,sourceRecordId:'rhsr-'+'c'.repeat(40)}]}}),/HUB_AGENT_NO_EVIDENCE/);
});

test('history projection checks many answers in one bounded sequential read', async () => {
  let active=0, peak=0, calls=0;
  const messages=Array.from({length:60},(_,i)=>({role:'assistant',content:`answer ${i}`,meta:{provenance:{hubSources:[{sourceRecordId:`id-${i}`}]}}}));
  const projected=await projectHubMessages(messages,async sources=>{
    active++;peak=Math.max(peak,active);calls++;
    await new Promise(resolve=>setTimeout(resolve,1));
    active--;
    if(sources[0].sourceRecordId==='id-5')throw new Error('revoked');
  });
  assert.equal(peak,1);
  assert.equal(calls,60);
  assert.equal(projected[0].meta.sourceStatus,'current');
  assert.equal(projected[5].meta.sourceStatus,'restricted');
  assert.match(projected[5].content,/不再交付/);
});
