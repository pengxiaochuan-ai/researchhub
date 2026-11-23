import test from 'node:test';
import assert from 'node:assert/strict';
import {projectActivitySources,readPublicActivitySources,readAllPublicWorkbook} from './sources.mjs';
const base=()=>({external:[],papers:{included:[],pendingVisibleCount:0},directory:{organizations:[],researchers:[]},content:[],coverage:{external:true,publications:true}});
test('current source records never invent historical first-public dates from approval or observation time',()=>{
 const input=base();input.external=[{documentType:'clinical_registry',externalKey:'ChiCTR2300073486',documentId:'one',title:'公开注册',visibility:'public',sourceTargetCondition:'抑郁症',createdAt:'2026-11-23T00:00:00Z'}];
 const out=projectActivitySources(input);assert.equal(out.records[0].entityKey,'registry:chictr:CHICTR2300073486');assert.equal(out.records[0].firstPublicAt,null);assert.equal(out.records[0].timeStatus,'historical_undated');
});
test('source type, current public filter and textbook missing coverage remain explicit',()=>{
 const input=base();input.external=[{documentType:'clinical_registry',externalKey:'ChiCTR1',documentId:'a',title:'成员',visibility:'tenant'},{documentType:'research_standard',externalKey:'T/X',documentId:'b',title:'公开标准',visibility:'public'},{documentType:'textbook',externalKey:'book',documentId:'c',title:'未知书籍',visibility:'public'}];
 const out=projectActivitySources(input);assert.equal(out.records.length,1);assert.equal(out.records[0].category,'guidance');assert.equal(out.categoryStatuses.guidance.coverage,'partial');assert.ok(out.categoryStatuses.guidance.reasons.includes('TEXTBOOK_TYPE_UNSUPPORTED'));
});
test('papers use canonical paper identities and directories use entity ids, not accounts or author affiliations',()=>{
 const input=base();input.papers.included=[{paperKey:'doi:10.1/one',type:'trial',sources:[{recordId:'a',title:'公开论文'}]}];input.directory.organizations=[{id:'org',name:'公开机构'}];input.directory.researchers=[{id:'person',name:'研究者',accountId:'private-account',directions:['针灸']}];
 const {records}=projectActivitySources(input);assert.deepEqual(records.map(x=>[x.category,x.entityKey]),[['publication','doi:10.1/one'],['organization','org'],['researcher','person']]);assert.equal(JSON.stringify(records).includes('private-account'),false);assert.ok(records.every(x=>x.firstPublicAt===null));
});
test('platform contents preserve proven first public version time and omit unknown timestamps',()=>{
 const input=base();input.content=[{id:'one',title:'公开通知',type:'notice',summary:'说明',firstPublicAt:'2026-11-20T01:00:00Z',proofRef:'academic-public-version:v1'},{id:'two',title:'时间缺失',type:'news',firstPublicAt:null}];
 const {records}=projectActivitySources(input);assert.equal(records[0].firstPublicAt,'2026-11-20T01:00:00.000Z');assert.equal(records[0].timeStatus,'verified');assert.equal(records[1].timeStatus,'historical_undated');assert.deepEqual(records[0].proofRefs,['academic-public-version:v1']);assert.match(records[0].href,/p011/);
});
test('workbook adapter consumes all pages and rejects mismatching or looping pagination',async()=>{
 let calls=0;const all=await readAllPublicWorkbook({},async({cursor})=>{calls++;return cursor?{items:[{id:'rhsr-b'}],nextCursor:null,matchedRecords:2}:{items:[{id:'rhsr-a'}],nextCursor:'rhsr-a',matchedRecords:2};});assert.equal(all.length,2);assert.equal(calls,2);
 await assert.rejects(readAllPublicWorkbook({},async()=>({items:[{id:'a'}],nextCursor:'a',matchedRecords:3})),/ACTIVITY_SOURCE_PAGINATION_CONFLICT/);
});
test('missing trusted public content reader throws instead of silently returning a successful empty category',async()=>{
 await assert.rejects(readPublicActivitySources({db:{},tenantId:'t',hubKey:'lingshu-xinyu'}),/ACTIVITY_CONTENT_READER_REQUIRED/);
});

test('pending paper identities and public-content failure stay partial/unavailable, never successful zero',()=>{
 const input=base();input.papers.pendingVisibleCount=1;input.contentUnavailable=true;
 const out=projectActivitySources(input);assert.equal(out.categoryStatuses.publication.coverage,'partial');assert.equal(out.categoryStatuses.platform_content.status,'unavailable');assert.equal(out.categoryStatuses.platform_content.currentCount,null);
});
