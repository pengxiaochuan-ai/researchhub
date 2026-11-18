import test from 'node:test';
import assert from 'node:assert/strict';
import {extractClassification,projectClassification,parseArticleMetadata} from './publication-classification.mjs';

test('own review of RCTs is not itself an RCT; protocol is not completed original research',()=>{
 const review=extractClassification({title:'Acupuncture for depression: a systematic review of randomized controlled trials',abstract:'Background: randomized controlled trials are important.',sourceHash:'a'});
 assert.deepEqual(review.claims.filter(x=>x.facet==='types').map(x=>x.value),['systematic']);
 assert(!review.claims.some(x=>x.facet==='designs'&&x.value==='rct'));
 const protocol=extractClassification({title:'Acupuncture for depression: protocol for a randomized controlled trial',sourceHash:'a'});
 assert(!protocol.claims.some(x=>x.value==='rct'||x.value==='original'));
});
test('explicit title/methods have verbatim evidence, background and negation cannot assign study design',()=>{
 const c=extractClassification({title:'Electroacupuncture for depression: a randomized controlled trial',abstract:'Methods: Adult patients were randomly assigned to electroacupuncture or sham acupuncture.',sourceHash:'a'});
 for(const pair of [['designs','rct'],['people','adult'],['methods','electroacupuncture'],['diseases','depression']])assert(c.claims.some(x=>x.facet===pair[0]&&x.value===pair[1]));
 assert(c.claims.every(x=>x.quote&&x.rule&&['title','abstract','metadata'].includes(x.field)));
 const background=extractClassification({title:'A new perspective',abstract:'Background: Previous randomized controlled trials studied elderly adults with depression. Methods: We analyzed molecular pathways.',sourceHash:'b'});
 assert(!background.claims.some(x=>x.facet==='designs'||x.facet==='people'||x.facet==='diseases'));
 const negative=extractClassification({title:'A non-randomized controlled study of acupuncture',sourceHash:'c'});
 assert(!negative.claims.some(x=>x.value==='rct'));
});
test('current fields and source hash gate derived labels; unknown is not other',()=>{
 const input={title:'Novel treatment',abstract:'Methods: Adult patients with depression received electroacupuncture.',sourceHash:'a'},c=extractClassification(input);
 assert(projectClassification(c,input).values.people.includes('adult'));
 assert.deepEqual(projectClassification(c,{...input,abstract:null}).values.people,[]);
 const design=extractClassification({title:'Unspecified treatment',abstract:'Methods: This randomized controlled trial enrolled patients.',sourceHash:'a'});
 assert.deepEqual(projectClassification(design,{title:'Unspecified treatment',abstract:null,sourceHash:'a'}).values.types,[]);
 assert.deepEqual(projectClassification(c,{...input,sourceHash:'b'}).values.people,[]);
 assert.deepEqual(extractClassification({title:'Unclear article',sourceHash:'a'}).claims,[]);
});
test('negated and unicode-hyphen nonrandom designs never become RCTs',()=>{
 for(const title of ['Not a randomized controlled trial','A non‐randomized controlled trial of acupuncture','A non-randomized controlled study'])assert(!extractClassification({title,sourceHash:'a'}).claims.some(c=>c.value==='rct'),title);
});
test('stock overviews, plural meta-analyses, meta-regressions and letters do not inherit included RCT designs',()=>{
 for(const input of [
  {title:'The effectiveness and safety of acupuncture for depression: An overview of meta-analyses.',abstract:'METHODS: We searched MAs of randomized trials.'},
  {title:'The dose-effect association: A meta-regression of randomized controlled trials.',abstract:'Methods: We searched randomized controlled trials in databases.'},
  {title:'No One-Size-Fits-All Placebo: Advocating Context-Driven Placebo Control Selection in Acupuncture Randomized Controlled Trials for Insomnia [Letter].'},
  {title:'针灸治疗抑郁症随机对照试验的Meta分析'},
  {title:'An overview of meta‐analyses of randomized controlled trials'},
 ]){const c=extractClassification({...input,sourceHash:'a'});assert(!c.claims.some(x=>x.value==='rct'),input.title);assert(!c.claims.some(x=>x.value==='original'),input.title);}
});
test('mouse singular and own-abstract animal models cannot create human diagnoses/populations/RCT labels',()=>{
 for(const input of [
  {title:'Brain functional changes following electroacupuncture in a mouse model of comorbid pain and depression: A resting-state functional magnetic resonance imaging study.'},
  {title:'Acupuncture for depression in adult mouse models: a randomized controlled trial'},
  {title:'Acupuncture for depression: a randomized controlled trial',abstract:'Methods: Adult mice received electroacupuncture in a mouse model of depression.'},
 ]){const c=extractClassification({...input,sourceHash:'a'});assert(!c.claims.some(x=>['people','designs','diseases'].includes(x.facet)),input.title);}
});
test('JATS front metadata uses own article only; source date precision and language are preserved',()=>{
 const xml='<article article-type="review-article" xml:lang="en"><front><article-meta><article-id pub-id-type="pmcid">PMC123</article-id><pub-date pub-type="epub"><year>2026</year><month>2</month></pub-date></article-meta></front><back><ref><article article-type="research-article"/></ref></back></article>';
 const meta=parseArticleMetadata(xml,'PMC123');assert.equal(meta.articleType,'review-article');assert.equal(meta.language,'en');assert.equal(meta.publicationDate,'2026-02');
 assert.throws(()=>parseArticleMetadata(xml,'PMC456'));
 assert.throws(()=>parseArticleMetadata('<!DOCTYPE article [<!ENTITY x "x">]><article/>','PMC123'));
});
test('source flattened abstract headings without colons work; review overrides generic research metadata; animal models are not human depression diagnoses',()=>{
 const review=extractClassification({title:'Comorbidity Mechanism and Management',abstract:'ABSTRACT Objective This review systematically elaborates mechanisms. Method We reviewed published studies. Result The findings are described.',metadata:{articleType:'research-article'},sourceHash:'a'});
 assert(review.claims.some(c=>c.facet==='types'&&c.value==='review'&&c.field==='abstract'));assert(!review.claims.some(c=>c.value==='original'));
 const rct=extractClassification({title:'A new treatment',abstract:'Background Previous trials exist. Methods This randomized controlled trial enrolled adult patients with depression. Results Findings were recorded.',sourceHash:'a'});
 assert(rct.claims.some(c=>c.value==='rct'));assert(rct.claims.some(c=>c.value==='adult'));
 const rat=extractClassification({title:'Electroacupuncture improves depression‐like behaviors in rats',abstract:'Background Depression is common in adults. Methods We established a rat model.',sourceHash:'a'});
 assert(!rat.claims.some(c=>c.facet==='diseases'||c.facet==='people'||c.facet==='designs'));
});
