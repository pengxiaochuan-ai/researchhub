import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeAssertion,parseDirectoryQuery,normalizeEntityCommand,normalizeDecisionCommand,directoryHash} from './contract.mjs';
const key='00000000-0000-4000-8000-000000000001',prov=[{kind:'source_record',sourceId:'source-test',rowId:'row-test',versionId:null,sourceHash:'a'.repeat(64),locator:'表1，第2行，摘要字段',fieldNames:['abstract']}];
const profile={assertionKey:'profile',kind:'profile',relatedEntityId:null,expectedRevision:0,requestKey:key,payload:{name:'合成团队',summary:'本机合成材料',directions:['针灸'],aliases:[],city:null,organizationType:null,teamType:'项目研究团队',rank:null,researchRole:null,photo:null,hubMatch:{status:'UNVERIFIED',tier:null,reason:null}},provenance:prov};
test('fixed profile contracts reject private fields, fake totals, identity claims and unreviewed relevance',()=>{
 assert.equal(normalizeAssertion(profile,'team').payload.name,'合成团队');
 for(const payload of [{...profile.payload,email:'private@test'},{...profile.payload,papers:99},{...profile.payload,level:'L3'},{...profile.payload,hubMatch:{status:'CONFIRMED',tier:'HIGH_RELEVANCE',reason:''}}])assert.throws(()=>normalizeAssertion({...profile,payload},'team'));
 assert.throws(()=>normalizeAssertion({...profile,payload:{...profile.payload,photo:'https://example.org/photo.jpg'}},'team'));
});
test('sources require a pinned existing source kind, hash, bounded locator and exact approved source fields',()=>{
 for(const p of [{...prov[0],kind:'url'},{...prov[0],sourceHash:'x'},{...prov[0],locator:''},{...prov[0],fieldNames:['raw_fields']},{...prov[0],accountId:'other'}])assert.throws(()=>normalizeAssertion({...profile,provenance:[p]},'team'));
 assert.throws(()=>normalizeAssertion({...profile,provenance:[]},'team'));
});
test('coverage is an explicit relation-set confirmation, not a client-provided career count',()=>{
 const c={...profile,assertionKey:'coverage:public:members',kind:'coverage',payload:{audienceScope:'public',metric:'members',status:'VERIFIED_INDEXED_SET',relationSetHash:'b'.repeat(64),note:'核对当前已收录集合'}};
 assert.equal(normalizeAssertion(c,'team').payload.metric,'members');
 assert.throws(()=>normalizeAssertion({...c,payload:{...c.payload,value:42}},'team'));
 assert.throws(()=>normalizeAssertion({...c,assertionKey:'coverage:tenant:members'},'team'));
});
test('strict list queries keep bounded pagination, cannot accept hidden scope or duplicate filters',()=>{
 assert.equal(parseDirectoryQuery('teams',new URLSearchParams('page=1&pageSize=10')).page,1);
 for(const q of ['accountId=x','q=a&q=b','page=0','page=1.5','pageSize=20','sort=hindex','page=10001'])assert.throws(()=>parseDirectoryQuery('teams',new URLSearchParams(q)));
 assert.equal(parseDirectoryQuery('researchers',new URLSearchParams('organizationId=org-test&rank=研究员')).organizationId,'org-test');
});
test('entity and decision commands pin body shape, bounded hashes and stable semantic request hashes',()=>{
 assert.equal(normalizeEntityCommand({kind:'team',stableKey:'synthetic-team',requestKey:key}).kind,'team');
 assert.throws(()=>normalizeEntityCommand({kind:'team',stableKey:'x',requestKey:key,accountId:'other'}));
 const d={expectedDecisionVersion:0,assertionHash:'a'.repeat(64),decision:'approve',audience:'public',reason:'核对来源字段后批准',requestKey:key};assert.equal(normalizeDecisionCommand(d).audience,'public');
 assert.throws(()=>normalizeDecisionCommand({...d,decision:'revoke'}));assert.throws(()=>normalizeDecisionCommand({...d,reviewer:'other'}));
 assert.equal(directoryHash({a:1,b:{d:2,c:3}}),directoryHash({b:{c:3,d:2},a:1}));
});
