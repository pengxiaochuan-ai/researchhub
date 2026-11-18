import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {proveLegacyCatalogOrder,stableCatalogDigest} from './research-assets-fingerprint-proof.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('exact legacy hash can be proved by tied-row order without changing a single definition',()=>{
 const a={kind:'constraint',name:'truncated',definition:'CHECK (a)'},b={...a,definition:'CHECK (b)'},tail={kind:'table',name:'t',definition:{rls:true,acl:null}};
 assert.equal(proveLegacyCatalogOrder([b,a,tail],sha([a,b,tail])).matched,true);
 assert.equal(proveLegacyCatalogOrder([b,{...a,definition:'CHECK (evil)'},tail],sha([a,b,tail])).matched,false);
 assert.equal(proveLegacyCatalogOrder([a,b],sha([a,b,tail])).matched,false);
});
test('order search is bounded and never permutes distinct identities',()=>{
 assert.throws(()=>proveLegacyCatalogOrder(Array.from({length:9},(_,i)=>({kind:'k',name:'same',definition:i})),'x'),/BOUND/);
 const rows=[{kind:'k',name:'a',definition:1},{kind:'k',name:'b',definition:2}];assert.equal(proveLegacyCatalogOrder(rows,sha([...rows].reverse())).matched,false);
});
test('v2 full identity digest is stable, covers definitions, and rejects duplicate identities',()=>{
 const a={kind:'constraint',name:'x'.repeat(80)+'A',definition:{a:1,b:2}},b={...a,name:'x'.repeat(80)+'B'};
 assert.equal(stableCatalogDigest([a,b]),stableCatalogDigest([b,{...a,definition:{b:2,a:1}}]));assert.notEqual(stableCatalogDigest([a,b]),stableCatalogDigest([a,{...b,definition:{a:3,b:2}}]));assert.throws(()=>stableCatalogDigest([a,a]),/IDENTITY/);
});
