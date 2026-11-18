import test from 'node:test';import assert from 'node:assert/strict';
import {assetUsageRequestAllowed,buildAssetUsageInput,createAssetUsageFlow,assertAssetCollaborations} from '../src/research-assets-usage.js';
const user={tenantId:'t',accountId:'owner',authVersion:1},scope={studyGroupId:'g',researchProjectId:'p'},target={assetId:'asset',version:1,action:'request'};
const options={schemaVersion:'rh-asset-usage.v1',scope:{tenantId:'t',...scope},assetId:'asset',version:1,expectedRevision:4,identityRevision:'a'.repeat(64),contentHash:'b'.repeat(64),policyHash:'c'.repeat(64),title:'合成资产',sourceValid:true,releaseActive:true,canManage:false,canRequest:true,canShare:false,canCite:false,actors:[{accountId:'owner',displayName:'科研人员'},{accountId:'admin',displayName:'管理员'}],recipients:[],requests:[]};
test('a committed but currently restricted citation receipt closes recovery without exposing or replaying citation',async()=>{
 let posted=0,copied=0;const flow=createAssetUsageFlow({user,scope,api:{get:async path=>path.includes('/operations/')?{assetId:'asset',version:1,revision:5,operation:'cited',status:'committed',contentAccess:'restricted'}:{...options,canCite:true},post:async()=>{posted++;throw Error('response lost');}},clipboard:()=>copied++});
 await flow.open({...target,action:'cite'});await flow.save();assert.equal(flow.state().phase,'unknown');await flow.lookup();assert.equal(flow.state().phase,'committed');assert.equal(flow.state().citation,null);assert.match(flow.state().message,/当前无权读取/);await flow.copy();assert.equal(copied,0);assert.equal(posted,1);
});
test('read unavailability preserves usage purpose and prevents a late permission receipt from reviving the dialog',async()=>{
 let finish,commits=0;const f=createAssetUsageFlow({user,scope,api:{get:async()=>options,post:()=>new Promise(r=>{finish=r;})},onCommitted:()=>commits++});await f.open(target);f.change({actions:['cite'],purpose:'保留的用途',ttlDays:1});const pending=f.save();f.pause();finish({assetId:'asset',version:1,revision:5,operation:'requested',status:'committed',requestId:'request-1',requestRevision:1});await pending;assert.equal(commits,0);assert.equal(f.state().phase,'unknown');assert.equal(f.state().draft.purpose,'保留的用途');f.invalidate();assert.equal(f.state().draft,null);
});
test('usage routes admit only fixed scoped usage, collaboration, request/decision/revoke and citation endpoints',()=>{
 for(const [m,p]of [['GET','/research-assets/asset/usage?version=1'],['GET','/research-assets/collaborations?page=1&pageSize=20'],['POST','/research-assets/asset/access-requests'],['POST','/research-assets/asset/access-requests/r1/decisions'],['POST','/research-assets/asset/grants/r1/revocations'],['POST','/research-assets/asset/citations']])assert(assetUsageRequestAllowed(m,p));
 for(const [m,p]of [['POST','/research-assets/asset/ai'],['POST','/research-assets/asset/export'],['GET','/research-assets/asset/usage?version=1&version=2'],['POST','/research-assets/asset/citations?raw=1']])assert.equal(assetUsageRequestAllowed(m,p),false);
});
test('purpose choices start empty and cannot silently grant AI, body or cite together',()=>{
 const draft={actions:[],purpose:'核对',ttlDays:1};assert.throws(()=>buildAssetUsageInput(options,target,draft,'original-key'),e=>e.status===422);
 const input=buildAssetUsageInput(options,target,{...draft,actions:['cite']},'original-key');assert.deepEqual(input.actions,['cite']);assert(!Object.hasOwn(input,'recipientAccountId'));
 assert.throws(()=>buildAssetUsageInput(options,target,{...draft,actions:['ai']},'original-key'),e=>e.status===422);
});
test('unknown result freezes original write; only original receipt lookup allows explicit retry',async()=>{
 const calls=[],api={get:async p=>p.includes('/operations/')?{status:'not_found'}:options,post:async(p,v)=>{calls.push([p,v]);throw Object.assign(new Error('503'),{status:503});}};
 const flow=createAssetUsageFlow({user,scope,api,makeKey:()=> 'original-key'});await flow.open(target);flow.change({actions:['cite'],purpose:'核对',ttlDays:1});await flow.save();assert.equal(flow.state().phase,'unknown');await flow.save();assert.equal(calls.length,1);assert.throws(()=>flow.change({purpose:'different'}));await flow.lookup();await flow.save();assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
});
test('failed clipboard does not claim copied; revoked citation cannot be copied from an old receipt',async()=>{
 let allowed=true,copied=0;const citeOptions={...options,canCite:true},receipt={assetId:'asset',version:1,revision:5,operation:'cited',status:'committed',citation:{text:'书目',url:'/pages/a02/?assetCatalog=1&researchAssetId=asset&assetVersion=1&studyGroupId=g&researchProjectId=p',excerptIncluded:false}};
 const flow=createAssetUsageFlow({user,scope,api:{get:async()=>({...citeOptions,canCite:allowed}),post:async()=>receipt},clipboard:async()=>{copied++;throw Error('denied');},makeKey:()=> 'original-key'});
 await flow.open({...target,action:'cite'});await flow.save();await flow.copy();assert.equal(copied,1);assert.match(flow.state().message,/复制失败/);allowed=false;await flow.copy();assert.equal(copied,1);assert.equal(flow.state().citation,null);
});
test('cancel and reopen preserve inputs; identity invalidation clears them and ignores a late response',async()=>{
 let resolve;const flow=createAssetUsageFlow({user,scope,api:{get:async()=>options,post:()=>new Promise(r=>{resolve=r;})},makeKey:()=> 'original-key'});
 await flow.open(target);flow.change({actions:['cite'],purpose:'保留的用途',ttlDays:1});flow.close();await flow.open(target);assert.equal(flow.state().draft.purpose,'保留的用途');
 const saving=flow.save();flow.invalidate();resolve({assetId:'asset',version:1,revision:5,operation:'requested',status:'committed',requestId:'request-1',requestRevision:1});await saving;
 assert.equal(flow.state().phase,'invalid');assert.equal(flow.state().draft,null);assert.equal(flow.state().options,null);
});
test('malformed grant receipt stays unknown and cannot be mistaken for a saved permission',async()=>{
 const flow=createAssetUsageFlow({user,scope,api:{get:async()=>options,post:async()=>({assetId:'asset',version:1,revision:5,operation:'requested',status:'committed'})},makeKey:()=> 'original-key'});
 await flow.open(target);flow.change({actions:['read_body'],purpose:'核对',ttlDays:1});await flow.save();assert.equal(flow.state().phase,'unknown');assert(!flow.state().receipt);
});
test('collaboration management has a separate explicit processing gate for unavailable sources',()=>{
 const row={assetId:'asset',requestId:'req',version:1,requestRevision:1,title:'资产',recipientName:'科研人员',purpose:'核对',actions:['cite'],state:'pending',expiresAt:'2026-11-20T00:00:00Z',canManage:true,canProcess:false,views:['all','pending']},value={schemaVersion:'rh-asset-collaborations.v1',scope,identityRevision:options.identityRevision,collaborationView:'all',counts:{all:1,sent:0,received:0,requested:0,pending:1},page:1,pageSize:20,total:1,items:[row]},context={scope,identityRevision:options.identityRevision,query:{page:1,pageSize:20}};
 assert.equal(assertAssetCollaborations(value,context).items[0].canProcess,false);assert.throws(()=>assertAssetCollaborations({...value,items:[{...row,canProcess:undefined}]},context));
 assert.throws(()=>assertAssetCollaborations({...value,counts:{...value.counts,all:2}},context));
});
