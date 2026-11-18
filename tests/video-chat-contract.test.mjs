import test from 'node:test';import assert from 'node:assert/strict';
import {videoPack,assertVideoPack,videoModelInput,acceptVideoOutput,verifyVideoOutput} from '../server/ai-agent/video-chat-contract.mjs';
const u={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'};
const tool={schema:'hub-media-content-tool.v1',mediaId:'m',runId:'r',sourceSha256:'a'.repeat(64),sourceVersion:2,scope:'selected-transcript-and-sampled-frames',fragments:[{id:'speech-0',kind:'transcript',text:'本次研究关注针灸改善睡眠。',startUs:'1000000',endUs:'3000000',estimated:true,playback:{sessionId:'s',mediaId:'m',runId:'r',evidenceId:'speech-0',timeUs:'1000000'}}]};
test('video pack binds actor, session, source version and exact evidence, not raw media',()=>{
 const p=videoPack(u,'s',tool);assertVideoPack(p,u,'s');for(const patch of [{accountId:'b'},{tenantId:'other'}])assert.throws(()=>assertVideoPack(p,{...u,...patch},'s'));assert.throws(()=>assertVideoPack(p,u,'other'));assert.throws(()=>assertVideoPack({...p,sourceVersion:3},u,'s'));
 const input=JSON.parse(videoModelInput('说了什么？',p));assert(!JSON.stringify(input).includes('sourceSha256'));assert(!JSON.stringify(input).includes('1000000'));assert.equal(input.sources[0].id,'V1');
});
test('invalid playback coordinates and duplicate evidence cannot become trusted citations',()=>{
 assert.throws(()=>videoPack(u,'s',{...tool,fragments:[{...tool.fragments[0],playback:{...tool.fragments[0].playback,sessionId:'other'}}]}));assert.throws(()=>videoPack(u,'s',{...tool,fragments:[tool.fragments[0],tool.fragments[0]]}));
});
test('only chosen source IDs render; model URLs, forged IDs and times are rejected',()=>{
 const p=videoPack(u,'s',tool),output={sections:[{kind:'interpretation',text:'这是研究意向，不能证明疗效。',sourceIds:['V1']}]};const r=acceptVideoOutput(JSON.stringify(output),p);assert.match(r.text,/\[V1\]/);verifyVideoOutput(r.validation,p,r.text);assert.throws(()=>verifyVideoOutput(r.validation,p,r.text+'changed'));
 for(const patch of [{sourceIds:['V99']},{sourceIds:[]},{text:'见00:03'},{text:'https://example.org'},{text:'结论[1]'}])assert.throws(()=>acceptVideoOutput(JSON.stringify({sections:[{...output.sections[0],...patch}]}),p));
});
test('filter can remove unsafe clauses while preserving supported qualitative explanation',()=>{const p=videoPack(u,'s',tool),r=acceptVideoOutput(JSON.stringify({sections:[{kind:'limitation',text:'支持研究关注。多余推断。',sourceIds:['V1']}]}),p,{filterText:t=>t.replace('多余推断。','')});assert.match(r.text,/支持研究关注/);assert.doesNotMatch(r.text,/多余推断/);verifyVideoOutput(r.validation,p,r.text);});
