import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssetRegistrationController,assertAssetHttpContext} from './local-research-assets-registration-controller.mjs';
const origin='http://127.0.0.1:19501',user={accountId:'o',authVersion:2};
const headers={origin,'x-researchhub-request':'asset-catalog-v1','x-researchhub-actor':'o','x-researchhub-auth-version':'2'};
test('local registration is assembled before static catalog and legacy readers with its bounded strict parser',()=>{
 const code=readFileSync(new URL('./local-knowledge.mjs',import.meta.url),'utf8'),controllers=code.slice(code.indexOf('Module({controllers:'));
 assert(controllers.indexOf('ai.AssetRegistrationController')>=0);assert(controllers.indexOf('ai.AssetRegistrationController')<controllers.indexOf('ai.AssetCatalogController'));assert(code.includes('parseAssetJson(bytes)'));assert(code.includes("app.use('/api/research-assets',express.json({limit:512*1024"));
});
test('write intent binds the expected account/version without changing cookie authorization',()=>{
 assert.equal(assertAssetHttpContext({headers,user},{origin,mutation:true}),true);
 for(const bad of [{...headers,origin:'https://elsewhere.example'},{...headers,'x-researchhub-request':undefined},{...headers,'x-researchhub-actor':'another'},{...headers,'x-researchhub-auth-version':'1'},{...headers,'x-researchhub-auth-version':'02'}])assert.throws(()=>assertAssetHttpContext({headers:bad,user},{origin,mutation:true}),e=>[400,403,409].includes(e.status));
 assert.equal(assertAssetHttpContext({headers:{},user},{origin}),true);
 assert.throws(()=>assertAssetHttpContext({headers:{'x-researchhub-actor':'o'},user},{origin}),e=>e.status===400);
});
test('asset controller exposes scoped draft/file and approved governance routes, never export',async()=>{
 const routes=[],calls=[];class HttpException extends Error{constructor(body,status){super(body.message);this.status=status;}}
 const no=()=>()=>{},common={Controller:no,Req:no,Param:no,Body:no,UploadedFile:no,UseInterceptors:no,Get:path=>(_p,m)=>routes.push(['GET',path,m]),Post:path=>(_p,m)=>routes.push(['POST',path,m]),HttpException};
 const registration=Object.fromEntries(['options','edit','register','revise','operation'].map(name=>[name,async(...args)=>{calls.push([name,...args]);return{ok:true};}]));
 const governance={options:async(...args)=>{calls.push(['governance',...args]);return{};},execute:async(...args)=>{calls.push(['governance-execute',...args]);return{};}};
 const C=createAssetRegistrationController({root:'/test/',require:name=>name==='@nestjs/common'?common:name==='@nestjs/platform-express'?{FileInterceptor:()=>()=>{}}:{RequireStudyGroup:no,RequireResearchProject:no,RequireStudyGroupMenu:no,RequireStudyGroupPermission:no},registration,governance,uploads:{stage:async(...args)=>{calls.push(['upload',...args]);return{status:'pending'};}},origin});
 const controller=new C(),req={headers,user,query:{},res:{setHeader:(k,v)=>{assert.equal(k,'Cache-Control');assert.equal(v,'no-store');}}};
 assert.deepEqual(routes.filter(([_m,p])=>![':id/lifecycle',':id/trash',':id/restores'].includes(p)).map(([m,p])=>[m,p]),[['GET','report-context-source'],['POST','report-context-registrations'],['POST','report-context-revisions'],['GET','report-sources/:id'],['POST','report-sources/:id/registrations'],['POST','report-sources/:id/revisions'],['GET','registrable-sources'],['GET','operations/:key'],['GET',':id/registration'],['GET',':id/governance'],['POST',':id/submissions'],['POST',':id/reviews'],['POST',':id/releases'],['POST',':id/withdrawals'],['GET',':id/usage'],['GET','collaborations'],['POST',':id/access-requests'],['POST',':id/access-requests/:requestId/decisions'],['POST',':id/grants/:requestId/revocations'],['POST',':id/citations'],['POST',''],['POST',':id/versions'],['POST','uploads']]);
 assert.deepEqual(routes.filter(([_m,p])=>[':id/lifecycle',':id/trash',':id/restores'].includes(p)).map(([m,p])=>[m,p]),[['GET',':id/lifecycle'],['POST',':id/trash'],['POST',':id/restores']]);
 await controller.register(req,{kind:'protocol'});assert.deepEqual(calls.at(-1),['register',user,{kind:'protocol'}]);
 await assert.rejects(controller.register({...req,headers:{}},{}),e=>e.status===403);
 await assert.rejects(controller.edit({...req,query:{version:['1','2']}},'asset'),e=>e.status===400);
 await controller.edit({...req,query:{version:'2'}},'asset');assert.deepEqual(calls.at(-1),['edit',user,'asset','2']);
 await assert.rejects(controller.upload(req,{requestKey:'upload-key',unexpected:'x'},{}),e=>e.status===400);
 assert.equal((await controller.upload(req,{requestKey:'upload-key'},{})).status,'pending');
 await controller.governance({...req,query:{version:'2'}},'asset');assert.deepEqual(calls.at(-1),['governance',user,'asset','2']);
 await assert.rejects(controller.governance({...req,query:{version:['1','2']}},'asset'),e=>e.status===400);
 await assert.rejects(controller.review(req,'asset',{action:'release'}),e=>e.status===400);
 await controller.review(req,'asset',{action:'review'});assert.deepEqual(calls.at(-1),['governance-execute',user,'asset',{action:'review'}]);
});
test('usage routes bind the path, action, request identity and origin before calling current authorization',async()=>{
 const calls=[],no=()=>()=>{},common=new Proxy({HttpException:class extends Error{constructor(v,s){super(v.message);this.status=s;}}},{get:(t,k)=>t[k]??no});
 const usage={options:async(...a)=>{calls.push(['options',...a]);return{};},collaborations:async(...a)=>{calls.push(['collaborations',...a]);return{};},execute:async(...a)=>{calls.push(['execute',...a]);return{};}};
 const C=createAssetRegistrationController({root:'/test/',require:name=>name==='@nestjs/common'?common:name==='@nestjs/platform-express'?{FileInterceptor:no}:new Proxy({},{get:()=>no}),usage,origin}),c=new C(),req={headers,user,query:{}};
 await c.usage({...req,query:{version:'1'}},'asset');assert.deepEqual(calls.at(-1),['options',user,'asset','1']);
 for(const query of [{},{version:'9'},{version:['1','2']},{version:'1',extra:'x'}])await assert.rejects(c.usage({...req,query},'asset'),e=>e.status===400);
 await c.collaborations(req);assert.deepEqual(calls.at(-1),['collaborations',user,{}]);
 for(const [method,args] of [['requestAccess',['asset',{action:'cite'}]],['decideAccess',['asset','req-a',{action:'decide',requestId:'req-b'}]],['revokeAccess',['asset','req-a',{action:'decide',requestId:'req-a'}]],['cite',['asset',{action:'share'}]]])await assert.rejects(c[method](req,...args),e=>e.status===400);
 await assert.rejects(c.cite({...req,headers:{}},'asset',{action:'cite'}),e=>e.status===403);
 await assert.rejects(c.cite({...req,query:{unexpected:'x'}},'asset',{action:'cite'}),e=>e.status===400);
 await c.decideAccess(req,'asset','req-a',{action:'decide',requestId:'req-a'});assert.deepEqual(calls.at(-1),['execute',user,'asset',{action:'decide',requestId:'req-a'}]);
 await c.revokeAccess(req,'asset','req-a',{action:'revoke',requestId:'req-a'});assert.deepEqual(calls.at(-1),['execute',user,'asset',{action:'revoke',requestId:'req-a'}]);
 await c.requestAccess(req,'asset',{action:'share'});await c.cite(req,'asset',{action:'cite'});assert.deepEqual(calls.at(-1),['execute',user,'asset',{action:'cite'}]);
});
test('a local after-commit response failure cannot undo a stored result or silently turn it into frontend success',async()=>{
 const no=()=>()=>{},common=new Proxy({HttpException:class extends Error{constructor(v,s){super(v.message);this.status=s;}}},{get:(t,k)=>t[k]??no});let saved=0,probed=0;
 const C=createAssetRegistrationController({root:'/test/',require:name=>name==='@nestjs/common'?common:name==='@nestjs/platform-express'?{FileInterceptor:no}:new Proxy({},{get:()=>no}),registration:{register:async()=>{saved++;return{status:'committed',assetId:'asset',version:1,revision:1};}},uploads:{},afterCommit:async()=>{probed++;throw Object.assign(new Error('controlled loss'),{code:'ASSET_CATALOG_RESULT_UNCONFIRMED',status:503});},origin});
 await assert.rejects(new C().register({user,headers,query:{}},{requestKey:'original-key'}),e=>e.status===503);assert.equal(saved,1);assert.equal(probed,1);
});
test('recycle response failure is injected only after the lifecycle service committed',async()=>{
 const no=()=>()=>{},common=new Proxy({HttpException:class extends Error{constructor(v,s){super(v.message);this.status=s;}}},{get:(t,k)=>t[k]??no});let committed=0,probed=0;
 const C=createAssetRegistrationController({root:'/test/',require:name=>name==='@nestjs/common'?common:name==='@nestjs/platform-express'?{FileInterceptor:no}:new Proxy({},{get:()=>no}),lifecycle:{execute:async()=>{committed++;return{status:'committed'};}},afterLifecycleCommit:async()=>{probed++;throw Object.assign(Error('controlled result loss'),{code:'ASSET_CATALOG_RESULT_UNCONFIRMED',status:503});},origin});
 await assert.rejects(new C().trashAsset({user,headers,query:{}},'asset',{action:'trash'}),e=>e.status===503);assert.equal(committed,1);assert.equal(probed,1);
});
