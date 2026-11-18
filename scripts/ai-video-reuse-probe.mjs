// Offline reconnaissance only: generated media, no database, HTTP, or models.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile,stat,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

assert(process.argv.includes('--generated-only'),'Pass --generated-only; no user files are accepted.');
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=new URL('../.tmp/ai-video-2026-11-16/reuse-probe/',import.meta.url);
await mkdir(out,{recursive:true,mode:0o700});
const require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {inspectChatUploadFile}=require(root+'app/server/src/sessions/chat-upload-inspector.ts');
const {inspectMediaFile}=require(root+'app/server/src/ingest/media-inspection.ts');
const {isRetiredSkillKey}=require(root+'app/server/src/common/skill-visibility-policy.ts');
const run=promisify(execFile),valid=new URL('generated-av.mp4',out),bad=new URL('generated-corrupt.mp4',out);
await run('ffmpeg',['-hide_banner','-loglevel','error','-y',
 '-f','lavfi','-i','color=c=blue:s=160x120:r=5',
 '-f','lavfi','-i','sine=frequency=440:sample_rate=16000',
 '-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',fileURLToPath(valid)],{timeout:30000,maxBuffer:1024*1024});
const bytes=await readFile(valid);
const signature=await inspectChatUploadFile({path:fileURLToPath(valid),filename:'generated-av.mp4',declaredMimetype:'video/mp4',size:(await stat(valid)).size});
assert.equal(signature.modality,'video');
assert.equal(signature.sha256,createHash('sha256').update(bytes).digest('hex'));
const inspection=await inspectMediaFile(fileURLToPath(valid),'generated-av.mp4');
assert.equal(inspection.classification,'valid');
assert.equal(inspection.status,'complete');
assert.equal(inspection.hasVideo,true);assert.equal(inspection.hasAudio,true);
assert(inspection.durationSeconds>=1&&inspection.durationSeconds<2);
// Preserve the real MP4 signature but remove its moov/index and content.
await writeFile(bad,bytes.subarray(0,40),{mode:0o600});
const corrupt=await inspectMediaFile(fileURLToPath(bad),'generated-corrupt.mp4');
assert.equal(corrupt.classification,'corrupt');assert.equal(corrupt.status,'unavailable');
assert.equal(corrupt.hasVideo,false);assert.equal(corrupt.hasAudio,false);
assert.equal(isRetiredSkillKey('raw-video-orchestration'),true);
const report={passed:true,at:new Date().toISOString(),syntheticOnly:true,
 fixtures:['generated-av.mp4','generated-corrupt.mp4'],signature,inspection,corrupt,
 retiredVideoSkillBlocked:true,scope:'Native signature and ffprobe only; not Hub upload, playback, content understanding, or user acceptance.',
 databaseConnections:0,httpRequests:0,providerRequests:0,sharedServiceRestarts:0};
await writeFile(new URL('result.json',out),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({passed:true,signature:signature.extension,valid:inspection.classification,corrupt:corrupt.classification,retiredVideoSkillBlocked:true,providerRequests:0,databaseConnections:0}));
