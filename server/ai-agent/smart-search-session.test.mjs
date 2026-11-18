import test from 'node:test';import assert from 'node:assert/strict';
import {createSmartSearchSession,assertWebEvidence} from './smart-search-session.mjs';
import {acceptWebAnswer,SMART_POLICY_HASH} from './smart-search-contract.mjs';
import {acceptGroundedAnswer} from './smart-search-grounding.mjs';
import {routeDigest} from './skill-routing.mjs';
function fixture(){
 const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},route={snapshotHash:'route',decision:{mode:'hub-smart-search',scope:'public-web'}},job={id:'j',payload:{hubSkillRoute:route},status:'processing'};let current=true,claim=true;
 const tx={knowledgeChatJob:{findFirst:async()=>job,updateMany:async({data})=>{Object.assign(job,data);return{count:1};}}};
 const sources=[{id:'W1',url:'https://example.org/',title:'Official',text:'Actual public evidence',coverage:'webpage-excerpt',retrievedAt:'2026-11-12T01:00:00Z'}];
 const service=createSmartSearchSession({tenantId:'t',transaction:fn=>fn(tx),routing:{validateInTx:async()=>{if(!current)throw Error('revoked');},assertNetwork:async()=>true},executionCurrent:async()=>{if(!claim)throw Error('claim-lost');},run:async opts=>{await opts.authorize();return{...acceptGroundedAnswer(JSON.stringify({claims:[{kind:'source_fact',text:'依据资料。',sourceIds:['W1'],quotes:[{sourceId:'W1',text:'Actual public evidence'}]}],limitations:'仅选段'}),sources),sources,tools:[{tool:'websearch',status:'completed'}],runtimeEvidence:{runtime:'hub-opencode'}};}});
 return{service,user,route,job,turn:{user,sessionId:'s',jobId:'j',skillRoute:route,query:'检索公开科研资料'},revoke:()=>{current=false;},loseClaim:()=>{claim=false;}};
}
test('web run binds current owner/route, immutable evidence and output before publication',async()=>{
 const f=fixture();f.turn.web=await f.service.prepare(f.turn);const result=await f.service.execute(f.turn,{});
 assert.equal(assertWebEvidence(f.job.payload.hubWebEvidence).hash,f.turn.webEvidence.hash);
 const provenance=f.service.provenance(f.turn,result.text);assert.equal(provenance.webOutput.policyHash,SMART_POLICY_HASH);
 assert.equal(provenance.webOutput.textHash,routeDigest(result.text));await f.service.validate(f.turn);
 f.job.payload.hubWebEvidence.sources[0].text='forged';await assert.rejects(f.service.validate(f.turn));
});
test('revocation and lost claims prevent model execution or publishing',async()=>{
 for(const method of ['revoke','loseClaim']){const f=fixture();f.turn.web=await f.service.prepare(f.turn);f[method]();await assert.rejects(f.service.execute(f.turn,{}));assert(!f.job.payload.hubWebEvidence);}
});
function savedProjection(policyHash){
 const f=fixture(),sign=body=>({...body,hash:routeDigest(body)}),sources=[{id:'W1',url:'https://example.org/',title:'Public',text:'A saved source excerpt.',coverage:'webpage-excerpt'}];
 const context=sign({schema:'hub-web-context.v1',policyHash,routeHash:'route',queryHash:'query',sources:[],networkEnabled:true}),evidence=sign({schema:'hub-web-evidence.v1',policyHash,contextHash:context.hash,routeHash:'route',sources,tools:[],runtime:{runtime:'hub-opencode'}}),text='原有真实回答，不改写。';
 Object.assign(f.job,{status:'completed',assistantMessageId:'m',payload:{hubSkillRoute:f.route,hubWebContext:context,hubWebEvidence:evidence}});
 return{...f,message:{id:'m',content:text,meta:{provenance:{webEvidence:evidence,webOutput:{schema:'hub-smart-answer.v1',policyHash,textHash:routeDigest(text),sourcesHash:routeDigest(sources),sourceIds:['W1']}}}}};
}
test('known v1 history remains readable, but tampered evidence and mixed-policy provenance remain restricted',async()=>{
 const legacy='edea9f7e85e165f400e1d4b66301e774cd7bf76c64a6a5cad8e76b915aa94332',f=savedProjection(legacy);
 let projected=await f.service.project(f.user,{id:'s'},[f.message]);assert.equal(projected[0].content,f.message.content);assert.equal(projected[0].meta.sourceStatus,'snapshot');
 f.message.meta.provenance.webOutput.policyHash='forged';projected=await f.service.project(f.user,{id:'s'},[f.message]);assert.equal(projected[0].meta.sourceStatus,'restricted');
 const changed=savedProjection(legacy);changed.job.payload.hubWebEvidence.sources[0].text='forged';assert.equal((await changed.service.project(changed.user,{id:'s'},[changed.message]))[0].meta.sourceStatus,'restricted');
});
test('current-policy output cannot silently project an ungrounded v1 scientific answer',async()=>{
 const f=savedProjection(SMART_POLICY_HASH);assert.equal((await f.service.project(f.user,{id:'s'},[f.message]))[0].meta.sourceStatus,'restricted');
});
