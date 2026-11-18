import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisitsService} from './visits.mjs';
const user={tenantId:'t',accountId:'u',authVersion:3},ctx={tenantId:'t',studyGroupId:'g',executionProjectId:'p'},tx={};
test('visit pagination is current actor, authentication version and filter bound',async()=>{
 const calls=[],studies={withResearchStudyTransaction:async(u,id,op,fn)=>{assert.equal(u,user);assert.equal(id,'study');assert.equal(op,'read');return fn(tx,ctx);}};
 const core={list:async(...args)=>{calls.push(args);return {items:[{id:'visit',subject:{subjectId:'SYNTHETIC'},capabilities:{canAssign:false}}],nextAfterId:calls.length===1?'visit':null};}};
 const api=createVisitsService({studies,core}),first=await api.list(user,'study',{limit:'1',subjectId:'subject'});
 assert(first.nextCursor);assert.deepEqual(calls[0],[tx,user,{tenantId:'t',studyGroupId:'g',researchProjectId:'p'},{limit:1,subjectId:'subject'}]);
 const second=await api.list(user,'study',{limit:'1',subjectId:'subject',cursor:first.nextCursor});assert.equal(second.nextCursor,null);assert.equal(calls[1][3].afterId,'visit');
 for(const changed of [{...user,accountId:'other'},{...user,authVersion:4}])await assert.rejects(async()=>api.list(changed,'study',{limit:'1',subjectId:'subject',cursor:first.nextCursor}),e=>e.status===400);
 await assert.rejects(async()=>api.list(user,'study',{subjectId:'other',cursor:first.nextCursor}),e=>e.status===400);assert.equal(calls.length,2);
});
test('visit detail passes only server resolved scope and retains completion limitations',async()=>{
 const studies={withResearchStudyTransaction:async(_u,_id,_op,fn)=>fn(tx,ctx)},value={id:'visit',completionIntegrity:'requires_review',capabilities:{canComplete:false}};
 const api=createVisitsService({studies,core:{read:async(db,u,s,id)=>{assert.equal(db,tx);assert.equal(u,user);assert.deepEqual(s,{tenantId:'t',studyGroupId:'g',researchProjectId:'p'});assert.equal(id,'visit');return value;}}});
 assert.deepEqual(await api.read(user,'study','visit'),{studyId:'study',visit:value});
 for(const q of [{limit:'0'},{limit:'101'},{tenantId:'other'},{subjectId:'../other'},{cursor:'invalid'}])await assert.rejects(async()=>api.list(user,'study',q),e=>e.status===400);
});
test('visit commands and receipt recovery share one transaction and preserve original completion history',async()=>{
 let saved,count=0;const events=[],value={id:'visit',actualCompletedAt:'original-time',evidenceRefs:[{source:'original'}]};
 const tx={$queryRaw:async()=>[],auditLog:{createMany:async()=>({count:1})}},studies={withResearchStudyTransaction:async(_u,_s,_o,fn)=>fn(tx,ctx)};
 const core={authorize:async(...args)=>events.push(args[3]),complete:async(db,u,s,id,body)=>{assert.equal(db,tx);assert.equal(u,user);assert.equal(id,'visit');assert.deepEqual(body,{expectedVersion:0});count++;return value;},read:async()=>value};
 const receipts={getReceipt:async()=>saved,saveReceipt:async(_tx,_user,data)=>{saved={request_hash:data.hash,action:data.action,target_id:data.target,result:data.result};}};
 const api=createVisitsService({studies,core,receipts}),body={requestKey:'complete-key',expectedVersion:0};
 const first=await api.command(user,'study','visit','complete',body),second=await api.command(user,'study','visit','complete',body);
 assert.deepEqual(second,first);assert.equal(count,1);assert.equal(first.visit.actualCompletedAt,'original-time');assert.deepEqual(events,['complete','complete']);
 assert.deepEqual(await api.receipt(user,'study','visit','complete-key',{operation:'complete'}),first);
 await assert.rejects(api.command(user,'study','visit','complete',{...body,notes:'different content'}),e=>e.status===409);
 await assert.rejects(async()=>api.command(user,'study','visit','reverify',{requestKey:'reverify-key',expectedVersion:1}),e=>e.status===400);
});
test('reverify normalizes the real core visitId result before saving and recovering its receipt',async()=>{
 let saved,changes=0;
 const tx={$queryRaw:async()=>[],auditLog:{createMany:async()=>({count:1})}},studies={withResearchStudyTransaction:async(_u,_s,_o,fn)=>fn(tx,ctx)};
 const current={id:'visit',version:4,completionIntegrity:'current',actualCompletedAt:'original-completion-time'};
 const core={authorize:async()=>{},reverify:async()=>{changes++;return {visitId:'visit',version:4,completionIntegrity:'current',refs:[]};},read:async()=>current};
 const receipts={getReceipt:async()=>saved,saveReceipt:async(_tx,_user,data)=>{saved={request_hash:data.hash,action:data.action,target_id:data.target,result:data.result};}};
 const api=createVisitsService({studies,core,receipts}),body={requestKey:'reverify-key',expectedVersion:3,reason:'approved correction'};
 const first=await api.command(user,'study','visit','reverify',body);assert.deepEqual(first.visit,current);
 assert.deepEqual(await api.command(user,'study','visit','reverify',body),first);
 assert.deepEqual(await api.receipt(user,'study','visit','reverify-key',{operation:'reverify'}),first);assert.equal(changes,1);
});
