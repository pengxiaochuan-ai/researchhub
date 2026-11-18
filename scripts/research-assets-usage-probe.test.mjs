import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createAssetUsageProbe} from './research-assets-usage-probe.mjs';
test('usage fault injection is private, exact, once-only and never changes a committed receipt',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rh-c05-probe-')),path=join(dir,'probe.json'),ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},now=Date.now(),user={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'o'},input={action:'request',version:1,expectedRevision:4,requestKey:'original-key'},receipt={status:'committed',operation:'requested',assetId:'asset',version:1,revision:5,requestId:'grant'};
 try{
  const probe=createAssetUsageProbe({ids,path,now:()=>now});await probe({user,input,receipt});
  writeFileSync(path,JSON.stringify({schemaVersion:'rh-asset-usage-probe.v1',ids,actorId:'o',assetId:'asset',version:1,expectedRevision:4,expiresAt:new Date(now+300000).toISOString(),used:false}),{mode:0o600});
  await probe({user:{...user,accountId:'a'},input,receipt});assert.equal(JSON.parse(readFileSync(path)).used,false);
  await assert.rejects(probe({user,input,receipt}),e=>e.status===503);const stored=JSON.parse(readFileSync(path));assert.equal(stored.used,true);assert.deepEqual(stored.receipt,receipt);assert.equal(stored.operationKey,'original-key');
  await probe({user,input,receipt});assert.deepEqual(JSON.parse(readFileSync(path)),stored);
 }finally{rmSync(dir,{recursive:true});}
});
