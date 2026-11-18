import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalogRecords,createAssetCatalogReader} from '../scripts/local-research-assets-catalog-read.mjs';
import {presentAssetCatalog} from '../scripts/local-research-assets-catalog-read.mjs';
import {presentAssetViews} from '../scripts/research-assets-catalog-views.mjs';
import {presentAssetOverview} from '../scripts/research-assets-overview.mjs';
import {businessAssetKey} from '../server/research-assets/business-family.mjs';
import {sealAssetRegistration} from '../scripts/research-assets-registration-contract.mjs';
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'b',accountId:'third-member',permissions:['artifact.read','artifact.edit'],identityRevision:'current'};
function row(i=1){
 const id='rhab-'+String(i).padStart(8,'0')+'-1111-4111-8111-111111111111';
 const registry={...p,assetId:id,ownerAccountId:p.accountId,kind:'protocol',revision:1,workingVersionNo:1,workingState:'draft',releaseState:'unreleased',everSubmitted:false,deletedAt:null};
 const value={kind:'protocol',metadata:{title:'合成方案 '+i},contentMd:'synthetic',sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'本人原创',discoveryRecipients:[]}};
 const seal=sealAssetRegistration(value,p,1);
 return{parent:{id,...p,ownerAccountId:p.accountId,createdBy:p.accountId,typeKey:'research_report',status:'draft',deletedAt:null,currentVersionNo:1,idempotencyKey:businessAssetKey(id)},registry,policies:[{version:1,metadata:value.metadata,sourceKind:'author',sourceBindings:[],rightsEvidence:'本人原创',discoveryRecipientCeiling:[],...seal,storedContentHash:seal.contentHash}],events:[{type:'created',revision:1,version:1}],grants:[]};
}
test('normal assets from a third current member do not inherit the legacy 26-row limit',async()=>{
 const rows=Array.from({length:31},(_,i)=>row(i+1));
 const tx={$queryRawUnsafe:async(sql,...params)=>{assert(!/LIMIT 27/.test(sql));assert.deepEqual(params,['t','g','b']);return rows;}};
 const records=await loadCatalogRecords(tx,p,()=>assert.fail(),{family:'business'});
 assert.equal(records.length,31);assert.equal(records[0].family.family,'business');
 const reader=createAssetCatalogReader({withAccess:async(_u,_permission,run)=>run(tx,p),loadRecords:(tx,p,sources)=>loadCatalogRecords(tx,p,sources,{family:'business'})});
 const catalog=await reader.catalog({},new URLSearchParams('page=2&pageSize=20'));
 assert.equal(catalog.stats.all,31);assert.equal(catalog.total,31);assert.equal(catalog.items.length,11);
});
test('business read rejects wrong parents and never falls back to legacy classification',async()=>{
 for(const change of [r=>r.parent.tenantId='other',r=>r.parent.idempotencyKey='rh-research-asset:catalog-20261112:owner:protocol',r=>r.registry.researchProjectId='other',r=>r.policies[0].metadata.title='tampered']){
  const r=row();change(r);await assert.rejects(loadCatalogRecords({$queryRawUnsafe:async()=>[r]},p,async()=>true,{family:'business'}),e=>e.status===409);
 }
});
test('legacy reads explicitly exclude new business rows before applying original caps',async()=>{
 let sql;await loadCatalogRecords({$queryRawUnsafe:async(q)=>{sql=q;return[];}},p,async()=>true);
 assert.match(sql,/NOT LIKE 'rhab-%'/);assert.match(sql,/LIMIT 27/);
});
function knowledgeRow(owner,deleted=false){
 const r=row();r.registry.ownerAccountId=owner;r.parent.ownerAccountId=owner;r.parent.createdBy=owner;
 if(deleted){r.registry.deletedAt=new Date().toISOString();r.registry.revision=2;r.events.push({type:'trashed',revision:2,version:1});}
 const value={kind:'protocol',metadata:r.policies[0].metadata,contentMd:'synthetic',sourceKind:'knowledge',sourceBindings:[{kind:'knowledge',id:'private-doc',version:1,contentHash:'a'.repeat(64)}],policy:{rightsEvidence:'获准合成来源',discoveryRecipients:[]}};
 const sealed=sealAssetRegistration(value,{accountId:owner},1);
 r.policies=[{...r.policies[0],...sealed,storedContentHash:sealed.contentHash,sourceKind:'knowledge',sourceBindings:value.sourceBindings,rightsEvidence:value.policy.rightsEvidence}];return r;
}
test('an artifact-only member does not need knowledge rights merely to list unrelated invisible private assets',async()=>{
 const r=knowledgeRow('another-owner');
 const records=await loadCatalogRecords({$queryRawUnsafe:async()=>[r]},p,()=>assert.fail('an invisible source must not request knowledge access'),{family:'business'});
 assert.equal(records[0].policies[0].sourceValid,false);assert.equal(presentAssetCatalog({records,principal:p,query:{}}).stats.all,0);
});
test('owned recycle records still revalidate their source so restore is not blocked by visibility filtering',async()=>{
 const r=knowledgeRow(p.accountId,true);let reads=0;
 const records=await loadCatalogRecords({$queryRawUnsafe:async()=>[r]},p,async()=>{reads++;return true;},{family:'business'});
 assert.equal(reads,1);assert.equal(records[0].policies[0].sourceValid,true);
});
test('cross-Study merge pages after the full per-Study result, including contributions beyond fifty',()=>{
 const now=Date.now(),records=Array.from({length:61},(_,i)=>{const r=row(i+1);r.family={family:'business',maxVersions:2147483647,maxOperations:2147483647};r.policies[0].sourceValid=true;r.events[0].actorAccountId=p.accountId;r.events[0].createdAt=new Date(now).toISOString();return r;});
 const query={page:'1',pageSize:'50'},catalog=presentAssetCatalog({records,principal:p,query,now,allItems:true});
 const view=presentAssetViews({type:'contributions',records,principal:p,query,now,allItems:true});
 assert.equal(catalog.items.length,61);assert.equal(view.items.length,61);
 const part={scope:{studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},catalog,contextRows:catalog.items,view,trend:presentAssetViews({type:'usage',records,principal:p,query,now}),identityRevision:'a'.repeat(64)};
 const result=presentAssetOverview({parts:[part],user:{...p,authVersion:1},query:{page:'4',pageSize:'20'},tab:'contributions',now});
 assert.equal(result.catalog.stats.all,61);assert.equal(result.catalog.total,61);assert.equal(result.catalog.items.length,1);assert.equal(result.mainView.total,61);assert.equal(result.mainView.items.length,1);assert.equal(result.mainView.totals.created,61);
});
