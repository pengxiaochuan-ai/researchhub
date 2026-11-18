import test from 'node:test';import assert from 'node:assert/strict';
import {createMediaInspection} from '../../scripts/ai-session-media-inspection.mjs';
test('media checker fixes local protocols, demuxer, process bounds and never follows a supplied URL',async()=>{
 let call;
 const inspect=createMediaInspection({parse:JSON.parse,classify:()=>({classification:'parse_failed'}),execute:async(...args)=>{call=args;return{stdout:'{"classification":"valid"}'};}});
 assert.equal((await inspect('/private/generated.mp4','media.mp4')).classification,'valid');
 assert.deepEqual(call[1].slice(0,6),['-v','error','-protocol_whitelist','file,pipe','-f','mov']);
 assert(call[1].includes('-enable_drefs'));assert.equal(call[2].timeout,30000);assert.equal(call[2].maxBuffer,1024*1024);
 assert.deepEqual(Object.keys(call[2].env).sort(),['LANG','PATH']);
});
test('media checking uses native failure classification and cleans failed recheck input',async()=>{
 const inspect=createMediaInspection({parse:JSON.parse,classify:e=>({classification:e.code==='ENOENT'?'tool_unavailable':'parse_failed'}),execute:async()=>{throw{code:'ENOENT'};}});
 assert.equal((await inspect('/private/generated.webm','media.webm')).classification,'tool_unavailable');
 await assert.rejects(inspect(null,'media.mp4',{validate:async()=>{throw Object.assign(Error('MEDIA_ACCESS'),{code:'MEDIA_ACCESS',status:403});}}),/MEDIA_ACCESS/);
 const corrupt=createMediaInspection({parse:JSON.parse,classify:()=>({classification:'corrupt'}),execute:async()=>{throw{code:1,stderr:'moov atom not found'};}});
 assert.equal((await corrupt('/private/bad.mp4','bad.mp4')).classification,'corrupt');
});
