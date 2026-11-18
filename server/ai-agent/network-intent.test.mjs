import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./network-intent.mjs').catch(()=>({}));
test('new requests default offline and accept only a strict explicit boolean network intent',()=>{
 assert.equal(typeof api.normalizeNetworkIntent,'function');
 assert.deepEqual(api.normalizeNetworkIntent(),{schema:'hub-network-intent.v1',enabled:false});
 assert.deepEqual(api.normalizeNetworkIntent({schema:'hub-network-intent.v1',enabled:true}),{schema:'hub-network-intent.v1',enabled:true});
 for(const v of [true,null,{enabled:true},{schema:'hub-network-intent.v1',enabled:'true'},{schema:'hub-network-intent.v1',enabled:true,role:'admin'}])assert.throws(()=>api.normalizeNetworkIntent(v),e=>e.status===400);
});
test('explicit Hub-only/no-network wording can narrow but never enlarge user network consent',()=>{
 assert.equal(typeof api.effectiveNetworkIntent,'function');
 const on={schema:'hub-network-intent.v1',enabled:true};
 for(const text of ['只用Hub已审核资料，不联网。','仅依据 Hub 资料回答','不要联网检索','无需外部检索','仅检索Hub已审核资料，查询针灸治疗抑郁的研究','只查询Hub资料，不访问外部网站','不要联网搜索，只检索Hub资料'])assert.equal(api.effectiveNetworkIntent(on,text).enabled,false,text);
 assert.equal(api.effectiveNetworkIntent(on,'不只用Hub，也查询官网').enabled,true);
 assert.equal(api.effectiveNetworkIntent(on,'检索近一年针灸论文').enabled,true);
 assert.equal(api.effectiveNetworkIntent(undefined,'允许全网检索').enabled,false);
});
