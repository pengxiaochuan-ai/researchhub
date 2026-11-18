import test from 'node:test';import assert from 'node:assert/strict';
import * as retrieval from './literature-retrieval.mjs';
import {planLiteratureQuery} from './literature-query.mjs';
const article={pmid:'35168522',title:'A public review',abstractText:'Limits of a public study.',journalInfo:{title:'Journal',pubDate:'2022'},doi:'10.1234/example',pubmedUrl:'https://evil.example/'};
test('real retrieval boundary binds fetched records to search ids and derives canonical links',async()=>{
 const result=await retrieval.retrievePubmed({plan:planLiteratureQuery('查找针灸治疗抑郁的文献'),call:async(name,args)=>name==='pubmed_search_articles'?{structuredContent:{pmids:['35168522'],totalCount:27}}:{structuredContent:{articles:[article]}}});
 assert.equal(result.sources[0].sourceUrl,'https://pubmed.ncbi.nlm.nih.gov/35168522/');assert.equal(result.sources[0].reviewStatus,'live-unreviewed');assert.equal(result.totalCount,27);assert.equal(result.returned,1);assert.equal(result.sources[0].coverage,'abstract');
});
test('a forged or unavailable fetched record is not substituted into the requested evidence',async()=>{
 await assert.rejects(()=>retrieval.retrievePubmed({plan:planLiteratureQuery('检索电针治疗抑郁'),call:async name=>name==='pubmed_search_articles'?{structuredContent:{pmids:['35168522'],totalCount:1}}:{structuredContent:{articles:[{...article,pmid:'999'}]}}}),/PUBMED_RECORD_MISMATCH/);
});
test('empty search is recorded exactly and never fetches or fabricates a record',async()=>{
 const r=await retrieval.retrievePubmed({plan:planLiteratureQuery('检索针灸治疗抑郁'),call:async name=>{if(name!=='pubmed_search_articles')throw Error('MUST_NOT_FETCH');return{structuredContent:{pmids:[],totalCount:0}};}});assert.deepEqual(r.sources,[]);assert.equal(r.totalCount,0);
});
