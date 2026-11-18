import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createAssetGovernanceProbe} from './research-assets-governance-probe.mjs';
test('governance response probe is local, opt-in and once-only for one committed historical-version withdrawal',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rh-governance-probe-')),path=join(dir,'probe.json'),ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},now=Date.parse('2026-11-13T00:00:00Z');
 const probe=createAssetGovernanceProbe({ids,path,now:()=>now}),user={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a'},receipt={assetId:'asset',version:3,revision:10,status:'committed',operation:'withdrawn'},input={action:'withdraw',version:3,expectedRevision:9,requestKey:'gov-original-key'};
 try{
  await probe({user,input,receipt});writeFileSync(path,JSON.stringify({schemaVersion:'rh-asset-governance-probe.v1',ids,assetId:'asset',actorId:'a',version:3,expectedRevision:9,expiresAt:new Date(now+300000).toISOString(),used:false}),{mode:0o600});
  await probe({user:{...user,accountId:'o'},input,receipt});await probe({user,input:{...input,action:'release'},receipt});assert.equal(JSON.parse(readFileSync(path)).used,false);
  await assert.rejects(probe({user,input,receipt}),e=>e.status===503);const state=JSON.parse(readFileSync(path));assert.equal(state.used,true);assert.equal(state.operationKey,input.requestKey);assert(!JSON.stringify(state).includes('reason'));await probe({user,input,receipt});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
