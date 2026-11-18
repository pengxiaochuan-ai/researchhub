import test from 'node:test';import assert from 'node:assert/strict';
import {assertRepairDraft,assertRepairEvent,REPAIR_ASSET_ID} from '../server/research-assets/business-local-repair.mjs';
import {assetDigest} from '../scripts/research-assets-registration-contract.mjs';
const ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},member='rh-c1-asset-member-20261117',p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:member},metadata={title:'C1成员合成资产 1'},value={metadata,contentMd:'unchanged',sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'rights',discoveryRecipients:[member,'o']}},registry={assetId:REPAIR_ASSET_ID,tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:member,kind:'protocol',revision:6,workingVersionNo:2},command={action:'revise',id:REPAIR_ASSET_ID,registry,next:{workingVersionNo:3},value};
const tx={$queryRawUnsafe:async()=>[{metadata,rights_evidence:'rights',source_kind:'author',content_hash:assetDigest('unchanged')}],researchArtifactVersion:{findFirst:async()=>({contentMd:'unchanged'})}};
test('only the approved first asset may add identical v3 with exactly author and owner discovery ceiling',async()=>{
 await assertRepairDraft(tx,p,command,ids);
 for(const bad of [{...command,id:'other'},{...command,registry:{...registry,revision:7}},{...command,value:{...value,contentMd:'changed'}},{...command,value:{...value,policy:{...value.policy,discoveryRecipients:[member,'o','a']}}}])await assert.rejects(assertRepairDraft(tx,p,bad,ids));
});
test('repair uses the exact eight-event sequence and reserves its final withdrawal',()=>{
 for(const [revision,action,actor]of [[7,'submit',member],[8,'review','a'],[9,'release','a'],[10,'request','o'],[11,'decide','a'],[12,'cite','o'],[13,'withdraw','a']]){
  const principal={...p,accountId:actor,isTenantAdmin:actor==='a'},record={family:{family:'business'},registry:{...registry,revision,workingVersionNo:3}};
  const input={version:3,discoveryRecipients:['o'],actions:['cite','read_body'],conclusion:'approved'};assert.doesNotThrow(()=>assertRepairEvent(principal,{record,action,input},ids));
  assert.throws(()=>assertRepairEvent({...principal,accountId:'unexpected'},{record,action,input},ids));
 }
 assert.throws(()=>assertRepairEvent({...p,accountId:'a',isTenantAdmin:true},{record:{family:{family:'business'},registry:{...registry,revision:14,workingVersionNo:3}},action:'release',input:{}},ids));
 assert.throws(()=>assertRepairEvent({...p,accountId:'a',isTenantAdmin:true},{record:{family:{family:'business'},registry:{...registry,revision:8,workingVersionNo:3}},action:'review',input:{version:3,conclusion:'changes_requested'}},ids));
});
