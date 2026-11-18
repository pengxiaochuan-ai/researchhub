import test from 'node:test';import assert from 'node:assert/strict';import {parseFormalTaskCommand,createFormalTaskService} from './formal-tasks.mjs';
const ref={kind:'formal_response_ref',responseId:'response',assignmentId:'assignment',revisionNo:1,contentHash:'a'.repeat(64)};
test('formal evidence is strict, fixed and no URL; old task parsing preserved',()=>{
 const body={requestKey:'request-key',expectedVersion:0,status:'completed',evidenceRefs:[ref]},c=parseFormalTaskCommand('transition',body,'task');assert.deepEqual(c.input.evidenceRefs,[ref]);
 assert.throws(()=>parseFormalTaskCommand('transition',{...body,evidenceRefs:[{...ref,url:'https://bad'}]},'task'));assert.throws(()=>parseFormalTaskCommand('transition',{...body,evidenceRefs:[ref,ref]},'task'));
});
test('same authorized Study transaction resolves source before core task mutation',async()=>{
 const calls=[],user={tenantId:'tenant',accountId:'actor',authVersion:2},ctx={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'},tx={$queryRaw:async()=>[],auditLog:{create:async()=>calls.push('audit')},$executeRaw:async()=>1};
 const studies={withResearchStudyTransaction:async(_u,_s,_op,fn)=>fn(tx,ctx)},authority={...ctx,researchProjectId:'project',actorAccountId:'actor',readAll:true,canConfigure:true,canExecute:true,canReview:true,isTenantAdmin:true};
 const core={authorize:async()=>authority,execute:async()=>{calls.push('execute');return {id:'task',version:1,status:'completed'};},source:{response:async()=>{calls.push('source');return {subjectId:'subject',visitId:'visit',context:{kind:'formal_response_ref'}};}}};
 const dbTask={id:'task',tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',subjectId:null,enrollmentId:null,subjectVisitId:null,assigneeAccountId:'actor',collaborators:[]};tx.studyTask={findFirst:async()=>dbTask};
 const service=createFormalTaskService({studies,core,cursorSecret:'x'.repeat(32)});const result=await service.command(user,'study','transition','task',{requestKey:'request-key',expectedVersion:0,status:'completed',evidenceRefs:[ref]});
 assert.equal(result.version,1);assert.deepEqual(result.receipt,{requestKey:'request-key',action:'task.transition',targetId:'task',studyId:'study'});assert.deepEqual(calls,['source','execute','audit']);
});
test('source and existing task cannot lock or bind different subjects',async()=>{
 let wrote=false;const user={tenantId:'tenant',accountId:'actor',authVersion:2},scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},ctx={...scope,executionProjectId:'project'};
 const tx={$queryRaw:async()=>[],studyTask:{findFirst:async()=>({id:'task',...scope,subjectId:'other',enrollmentId:null,subjectVisitId:null,assigneeAccountId:'actor',collaborators:[]})}};
 const studies={withResearchStudyTransaction:async(_u,_s,_p,fn)=>fn(tx,ctx)},core={authorize:async()=>({...scope,actorAccountId:'actor',readAll:true}),source:{response:async()=>({subjectId:'subject',visitId:'v',context:{kind:'formal_response_ref'}})},execute:async()=>{wrote=true;}};
 const api=createFormalTaskService({studies,core,cursorSecret:'x'.repeat(32)});await assert.rejects(api.command(user,'study','transition','task',{requestKey:'test-source-1',expectedVersion:0,status:'completed',evidenceRefs:[ref]}),e=>e.code==='STUDY_TASK_SOURCE_CHANGED');assert.equal(wrote,false);
});
test('participants filters current task authority and binds signed paging to actor and study',async()=>{
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},ctx={...scope,executionProjectId:'project'},user={tenantId:'tenant',accountId:'actor',role:'tenant_admin',authVersion:2};
 const accounts=[{id:'allowed',displayName:'Allowed',role:'researcher',authVersion:1,createdAt:new Date('2026-01-02T00:00:00Z')},{id:'denied',displayName:'Denied',role:'researcher',authVersion:1,createdAt:new Date('2026-01-01T00:00:00Z')}];
 const tx={account:{findMany:async()=>accounts}},studies={withResearchStudyTransaction:async(_u,_s,_a,fn)=>fn(tx,ctx)},core={authorize:async(_tx,principal)=>{if(principal.accountId==='denied')throw {getResponse:()=>({code:'STUDY_TASK_AUTH_REQUIRED'})};return {...scope,actorAccountId:principal.accountId,canExecute:true};}};
 const api=createFormalTaskService({studies,core,cursorSecret:'x'.repeat(32)});const page=await api.participants(user,'study',{limit:'1'});assert.deepEqual(page.items,[{id:'allowed',displayName:'Allowed'}]);assert.ok(page.nextCursor);
 await assert.rejects(api.participants({...user,authVersion:3},'study',{limit:'1',cursor:page.nextCursor}),e=>e.code==='STUDY_TASK_CURSOR_INVALID');await assert.rejects(api.participants(user,'other',{limit:'1',cursor:page.nextCursor}),e=>e.code==='STUDY_TASK_CURSOR_INVALID');
});
