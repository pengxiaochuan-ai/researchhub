import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeEvidence,knowledgeContextId} from './knowledge-evidence.mjs';

function harness(){
 const user={tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project'};
 const kb={id:'kb1',tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',name:'合成库'};
 const doc={id:'doc1',kbId:'kb1',tenantId:'tenant',studyGroupId:'group',title:'合成依据',version:1,contentMd:'合成材料，仅验证软件',reviewed:true,status:'published',safetyLevel:'allow',trashedAt:null};
 // Native KnowledgeDoc/KnowledgeChunk inherit Study through KnowledgeBase.
 const chunk={id:'chunk1',docId:'doc1',kbId:'kb1',tenantId:'tenant',studyGroupId:'group',text:doc.contentMd,reviewed:true,page:2,section:'目的'};
 const state={visible:true,authorized:true,purpose:true,searchCalls:0,reads:0,checks:0,hits:null};
 const tx={knowledgeBase:{findUnique:async()=>kb},knowledgeDoc:{findUnique:async()=>doc},knowledgeChunk:{findUnique:async()=>chunk}};
 const evidence=createKnowledgeEvidence({
  readCurrent:async(actor,fn)=>{assert.equal(actor,user);state.reads++;if(!state.authorized)throw Error('AUTH_REVOKED');return fn(tx);},
  authorizeInTransaction:async(actual,actor)=>{assert.equal(actual,tx);assert.equal(actor,user);state.checks++;if(!state.authorized)throw Error('AUTH_REVOKED');},
  authorizePurpose:async(actual,actor,kbId)=>{assert.equal(actual,tx);assert.equal(actor,user);assert.equal(kbId,'kb1');if(!state.purpose)throw Error('PURPOSE_REVOKED');},
  accessibleKbIds:async(actor,ids,actual)=>{assert.equal(actor,user);assert.deepEqual(ids,['kb1']);assert.equal(actual,tx);return state.visible?['kb1']:[];},
  search:async(actor,input)=>{assert.equal(actor,user);assert.deepEqual(input,{query:'目的是什么',kbIds:['kb1'],topK:6});state.searchCalls++;return state.hits??[{docId:'doc1',kbId:'kb1',chunkId:'chunk1',snippet:chunk.text,docTitle:'过期名称',kbName:'过期库名',via:'keyword',page:2,section:'目的'}];},
 });return{user,kb,doc,chunk,state,tx,evidence};
}
test('only exact KB context keys are parsed; Hub, empty, malformed and nested scopes reject',()=>{
 assert.equal(knowledgeContextId('kb:kb_01'),'kb_01');
 for(const x of ['hub:lingshu-xinyu','kb:','kb:one:two','kb:../private',null])assert.throws(()=>knowledgeContextId(x),/KNOWLEDGE_CONTEXT_INVALID/);
});
test('current native retrieval is pinned to one KB and snapshots use actual document and chunk metadata',async()=>{
 const h=harness(),turn=await h.evidence.prepare(h.user,'kb1','目的是什么');
 assert.equal(h.state.searchCalls,1);assert.equal(turn.sources.length,1);
 assert.equal(turn.sources[0].docTitle,h.doc.title);assert.equal(turn.sources[0].kbName,h.kb.name);
 assert.equal(turn.sources[0].page,2);assert.equal(turn.sources[0].version,1);
 assert.equal(turn.tool.mutated,false);assert.match(turn.tool.result,/^\[1\] 《合成依据》/);
});
test('no reviewed evidence blocks before any model is required',async()=>{
 const h=harness();h.state.hits=[];await assert.rejects(h.evidence.prepare(h.user,'kb1','目的是什么'),e=>e.code==='QA_NO_EVIDENCE'&&e.status===422);
});
test('invisible KB blocks before search even for a tenant administrator',async()=>{
 const h=harness();h.user.role='tenant_admin';h.state.visible=false;
 await assert.rejects(h.evidence.prepare(h.user,'kb1','目的是什么'),/KNOWLEDGE_SOURCE_RESTRICTED/);assert.equal(h.state.searchCalls,0);
});
test('read permission alone does not authorize AI use and withdrawal fences the actual commit',async()=>{
 const h=harness();h.state.purpose=false;
 await assert.rejects(h.evidence.prepare(h.user,'kb1','目的是什么'),/PURPOSE_REVOKED/);assert.equal(h.state.searchCalls,0);
 h.state.purpose=true;const {sources}=await h.evidence.prepare(h.user,'kb1','目的是什么');h.state.purpose=false;
 await assert.rejects(h.evidence.validate(h.user,'kb1',sources,h.tx),/PURPOSE_REVOKED/);
});
test('cross-KB hit and forged source location are rejected instead of silently substituted',async()=>{
 const h=harness();h.state.hits=[{docId:'doc1',kbId:'other',chunkId:'chunk1',snippet:h.chunk.text,via:'keyword'}];
 await assert.rejects(h.evidence.prepare(h.user,'kb1','目的是什么'),/KNOWLEDGE_SOURCE_CHANGED/);
 h.state.hits=[{docId:'doc1',kbId:'kb1',chunkId:'chunk1',snippet:h.chunk.text,via:'keyword',page:99,section:'目的'}];
 await assert.rejects(h.evidence.prepare(h.user,'kb1','目的是什么'),/KNOWLEDGE_SOURCE_CHANGED/);
});
test('real parent tuple must agree between KB/document/chunk, including project and tenant',async()=>{
 for(const [object,key] of [['doc','tenantId'],['doc','studyGroupId'],['chunk','tenantId'],['chunk','studyGroupId'],['chunk','docId'],['kb','researchProjectId'],['kb','studyGroupId']]){
  const h=harness();h[object][key]='other';await assert.rejects(h.evidence.prepare(h.user,'kb1','目的是什么'),/KNOWLEDGE_SOURCE_(CHANGED|RESTRICTED)/);
 }
});
test('assistant publication revalidates in the actual transaction without opening another transaction',async()=>{
 const h=harness(),turn=await h.evidence.prepare(h.user,'kb1','目的是什么'),reads=h.state.reads;
 await h.evidence.validate(h.user,'kb1',turn.sources,h.tx);assert.equal(h.state.reads,reads);assert.equal(h.state.checks,1);
 h.state.authorized=false;await assert.rejects(h.evidence.validate(h.user,'kb1',turn.sources,h.tx),/AUTH_REVOKED/);assert.equal(h.state.reads,reads);
});
test('changed versions become stale; withdrawn, trash, blocked and invisible sources become restricted',async()=>{
 const h=harness(),{sources}=await h.evidence.prepare(h.user,'kb1','目的是什么');
 h.doc.version++;assert.equal(await h.evidence.status(h.user,'kb1',sources[0]),'stale');
 await assert.rejects(h.evidence.validate(h.user,'kb1',sources,h.tx),/KNOWLEDGE_SOURCE_CHANGED/);
 for(const change of [()=>{h.doc.reviewed=false;},()=>{h.doc.trashedAt=new Date();},()=>{h.doc.safetyLevel='blocked';},()=>{h.state.visible=false;}]){
  change();assert.equal(await h.evidence.status(h.user,'kb1',sources[0]),'restricted');
 }
});
test('source projection hides withdrawn answer and provenance; stale evidence remains explicitly historical',async()=>{
 const h=harness(),{sources}=await h.evidence.prepare(h.user,'kb1','目的是什么');
 const message={id:'m1',role:'assistant',content:'原有说明[1]',meta:{provenance:{knowledgeSources:sources,privateDetail:'must-hide'}}};
 h.doc.version++;let result=await h.evidence.project(h.user,'kb1',[message]);assert.equal(result[0].meta.sourceStatus,'stale');assert.equal(result[0].content,message.content);
 h.doc.reviewed=false;result=await h.evidence.project(h.user,'kb1',[message]);assert.equal(result[0].meta.sourceStatus,'restricted');assert.equal(result[0].meta.provenance,undefined);assert(!result[0].content.includes(message.content));
});
test('empty snapshots, cross-KB snapshots and document-ID retargets reject at publication',async()=>{
 const h=harness(),{sources}=await h.evidence.prepare(h.user,'kb1','目的是什么');
 for(const s of [[],[{...sources[0],kbId:'other'}],[{...sources[0],docId:'other'}]])await assert.rejects(h.evidence.validate(h.user,'kb1',s,h.tx));
});
test('unchanged hashes cannot mask a forged quote, page, section or title',async()=>{
 const h=harness(),{sources}=await h.evidence.prepare(h.user,'kb1','目的是什么');
 for(const patch of [{quote:'伪造科学结论'},{page:99},{section:'不存在的条款'},{docTitle:'伪造题名'},{kbName:'其他库'},{via:'invented'}]){
  const altered={...sources[0],...patch};
  await assert.rejects(h.evidence.validate(h.user,'kb1',[altered],h.tx),/KNOWLEDGE_SOURCE_CHANGED/);
  assert.equal(await h.evidence.status(h.user,'kb1',altered),'restricted');
 }
});
test('a locator-only chunk change cannot be delivered using the previous page or section',async()=>{
 const h=harness(),{sources}=await h.evidence.prepare(h.user,'kb1','目的是什么');
 h.chunk.page=3;
 await assert.rejects(h.evidence.validate(h.user,'kb1',sources,h.tx),/KNOWLEDGE_SOURCE_CHANGED/);
 assert.equal(await h.evidence.status(h.user,'kb1',sources[0]),'restricted');
});
