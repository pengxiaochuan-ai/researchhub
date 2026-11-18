import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {StudyOperationsService}=require('./src/study-operations/study-operations.service.ts');
const user={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'actor'};
for(const method of ['createQuery','closeQuery','createDeviation','closeDeviation'])test(method+' serializes whole-study quality changes before record read and audit in one transaction',async()=>{
 const events=[];let inTx=false;
 const record={id:'record',status:'open',ruleCode:'manual',targetRecord:{}};
 const model={findFirst:async()=>{events.push('read');assert(inTx);return record;},create:async()=>{events.push('write');assert(inTx);return record;},update:async()=>{events.push('write');assert(inTx);return record;}};
 const db={dataQuery:model,protocolDeviation:model,$executeRaw:async(_sql,lane)=>{assert(inTx);assert.equal(lane,'wp01:tenant:tenant');events.push('tenant-lock');},auditLog:{create:async()=>{assert(inTx);events.push('audit');}}};
 const service=new StudyOperationsService({forTenant:()=>db,withTenantTransaction:async(_t,_g,_p,fn)=>{inTx=true;try{return await fn(db);}finally{inTx=false;}}});
 const args=method==='createQuery'?[{ruleCode:'manual',targetRecord:{}}]:method==='createDeviation'?[{category:'other',severity:'minor'}]:method==='closeQuery'?['record','done']:['record',{closeRationale:'done'}];
 await service[method](user,...args);assert.equal(events[0],'tenant-lock');assert.equal(events.at(-1),'audit');assert.equal(events.filter(e=>e==='write').length,1);
});
