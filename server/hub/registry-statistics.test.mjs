import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRegistrationStatistics} from './registry-statistics.mjs';
const field=value=>({value,status:value?'reported':'not_reported'});
const row=(n,overrides={})=>({documentId:'rhed-'+String(n).padStart(40,'0'),documentType:'clinical_registry',externalKey:'ChiCTR'+n,title:'已公开注册 '+n,visibility:'public',reviewVersion:'1',sourceTargetCondition:'抑郁症',registrationSummaryStatus:'approved',registrationSummary:{registeredOn:field('2023-07-12')},statisticsFields:{status:'approved',design:field('随机平行对照'),interventions:[field('针灸'),field('安慰针')],reviewVersion:'2',extractionVersion:1,payloadSha256:'a'.repeat(64)},...overrides});
test('annual registered dates and exact approved source fields carry every contributing source ID',()=>{
 const a=row(1),b=row(2,{registrationSummary:{registeredOn:field('2025-11-01')},statisticsFields:{...row(2).statisticsFields,interventions:[field('针灸'),field('针灸')]}});
 const result=projectRegistrationStatistics([b,a]);
 assert.equal(result.scope,'CURRENT_HUB_APPROVED_PUBLIC_INDEXED');assert.equal(result.total,2);
 assert.deepEqual(result.dimensions.year.groups,[{label:'2023',count:1,recordIds:[a.documentId],cumulative:1},{label:'2025',count:1,recordIds:[b.documentId],cumulative:2}]);
 assert.equal(result.dimensions.disease.groups[0].count,2);assert.equal(result.dimensions.design.groups[0].count,2);
 assert.equal(result.dimensions.intervention.groups.find(x=>x.label==='针灸').count,2);assert.equal(result.dimensions.intervention.groups.find(x=>x.label==='安慰针').count,1);
 assert.equal(result.dimensions.intervention.missing,0);assert.equal(result.records.length,2);assert(result.records.every(x=>x.reviewVersion==='1'));
 assert.equal(JSON.stringify(result).includes('2024'),false,'uncovered years are not invented zero buckets');
});
test('missing, pending or invalid fields are explicit missing, never source-update dates or inferred classifications',()=>{
 const a=row(1,{registrationSummaryStatus:'pending_review',sourceUpdatedOn:'2024-01-01',registrationSummary:{registeredOn:field('2023-07-12')},statisticsFields:undefined,sourceTargetCondition:''});
 const b=row(2,{registrationSummary:{registeredOn:field('2023-02-30')},statisticsFields:{status:'approved',design:field(''),interventions:[field('')]}});
 const c=row(3,{registrationSummary:{registeredOn:field('2023')},statisticsFields:{status:'approved',design:{value:'不应读取',status:'not_reported'},interventions:[]}});
 const result=projectRegistrationStatistics([a,b,c]);assert.equal(result.dimensions.year.groups.length,0);assert.equal(result.dimensions.year.missing,3);
 assert.equal(result.dimensions.disease.missing,1);assert.equal(result.dimensions.design.missing,3);assert.equal(result.dimensions.intervention.missing,3);assert(!JSON.stringify(result).includes('不应读取'));
});
test('exact duplicates count once; contradictory versions are quarantined without picking an arbitrary row',()=>{
 const a=row(1),b=row(1,{documentId:'rhed-'+'f'.repeat(40),registrationSummary:{registeredOn:field('2022-01-01')}});
 assert.equal(projectRegistrationStatistics([a,structuredClone(a)]).total,1);
 const result=projectRegistrationStatistics([a,b]);assert.equal(result.total,1);assert.equal(result.conflictedRegistrations,1);
 for(const d of Object.values(result.dimensions)){assert.equal(d.groups.length,0);assert.equal(d.missing,1);}
 assert.deepEqual(result,projectRegistrationStatistics([b,a]),'input order never chooses a source');
});
test('non-public, other-resource and withdrawn rows do not enter the public statistics or disclose labels',()=>{
 const result=projectRegistrationStatistics([row(1),row(2,{visibility:'tenant',sourceTargetCondition:'私有疾病'}),row(3,{documentType:'clinical_guideline'}),row(4,{visibility:'none'})]);
 assert.equal(result.total,1);assert.equal(result.records.length,1);assert(!JSON.stringify(result).includes('私有疾病'));
});
test('each intervention is exact source text, multi-category counts may exceed total with no case or synonym merging',()=>{
 const a=row(1,{statisticsFields:{status:'approved',design:field(''),interventions:[field('针灸'),field('针刺'),field('Acupuncture'),field('acupuncture')]}});
 const result=projectRegistrationStatistics([a]);assert.equal(result.dimensions.intervention.groups.length,4);assert.equal(result.dimensions.intervention.groups.reduce((n,x)=>n+x.count,0),4);assert.equal(result.total,1);
 assert.equal(projectRegistrationStatistics([]).total,0);
});

