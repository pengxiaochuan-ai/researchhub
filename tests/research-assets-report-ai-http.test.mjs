import test from 'node:test';import assert from 'node:assert/strict';
import {createAssetCatalogController} from '../scripts/local-research-assets-catalog-controller.mjs';
import {assetHttpScopedUser} from '../server/research-assets/business-http-context.mjs';
test('report-only endpoints demand current identity, explicit scope, same-origin POST and no query extras',async()=>{
 const calls=[],routes=[],metadata=[],no=()=>()=>{};class HttpException extends Error{constructor(b,s){super(b.message);this.status=s;}}
 const common={Controller:no,Get:path=>(_p,m)=>routes.push([m,path]),Post:path=>(_p,m)=>routes.push([m,path]),Head:no,Body:no,Req:no,Param:no,StreamableFile:class{},HttpException,SetMetadata:(k,v)=>(_p,m)=>metadata.push([m,k,v])};
 const reportQa=Object.fromEntries(['status','consent','search'].map(n=>[n,(...args)=>{calls.push([n,...args]);return{ok:true};}]));
 const C=createAssetCatalogController({root:'/app/',require:n=>n==='@nestjs/common'?common:{RequireStudyGroup:no,RequireResearchProject:no,RequireStudyGroupMenu:no,RequireStudyGroupPermission:no},reportQa,scopedUser:assetHttpScopedUser});
 const c=new C(),user={tenantId:'t',accountId:'a',authVersion:2},headers={'x-study-group-id':'g','x-research-project-id':'p','x-researchhub-actor':'a','x-researchhub-auth-version':'2',origin:'http://127.0.0.1:19501','x-researchhub-request':'asset-catalog-v1'},req=()=>({user:{...user},headers:{...headers},query:{}});
 await c.reportQaStatus(req(),'asset','2');await c.reportQaSearch(req(),'asset','2',{question:'限制'});await c.reportQaConsent(req(),'asset','2',{action:'grant'});assert.equal(calls.length,3);assert.equal(calls[0][1].researchProjectId,'p');
 for(const r of [{...req(),query:{extra:'1'}},{...req(),headers:{...headers,origin:'https://other.test'}},{...req(),headers:{...headers,'x-researchhub-actor':'other'}},{...req(),headers:{...headers,'x-research-project-id':undefined}}])await assert.rejects(c.reportQaSearch(r,'asset','2',{}));
 assert.equal(calls.length,3);assert(routes.some(([m,p])=>m==='reportQaConsent'&&p.endsWith('/ai-consents')));assert(metadata.some(([m,k,v])=>m==='reportQaSearch'&&k==='requireStudyGroup'&&v===false));
});
