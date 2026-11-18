import test from 'node:test';import assert from 'node:assert/strict';
import {createAssetDetailReader} from '../scripts/research-assets-detail-read.mjs';
const id='rhab-11111111-1111-4111-8111-111111111111',p={tenantId:'t',studyGroupId:'g',researchProjectId:'b',identityRevision:'current'};
const row={asset_revision:6,event_type:'reviewed',version_no:2,created_at:new Date(),actor_name:'合成管理员',reason:'核对原创合成材料与私有用途',conclusion:'approved'};
function reader(family='business',event=row){return createAssetDetailReader({withAccess:async(_user,_permission,run)=>run({$queryRawUnsafe:async()=>[event]},p),readFixed:async()=>({family,bodyAccess:'allowed',bodyExpiresAt:null})});}
test('business audit delivers the stored review conclusion and reason for the exact fixed version',async()=>{
 const value=await reader().activity({},id,2);assert.equal(value.items[0].reason,row.reason);assert.equal(value.items[0].conclusion,'approved');assert.equal(value.items[0].revision,6);
});
test('business review without a complete stored conclusion fails closed; old detail shape stays unchanged',async()=>{
 for(const change of[{reason:null},{conclusion:null},{conclusion:'unknown'}])await assert.rejects(reader('business',{...row,...change}).activity({},id,2),e=>e.status===409);
 const old=await reader('detail').activity({},'legacy-id',2);assert.equal(Object.hasOwn(old.items[0],'reason'),false);
});
