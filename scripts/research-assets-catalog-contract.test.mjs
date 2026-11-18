import test from 'node:test';
import assert from 'node:assert/strict';
import {assertAssetCatalogInput,assertAssetAction,catalogVisibleVersion,effectiveAssetRelease,assertCatalogFixtureInventory} from './research-assets-catalog-contract.mjs';

const now=Date.parse('2026-11-12T00:00:00Z');
const owner={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'owner',isTenantAdmin:false,permissions:['artifact.read','artifact.create','artifact.edit']};
const admin={...owner,accountId:'admin',isTenantAdmin:true};
const recipient={...owner,accountId:'reader'};
const registry={assetId:'a',tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'owner',kind:'protocol',revision:1,workingVersionNo:1,workingState:'draft',submittedVersionNo:null,approvedVersionNo:null,releasedVersionNo:null,releaseState:'unreleased',deletedAt:null};
const policy={version:1,rightsEvidence:'本轮原创合成材料及明确用途声明',discoveryRecipientCeiling:['owner','reader']};
const context=(r=registry)=>({registry:r,policy,sourceValid:true,everSubmitted:false,hasReferences:false});
const input=(action,extra={})=>({action,version:1,expectedRevision:1,requestKey:'request-key-01',reason:'具名人工核对',...extra});
const release=(version=1,revision=1)=>({type:'released',version,revision,discoveryRecipients:['owner','reader'],expiresAt:'2026-11-19T00:00:00Z'});

test('catalog validates duplicates, unknown keys and noncanonical paging before a query',()=>{
 assert.deepEqual(assertAssetCatalogInput(new URLSearchParams('q=%20针灸%20&kind=protocol&pageSize=5')), {q:'针灸',kind:'protocol',domain:'all',status:'all',scope:'all',source:'all',page:1,pageSize:5,sort:'updatedAt',direction:'desc'});
 for(const q of ['page=01','page=0','pageSize=100','kind=all&kind=protocol','ownerAccountId=other','direction=asc;drop','q='+ '字'.repeat(121)])assert.throws(()=>assertAssetCatalogInput(new URLSearchParams(q)),e=>e.status===400);
});

test('revising a released asset starts a separate working version and leaves release v1 intact',()=>{
 const r={...registry,revision:4,workingState:'approved',approvedVersionNo:1,releasedVersionNo:1,releaseState:'released'};
 const next=assertAssetAction(context(r),input('revise',{expectedRevision:4,baseVersion:1}),owner);
 assert.equal(next.workingVersionNo,2);assert.equal(next.workingState,'draft');assert.equal(next.releasedVersionNo,1);assert.equal(next.revision,5);assert.equal(r.workingVersionNo,1);
 assert.throws(()=>assertAssetAction(context(r),input('revise',{expectedRevision:3,baseVersion:1}),owner),e=>e.status===409);
});

test('pending review may not approve a new version or grant researcher review authority',()=>{
 const c=context({...registry,workingState:'in_review',submittedVersionNo:1});
 assert.throws(()=>assertAssetAction(c,input('review',{conclusion:'approved'}),owner),e=>e.status===403);
 assert.throws(()=>assertAssetAction(c,input('review',{version:2,conclusion:'approved'}),admin),e=>e.status===409);
 const next=assertAssetAction(c,input('review',{conclusion:'approved'}),admin);assert.equal(next.approvedVersionNo,1);assert.equal(next.workingState,'approved');
 assert.throws(()=>assertAssetAction(c,input('review',{conclusion:'approved',reason:''}),admin),e=>e.status===400);
});

test('unknown upstream rights or invalid sources stop submission and release without inventing approval',()=>{
 assert.throws(()=>assertAssetAction({...context(),policy:{...policy,rightsEvidence:''}},input('submit'),owner),e=>e.status===422);
 assert.throws(()=>assertAssetAction({...context(),sourceValid:false},input('submit'),owner),e=>e.status===409);
 const c=context({...registry,workingState:'approved',approvedVersionNo:1});
 assert.throws(()=>assertAssetAction(c,input('release',{discoveryRecipients:['public']}),admin),e=>e.status===422);
 assert.throws(()=>assertAssetAction(c,input('release',{discoveryRecipients:['reader']}),owner),e=>e.status===403);
});

test('tenant admin authority remains tenant and true-parent bound',()=>{
 for(const bad of [{tenantId:'foreign'},{studyGroupId:'foreign'},{researchProjectId:'foreign'}])assert.throws(()=>assertAssetAction(context(),input('revise',{baseVersion:1}),{...admin,...bad}),e=>e.status===404);
});

