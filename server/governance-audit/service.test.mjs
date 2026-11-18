import test from 'node:test';import assert from 'node:assert/strict';
import {createGovernanceAudit} from './service.mjs';
const p={tenantId:'t',accountId:'admin',authVersion:1,role:'tenant_admin'};
function setup({role='tenant_admin',version=1,after=false}={}){let reads=0,checks=0;const tx={account:{findFirst:async args=>args.where.id===p.accountId?{id:p.accountId,role,isTenantAdmin:role==='tenant_admin',authVersion:after&&checks++?2:version,status:'active',tenant:{status:'active'}}:null,findMany:async()=>[]},auditLog:{findMany:async q=>{reads++;assert.equal(q.where.tenantId,p.tenantId);assert.deepEqual(q.orderBy,[{createdAt:'desc'},{id:'desc'}]);return[];},count:async()=>0,findFirst:async()=>null}};return{service:createGovernanceAudit({transact:async(_p,cb)=>cb(tx),normalize:()=>({schemaVersion:'legacy_unverified'})}),reads:()=>reads};}
test('normal researcher and stale credential cannot query audit data',async()=>{for(const c of [{role:'researcher'},{version:2}]){const s=setup(c);await assert.rejects(()=>s.service.list(p,{}),{status:403});assert.equal(s.reads(),0);}});
test('scope override rejected before querying data',async()=>{const s=setup();await assert.rejects(()=>s.service.list(p,{tenantId:'other'}),{status:400});assert.equal(s.reads(),0);});
test('list rechecks authority after read and returns a truthful empty page',async()=>{const s=setup();assert.deepEqual((await s.service.list(p,{})).items,[]);await assert.rejects(()=>setup({after:true}).service.list(p,{}),{status:403});});
test('unverified receipt never creates navigation; verified receipt needs current target parent',async()=>{
 for(const mismatch of [true,false]){
  const row={id:'log',tenantId:'t',accountId:'admin',studyGroupId:'g',researchProjectId:'project',target:'protocol',action:'researchhub.protocol.approve',createdAt:new Date(),meta:{requestKey:'key'}};
  let targetChecks=0;const tx={account:{findFirst:async()=>({id:'admin',displayName:'管理员',role:'tenant_admin',isTenantAdmin:true,authVersion:1,status:'active',tenant:{status:'active'}})},auditLog:{findFirst:async()=>row},$queryRaw:async()=>[{audit_id:'log',actor_id:mismatch?'bad':'admin',action:'protocol.approve',target_id:'protocol',result:{protocol:{id:'protocol',status:'approved',versionNumber:1}}}],researchProject:{findFirst:async()=>({id:'project'})},studyProtocolVersion:{findFirst:async({where})=>{targetChecks++;assert.equal(where.tenantId,'t');assert.equal(where.researchProjectId,'project');return null;}},studyGroup:{findFirst:async()=>({id:'g'})}};
  const api=createGovernanceAudit({transact:async(_p,cb)=>cb(tx),normalize:()=>({})}),v=await api.detail(p,'log');assert.equal(v.navigation,null);assert.equal(targetChecks,mismatch?0:1);
 }
});
test('signed seek pagination does not repeat the first row after a newer log is inserted',async()=>{
 const at=new Date('2026-11-13T00:00:00Z');let rows=['c','b','a'].map(id=>({id,tenantId:'t',accountId:'admin',action:'update_account',target:'x',createdAt:at}));
 const tx={account:{findFirst:async()=>({id:'admin',role:'tenant_admin',isTenantAdmin:true,authVersion:1,status:'active',tenant:{status:'active'}}),findMany:async()=>[]},auditLog:{count:async()=>rows.length,findMany:async q=>{assert.equal(q.skip,undefined);const before=q.where.OR?.[1]?.id?.lt;return rows.filter(r=>!before||r.id<before).slice(0,q.take);}}};
 const api=createGovernanceAudit({transact:async(_p,cb)=>cb(tx),normalize:()=>({}),cursorSecret:'test-only-secret'}),first=await api.list(p,{take:1});rows.unshift({...rows[0],id:'d'});
 const second=await api.list(p,{take:1,skip:1,cursor:first.nextCursor});assert.equal(first.items[0].id,'c');assert.equal(second.items[0].id,'b');
 await assert.rejects(()=>api.list(p,{take:1,skip:1,cursor:first.nextCursor,action:'update_account'}));
 await assert.rejects(()=>api.list(p,{take:1,skip:1}));
});
