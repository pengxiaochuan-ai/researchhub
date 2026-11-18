import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// An explicitly reviewed snapshot is read once. This never adopts newer sources.
export function createUiFreezeGuard({workspaceRoot,manifestFile,manifestSha256}){
 const root=resolve(workspaceRoot,'researchhub'),realRoot=realpathSync(root),file=resolve(manifestFile);
 assert(file.startsWith(root+sep),'UI_FREEZE_OUTSIDE_PROJECT');
 const realFile=realpathSync(file);assert(realFile.startsWith(realRoot+sep),'UI_FREEZE_OUTSIDE_PROJECT');
 const bytes=readFileSync(file);assert.equal(sha(bytes),manifestSha256,'UI_FREEZE_PROOF_CHANGED');
 const manifest=JSON.parse(bytes);
 assert(manifest.syntheticOnly===true&&manifest.businessWriteWindowClosed===true&&Array.isArray(manifest.sources)&&manifest.sources.length>0,'UI_FREEZE_UNREVIEWABLE');
 const sources=manifest.sources.map(row=>{
  const path=resolve(root,row.path);
  assert(path.startsWith(root+sep)&&/^[a-f0-9]{64}$/.test(row.sha256),'UI_FREEZE_SOURCE_OUTSIDE_PROJECT');
  const realPath=realpathSync(path);assert(realPath.startsWith(realRoot+sep),'UI_FREEZE_SOURCE_OUTSIDE_PROJECT');
  return {path,realPath,sha256:row.sha256};
 });
 assert.equal(new Set(sources.map(row=>row.realPath)).size,sources.length,'UI_FREEZE_DUPLICATE_SOURCE');
 return ()=>{
  assert.equal(realpathSync(file),realFile,'UI_FREEZE_PROOF_PATH_CHANGED');
  assert.equal(sha(readFileSync(file)),manifestSha256,'UI_FREEZE_PROOF_CHANGED');
  for(const row of sources){assert.equal(realpathSync(row.path),row.realPath,'UI_FREEZE_SOURCE_PATH_CHANGED');assert.equal(sha(readFileSync(row.path)),row.sha256,'UI_SOURCE_CHANGED_STOP_BEFORE_WRITE');}
  return true;
 };
}
