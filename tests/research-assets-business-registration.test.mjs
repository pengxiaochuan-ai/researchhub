import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAssetRegistration,sealAssetRegistration} from '../scripts/research-assets-registration-contract.mjs';
import {assertAssetAction} from '../scripts/research-assets-catalog-contract.mjs';
import {validateAssetGovernance} from '../scripts/research-assets-governance-contract.mjs';
import {validateAssetLifecycle} from '../scripts/local-research-assets-lifecycle.mjs';

const ids={owner:'synthetic-owner',admin:'synthetic-admin'};
const input=()=>({kind:'protocol',metadata:{title:'合成方案',summary:'摘要',purpose:'方法复用',limitations:'仅合成验证',author:'研究者',domains:[]},sourceKind:'author',sourceBindings:[],contentMd:'# 合成方案',policy:{rightsEvidence:'本人原创',discoveryRecipients:[]},requestKey:'business-register-0001'});
test('business revisions use PostgreSQL integer bounds, preserving legacy fixture ceilings',()=>{
 const value={...input(),baseVersion:9,expectedRevision:25};
 assert.throws(()=>validateAssetRegistration(value,{ids,revision:true}));
 const normal=validateAssetRegistration(value,{ids,revision:true,family:'business'});
 assert.equal(normal.baseVersion,9);
 assert.equal(sealAssetRegistration(normal,{accountId:'third-synthetic-member'},10,undefined,{family:'business'}).block.versionNo,10);
 assert.throws(()=>sealAssetRegistration(normal,{accountId:ids.owner},10));
 for(const [field,n]of [['baseVersion',2147483647],['expectedRevision',2147483647],['baseVersion',1.5]])assert.throws(()=>validateAssetRegistration({...value,[field]:n},{ids,revision:true,family:'business'}));
});
test('business registration accepts only the server-proved recipient set and never caller labels',()=>{
 const value=input();value.policy.discoveryRecipients=['third-synthetic-member'];
 assert.throws(()=>validateAssetRegistration(value,{ids}));
 assert.throws(()=>validateAssetRegistration(value,{ids,family:'business'}));
 assert.deepEqual(validateAssetRegistration(value,{ids,family:'business',allowedRecipients:['third-synthetic-member']}).policy.discoveryRecipients,['third-synthetic-member']);
 assert.throws(()=>validateAssetRegistration({...value,family:'business'},{ids,family:'business',allowedRecipients:['third-synthetic-member']}));
});
test('business revise advances a validated family above eight while old calls remain bounded',()=>{
 const actor={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'owner',permissions:['artifact.edit']};
 const registry={...actor,ownerAccountId:'owner',revision:25,workingVersionNo:9,workingState:'draft',deletedAt:null};
 const command={action:'revise',version:9,baseVersion:9,expectedRevision:25,requestKey:'business-revise-0001'};
 assert.throws(()=>assertAssetAction({registry,sourceValid:true},command,actor));
 const next=assertAssetAction({registry,sourceValid:true,family:{family:'business',maxVersions:2147483647}},command,actor);
 assert.equal(next.workingVersionNo,10);assert.equal(next.revision,26);
 assert.throws(()=>assertAssetAction({registry,sourceValid:true,family:{family:'catalog',maxVersions:2147483647}},command,actor));
 assert.throws(()=>assertAssetAction({registry,sourceValid:true,family:{family:'business',maxVersions:2147483647}},{...command,expectedRevision:24},actor));
});
test('normal governance and lifecycle contracts retain fixed higher versions without widening legacy calls',()=>{
 const common={version:9,expectedRevision:25,requestKey:'business-fixed-contract',identityRevision:'a'.repeat(64),contentHash:'b'.repeat(64),policyHash:'c'.repeat(64)};
 assert.throws(()=>validateAssetGovernance({...common,action:'submit'},{ids}));
 assert.equal(validateAssetGovernance({...common,action:'submit'},{ids,family:'business'}).version,9);
 assert.throws(()=>validateAssetLifecycle({...common,action:'trash',reason:'合成验证'}));
 assert.equal(validateAssetLifecycle({...common,action:'trash',reason:'合成验证'},{family:'business'}).expectedRevision,25);
});
