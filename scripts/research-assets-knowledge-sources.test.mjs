import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetKnowledgeSources,ASSET_SOURCE_KB} from './research-assets-knowledge-sources.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
const ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'o',role:'researcher',authVersion:1};
const doc={id:'doc-new',tenantId:'t',studyGroupId:'g',kbId:ASSET_SOURCE_KB,title:'本轮原创合成研究设计说明',contentMd:'原创合成方法，不含真实研究结果。',version:2,createdBy:'a',reviewed:true,status:'published',safetyLevel:'allow',trashedAt:null,kb:{id:ASSET_SOURCE_KB,tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:null,visibility:'tenant',createdBy:'a'}};
function setup(change={},originalProjectReview=false){
 const current={...doc,...change},hash=assetDigest(doc.contentMd),sourceAudit={id:'original-review',tenantId:'t',studyGroupId:'g',researchProjectId:null,accountId:'a',action:'review_kb_doc',target:doc.title+':pass',createdAt:'2026-11-12T00:00:00Z'},proof={id:'review-proof',tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a',action:'hub_asset_source_review_recorded',target:doc.id,meta:{docId:doc.id,kbId:ASSET_SOURCE_KB,version:2,contentHash:hash,sourceAudit,sourceAuditHash:assetDigest(sourceAudit)}};
 if(originalProjectReview){proof.action='review_kb_doc';proof.target=doc.title+':pass';proof.meta=null;}
 const manifest={schemaVersion:'rh-asset-source-manifest.v1',ids,kbId:ASSET_SOURCE_KB,items:[{key:'protocol-notes',id:doc.id,title:doc.title,createdBy:'a',rightsEvidence:'本轮原创，允许固定快照整理和限定引用',allowedRecipients:['o','a'],versions:[{version:2,contentHash:hash,reviewAuditId:proof.id,reviewTarget:proof.target}]}]};
 const tx={auditLog:{findFirst:async({where})=>Object.entries(where).every(([k,v])=>proof[k]===v)?proof:null}};
 const service=createAssetKnowledgeSources({ids,manifest:()=>manifest,withKnowledgeRead:async(_tx,user,fn)=>{assert.equal(user.accountId,'o');assert.equal(user.authVersion,1);return fn(_tx);},readVisibleDoc:async(_tx,_user,id)=>id===doc.id?current:null});
 return{service,tx,manifest,binding:{kind:'knowledge',id:doc.id,version:2,contentHash:hash}};
}
test('existing knowledge visibility and named real review proof precede asset reuse',async()=>{
 const {service,tx,binding}=setup();assert.equal(await service.assertSources(tx,p,{sourceKind:'knowledge',sourceBindings:[binding],discoveryRecipientCeiling:['o']}),true);
 const sources=await service.sources(tx,p);assert.equal(sources.length,1);assert.equal(sources[0].contentMd,doc.contentMd);assert.deepEqual(sources[0].binding,binding);assert(!JSON.stringify(sources).includes('review-proof'));
});
test('an actual original Study-level knowledge review is reused directly without a manufactured projection',async()=>{
 const {service,tx,binding}=setup({},true);assert.equal(await service.assertSources(tx,p,{sourceKind:'knowledge',sourceBindings:[binding],discoveryRecipientCeiling:['o']}),true);
});
test('a readable old document, missing review, changed version or withdrawn source never becomes copying permission',async()=>{
 for(const change of [{reviewed:false},{status:'draft'},{trashedAt:new Date()},{safetyLevel:'blocked'},{version:3},{contentMd:'替换后的正文'},{createdBy:'o'},{kb:{...doc.kb,researchProjectId:'other'}}]){
  const {service,tx,binding}=setup(change);assert.equal(await service.assertSources(tx,p,{sourceKind:'knowledge',sourceBindings:[binding],discoveryRecipientCeiling:['o']}),false);
 }
 const {service,tx,binding}=setup();assert.equal(await service.assertSources(tx,p,{sourceKind:'knowledge',sourceBindings:[{...binding,id:'old-doc'}],discoveryRecipientCeiling:['o']}),false);
 tx.auditLog.findFirst=async()=>null;assert.equal(await service.assertSources(tx,p,{sourceKind:'knowledge',sourceBindings:[binding],discoveryRecipientCeiling:['o']}),false);
});
test('grant ceilings and current knowledge authorization are not replaced by an administrator checkbox',async()=>{
 const {service,tx,binding,manifest}=setup();assert.equal(await service.assertSources(tx,p,{sourceKind:'knowledge',sourceBindings:[binding],discoveryRecipientCeiling:['third']}),false);
 manifest.items.push({...manifest.items[0],id:'another',key:'unapproved-third-document'});await assert.rejects(service.sources(tx,p),e=>e.status===409);
});
