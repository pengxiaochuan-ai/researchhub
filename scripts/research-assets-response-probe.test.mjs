import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createAssetResponseProbe} from './research-assets-response-probe.mjs';
test('local response-loss probe is opt-in, single-use, fixed-actor/scope/version and never changes a business receipt',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rh-response-probe-')),path=join(dir,'probe.json'),ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},now=Date.parse('2026-11-13T00:00:00Z');
 const probe=createAssetResponseProbe({ids,path,now:()=>now}),user={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a'},receipt={assetId:'new-asset',version:3,revision:3,status:'committed'},event={user,input:{baseVersion:2,expectedRevision:2,requestKey:'original-key'},receipt};
 try{
  await probe(event);writeFileSync(path,JSON.stringify({schemaVersion:'rh-asset-response-probe.v1',ids,assetId:'new-asset',actorId:'a',baseVersion:2,expectedRevision:2,expiresAt:new Date(now+300000).toISOString(),used:false}),{mode:0o600});
  await probe({...event,user:{...user,accountId:'o'}});assert.equal(JSON.parse(readFileSync(path,'utf8')).used,false);
  await assert.rejects(probe(event),e=>e.status===503&&e.code==='ASSET_CATALOG_RESULT_UNCONFIRMED');const used=JSON.parse(readFileSync(path,'utf8'));assert.equal(used.used,true);assert.equal(used.operationKey,'original-key');assert.equal(used.receipt.assetId,receipt.assetId);assert(!JSON.stringify(used).includes('contentMd'));
  await probe(event);assert.equal(receipt.status,'committed');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
