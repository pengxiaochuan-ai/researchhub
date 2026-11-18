import test from 'node:test';import assert from 'node:assert/strict';
import {assertBusinessLocalScope,createBusinessLocalBudget,createBusinessLocalEventBudget,projectBusinessLocalActions} from '../server/research-assets/business-local.mjs';
const ids={tenant:'t',group:'g',project:'a',owner:'owner',admin:'admin'},p={tenantId:'t',studyGroupId:'g',researchProjectId:'a',accountId:'owner'};
const command={action:'create',value:{kind:'protocol',sourceKind:'author',metadata:{title:'C1合成方案 owner A 1',limitations:'仅合成数据'}}};
test('local activation keeps the approved two identities and original A/B Studies',()=>{
 assertBusinessLocalScope(ids,p);
 assertBusinessLocalScope(ids,{...p,accountId:ids.admin,researchProjectId:'rh-asset-detail-20261113-study-b'});
 for(const change of[{tenantId:'other'},{studyGroupId:'other'},{researchProjectId:'c'},{accountId:'third'}])assert.throws(()=>assertBusinessLocalScope(ids,{...p,...change}),e=>e.status===403);
});
test('local admission preserves two slots per actor per Study and does not reset recycled rows',async()=>{
 const budget=createBusinessLocalBudget(ids);
 await budget({$queryRawUnsafe:async()=>[]},p,command);
 await assert.rejects(budget({$queryRawUnsafe:async()=>[{owner_account_id:'owner'},{owner_account_id:'owner',deleted_at:'recycled'}]},p,command),e=>e.code==='ASSET_CATALOG_FIXTURE_CAPACITY');
 await assert.rejects(budget({$queryRawUnsafe:async()=>[]},p,{...command,value:{...command.value,kind:'dataset'}}),e=>e.status===403);
});
test('local revisions remain own new assets, no more than two versions or six events each',async()=>{
 const budget=createBusinessLocalBudget(ids),id='rhab-11111111-1111-4111-8111-111111111111';
 const revise={...command,action:'revise',id,registry:{ownerAccountId:'owner',revision:1},next:{workingVersionNo:2}};
 await budget({$queryRawUnsafe:async()=>[]},p,revise);
 for(const change of[{id:'old-asset'},{registry:{ownerAccountId:'admin',revision:1}},{next:{workingVersionNo:3}},{registry:{ownerAccountId:'owner',revision:6}}])await assert.rejects(budget({$queryRawUnsafe:async()=>[]},p,{...revise,...change}));
});
test('the 48-event budget admits draft lifecycle and current-admin review, never release or another person editing',async()=>{
 const budget=createBusinessLocalEventBudget(ids),record={registry:{assetId:'rhab-11111111-1111-4111-8111-111111111111',ownerAccountId:'owner',kind:'protocol',revision:4,workingVersionNo:2},family:{family:'business'}};
 await budget({},p,{record,action:'submit'});
 await budget({},{...p,accountId:'admin',isTenantAdmin:true},{record,action:'review'});
 await assert.rejects(budget({},p,{record,action:'release'}));
 await assert.rejects(budget({},{...p,accountId:'admin',isTenantAdmin:true},{record,action:'release'}));
 await assert.rejects(budget({},{...p,accountId:'admin',isTenantAdmin:true},{record:{...record,registry:{...record.registry,revision:6}},action:'review'}));
 await assert.rejects(budget({},{...p,accountId:'admin',isTenantAdmin:true},{record,action:'trash'}));
 await assert.rejects(budget({},p,{record:{...record,registry:{...record.registry,revision:6}},action:'submit'}));
 const rows=projectBusinessLocalActions([record],p);assert(rows[0].availableActions.includes('submit'));assert(!rows[0].availableActions.includes('release'));
});