test('trash never permits previously submitted or referenced objects and restore does not recreate grants',()=>{
 for(const extra of [{everSubmitted:true},{hasReferences:true}])assert.throws(()=>assertAssetAction({...context(),...extra},input('trash'),owner),e=>e.status===409);
 const deleted=assertAssetAction(context(),input('trash'),owner,now);assert.equal(deleted.deletedAt,'2026-11-12T00:00:00.000Z');
 const restored=assertAssetAction(context(deleted),input('restore',{expectedRevision:2}),owner,now);assert.equal(restored.deletedAt,null);assert.equal(Object.hasOwn(restored,'grants'),false);
});

test('release v2 changes default preference but does not withdraw still licensed v1',()=>{
 const events=[release(),release(2,2)];assert.equal(effectiveAssetRelease(events,1,now).active,true);
 assert.equal(effectiveAssetRelease([...events,{type:'withdrawn',version:2,revision:3}],1,now).active,true);
 assert.equal(effectiveAssetRelease([...events,{type:'withdrawn',version:1,revision:3}],1,now).active,false);
 assert.equal(effectiveAssetRelease(events,1,Date.parse('2026-11-19T00:00:00Z')).active,false);
});

test('metadata scope narrowing cannot add recipients or silently revive removed grants',()=>{
 const events=[release(),{type:'scope_narrowed',version:1,revision:2,discoveryRecipients:['owner']}];
 assert.deepEqual(effectiveAssetRelease(events,1,now).recipients,['owner']);
 assert.throws(()=>effectiveAssetRelease([...events,{type:'scope_narrowed',version:1,revision:3,discoveryRecipients:['owner','reader']}],1,now),e=>e.status===409);
 const r={...registry,revision:2,releasedVersionNo:1,releaseState:'released'};
 assert.equal(catalogVisibleVersion({registry:r,events,policies:[policy],grants:[{recipientAccountId:'reader',version:1,actions:['read_body','cite'],state:'approved',expiresAt:'2026-11-19T00:00:00Z'}],principal:recipient,now}),null);
});

test('owner sees working head, recipient sees only a discoverable published version, not a secret draft',()=>{
 const r={...registry,workingVersionNo:2,revision:3,releasedVersionNo:1,releaseState:'released'};
 const params={registry:r,events:[release()],policies:[policy,{...policy,version:2,title:'secret draft'}],grants:[],now};
 assert.equal(catalogVisibleVersion({...params,principal:owner}).version,2);
 const read=catalogVisibleVersion({...params,principal:recipient});assert.equal(read.version,1);assert.equal(read.bodyAllowed,false);assert.equal(read.citeAllowed,false);
 assert.equal(catalogVisibleVersion({...params,principal:{...recipient,tenantId:'foreign'}}),null);
});

test('grants are fixed-version and action scoped, not AI or a licence for a later release',()=>{
 const r={...registry,workingVersionNo:2,revision:3,releasedVersionNo:2,releaseState:'released'};
 const params={registry:r,events:[release(),release(2,2)],policies:[policy,{...policy,version:2}],grants:[{recipientAccountId:'reader',version:1,actions:['read_body'],state:'approved',expiresAt:'2026-11-19T00:00:00Z'}],principal:recipient,now};
 const selected=catalogVisibleVersion(params);assert.equal(selected.version,2);assert.equal(selected.bodyAllowed,false);assert.equal(selected.citeAllowed,false);assert.equal(selected.aiAllowed,false);
 const old=catalogVisibleVersion({...params,version:1});assert.equal(old.bodyAllowed,true);assert.equal(old.citeAllowed,false);
});

test('a discovery-only newest version does not hide an explicitly selected licensed older one',()=>{
 const r={...registry,workingVersionNo:2,revision:3,releasedVersionNo:2,releaseState:'released'};
 const events=[release(),{...release(2,2),discoveryRecipients:['owner']}];
 const v=catalogVisibleVersion({registry:r,events,policies:[policy,{...policy,version:2}],grants:[],principal:recipient,now});assert.equal(v.version,1);
});

test('named fixture inventory refuses unknown keys, foreign parents, extra versions and reused IDs',()=>{
 const ids={tenant:'t',group:'g',project:'p',owner:'owner',admin:'admin'};
 const row={id:'a',tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'owner',createdBy:'owner',status:'draft',deletedAt:null,currentVersionNo:1,idempotencyKey:'rh-research-asset:catalog-20261112:owner:protocol',eventCount:1};
 assert.equal(assertCatalogFixtureInventory([row],ids),1);
 for(const bad of [{idempotencyKey:row.idempotencyKey+'-other'},{researchProjectId:'other'},{currentVersionNo:9},{eventCount:25},{ownerAccountId:'other'}])assert.throws(()=>assertCatalogFixtureInventory([{...row,...bad}],ids));
 assert.throws(()=>assertCatalogFixtureInventory([row,row],ids));
});
