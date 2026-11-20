import test from'node:test';import assert from'node:assert/strict';import{createRuntimeChatStatus}from'./chat-status.mjs';
test('article admission can verify status inside its already authorized transaction without nesting reads',async()=>{let checks=0;const tx={account:{findFirst:async()=>{checks++;return null}}},status=createRuntimeChatStatus({read:()=>{throw Error('nested read forbidden')},invalid:()=>{throw Error('current account rejected')},tenantId:'tenant',agentId:'agent'});await assert.rejects(()=>status({accountId:'actor'},{tx}),/current account rejected/);assert.equal(checks,1);});

import{materialUploadCapability}from'./chat-status.mjs';
const capability=(overrides={})=>materialUploadCapability({assembled:true,account:{role:'researcher'},roles:[{menuPermissions:['knowledge','workbench'],buttonPermissions:['knowledge.edit','chat.use']}],tools:['knowledge.search','file.read'],effective:(_kind,tools)=>tools,permissions:(actual,required)=>required.every(k=>actual.includes(k)),...overrides});
test('upload availability follows the assembled service and existing role and file tool, without claiming private AI execution',()=>{
 assert.equal(capability().enabled,true);assert.equal(capability().analysisReady,false);assert.deepEqual(capability().extensions,['pdf','docx','txt','md']);
 for(const change of[{assembled:false},{roles:[]},{tools:['knowledge.search']},{roles:[{menuPermissions:['workbench'],buttonPermissions:['chat.use']}]}])assert.equal(capability(change).enabled,false);
});
test('current tenant administrator uses its existing product grant and still needs configured file.read',()=>{
 const account={role:'tenant_admin',isTenantAdmin:true};assert.equal(capability({account,roles:[]}).enabled,true);assert.equal(capability({account,roles:[],tools:['knowledge.search']}).enabled,false);assert.equal(capability({account:{...account,isTenantAdmin:false},roles:[]}).enabled,false);
});
