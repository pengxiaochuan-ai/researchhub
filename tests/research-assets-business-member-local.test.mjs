import test from 'node:test';
import assert from 'node:assert/strict';
import {assertBusinessLocalScope,createBusinessLocalBudget,createBusinessLocalEventBudget} from '../server/research-assets/business-local.mjs';
const ids={tenant:'t',group:'g',project:'a',owner:'o',admin:'d'},member='rh-c1-asset-member-20261117',p={tenantId:'t',studyGroupId:'g',researchProjectId:'a',accountId:member},id='rhab-12345678-1234-4123-8123-123456789abc';
test('new local member is limited to approved A without widening old actor scope',()=>{
 assert.doesNotThrow(()=>assertBusinessLocalScope(ids,p));
 for(const bad of [{...p,researchProjectId:'rh-asset-detail-20261113-study-b'},{...p,accountId:'unexpected'},{...p,tenantId:'other'}])assert.throws(()=>assertBusinessLocalScope(ids,bad));
});
test('member admission counts recycled objects and enforces five-kind distribution',async()=>{
 const before=createBusinessLocalBudget(ids),value=kind=>({kind,sourceKind:'author',metadata:{title:'C1成员合成资产 '+kind,limitations:'合成资料'}});
 await before({$queryRawUnsafe:async()=>[]},p,{action:'create',value:value('dataset')});
 const rows=[{asset_id:id,owner_account_id:member,asset_kind:'dataset'}];
 await assert.rejects(before({$queryRawUnsafe:async()=>rows},p,{action:'create',value:value('dataset')}));
 await before({$queryRawUnsafe:async()=>rows},p,{action:'create',value:value('protocol')});
 await assert.rejects(before({$queryRawUnsafe:async()=>[]},p,{action:'create',value:{...value('protocol'),sourceKind:'upload'}}));
});
test('new owner supports five draft kinds while old completed batch stays frozen',async()=>{
 const before=createBusinessLocalEventBudget(ids),record={family:{family:'business'},registry:{assetId:id,researchProjectId:ids.project,ownerAccountId:member,kind:'dataset',workingVersionNo:2,revision:5}};
 await before({}, {...p,accountId:ids.admin,isTenantAdmin:true},{record,action:'review'});
 await assert.rejects(before({},p,{record,action:'release'}));
 await assert.rejects(before({}, {...p,accountId:ids.admin,isTenantAdmin:true},{record:{...record,registry:{...record.registry,ownerAccountId:ids.owner,kind:'protocol',revision:6}},action:'review'}));
});
