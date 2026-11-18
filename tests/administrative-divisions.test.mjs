import test from 'node:test';import assert from 'node:assert/strict';
import {createDivisionClient} from '../src/administrative-divisions.js';
test('reference client reads only the local same-origin dictionary with strict parent scope',async()=>{
 let seen;const c=createDivisionClient({fetchImpl:async(url,init)=>{seen={url,...init};return{ok:true,json:async()=>({version:'MCA-2024-12-31',items:[],provinceOnly:false})};}});
 await c.list('130000');assert.equal(seen.url,'/api/reference/administrative-divisions?parentCode=130000');assert.equal(seen.credentials,'same-origin');assert.equal(seen.cache,'no-store');
 await assert.rejects(c.list('https://foreign.example/'));await assert.rejects(c.list('130100'));
});
test('reference client discards delayed responses after identity/object invalidation and never uses local demo options',async()=>{
 let c;c=createDivisionClient({fetchImpl:async()=>({ok:true,json:async()=>{c.invalidate();return{version:'MCA-2024-12-31',items:[]};}})});await assert.rejects(c.list(),{name:'AbortError'});
 const failure=createDivisionClient({fetchImpl:async()=>{throw Error('offline');}});await assert.rejects(failure.list(),{code:'REFERENCE_UNAVAILABLE'});
});
