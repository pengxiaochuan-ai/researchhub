import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./service.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const now=new Date('2026-11-13T08:00:00Z');
const principal={tenantId:'tenant',accountId:'admin',authVersion:2,role:'tenant_admin'};
function setup({role='tenant_admin',version=2,active=true,revoked=false,read=()=>({})}={}){
 let checks=0,sourceReads=0;
 const tx={account:{findFirst:async q=>{assert.equal(q.where.tenantId,principal.tenantId);checks++;return active?{id:principal.accountId,role,isTenantAdmin:role==='tenant_admin',authVersion:revoked&&checks>1?3:version,status:'active',tenant:{status:'active'}}:null;}}};
 return {service:()=>api.createGovernanceSystem({tenantId:principal.tenantId,transact:async cb=>cb(tx),readState:async()=>{sourceReads++;return read();},now:()=>now}),sourceReads:()=>sourceReads};
}
test('status contract exists and configuration never implies a live check',()=>{
 assert.equal(typeof api.projectServiceStates,'function');
 const rows=api.projectServiceStates({parser:{configured:true,secret:'NEVER',url:'https://secret'},email:{configured:false},ai:{configured:'true'},vector:{configured:true,check:{status:'passed',checkedAt:now.toISOString()}}},now);
 assert.equal(rows.length,5);assert.equal(rows.find(r=>r.key==='parser').check.status,'unknown');
 assert.equal(rows.find(r=>r.key==='email').configuration,'missing');assert.equal(rows.find(r=>r.key==='ai').configuration,'unknown');
 assert.equal(rows.find(r=>r.key==='vector').check.status,'passed');assert(!JSON.stringify(rows).includes('NEVER'));assert(!JSON.stringify(rows).includes('https'));
});
test('malformed, missing, future and contradictory checks are unknown, failure is truthful',()=>{
 assert.equal(typeof api.projectServiceStates,'function');
 for(const check of [{status:'passed'}, {status:'healthy',checkedAt:now.toISOString()},{status:'passed',checkedAt:'bad'},{status:'passed',checkedAt:'2027-01-01T00:00:00Z'}])assert.equal(api.projectServiceStates({ai:{configured:true,check}},now).find(r=>r.key==='ai').check.status,'unknown');
 assert.equal(api.projectServiceStates({ai:{configured:false,check:{status:'passed',checkedAt:now.toISOString()}}},now).find(r=>r.key==='ai').check.status,'unknown');
 assert.equal(api.projectServiceStates({parser:{configured:true,check:{status:'failed',checkedAt:now.toISOString(),error:'secret'}}},now).find(r=>r.key==='parser').check.status,'failed');
});
test('owner, stale, inactive and cross tenant reject before reading runtime state',async()=>{
 assert.equal(typeof api.createGovernanceSystem,'function');
 for(const config of [{role:'researcher'},{version:3},{active:false}]){const s=setup(config);await assert.rejects(()=>s.service().status(principal),{status:403});assert.equal(s.sourceReads(),0);}
 const s=setup();await assert.rejects(()=>s.service().status({...principal,tenantId:'other'}),{status:403});assert.equal(s.sourceReads(),0);
});
test('status rechecks current authority after collecting runtime state',async()=>{
 assert.equal(typeof api.createGovernanceSystem,'function');const s=setup({revoked:true});await assert.rejects(()=>s.service().status(principal),{status:403});
 const r=await setup({read:()=>({ai:{configured:true,password:'secret'}})}).service().status(principal);assert.equal(r.schema,'hub-system-status.v1');assert.equal(r.services.length,5);assert(!JSON.stringify(r).includes('secret'));
});
test('unknown query rejected; reader failure never leaks a configuration error',async()=>{
 assert.equal(typeof api.createGovernanceSystem,'function');const s=setup({read:()=>{throw Error('SMTP_PASSWORD=secret');}});await assert.rejects(()=>s.service().status(principal,{tenantId:'other'}),{status:400});
 await assert.rejects(()=>s.service().status(principal),e=>e.status===503&&!e.message.includes('secret'));
});
