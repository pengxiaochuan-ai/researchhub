import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIntent,requestHash,validateMutation} from './contract.mjs';
test('draft permits missing question and PICO, trims title and rejects client identity',()=>{
 assert.deepEqual(normalizeIntent({title:'  睡眠研究  '}),{title:'睡眠研究',question:'',pico:{p:'',i:'',c:'',o:''},researchType:'',hubKey:null});
 assert.throws(()=>normalizeIntent({title:'研究',actor:'other'}),e=>e.status===400);
});
test('bounded long input is preserved, invalid or excess PICO is rejected',()=>{
 const question='问'.repeat(10000);assert.equal(normalizeIntent({title:'研究',question}).question,question);
 assert.throws(()=>normalizeIntent({title:'研究',pico:{p:1}}),e=>e.status===400);
 assert.throws(()=>normalizeIntent({title:'研究',pico:{unexpected:'x'}}),e=>e.status===400);
 assert.throws(()=>normalizeIntent({title:'x'.repeat(301)}),e=>e.status===400);
});
test('request hash is stable across property order but identifies changed inputs',()=>{
 assert.equal(requestHash({a:1,b:{x:2,y:3}}),requestHash({b:{y:3,x:2},a:1}));
 assert.notEqual(requestHash({a:1}),requestHash({a:2}));
});
test('mutations require a bounded request key and integer CAS',()=>{
 assert.throws(()=>validateMutation({requestKey:'',expectedVersion:1},true),e=>e.status===400);
 assert.throws(()=>validateMutation({requestKey:'request-1',expectedVersion:1.2},true),e=>e.status===400);
 assert.equal(validateMutation({requestKey:'request-1',expectedVersion:2},true).expectedVersion,2);
});
