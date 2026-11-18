import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./smart-search-native-probe.mjs').catch(()=>({}));
test('native probe stays offline unless explicitly invoked with its fixed public live query',()=>{
 assert.equal(typeof api.probeIntent,'function');assert.equal(api.probeIntent([]).live,false);
 assert.equal(api.probeIntent(['--live']).query,'World Health Organization depression fact sheet');
 assert.throws(()=>api.probeIntent(['--live','--query=private']),/PROBE_ARGUMENTS/);
});
test('native tool success requires an actual completed search output and HTTPS source, not just model text',()=>{
 assert.equal(typeof api.assessNativeProbe,'function');
 assert.equal(api.assessNativeProbe([{parts:[{type:'text',text:'Search done https://who.int'}]}]).passed,false);
 assert.equal(api.assessNativeProbe([{parts:[{type:'tool',tool:'websearch',state:{status:'error',input:{query:'x'},output:'https://who.int'}}]}]).passed,false);
 assert.equal(api.assessNativeProbe([{parts:[{type:'tool',tool:'websearch',state:{status:'completed',input:{query:'x'},output:'https://www.who.int/news-room/fact-sheets/detail/depression'}}]}]).passed,true);
});