test('same source ID with contradictory metadata does not expose an arbitrarily selected title or revision',()=>{
 const a=row(1),b=row(1,{title:'冲突版本',reviewVersion:'2'});
 const left=projectRegistrationStatistics([a,b]),right=projectRegistrationStatistics([b,a]);
 assert.deepEqual(left,right);assert.equal(left.conflictedRegistrations,1);assert.equal(left.records[0].conflicted,true);
});

test('current public summary releases classification fields only after matching native detail approval; revoked, pending, expired and hash-changed detail stays missing',async()=>{
 const {initialFive,initialDocumentId}=await import('../hub-sources/initial-five.mjs');
 const {registryDetailHash}=await import('../hub-sources/registry-detail-contract.mjs');
 const {listVisibleClinicalRegistrySummaries}=await import('../hub-sources/external-visible.mjs');
 const source=initialFive[0],tenantId='tenant',hubKey='lingshu-xinyu';
 const field=(key,value='')=>({key,label:key,value,status:value?'reported':'not_reported',source:{tableIndex:1,rowIndex:1,cellIndex:1,line:1,column:1,sourceLabel:key,quote:value}});
 const payload={schemaVersion:2,extractorVersion:'chictr-mhtml-v1',registrationNumber:source.externalKey,sourceUrl:source.sourceUrl,snapshotDate:'2026-11-21',
  design:['studyType','phase','design','objective','randomization','blinding','protocol'].map(key=>field(key,key==='design'?'原文随机平行对照':'')),
  registration:[field('registeredOn','2023-07-12'),field('leadInstitution'),field('registrationStatus')],
  arms:[{id:'arm-1',name:field('name'),sampleSize:field('sampleSize'),intervention:field('intervention','原文干预')}],
  outcomes:[{id:'outcome-1',...Object.fromEntries(['name','englishName','type','timepoint','method'].map(key=>[key,field(key)]))}]};
 const original={documentId:initialDocumentId(tenantId,hubKey,source),documentType:source.documentType,externalKey:source.externalKey,title:source.title,sourceTargetCondition:source.sourceTargetCondition,hubTopic:source.hubTopic,sourceName:source.sourceName,sourceUrl:source.sourceUrl,contentSha256:source.expectedSha256,reviewVersion:1,visibility:'public',registryExtractionId:'extract',registryExtractionVersion:1,registrySourceSha256:source.expectedSha256,registryPayloadSha256:registryDetailHash(payload),registryPayload:payload,registryReviewVersion:1,registryDecision:'approve',displayEvidenceRef:'evidence://hub-display/test',registryEvidenceRef:'evidence://hub-display/test'};
 async function read(change={}){const current={...original,...change},db={$queryRaw:async(strings)=>strings.join('').includes('current_setting')?[{tenant:tenantId}]:[current]};return(await listVisibleClinicalRegistrySummaries({db,tenantId,hubKey}))[0];}
 const approved=await read();assert.equal(approved.statisticsFields.design.value,'原文随机平行对照');assert.equal(projectRegistrationStatistics([approved]).dimensions.intervention.groups[0].label,'原文干预');
 for(const change of [{registryDecision:'revoke'},{registryDecision:'pending'},{registryExpiresAt:new Date('2000-01-01')},{registrySourceSha256:'b'.repeat(64)},{registryPayloadSha256:'b'.repeat(64)},{registryEvidenceRef:'evidence://hub-display/changed'}]){
  const hidden=await read(change);assert.equal(hidden.statisticsFields,undefined);assert.equal(hidden.registrationSummary,undefined);
  const stats=projectRegistrationStatistics([hidden]);assert.equal(stats.total,1);for(const key of ['year','design','intervention']){assert.equal(stats.dimensions[key].groups.length,0);assert.equal(stats.dimensions[key].missing,1);}
 }
});
