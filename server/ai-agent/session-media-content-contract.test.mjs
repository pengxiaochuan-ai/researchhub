import test from'node:test';import assert from'node:assert/strict';
const api=await import('./session-media-content-contract.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('content input binds only an original request key and media version',()=>{
 assert(api,'content contract missing');assert.deepEqual(api.normalizeContentRequest({requestKey:'new-1',expectedMediaVersion:5}),{requestKey:'new-1',expectedMediaVersion:5});
 for(const value of [{requestKey:'a',expectedMediaVersion:0},{requestKey:'a',expectedMediaVersion:1,url:'https://outside.invalid'},{requestKey:'a',expectedMediaVersion:1,storageKey:'private'},{requestKey:'a',expectedMediaVersion:1,prompt:'injected'},null])assert.throws(()=>api.normalizeContentRequest(value),e=>e.code==='MEDIA_CONTENT_INPUT');
});
test('only actual evidence and bounded source times are deliverable',()=>{
 assert(api,'content validation missing');const manifest={sourceSha256:'a'.repeat(64),sourceVersion:5,durationUs:'4000000',timelineOriginUs:'0'};
 const output={schema:'hub-media-content-output.v1',sourceSha256:manifest.sourceSha256,sourceVersion:5,channel:'audio',status:'complete',coverage:{startUs:'0',endUs:'4000000'},evidence:[{id:'segment-1',kind:'transcript',text:'合成科研材料。',startUs:'1000000',endUs:'2000000',estimated:true}],usage:{executor:'whisper-small',requests:1}};
 assert.equal(api.validateContentOutput(output,manifest,'audio').evidence.length,1);
 for(const mutate of [v=>v.sourceSha256='b'.repeat(64),v=>v.sourceVersion=6,v=>v.evidence[0].endUs='5000000',v=>v.evidence[0].startUs='-1',v=>v.evidence[0].estimated=false,v=>v.evidence.push(v.evidence[0]),v=>v.evidence[0].url='https://fake.invalid']){const value=structuredClone(output);mutate(value);assert.throws(()=>api.validateContentOutput(value,manifest,'audio'));}
 assert.throws(()=>api.validateContentOutput(output,{...manifest,timelineOriginUs:'5000000'},'audio'),e=>e.code==='MEDIA_CONTENT_TIMELINE_UNSUPPORTED');
});
test('visual descriptions can select only actual frames, never fabricated timestamps',()=>{
 assert(api,'visual validation missing');const frames=[{id:'f1',pts:'100',timeBase:'1/100',presentationUs:'1000000',sha256:'c'.repeat(64)}];
 assert.deepEqual(api.bindFrameDescriptions([{frameId:'f1',description:'红色背景。'}],frames),[{...frames[0],description:'红色背景。'}]);
 assert.throws(()=>api.bindFrameDescriptions([{frameId:'unknown',description:'虚构'}],frames));assert.throws(()=>api.bindFrameDescriptions([{frameId:'f1',description:'红色',time:10}],frames));
});

test('PTS, manifest time base and generated exact coordinates must agree',()=>{
 const manifest={sourceSha256:'a'.repeat(64),sourceVersion:2,durationUs:'10000000',timelineOriginUs:'0',videoTimeBase:'1/25'},output={schema:'hub-media-content-output.v1',sourceSha256:manifest.sourceSha256,sourceVersion:2,channel:'visual',status:'complete',coverage:{startUs:'0',endUs:'10000000'},evidence:[{id:'f',kind:'frame',text:'合成画面',startUs:'9000000',endUs:'9000000',estimated:false,pts:'225',timeBase:'1/25',sha256:'c'.repeat(64)}],usage:{executor:'local',requests:1}};
 api.validateContentOutput(output,manifest,'visual');for(const patch of [{startUs:'1000000',endUs:'1000000'},{pts:'25'},{timeBase:'1/250'}]){const v=structuredClone(output);Object.assign(v.evidence[0],patch);assert.throws(()=>api.validateContentOutput(v,manifest,'visual'),{code:'MEDIA_CONTENT_EVIDENCE'});}
});
