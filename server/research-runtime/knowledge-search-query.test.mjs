import test from 'node:test';import assert from 'node:assert/strict';
import {compileKnowledgeQuery}from'./knowledge-search-query.mjs';
test('Chinese questions become native keyword terms without a second query or model call',()=>{
 const r=compileKnowledgeQuery('人工审核流程是什么？');assert(r.terms.includes('人工'));assert(r.terms.includes('审核'));assert(r.terms.includes('流程'));assert(!r.terms.includes('什么'));assert.equal(r.query,r.terms.join(' '));assert.equal(r.original,'人工审核流程是什么？');
});
test('stop words never widen an empty question to the entire KB',()=>{const r=compileKnowledgeQuery('请问这些资料是什么？');assert.equal(r.terms.length,0);assert.equal(r.query,'');});
test('explicit terms are deduplicated and bounded to the original native six-term limit',()=>{
 const r=compileKnowledgeQuery('人工 审核 人工 方法 流程 来源 证据 局限 核对');assert(r.terms.length<=6);assert.equal(new Set(r.terms).size,r.terms.length);assert(r.terms.every(x=>x.length>=2));
});
