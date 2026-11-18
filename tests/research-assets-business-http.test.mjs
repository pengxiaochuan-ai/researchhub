import test from 'node:test';import assert from 'node:assert/strict';
import {assetHttpScopedUser} from '../server/research-assets/business-http-context.mjs';
import {createAssetRegistrationController} from '../scripts/local-research-assets-registration-controller.mjs';
test('HTTP scope takes only explicit Study headers and preserves authenticated identity claims',()=>{
 const user={tenantId:'t',accountId:'admin',role:'tenant_admin',authVersion:4},headers={'x-study-group-id':'g','x-research-project-id':'b','x-role':'tenant_admin'};
 assert.deepEqual(assetHttpScopedUser({user,headers}),{...user,studyGroupId:'g',researchProjectId:'b'});assert.deepEqual(user,{tenantId:'t',accountId:'admin',role:'tenant_admin',authVersion:4});
 for(const patch of[{}, {'x-study-group-id':'g'},{...headers,'x-research-project-id':['a','b']},{...headers,'x-study-group-id':'../../other'}])assert.throws(()=>assetHttpScopedUser({user,headers:patch}),e=>e.status===400);
 assert.throws(()=>assetHttpScopedUser({headers}),e=>e.status===401);
 const researcher=assetHttpScopedUser({user:{...user,role:'researcher'},headers});assert.equal(researcher.role,'researcher');assert.equal(researcher.isTenantAdmin,undefined);
});
test('only current-authorized draft routes replace the legacy membership guard; missing scope fails before service',async()=>{
 const metadata=[],calls=[],no=()=>()=>{};class HttpException extends Error{constructor(body,status){super(body.message);this.status=status;}}
 const common={Controller:no,Get:no,Post:no,Req:no,Param:no,Body:no,UploadedFile:no,UseInterceptors:no,HttpException,SetMetadata:(key,value)=>(_p,method)=>metadata.push({key,value,method})};
 const C=createAssetRegistrationController({root:'/test/',require:name=>name==='@nestjs/common'?common:name==='@nestjs/platform-express'?{FileInterceptor:()=>()=>{}}:{RequireStudyGroup:no,RequireResearchProject:no,RequireStudyGroupMenu:no,RequireStudyGroupPermission:no},scopedUser:assetHttpScopedUser,registration:{options:async user=>{calls.push(user);return{};},register:()=>assert.fail('invalid scope reached mutation')}});
 const controller=new C(),user={tenantId:'t',accountId:'admin',role:'tenant_admin',authVersion:4};
 await controller.options({user,headers:{'x-study-group-id':'g','x-research-project-id':'b'},query:{}});
 assert.equal(calls[0].researchProjectId,'b');assert.equal(calls[0].role,'tenant_admin');assert.equal(calls[0].researchProjectRoleKey,undefined);
 await assert.rejects(controller.options({user,headers:{},query:{}}),e=>e.status===400);assert.equal(calls.length,1);
 assert(metadata.some(m=>m.method==='review'&&m.value===false));assert(!metadata.some(m=>['release','upload','reportRegister'].includes(m.method)));
});
