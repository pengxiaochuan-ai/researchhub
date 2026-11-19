import test from 'node:test';
import assert from 'node:assert/strict';
import {readAssetOverviewScopes} from './overview-scopes.mjs';

test('registered assets without a Study binding participate in reading without expanding creation',async()=>{
 const calls=[];const tx={$queryRawUnsafe:async(...args)=>{calls.push(args);return[{studyGroupId:'group',researchProjectId:'native-study',bound:true},{studyGroupId:'group',researchProjectId:'original-project',bound:false}];}};
 assert.deepEqual(await readAssetOverviewScopes(tx,'current-tenant'),[{scope:{studyGroupId:'group',researchProjectId:'native-study'},canCreate:true},{scope:{studyGroupId:'group',researchProjectId:'original-project'},canCreate:false}]);
 assert.equal(calls.length,1);assert.equal(calls[0][1],'current-tenant');
});
test('no bindings and no registered assets remain an honest empty scope list',async()=>{
 assert.deepEqual(await readAssetOverviewScopes({$queryRawUnsafe:async()=>[]},'empty-tenant'),[]);
});
