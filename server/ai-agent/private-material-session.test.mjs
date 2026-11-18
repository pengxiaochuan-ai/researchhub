import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateMaterialSession,assertPrivateRuntimeTools} from './private-material-session.mjs';
import {freezeMaterialSelection} from './private-material-selection.mjs';
import {materialDigest} from './session-material-contract.mjs';
import {runOpenCodeSynthesis} from './opencode-synthesis.mjs';
import {isOwnedOpenCodeRequest} from './opencode-runtime.mjs';
const user={tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project',authVersion:0};
function fixture({actualHarness=false}={}){
 const row={id:'material',version:3,state:'ready',deleted_at:null,tenant_id:'tenant',account_id:'owner',study_group_id:'group',research_project_id:'project',session_id:'session',purpose:'knowledge',kb_id:'kb',source_file_id:'file',import_task_id:'task',source_sha256:'a'.repeat(64),doc_id:'doc',doc_version:1,content_sha256:'b'.repeat(64)};
 const selection=freezeMaterialSelection(user,'session',[row]);
 const bound={schema:'hub-private-materials.v1',principal:selection.principal,sessionId:'session',materials:selection.materials.map(m=>({materialId:m.materialId,version:m.version,kbId:m.kbId,sourceFileId:m.sourceFileId,sourceSha256:m.sourceSha256,docId:m.docId,docVersion:m.docVersion,contentSha256:m.contentSha256}))};
 const body={schema:'hub-private-material-pack.v1',binding:{...bound,hash:materialDigest(bound)},readingLimit:24000,sources:[{id:'M1',materialId:'material',materialVersion:3,kbId:'kb',sourceFileId:'file',sourceSha256:row.source_sha256,docId:'doc',docVersion:1,contentSha256:row.content_sha256,title:'合成来源',reviewed:false,sourceType:'owner-uploaded-draft',coverage:{complete:true,readCharacters:20,totalCharacters:20,totalLines:1,positionUnit:'unicode-codepoints'},fragments:[{id:'M1-F1',text:'Synthetic material; observations need verification.',lineStart:1,lineEnd:1,start:0,end:20}]}]};
 const pack={...body,packHash:materialDigest(body)},route={decision:{mode:'hub-private-materials'},snapshotHash:'route'};
 const job={id:'job',tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project',sessionId:'session',status:'processing',payload:{hubPrivateEvidence:pack,hubPrivateSelection:selection,hubSkillRoute:route}};
 let sourceCurrent=true,access=true,claimed=true,calls=0;const checks=[];
 const tx={knowledgeChatJob:{findFirst:async({where})=>Object.entries(where).every(([key,val])=>job[key]===val)?job:null}};
 const service=createPrivateMaterialSession({root:new URL('../../',import.meta.url).pathname,tenantId:'tenant',transaction:fn=>fn(tx),routing:{validateInTx:async()=>{checks.push('skill');if(!access)throw Error('revoked');}},reader:{assertCurrentInTx:async()=>{checks.push('source');if(!sourceCurrent)throw Error('source-changed');}},executionCurrent:async()=>{checks.push('claim');if(!claimed)throw Error('claim-lost');},
  runSynthesis:actualHarness?runOpenCodeSynthesis:async opts=>{calls++;await opts.authorize();const result=await opts.providerCall([{role:'system',content:opts.instruction},{role:'user',content:opts.text}]);await opts.authorize();return{...result,runtimeEvidence:{runtime:'hub-opencode',providerCalls:1,sessionId:'contract-test-only'}};}});
 const turn={user,sessionId:'session',jobId:'job',query:'请汇总本人材料',skillRoute:route};
 return{service,turn,job,pack,checks,get calls(){return calls;},revoke:()=>{access=false;},change:()=>{sourceCurrent=false;},loseClaim:()=>{claimed=false;}};
}
const output=()=>({text:JSON.stringify({sections:[{kind:'fact',text:'材料提示这些观察需要进一步核验。',fragmentIds:['M1-F1']}]}),usage:{promptTokens:100,completionTokens:30,totalTokens:130},usedMock:false});
test('private adapter binds the real selected Skill method and evidence, preserving current scope throughout synthesis',async()=>{
 const f=fixture();await f.service.prepare(f.turn);assert.equal(f.turn.privateMaterials.packHash,f.pack.packHash);assert(f.service.reservationMaxTokens(f.turn)>=1536);
 const response=await f.service.synthesize(f.turn,async messages=>{assert(messages[0].content.includes('本人材料'));assert.equal(JSON.parse(messages[1].content).packHash,f.pack.packHash);return output();});
 f.service.accept(f.turn,response);const p=f.service.provenance(f.turn);assert.equal(p.privateMaterials.packHash,f.pack.packHash);assert.equal(p.hubTools[0].executedBy,'hub-controlled-evidence-adapter');assert.equal(p.privateRuntime.providerCalls,1);assert.equal(f.calls,1);assert.match(response.text,/原文报告/);
 const m={id:'answer',content:response.text,meta:{provenance:p}};f.job.status='completed';f.job.assistantMessageId=m.id;
 assert.equal((await f.service.project(user,{id:'session'},[m]))[0].meta.sourceStatus,'current');assert.equal((await f.service.source(user,{id:'session'},m,1)).docId,'doc');
 f.change();const invalid=(await f.service.project(user,{id:'session'},[m]))[0];assert.equal(invalid.meta.sourceStatus,'restricted');assert(!JSON.stringify(invalid).includes('Synthetic material'));await assert.rejects(f.service.source(user,{id:'session'},m,1));
});
test('source/access/claim failure stops before synthesis and another account cannot use the stored job',async()=>{
 for(const invalid of ['change','revoke','loseClaim']){const f=fixture();await f.service.prepare(f.turn);f[invalid]();await assert.rejects(f.service.synthesize(f.turn,async()=>{throw Error('MUST_NOT_CALL');}));assert.equal(f.calls,0);}
 const f=fixture();await assert.rejects(f.service.prepare({...f.turn,user:{...user,accountId:'admin'}}));assert.equal(f.calls,0);
});
test('file.read is required only for the private adapter; approved file.read config does not break ordinary Hub chat',()=>{
 const ctx={kbAgent:true,agentKind:'research',tools:['knowledge.search','file.read']};assert.doesNotThrow(()=>assertPrivateRuntimeTools(ctx));assert.doesNotThrow(()=>assertPrivateRuntimeTools(ctx,{privateMaterials:true}));
 assert.doesNotThrow(()=>assertPrivateRuntimeTools({...ctx,tools:['knowledge.search']}));assert.throws(()=>assertPrivateRuntimeTools({...ctx,tools:['knowledge.search']},{privateMaterials:true}));assert.throws(()=>assertPrivateRuntimeTools({...ctx,tools:['knowledge.search','data.read']}));
});
test('actual isolated OpenCode binds the private adapter input; controlled free provider is not claimed as a real model result',{timeout:60000},async()=>{
 const f=fixture({actualHarness:true}),nativeFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=(url,init)=>{assert(isOwnedOpenCodeRequest(url,init),'NON_OWNED_HTTP_DENIED');return nativeFetch(url,init);};
 try{await f.service.prepare(f.turn);const response=await f.service.synthesize(f.turn,async messages=>{calls++;assert.deepEqual(messages.map(m=>m.role),['system','user']);assert.equal(JSON.parse(messages[1].content).packHash,f.pack.packHash);assert(!JSON.stringify(messages).includes('/Users/'));return output();});
  assert.equal(calls,1);assert.equal(f.turn.privateRuntime.runtime,'hub-opencode');assert.match(f.turn.privateRuntime.sessionId,/^ses_/);assert.equal(f.turn.privateRuntime.providerCalls,1);f.service.accept(f.turn,response);assert.match(response.text,/原文报告/);
 }finally{globalThis.fetch=nativeFetch;}
});
test('real harness retains known usage when source access is revoked after a controlled provider result',{timeout:60000},async()=>{
 const f=fixture({actualHarness:true}),nativeFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=(url,init)=>{assert(isOwnedOpenCodeRequest(url,init),'NON_OWNED_HTTP_DENIED');return nativeFetch(url,init);};
 try{await f.service.prepare(f.turn);await assert.rejects(f.service.synthesize(f.turn,async()=>{calls++;f.revoke();return output();}),e=>e.message==='revoked'&&e.knownProviderResult?.usage?.totalTokens===130);assert.equal(calls,1);
 }finally{globalThis.fetch=nativeFetch;}
});
