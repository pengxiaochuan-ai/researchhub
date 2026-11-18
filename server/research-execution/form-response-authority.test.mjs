import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {authorizeFormalResponse}=require('./src/study-operations/formal-response-authority.ts');
function tx(buttons,menus=['workbench']){return {account:{findFirst:async()=>({role:'researcher',isTenantAdmin:false,status:'active',authVersion:2,tenant:{status:'active'}})},tenantFeatureEntitlement:{findFirst:async()=>({enabled:true})},studyGroup:{findFirst:async()=>({id:'g'})},researchProject:{findFirst:async()=>({id:'p'})},researchProjectMembership:{findFirst:async()=>({id:'m'})},studyGroupMembership:{findFirst:async()=>({role:{tenantId:'t',status:'active',menuPermissions:menus,buttonPermissions:buttons}})}};}
const user={tenantId:'t',accountId:'a',authVersion:2};
test('current form.fill, workbench and current auth version are checked',async()=>{
 await assert.doesNotReject(authorizeFormalResponse(tx(['form.fill']),user,'g','p'));
 await assert.rejects(authorizeFormalResponse(tx(['study.execute']),user,'g','p'));
 await assert.rejects(authorizeFormalResponse(tx(['form.fill'],[]),user,'g','p'));
 await assert.rejects(authorizeFormalResponse(tx(['form.fill']),{...user,authVersion:1},'g','p'));
});
