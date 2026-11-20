import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createEeglabInspection,assertEeglabRuntimeReady,inspectEeglabSignature} from '../../scripts/ai-session-eeglab-inspection.mjs';
import {createMediaInspection} from '../../scripts/ai-session-media-inspection.mjs';
const fixtures=JSON.parse(readFileSync(new URL('../../.tmp/eeglab-ui-fixtures-2026-11-19/manifest.json',import.meta.url))),inspect=createEeglabInspection();
test('independent reader actually imports pinned libraries and never substitutes an unrelated Python',async()=>{
 assert.deepEqual((await assertEeglabRuntimeReady()).packages,{numpy:'2.5.1',scipy:'1.18.0',h5py:'3.16.0'});
 await assert.rejects(assertEeglabRuntimeReady('/missing/python'),/EEGLAB_RUNTIME_NOT_READY/);
 const failed=await createEeglabInspection({python:'/missing/python'})(fixtures.cases[0].archive,'originals.eeglab');assert.equal(failed.classification,'tool_unavailable');
});
for(const item of fixtures.cases)test('real bounded EEGLAB fixture: '+item.id,async()=>{
 const result=await inspect(item.archive,'originals.eeglab');
 if(item.valid){const {classification,...facts}=result;assert.equal(classification,'valid');assert.deepEqual(facts,item.inspection);assert.equal((await inspectEeglabSignature({path:item.archive})).sha256,item.archiveSha256);}
 else assert.notEqual(result.classification,'valid');
 assert(!JSON.stringify(result).includes('history'));assert(!JSON.stringify(result).includes('PRIVATE_SUBJECT'));
});
test('EEGLAB dispatch never enters ffmpeg or video classification',async()=>{
 const dispatch=createMediaInspection({parse:()=>{throw Error('video parser forbidden');},classify:()=>{throw Error('video classifier forbidden');},execute:()=>{throw Error('ffmpeg forbidden');}});
 assert.equal((await dispatch(fixtures.cases[0].archive,'originals.eeglab')).classification,'valid');
});
