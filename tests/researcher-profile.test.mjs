import test from 'node:test';import assert from 'node:assert/strict';
import {researcherTenureText} from '../src/directory-presentation.js';
test('same institution with distinct current positions uses only the uniquely selected position, never the first ID match',async()=>{
 const affiliations=[{id:'o',name:'机构',startMonth:'2010-01',current:true,isPrimaryForDisplay:false,department:'旧部门'},{id:'o',name:'机构',startMonth:'2021-03',current:true,isPrimaryForDisplay:true,department:'选中部门'}];
 const p={organization:{id:'o'},affiliations,matchedAffiliations:[],summary:'',directions:[],teams:[],metrics:{},relevance:{},works:[],collaborations:[],provenance:[]};
 assert.equal(researcherTenureText(p),'2021-03 至今');const{researcherProfile}=await import('../src/researcher-profile.js');assert.equal(researcherProfile(p).current.period,'2021-03 至今');assert.equal(researcherProfile(p).current.unit,'选中部门');
 affiliations[1].isPrimaryForDisplay=false;assert.equal(researcherTenureText(p),'');assert.equal(researcherProfile(p).current.period,'');
 affiliations[0].isPrimaryForDisplay=true;affiliations[1].isPrimaryForDisplay=true;assert.equal(researcherTenureText(p),'');
});
test('verified tenure labels only the displayed affiliation and never guesses a conflicted or missing month',()=>{
 const a={id:'o',name:'机构',startMonth:'2021-03',endMonth:null,current:true},p={organization:{id:'o'},affiliations:[a],matchedAffiliations:[],projectionStatus:'RESOLVED'};
 assert.equal(researcherTenureText(p),'2021-03 至今');assert.equal(researcherTenureText({...p,organization:null,projectionStatus:'CONFLICT'}),'');
 assert.equal(researcherTenureText({...p,matchedAffiliations:[{...a,id:'o2',startMonth:'2024-02'}]}),'2024-02 至今');
 assert.equal(researcherTenureText({...p,affiliations:[{...a,startMonth:null}]}),'');
});
test('researcher profile uses only current reviewed DTO, preserves unknown counts and explicit roles',async()=>{
 const m=await import('../src/researcher-profile.js');const p=m.researcherProfile({id:'p',name:'真实读取名',summary:'',directions:['针灸'],affiliations:[],organization:null,primaryTeam:{id:'t'},teams:[{id:'t',name:'团队',role:'lead',isPrimary:true}],metrics:{publications:{value:null},clinicalTrials:{value:0}},relevance:{reason:null},works:[],collaborations:[],provenance:[]});
 assert.equal(p.papers,null);assert.equal(p.trials,0);assert.equal(p.guideCount,null);assert.equal(p.partnerCount,null);assert.equal(p.current.org,'机构待核验');assert.equal(p.badges.length,0);assert.equal(p.teams[0].role,'负责人');assert.equal(p.teams[0].core,true);assert.equal(p.dimensions.length,0);assert.equal(p.education.length,0);
});
