import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAssetRegistration,sealAssetRegistration,assertRegistrationPolicy,registrationRequestHash,assetDigest} from './research-assets-registration-contract.mjs';
const ids={owner:'owner',admin:'admin'},actor={accountId:'owner',tenantId:'t',studyGroupId:'g',researchProjectId:'p'};
const input={kind:'protocol',metadata:{title:'原创合成方案',summary:'人工整理摘要',purpose:'合成方法讨论',limitations:'无临床含义',author:'合成作者',domains:['情志病']},sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'本轮原创合成材料，获准两账号只读和引用',discoveryRecipients:['owner','admin']},contentMd:'# 合成方案\n\n仅方法说明。',requestKey:'registration-create-1'};
test('byte buffers use raw-byte SHA256 rather than the JSON representation of a Buffer',()=>{
 assert.equal(assetDigest(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.equal(assetDigest(Buffer.from('abc')),assetDigest('abc'));
});
test('five kinds seal metadata, content and current policy to the same fixed owner and version',()=>{
 for(const kind of ['protocol','dataset','instrument','analysis','publication']){
  const value=validateAssetRegistration({...input,kind},{ids});const sealed=sealAssetRegistration(value,actor,1);
  assert.equal(sealed.block.assetKind,kind);assert.equal(sealed.block.ownerAccountId,'owner');assert.equal(sealed.block.versionNo,1);assert.match(sealed.policyHash,/^[a-f0-9]{64}$/);
  assertRegistrationPolicy(sealed.block,{...sealed,version:1,metadata:value.metadata,sourceBindings:value.sourceBindings,rightsEvidence:value.policy.rightsEvidence,discoveryRecipientCeiling:value.policy.discoveryRecipients},'owner',kind);
  assert.throws(()=>assertRegistrationPolicy({...sealed.block,metadata:{...sealed.block.metadata,title:'篡改'}},{...sealed,version:1,metadata:value.metadata,sourceBindings:[],rightsEvidence:value.policy.rightsEvidence,discoveryRecipientCeiling:value.policy.discoveryRecipients},'owner',kind));
  if(kind==='analysis')assert.equal(value.metadata.analysisNature,'method_description');
 }
});
test('unknown rights remain draft data, never become invented copying rights or recipients',()=>{
 const unknown=validateAssetRegistration({...input,policy:{rightsEvidence:'',discoveryRecipients:[]}},{ids});assert.equal(unknown.policy.rightsEvidence,'');
 for(const change of [{ownerAccountId:'admin'},{policy:{...input.policy,discoveryRecipients:['third']}},{policy:{...input.policy,discoveryRecipients:['owner','owner']}},{sourceKind:'knowledge',sourceBindings:[]},{sourceKind:'author',sourceBindings:[{kind:'knowledge',id:'doc',version:1,contentHash:'a'.repeat(64)}]},{contentMd:'x'.repeat(131073)},{metadata:{...input.metadata,analysisNature:'executed_result'}},{contentMd:'\u0000payload'}])assert.throws(()=>validateAssetRegistration({...input,...change},{ids}));
});
test('canonical request identity survives JSON key order but not changed content, scope or fixed base version',()=>{
 const a=validateAssetRegistration(input,{ids}),b=validateAssetRegistration({...input,metadata:{author:input.metadata.author,limitations:input.metadata.limitations,purpose:input.metadata.purpose,summary:input.metadata.summary,title:input.metadata.title,domains:['情志病']}},{ids});
 assert.equal(registrationRequestHash(a,actor),registrationRequestHash(b,actor));
 assert.notEqual(registrationRequestHash(a,actor),registrationRequestHash({...a,contentMd:a.contentMd+'x'},actor));
 assert.notEqual(registrationRequestHash(a,actor),registrationRequestHash(a,{...actor,researchProjectId:'other'}));
 assert.throws(()=>validateAssetRegistration({...input,baseVersion:1,expectedRevision:1},{ids}));
 const revision=validateAssetRegistration({...input,baseVersion:1,expectedRevision:2},{ids,revision:true});assert.equal(revision.baseVersion,1);
});
