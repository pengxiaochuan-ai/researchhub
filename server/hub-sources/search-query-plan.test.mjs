import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {compileHubQuery} from './search-query-plan.mjs';
const dictionary=JSON.parse(readFileSync(new URL('./search-dictionary-v1.json',import.meta.url)));
const compile=q=>compileHubQuery(q,dictionary);
test('two_known_concepts_are_AND_groups_with_OR_variants_not_one_large_OR',()=>{
 const p=compile('针灸 抑郁');assert.equal(p.mode,'mapped');assert.equal(p.conceptGroups.length,2);assert(p.conceptGroups[0].terms.includes('acupuncture'));assert(p.conceptGroups[0].terms.includes('moxibustion'));assert(p.conceptGroups[1].terms.includes('depression'));assert.equal(p.conceptGroups[0].relationship,'broader_retrieval');
});
test('longest_chinese_and_english_phrases_win_without_diagnosis_substitution',()=>{
 assert.deepEqual(compile('癫狂').conceptGroups.map(g=>g.id),[12]);assert.deepEqual(compile('抑郁障碍').conceptGroups.map(g=>g.id),[21]);assert.deepEqual(compile('Electro-Acupuncture PTSD').conceptGroups.map(g=>g.id),[42,27]);
 assert.equal(compile('nonacupuncture').mode,'literal');assert.equal(compile('depressions').mode,'literal');assert(!compile('不寐').appliedTerms.includes('insomnia disorder'));assert(!compile('郁证').appliedTerms.includes('depressive disorder'));
});
test('disabled_terms_do_not_expand_and_unknown_meaningful_constraints_are_never_dropped',()=>{
 for(const q of ['卑惵','怵惕','狂越','不得卧','性功能障碍','针灸 癫痫','针灸 2025','针灸 未知词','针灸 asthma']){const p=compile(q);assert.equal(p.mode,'literal',q);assert.deepEqual(p.appliedTerms,[q]);assert(p.warning);}
});
test('negation_comparison_time_exclusion_and_boolean_queries_fall_back_without_rewriting',()=>{
 for(const q of ['不是针灸','排除抑郁','针灸或艾灸','针灸 AND 抑郁','acupuncture OR depression','no acupuncture','not acupuncture','acupuncture versus depression','针灸比艾灸','针灸之后抑郁','针灸-抑郁','针灸>抑郁','针灸（不含抑郁）'])assert.equal(compile(q).mode,'literal',q);
 assert.equal(compile('请帮我检索针灸和抑郁的研究').mode,'mapped');
});
test('identifier_mode_is_exact_and_original_input_is_retained',()=>{
 for(const [input,term]of [['pmc13691533','PMC13691533'],['10.1234/Example.12','10.1234/example.12'],['https://doi.org/10.1234/Example.12','10.1234/example.12']]){const p=compile(input);assert.equal(p.mode,'identifier');assert.deepEqual(p.appliedTerms,[term]);assert.deepEqual(p.conceptGroups,[]);assert.equal(p.originalQuery,input);}
 assert.equal(compile('https://doi.org.evil.test/10.1234/a').mode,'literal');assert.equal(compile('PMC13691533 抑郁').mode,'literal');assert.equal(compile('  针灸  ').originalQuery,'  针灸  ');
});
test('bounds_reject_instead_of_truncating_and_shared_variants_deduplicate',()=>{
 for(const q of ['', '针', 'x'.repeat(101), null, 123])assert.throws(()=>compile(q),e=>e.status===400);
 const q='情志病 郁证 脏躁 百合病 梅核气 惊悸 怔忡 不寐 嗜睡';assert.throws(()=>compile(q),e=>e.code==='HUB_QUERY_LIMIT');
 const large=structuredClone(dictionary);large.terms[19].en=Array.from({length:64},(_,i)=>'depression variant '+i);assert.throws(()=>compileHubQuery('抑郁',large),e=>e.code==='HUB_QUERY_LIMIT');
 const p=compile('针刺 acupuncture 针刺');assert.equal(p.conceptGroups.length,1);assert.equal(new Set(p.appliedTerms).size,p.appliedTerms.length);
});
test('snapshot_exactly_preserves_all_47_approved_rows_and_frozen_upstream_hashes',()=>{
 assert.equal(dictionary.terms.length,47);assert.deepEqual(dictionary.terms.filter(t=>!t.enabled).map(t=>t.id),[13,14,17,19,35]);assert.equal(dictionary.terms.filter(t=>t.enabled).length,42);
 const source=new URL('../../../researchhub-collector/docs/superpowers/specs/2026-10-31-pmc-query-terms-finalization.md',import.meta.url),data=readFileSync(source,'utf8');assert.equal(createHash('sha256').update(data).digest('hex'),dictionary.upstream.sha256);
 const rows=[...data.matchAll(/^\|\s*(\d+)\s*\|\s*(病证|干预)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*(启用|禁用)\s*\|/gm)];assert.equal(rows.length,47);
 for(const row of rows){const term=dictionary.terms.find(t=>t.id===Number(row[1]));assert.equal(term.zh,row[3].trim());assert.deepEqual(term.en,[...row[4].matchAll(/`([^`]+)`/g)].map(m=>m[1]));assert.equal(term.enabled,row[5]==='启用');assert.equal(term.group,row[2]);}
 for(const term of dictionary.terms){if(term.zh.length<2)assert.throws(()=>compile(term.zh),e=>e.code==='HUB_QUERY_INVALID');else{const plan=compile(term.zh);if(term.enabled){assert.equal(plan.mode,'mapped',term.zh);assert.equal(plan.conceptGroups[0].id,term.id);}else assert.equal(plan.mode,'literal');}if(term.enabled)for(const en of term.en){const english=compile(en.toUpperCase());assert.equal(english.mode,'mapped',en);assert.equal(english.conceptGroups[0].id,term.id);}}
 const raw=readFileSync(new URL('../../../researchhub-collector/src/hub_collector/keywords.py',import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),dictionary.upstream.rawKeywordsSha256);
});
test('compiler_is_pure_deterministic_and_does_not_mutate_frozen_snapshot',()=>{
 const before=JSON.stringify(dictionary);assert.deepEqual(compile('针灸 抑郁'),compile('针灸 抑郁'));assert.equal(JSON.stringify(dictionary),before);assert.equal(compile('针灸').dictionaryVersion,dictionary.version);
});
