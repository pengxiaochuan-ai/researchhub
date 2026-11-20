import test from 'node:test';
import {createHash} from 'node:crypto';
const bodyHash=createHash('sha256').update('合成正文').digest('hex');
import assert from 'node:assert/strict';
import {createHubAssetBridge} from './hub-asset-bridge.mjs';

const user={tenantId:'tenant',accountId:'author',authVersion:1};
const scope={tenantId:'tenant',studyGroupId:'source-group',researchProjectId:'source-project'};
function setup({owner='author',allowed=true,sourceKind='author',sourceBindings=[]}={}){
 const calls=[],tx={};
 const record={registry:{assetId:'rhab-one',ownerAccountId:owner,ownerName:'作者',revision:2,approvedVersionNo:1,deletedAt:null},policies:[{version:1,sourceValid:true,contentHash:bodyHash,policyHash:'b'.repeat(64),sourceKind,sourceBindings,metadata:{title:'合成方案',summary:'合成验收资料'}}]};
 const bridge=createHubAssetBridge({tenantId:'tenant',resolveScope:async(u,ref)=>{calls.push(['scope',u,ref]);return scope;},authorize:async(t,u,s,permission)=>{calls.push(['authorize',t,u,s,permission]);if(!allowed)throw Object.assign(Error('denied'),{status:403});return{...s,...u,permissions:['artifact.read','artifact.create']};},readRecords:async(t,p,id)=>{calls.push(['records',t,p,id]);return[record];},readBody:async(t,p,id,v)=>{calls.push(['body',t,p,id,v]);return '合成正文';},createArtifact:async(t,p,input)=>{calls.push(['create',t,p,input]);return{id:'target-artifact'};},readScopes:async()=>[]});
 return{bridge,calls,tx};
}
test('source submission uses current author and same transaction, never substitutes owner',async()=>{
 const {bridge,calls,tx}=setup();const result=await bridge.resolveSource(tx,user,{studyId:'source-study',assetId:'rhab-one',version:1});
 assert.equal(result.ownerId,'author');assert.equal(result.version,1);assert.equal(result.contentMd,'合成正文');
 assert.equal(calls.find(x=>x[0]==='authorize')[2],user);assert.equal(calls.find(x=>x[0]==='body')[1],tx);
});
test('another owner, invalid version and revoked Study permission fail before body delivery',async()=>{
 for(const options of [{owner:'someone-else'},{allowed:false}]){const {bridge,calls,tx}=setup(options);await assert.rejects(()=>bridge.resolveSource(tx,user,{studyId:'source-study',assetId:'rhab-one',version:1}));assert.equal(calls.some(x=>x[0]==='body'),false);}
 const {bridge,calls,tx}=setup();await assert.rejects(()=>bridge.resolveSource(tx,user,{studyId:'source-study',assetId:'rhab-one',version:2}));assert.equal(calls.some(x=>x[0]==='body'),false);
});
test('Hub candidates only advertise the currently supported original source coverage',async()=>{
 const original=setup();assert.equal((await original.bridge.candidates(original.tx,user,'source-study')).length,1);
 const derived=setup({sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:'report',version:1,contentHash:bodyHash}]});assert.deepEqual(await derived.bridge.candidates(derived.tx,user,'source-study'),[]);
});
test('native fixed report assets can enter the Hub candidate flow without treating arbitrary derived sources as original',async()=>{
 const report=setup({sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:'rh-formal-report-fixture',version:1,contentHash:bodyHash}]});assert.equal((await report.bridge.candidates(report.tx,user,'source-study')).length,1);
});
test('copy creates real private native draft in target under recipient with fixed lineage',async()=>{
 const {bridge,calls,tx}=setup();const recipient={...user,accountId:'recipient'};
 const source={entryId:'hub-entry',assetId:'rhab-one',version:1,contentHash:bodyHash,policyHash:'b'.repeat(64)};
 const result=await bridge.createTarget(tx,recipient,{targetStudyId:'target-study',title:'我的方案',contentMd:'合成正文',requestKey:'copy-request-01',source});
 assert.deepEqual(result,{targetArtifactId:'target-artifact',targetStudyId:'target-study',version:1});
 const auth=calls.find(x=>x[0]==='authorize');assert.equal(auth[2],recipient);assert.equal(auth[4],'artifact.create');
 const create=calls.find(x=>x[0]==='create');assert.equal(create[1],tx);assert.equal(create[2].accountId,'recipient');assert.equal(create[3].typeKey,'protocol_draft');assert.equal(create[3].contentBlocks[0].source.entryId,'hub-entry');assert.equal(create[3].contentBlocks[0].ownerAccountId,'recipient');
});
test('copy with no target create permission cannot write an artifact',async()=>{
 const {bridge,calls,tx}=setup({allowed:false});await assert.rejects(()=>bridge.createTarget(tx,user,{targetStudyId:'target-study',title:'方案',contentMd:'正文',requestKey:'copy-request-01',source:{entryId:'entry',assetId:'rhab-one',version:1,contentHash:bodyHash,policyHash:'b'.repeat(64)}}));assert.equal(calls.some(x=>x[0]==='create'),false);
});
test('copied target is readable and editable only by its actual recipient, preserving fixed lineage',async()=>{
 const {bridge:creator,calls,tx}=setup(),recipient={...user,accountId:'recipient'};
 const source={entryId:'hub-entry',assetId:'rhab-one',version:1,contentHash:bodyHash,policyHash:'b'.repeat(64)};
 await creator.createTarget(tx,recipient,{targetStudyId:'target-study',title:'我的方案',contentMd:'合成正文',requestKey:'copy-request-02',source});
 const input=calls.find(x=>x[0]==='create')[3],fact={actor_id:'recipient',target_artifact_id:'target-artifact',target_study_id:'target-study',entry_id:source.entryId,asset_id:source.assetId,source_version:1,source_hash:bodyHash,policy_hash:source.policyHash};
 const parent={id:'target-artifact',...scope,ownerAccountId:'recipient',createdBy:'recipient',typeKey:'protocol_draft',title:'我的方案',currentVersionNo:1};
 const versions=[{versionNo:1,contentMd:'合成正文',contentHash:bodyHash,contentBlocks:JSON.parse(JSON.stringify(input.contentBlocks))}];
 const bridge=createHubAssetBridge({tenantId:'tenant',resolveScope:async()=>scope,authorize:async(_tx,u,s)=>({...s,...u}),readRecords:async()=>[],readBody:async()=>'',createArtifact:async()=>{},readScopes:async()=>[],readArtifact:async()=>parent,readVersions:async()=>versions,saveVersion:async(_tx,p,id,b)=>{assert.equal(p.accountId,'recipient');assert.equal(id,'target-artifact');assert.equal(b.baseVersionNo,1);parent.currentVersionNo=2;versions.push({versionNo:2,contentMd:b.contentMd,contentHash:createHash('sha256').update(b.contentMd).digest('hex'),contentBlocks:b.contentBlocks});}});
 assert.equal((await bridge.readTarget(tx,recipient,{artifactId:parent.id,copyFact:fact})).version,1);
 await assert.rejects(()=>bridge.readTarget(tx,user,{artifactId:parent.id,copyFact:fact}));
 const saved=await bridge.saveTarget(tx,recipient,{artifactId:parent.id,copyFact:fact,body:{requestKey:'save-draft-02',expectedVersion:1,contentMd:'本人修改后的合成正文'}});
 assert.equal(saved.version,2);assert.equal(saved.contentMd,'本人修改后的合成正文');
 await assert.rejects(()=>bridge.saveTarget(tx,recipient,{artifactId:parent.id,copyFact:fact,body:{requestKey:'save-draft-03',expectedVersion:1,contentMd:'旧版本修改'}}),e=>e.code==='ASSET_CATALOG_HUB_ASSET_DRAFT_VERSION_CONFLICT');
 versions[1].contentBlocks[0].source.version=2;
 await assert.rejects(()=>bridge.readTarget(tx,recipient,{artifactId:parent.id,copyFact:fact}));
});
