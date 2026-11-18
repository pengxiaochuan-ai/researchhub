import test from 'node:test';
import assert from 'node:assert/strict';
import {clinicalRegistryOptions,filterClinicalRegistries,reconcileClinicalFilters,emptyClinicalFilters,clinicalFilterIdentity} from '../src/clinical-registry-filters.js';
const make=(id,disease,type,values,status='approved')=>({documentId:id,title:id+'研究',externalKey:id,sourceTargetCondition:disease,sourceName:'公开来源',studySummaryStatus:status,studySummary:{studyType:{value:type},interventions:values.map(value=>({intervention:{value}}))}});
const rows=[make('first','抑郁症','干预性研究',['电刺激+药物','电刺激+安慰剂','电刺激+药物']),make('second','轻度认知障碍','干预性研究',['经皮耳穴刺激']),make('pending','其他疾病','未审类型',['未审干预'],'pending_review')];
test('options use current approved values exactly, including all arms, and never infer classifications',()=>{
 assert.deepEqual(clinicalRegistryOptions(rows),{studyType:['干预性研究'],disease:['抑郁症','轻度认知障碍','其他疾病'],intervention:['电刺激+药物','电刺激+安慰剂','经皮耳穴刺激']});
 assert.deepEqual(clinicalRegistryOptions([make('bad','','',[null,{},' '])]),{studyType:[],disease:[],intervention:[]});
});
test('filters AND exact values, one matching arm suffices, and keyword uses the existing search scope',()=>{
 const ids=filters=>filterClinicalRegistries(rows,filters).map(x=>x.documentId);
 assert.deepEqual(ids({studyType:'干预性研究',disease:'抑郁症',intervention:'电刺激+安慰剂'}),['first']);
 assert.deepEqual(ids({disease:'抑郁症',intervention:'经皮耳穴刺激'}),[]);
 assert.deepEqual(ids({intervention:'电刺激'}),[]);
 assert.deepEqual(ids({query:' SECOND ',studyType:'干预性研究'}),['second']);
 assert.deepEqual(ids({query:'经皮耳穴刺激'}),[],'do not silently broaden keyword scope');
 assert.deepEqual(ids({studyType:'未审类型'}),[]);
 assert.deepEqual(ids({...emptyClinicalFilters(),query:''}),['first','second','pending']);
});
test('successful refresh retains only still-approved choices and never reintroduces withdrawn values',()=>{
 const options=clinicalRegistryOptions(rows.slice(1));
 assert.deepEqual(reconcileClinicalFilters({studyType:'干预性研究',disease:'抑郁症',intervention:'电刺激+药物'},options),{studyType:'干预性研究',disease:'',intervention:''});
 assert.deepEqual(emptyClinicalFilters(),{studyType:'',disease:'',intervention:''});
 assert.deepEqual(reconcileClinicalFilters({studyType:'未审类型',disease:'其他疾病',intervention:'未审干预'},clinicalRegistryOptions(rows)),{studyType:'',disease:'其他疾病',intervention:''});
});
test('routine same-account auth refresh preserves filters; only a confirmed identity change clears them',()=>{
 assert.equal(clinicalFilterIdentity({mode:'real',id:'owner',status:'authenticated'}),'real:owner');
 assert.equal(clinicalFilterIdentity({mode:'real',id:'owner',status:'authenticated',sessionHealth:'unavailable'}),'real:owner');
 assert.equal(clinicalFilterIdentity({mode:'real',status:'checking'}),null);
 assert.equal(clinicalFilterIdentity({mode:'real',status:'unavailable'}),null);
 assert.equal(clinicalFilterIdentity({mode:'real',status:'anonymous'}),'real:anonymous');
 assert.notEqual(clinicalFilterIdentity({mode:'real',id:'admin',status:'authenticated'}),'real:owner');
});
