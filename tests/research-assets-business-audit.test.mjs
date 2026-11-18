import test from 'node:test';import assert from 'node:assert/strict';
import {appendCatalogEvent} from '../scripts/local-research-assets-registration.mjs';
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'owner'};
test('normal business facts are not silently recorded as fixtures; local execution declares its synthetic flag',async()=>{
 const captured=[],tx={$executeRawUnsafe:async()=>1,auditLog:{create:async({data})=>captured.push(data)}};
 const command={registry:{assetId:'rhab-11111111-1111-4111-8111-111111111111',revision:1},version:1,type:'created',requestKey:'business-audit-test',requestHash:'a'.repeat(64),receipt:{status:'committed'}};
 await appendCatalogEvent(tx,p,command);assert.equal(captured.at(-1).meta.syntheticOnly,false);
 await appendCatalogEvent(tx,p,command,{syntheticOnly:true});assert.equal(captured.at(-1).meta.syntheticOnly,true);
 await appendCatalogEvent(tx,p,{...command,registry:{...command.registry,assetId:'old-fixture'},payload:{syntheticOnly:false}});assert.equal(captured.at(-1).meta.syntheticOnly,true);
});
