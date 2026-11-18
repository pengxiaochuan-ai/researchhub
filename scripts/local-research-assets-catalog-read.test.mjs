import test from 'node:test';
import assert from 'node:assert/strict';
import {presentAssetCatalog,loadCatalogRecords,createAssetCatalogReader,visibleCatalogAsset} from './local-research-assets-catalog-read.mjs';
import {sealAssetRegistration} from './research-assets-registration-contract.mjs';
const now=Date.parse('2026-11-12T00:00:00Z'),actor={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'reader',displayName:'合成使用者',isTenantAdmin:false,catalogActors:{owner:'owner',admin:'admin'}};
const base={tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'owner',ownerName:'合成作者',kind:'protocol',revision:3,workingVersionNo:2,workingState:'draft',releasedVersionNo:1,releaseState:'released',deletedAt:null,createdAt:'2026-11-10T00:00:00Z',updatedAt:'2026-11-11T00:00:00Z'};
const parent=r=>({id:r.assetId,tenantId:r.tenantId,studyGroupId:r.studyGroupId,researchProjectId:r.researchProjectId,ownerAccountId:r.ownerAccountId,createdBy:r.ownerAccountId,typeKey:'research_report',status:'draft',deletedAt:null,currentVersionNo:r.workingVersionNo,idempotencyKey:'rh-research-asset:catalog-20261112:owner:'+r.kind});
function policy(metadata,version=1,sourceKind='author'){
 const rightsEvidence='原创合成材料',discoveryRecipientCeiling=['reader'],sourceBindings=[];
 const sealed=sealAssetRegistration({kind:'protocol',metadata,contentMd:'合成正文',sourceKind,sourceBindings,policy:{rightsEvidence,discoveryRecipients:discoveryRecipientCeiling}},{accountId:'owner'},version);
 return{...sealed,version,metadata,sourceKind,sourceBindings,rightsEvidence,discoveryRecipientCeiling,storedContentHash:sealed.contentHash};
}
function record(id,n=0){return{registry:{...base,assetId:id},policies:[{version:1,metadata:{title:'获准方案 '+n,summary:'合成摘要',domains:['情志病'],author:'作者声明'},sourceKind:'author',createdAt:'2026-11-10T00:00:00Z'},{version:2,metadata:{title:'SECRET-PRIVATE-DRAFT',summary:'SECRET-PRIVATE-BODY',domains:['秘密领域']},sourceKind:'author',createdAt:'2026-11-11T00:00:00Z'}],events:[{type:'released',version:1,revision:2,discoveryRecipients:['reader'],expiresAt:'2026-11-19T00:00:00Z'}],grants:[],sourceValid:true};}
test('catalog filters actual visible-version fields before paging and counts objects rather than versions',()=>{
 const records=Array.from({length:7},(_,i)=>record('asset-'+i,i));
 const r=presentAssetCatalog({records,principal:actor,query:new URLSearchParams('kind=protocol&page=2&pageSize=5'),now});
 assert.equal(r.total,7);assert.equal(r.items.length,2);assert.equal(r.stats.all,7);assert.equal(r.stats.protocol,7);assert.equal(r.stats.dataset,0);
 assert(!JSON.stringify(r).includes('SECRET'));assert(!r.filterOptions.domains.includes('秘密领域'));
 const none=presentAssetCatalog({records,principal:actor,query:new URLSearchParams('q=SECRET'),now});assert.equal(none.total,0);assert.equal(none.stats.all,7);
});
test('only a clean owned working draft offers recycle at the original More entry',()=>{
 const a=record('clean');Object.assign(a.registry,{workingVersionNo:1,releaseState:'unreleased',releasedVersionNo:null,everSubmitted:false});a.events=[{type:'created',version:1,revision:1}];
 const p={...actor,accountId:'owner',permissions:['artifact.edit']},row=()=>presentAssetCatalog({records:[a],principal:p,query:{},now}).items[0];
 assert(row().canActions.includes('trash'));a.events.push({type:'cited',version:1,revision:2});assert(!row().canActions.includes('trash'));
});
test('stable sort, page bounds and nonmatching source filters cannot expose private rows',()=>{
 const records=[record('b'),record('a'),{...record('hidden'),events:[]}];
 const r=presentAssetCatalog({records,principal:actor,query:new URLSearchParams('pageSize=5'),now});assert.deepEqual(r.items.map(x=>x.id),['b','a']);assert.equal(r.total,2);
 const out=presentAssetCatalog({records,principal:actor,query:new URLSearchParams('page=2&pageSize=5'),now});assert.equal(out.items.length,0);assert.equal(out.total,2);
 const source=presentAssetCatalog({records,principal:actor,query:new URLSearchParams('source=knowledge'),now});assert.equal(source.total,0);
});
test('withdrawn sources and tenant changes clear catalog counts, not stale cached visibility',()=>{
 const a=record('a');a.sourceValid=false;
 assert.equal(presentAssetCatalog({records:[a],principal:actor,query:new URLSearchParams(),now}).stats.all,0);
 assert.equal(presentAssetCatalog({records:[record('a')],principal:{...actor,tenantId:'other'},query:new URLSearchParams(),now}).items.length,0);
});
test('an author sees current fixed release, withdrawal and expiry rather than a stale approved label',()=>{
 const a=record('a');Object.assign(a.registry,{workingVersionNo:1,workingState:'approved',approvedVersionNo:1});
 const principal={...actor,accountId:'owner',permissions:['artifact.edit']};
 const state=time=>presentAssetCatalog({records:[a],principal,query:new URLSearchParams(),now:time}).items[0].state;
 assert.equal(state(now),'released');assert.equal(state(Date.parse('2026-11-20')),'expired');
 a.events.push({type:'withdrawn',version:1,revision:3});assert.equal(state(now),'withdrawn');
});
test('a new private working version does not inherit the scope of an older released version',()=>{
 const a=record('a'),principal={...actor,accountId:'owner',permissions:['artifact.edit']};
 const row=presentAssetCatalog({records:[a],principal,query:new URLSearchParams(),now}).items[0];assert.equal(row.version,2);assert.equal(row.state,'draft');assert.equal(row.scope,'private');
});
test('a newer invalid source does not hide an independently valid released fixed version',()=>{
 const a=record('a');a.policies[0].sourceValid=true;a.policies[1].sourceValid=false;
 a.events.push({type:'released',version:2,revision:3,discoveryRecipients:['reader'],expiresAt:'2026-11-19T00:00:00Z'});
 const result=presentAssetCatalog({records:[a],principal:actor,query:new URLSearchParams(),now});
 assert.equal(result.total,1);assert.equal(result.items[0].version,1);assert(!JSON.stringify(result).includes('SECRET'));
});
test('a restricted preview returns only visible fixed-version metadata and cannot read body text',async()=>{
 const a=record('a');a.policies=a.policies.map(p=>({...p,...policy(p.metadata,p.version)}));
 a.parent=parent(a.registry);
 const tx={$queryRawUnsafe:async()=>[a],researchArtifactVersion:{findFirst:()=>assert.fail('restricted body must not be queried')}};
 const reader=createAssetCatalogReader({withAccess:async(_u,permission,fn)=>{assert.equal(permission,'artifact.read');return fn(tx,actor);},now:()=>now});
 const preview=await reader.preview({},'a',1);assert.equal(preview.schemaVersion,'rh-research-asset-preview.v1');assert.equal(preview.version,1);assert.equal(preview.bodyAccess,'restricted');assert.equal(preview.metadata.title,'获准方案 0');assert(!JSON.stringify(preview).includes('SECRET'));assert(!('contentMd' in preview));
 await assert.rejects(reader.preview({},'hidden',1),e=>e.status===404);await assert.rejects(reader.preview({},'a',2),e=>e.status===404);
});
test('JSONB key reordering preserves fixed metadata binding but a changed title is rejected',async()=>{
 const p=policy({title:'合成方案',summary:'固定摘要'});
 p.block.metadata={summary:'固定摘要',title:'合成方案'};
 const row={registry:{...base,assetId:'a'},policies:[p],events:[],grants:[]};
 row.parent=parent(row.registry);
 const tx={$queryRawUnsafe:async(_sql,...params)=>{assert.deepEqual(params,['t','g','p']);return[row];}};
 assert.equal((await loadCatalogRecords(tx,actor,()=>assert.fail())).length,1);
 p.block.metadata.title='改过的正文元数据';await assert.rejects(loadCatalogRecords(tx,actor,()=>assert.fail()),e=>e.status===409);
});
test('a non-author policy cannot bypass the active source adapter by declaring no bindings',async()=>{
 const p=policy({title:'来源待核对',summary:'摘要'},1,'knowledge');
 const row={registry:{...base,assetId:'a'},policies:[p],events:[],grants:[]};
 row.parent=parent(row.registry);
 let checked=0;const tx={$queryRawUnsafe:async()=>[row]};await loadCatalogRecords(tx,actor,async()=>{checked++;return false;});
 assert.equal(checked,1);assert.equal(p.sourceValid,false);
});
test('a matching block and sidecar cannot disguise a forged policy digest or altered rights evidence',async()=>{
 const p=policy({title:'原创合成方案',summary:'摘要'}),row={registry:{...base,assetId:'a'},policies:[p],events:[],grants:[]},tx={$queryRawUnsafe:async()=>[row]};
 row.parent=parent(row.registry);
 p.block.rightsEvidence='被修改的用途声明';
 await assert.rejects(loadCatalogRecords(tx,actor,()=>assert.fail()),e=>e.status===409);
 p.rightsEvidence=p.block.rightsEvidence;
 await assert.rejects(loadCatalogRecords(tx,actor,()=>assert.fail()),e=>e.status===409);
});
test('edit capability requires current editable owner/admin working head and available version/event budget',()=>{
 const row=record('a'),owner={...actor,accountId:'owner',permissions:['artifact.edit']};
 const read=p=>presentAssetCatalog({records:[row],principal:p,query:new URLSearchParams(),now}).items[0];
 assert(read(owner).canActions.includes('edit'));assert(!read(actor).canActions.includes('edit'));assert(!read({...owner,permissions:[]}).canActions.includes('edit'));assert(read({...actor,isTenantAdmin:true}).canActions.includes('edit'));
 row.registry.revision=24;assert(!read(owner).canActions.includes('edit'));row.registry.revision=3;row.registry.workingVersionNo=8;row.policies.push({...row.policies[1],version:8});assert(!read(owner).canActions.includes('edit'));
});

test('overview fixed-version adapter never substitutes current metadata or an invisible version',()=>{const r=record('fixed');assert.equal(visibleCatalogAsset(r,actor,now,2),null);assert.equal(visibleCatalogAsset(r,actor,now,8),null);const own={...actor,accountId:'owner'};assert.equal(visibleCatalogAsset(r,own,now,1).row.title,'获准方案 0');assert.equal(visibleCatalogAsset(r,own,now,2).row.title,'SECRET-PRIVATE-DRAFT');r.policies[0].sourceValid=false;assert.equal(visibleCatalogAsset(r,own,now,1),null);});
