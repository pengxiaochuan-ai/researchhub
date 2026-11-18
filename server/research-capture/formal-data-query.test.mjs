import test from 'node:test';import assert from 'node:assert/strict';import {createFormalDataQueryService} from './formal-data-query.mjs';
const user={tenantId:'tenant',accountId:'actor',authVersion:2},scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},tx={},ctx={...scope,executionProjectId:'project'},ref={responseId:'response',assignmentId:'assignment',revisionNo:1,contentHash:'a'.repeat(64)};
const studies={withResearchStudyTransaction:async(u,s,permission,fn)=>{assert.equal(permission,'read');return fn(tx,ctx);}};
test('query page applies parent scope, limit, capabilities and signed cursor binding',async()=>{
 const calls=[],core={readResponse:async(...a)=>calls.push(['parent',a]),authorize:async(...a)=>calls.push(['auth',a]),list:async(...a)=>{calls.push(['list',a]);return {items:[{id:'q',status:'open'}],nextAfterId:'q'};}};
 const api=createFormalDataQueryService({studies,core,cursorSecret:'test-secret'}),first=await api.list(user,'study',{assignmentId:'assignment',limit:'2'});
 assert.equal(first.items.length,1);assert.equal(first.capabilities.canCreate,true);assert.equal(calls[0][0],'parent');assert.deepEqual(calls.find(x=>x[0]==='list')[1][3],{limit:2,assignmentId:'assignment'});
 await api.list(user,'study',{assignmentId:'assignment',limit:'2',cursor:first.nextCursor});assert.equal(calls.at(-3)[0],'list');
 await assert.rejects(async()=>api.list({...user,accountId:'other'},'study',{assignmentId:'assignment',limit:'2',cursor:first.nextCursor}),e=>e.status===400);
 await assert.rejects(async()=>api.list(user,'study',{assignmentId:'other',limit:'2',cursor:first.nextCursor}),e=>e.status===400);
});
test('receipt is read-only and actions use core authority not owner claims',async()=>{
 const calls=[],core={receipt:async(...a)=>{calls.push(a);return {id:'q',version:2,status:'open'};},read:async()=>({id:'q',status:'open'}),authorize:async(_tx,_u,_g,_p,permission)=>{if(permission==='study.review')throw {getStatus:()=>403,getResponse:()=>({code:'RESEARCH_FORBIDDEN'})};}};
 const api=createFormalDataQueryService({studies,core,cursorSecret:'test-secret'});const result=await api.receipt(user,'study','request-key',{action:'reply',assignmentId:'assignment',queryId:'q'});assert.equal(result.result.version,2);assert.deepEqual(result.receipt,{requestKey:'request-key',action:'data_query.reply',targetId:'q',assignmentId:'assignment'});assert.equal(calls.length,1);
 const detail=await api.read(user,'study','q');assert.equal(detail.capabilities.canReply,true);assert.equal(detail.capabilities.canClose,false);
});
test('invalid write input never reaches core',async()=>{const api=createFormalDataQueryService({studies,core:{},cursorSecret:'x'});await assert.rejects(async()=>api.create(user,'study',{requestKey:'request-key',target:{kind:'formal_response_revision',ref,fieldKey:'x'},text:'question',actorId:'forged'}),e=>e.status===400);});
