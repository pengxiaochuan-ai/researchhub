import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertGovernanceOptions,buildGovernanceInput,createAssetGovernanceFlow,assetGovernanceRequestAllowed} from '../src/research-assets-governance.js';
const user={tenantId:'tenant',accountId:'admin',authVersion:1},scope={studyGroupId:'group',researchProjectId:'project'},target={assetId:'asset',version:2,action:'review'};
const options={schemaVersion:'rh-asset-governance.v1',scope:{tenantId:'tenant',...scope},assetId:'asset',version:2,expectedRevision:3,identityRevision:'a'.repeat(64),contentHash:'b'.repeat(64),policyHash:'c'.repeat(64),title:'合成方案',summary:'固定摘要',rightsEvidence:'原创材料',sourceValid:true,selfReview:true,actions:['review'],recipients:[{accountId:'owner',displayName:'科研人员'}],workingState:'in_review',releaseActive:false};
const draft={conclusion:'approved',reason:'本人已核内容与用途',contentChecked:true,rightsChecked:true,selfReviewAcknowledged:true,discoveryRecipients:['owner'],ttlDays:7};
test('read unavailability preserves governance input but rejects the in-flight completion',async()=>{
 let finish,commits=0;const f=createAssetGovernanceFlow({user,scope,api:{get:async()=>options,post:()=>new Promise(r=>{finish=r;})},onCommitted:()=>commits++});await f.open(target);f.change(draft);const pending=f.save();f.pause();finish({assetId:'asset',version:2,revision:4,operation:'reviewed',status:'committed'});await pending;assert.equal(commits,0);assert.equal(f.state().phase,'unknown');assert.equal(f.state().draft.reason,draft.reason);f.invalidate();assert.equal(f.state().draft,null);
});
test('strict governance routes do not authorize any old lifecycle, wildcard or public endpoint',()=>{
 for(const [method,path] of [['GET','/research-assets/asset/governance?version=2'],['POST','/research-assets/asset/reviews']])assert(assetGovernanceRequestAllowed(method,path));
 for(const [method,path] of [['GET','/research-assets/asset/governance?version=2&raw=1'],['POST','/research-assets/asset/publish'],['POST','/research-assets/asset/review'],['DELETE','/research-assets/asset/reviews'],['POST','/research-assets/asset/releases?public=1']])assert.equal(assetGovernanceRequestAllowed(method,path),false);
});
test('fixed identity and scoped options cannot be replaced by a foreign asset or stale current action',()=>{
 assert.equal(assertGovernanceOptions(options,{user,scope,target}).title,'合成方案');
 for(const extra of [{assetId:'other'},{scope:{...options.scope,tenantId:'other'}},{version:3},{actions:[]},{contentHash:'not-hash'}])assert.throws(()=>assertGovernanceOptions({...options,...extra},{user,scope,target}));
 const input=buildGovernanceInput(options,target,draft,'governance-ui-key');assert.equal(input.selfReviewAcknowledged,true);assert.equal(input.action,'review');assert.equal(input.version,2);
 assert.throws(()=>buildGovernanceInput(options,target,{...draft,rightsChecked:false},'governance-ui-key'),e=>e.status===422);
});
test('unknown result freezes original payload and allows only original receipt then explicit retry',async()=>{
 const calls=[],store=new Map(),api={get:async path=>{calls.push(['GET',path]);return path.includes('/operations/')?{status:'not_found'}:options;},post:async(path,body)=>{calls.push(['POST',path,body]);throw Object.assign(new Error('网络中断'),{status:503});}};
 const flow=createAssetGovernanceFlow({user,scope,api,storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},makeKey:()=> 'governance-ui-key'});
 await flow.open(target);flow.change(draft);await flow.save();assert.equal(flow.state().phase,'unknown');assert.equal(calls.filter(c=>c[0]==='POST').length,1);assert.equal(store.size,1);
 assert.equal(calls.find(c=>c[0]==='POST')[1],'/research-assets/asset/reviews');
 assert.throws(()=>flow.change({reason:'changed'}));await flow.save();assert.equal(calls.filter(c=>c[0]==='POST').length,1);
 assert(![...store.values()][0].includes(draft.reason));await flow.lookup();assert.equal(flow.state().phase,'retryable');await flow.save();assert.equal(calls.filter(c=>c[0]==='POST').length,2);assert.deepEqual(calls.at(-1)[2],calls.find(c=>c[0]==='POST')[2]);
});
test('logout clears private input, late saves cannot render, and minimal marker resumes by receipt only',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};let finish;
 const api={get:async path=>path.includes('/operations/')?{assetId:'asset',version:2,revision:4,operation:'reviewed',status:'committed'}:options,post:()=>new Promise(resolve=>{finish=resolve;})};
 let committed=0;const flow=createAssetGovernanceFlow({user,scope,api,storage,makeKey:()=> 'governance-ui-key',onCommitted:()=>committed++});
 await flow.open(target);flow.change(draft);const pending=flow.save();flow.invalidate();finish({assetId:'asset',version:2,revision:4,operation:'reviewed',status:'committed'});await pending;assert.equal(committed,0);assert.equal(flow.state().options,null);
 const restored=createAssetGovernanceFlow({user,scope,api,storage,onCommitted:()=>committed++});await restored.open();assert.equal(restored.state().phase,'unknown');assert.equal(restored.state().draft,null);await restored.lookup();assert.equal(committed,1);assert.equal(store.size,0);
});
test('the original more menu retains recovery after an action disappears or selection is cleared',()=>{
 const ui=readFileSync(new URL('../pages/shared/ResearchAssetCatalog.jsx',import.meta.url),'utf8'),hook=readFileSync(new URL('../pages/shared/useAssetGovernance.jsx',import.meta.url),'utf8');
 assert(ui.includes('onRecover')&&ui.includes('继续上次操作'));assert(hook.includes('assetGovernancePendingKey')&&hook.includes('recover:'));
});
