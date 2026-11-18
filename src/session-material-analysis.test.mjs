import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./session-material-session.js');
const ready={id:'one',state:'ready',available:true},pending={id:'two',state:'importing',available:false},warning={id:'three',state:'blocked',available:false};
test('ready and parsing sources allow queued questions only when the actual backend declares analysis ready',()=>{
 assert.equal(typeof api.materialAnalysisState,'function');
 const state=items=>api.materialAnalysisState({enabled:true,analysisReady:true,items});
 assert.equal(state([ready]).blocksAnalysis,false);assert.equal(state([pending]).blocksAnalysis,false);assert.equal(state([ready,warning]).blocksAnalysis,false);assert.equal(state([warning]).blocksAnalysis,true);
 assert.equal(api.materialAnalysisState({enabled:true,analysisReady:false,items:[ready]}).blocksAnalysis,true);
 assert.equal(state([]).blocksAnalysis,false);
});
test('unknown/unread/error/uploading states still block; enabling analysis never drops safety and identity recovery',()=>{
 for(const extra of [{checking:true},{error:'offline'},{uploading:true},{pending:['unknown-request']}])assert.equal(api.materialAnalysisState({enabled:true,analysisReady:true,items:[ready],...extra}).blocksAnalysis,true);
});
