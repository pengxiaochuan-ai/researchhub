import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/governance-loading.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('fast category publishes ready before slow category, snapshots immutable and every unread category stays loading',async()=>{
 assert.equal(typeof api.loadGovernanceResults,'function');const slow=deferred(),events=[];
 const done=api.loadGovernanceResults({kinds:['sources','invitations'],load:k=>k==='sources'?Promise.resolve([{id:'source'}]):slow.promise,onUpdate:s=>events.push(s)});
 await new Promise(setImmediate);assert.equal(events[0].sources.state,'loading');assert.equal(events.at(-1).sources.state,'ready');assert.equal(events.at(-1).invitations.state,'loading');assert.equal(events[0].sources.state,'loading');
 slow.resolve([]);const final=await done;assert.equal(final.invitations.state,'ready');assert.equal(events.at(-1).invitations.state,'ready');
});
test('failed and denied categories are never successful zero; abort suppresses a late successful result',async()=>{
 assert.equal(typeof api.loadGovernanceResults,'function');const c=new AbortController(),slow=deferred(),events=[];
 const done=api.loadGovernanceResults({kinds:['sources','teams','invitations'],signal:c.signal,load:k=>k==='sources'?Promise.reject(Object.assign(Error('denied'),{status:403})):k==='teams'?Promise.reject(Error('network')):slow.promise,onUpdate:s=>events.push(s)});
 await new Promise(setImmediate);assert.equal(events.at(-1).sources.state,'denied');assert.equal(events.at(-1).teams.state,'error');assert.equal(events.at(-1).invitations.state,'loading');c.abort();slow.resolve([{id:'late-private'}]);const final=await done;assert.equal(final.invitations.state,'error');assert(!JSON.stringify(final).includes('late-private'));
});
