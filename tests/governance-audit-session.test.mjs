import test from 'node:test';import assert from 'node:assert/strict';
import {createGovernanceAuditClient,createAuditEpoch,readAuditFilters} from '../src/governance-audit-session.js';
test('audit client uses only no-store same-origin GET and omits empty filters',async()=>{const calls=[];const c=createGovernanceAuditClient({fetchImpl:async(...args)=>{calls.push(args);return{ok:true,json:async()=>({items:[]})};}});await c.list({take:20,skip:0,action:'',target:''});await c.detail('id');assert.equal(calls[0][0],'/api/governance-audit?take=20&skip=0');for(const[,init]of calls){assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.body,undefined);}});
test('network failure and business403 remain separate from logout',async()=>{await assert.rejects(()=>createGovernanceAuditClient({fetchImpl:async()=>{throw Error();}}).list({}),{status:0});await assert.rejects(()=>createGovernanceAuditClient({fetchImpl:async()=>({ok:false,status:403,json:async()=>({message:'无权'})})}).list({}),{status:403});});
test('new collection invalidates identity-late list and detail',()=>{const e=createAuditEpoch(),old=e.advance();assert(e.isCurrent(old));e.advance();assert(!e.isCurrent(old));});
test('return route restores only query metadata and never an audit record body',()=>{
 assert.deepEqual(readAuditFilters('?action=update_account&target=x&skip=20&cursor=signed&meta=SECRET'),{take:20,skip:20,action:'update_account',target:'x',cursor:'signed'});
});
