import test from 'node:test';import assert from 'node:assert/strict';
import {createLiteratureSession,assertLiteratureEvidence} from './literature-session.mjs';
import {routeDigest} from './skill-routing.mjs';import {planInterpretation} from './interpretation-plan.mjs';
function fixture(){
 const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},source={id:'P1',kind:'pubmed-live',pmid:'123',title:'Trial',abstract:'Adults were randomized to treatment or sham. No significant difference was observed.'};
 const body={schema:'hub-literature-evidence.v1',routeHash:'search',plan:{hash:'search-plan'},hubSources:[],selected:[source],tools:[],external:{sources:[source]}},parent={id:'parent',tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p',sessionId:'s',status:'completed',payload:{hubLiteratureEvidence:{...body,hash:routeDigest(body)},hubSkillRoute:{snapshotHash:'search'}}};
 const plan=planInterpretation('解读第一篇',{retrieval:{jobId:'parent',...parent.payload.hubLiteratureEvidence}}),route={snapshotHash:'route',decision:{mode:'hub-literature-interpretation',taskPlan:plan}};
 let job={id:'job',status:'processing',payload:{hubSkillRoute:route}};
 const tx={knowledgeChatJob:{findFirst:async({where})=>where.id==='parent'?(parent.status===where.status&&parent.accountId===where.accountId?parent:null):job,updateMany:async({data})=>{job={...job,...data};return{count:1};}}};
 const service=createLiteratureSession({root:new URL('../../',import.meta.url),tenantId:'t',transaction:fn=>fn(tx),routing:{validate:async()=>true,validateInTx:async()=>true},hubSearch:async()=>{throw Error('MUST_NOT_SEARCH');},hubCurrent:async()=>true,createMcp:async()=>{throw Error('MUST_NOT_START_MCP');}});
 return{service,parent,user,turn:{user,sessionId:'s',jobId:'job',skillRoute:route},get job(){return job;}};
}
test('interpretation persists an exact owned parent snapshot without new retrieval; parent changes stop delivery',async()=>{
 const f=fixture(),e=await f.service.prepare(f.turn);assert.equal(e.plan.schema,'hub-interpretation-query.v1');assert.equal(e.selected[0].pack.binding.recordId,'pubmed:123');assert.equal(f.job.payload.hubLiteratureEvidence.hash,e.hash);assertLiteratureEvidence(e);await f.service.validate(f.turn,e);
 f.parent.payload.hubLiteratureEvidence.selected[0].abstract='forged';await assert.rejects(()=>f.service.validate(f.turn,e));
});
test('an unavailable, failed or foreign-account parent is never accepted as interpretation evidence',async()=>{
 for(const patch of [{status:'failed'},{accountId:'other'}]){const f=fixture();Object.assign(f.parent,patch);await assert.rejects(()=>f.service.prepare(f.turn));}
});
