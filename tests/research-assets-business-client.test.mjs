import test from 'node:test';
import assert from 'node:assert/strict';
import {assertAssetRegistrationOptions,assertAssetEditDraft,createAssetRegistrationAttempt,assetRegistrationRequestAllowed,assetRegistrationEntryReady,bindAssetRegistrationEntry} from '../src/research-assets-registration.js';
import {createAssetRegistrationFlow} from '../src/research-assets-registration-flow.js';
const user={tenantId:'t',accountId:'member-three',authVersion:1,displayName:'合成研究者'},scope={studyGroupId:'g',researchProjectId:'b'},hash='a'.repeat(64);
const id=n=>'rhab-'+String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const options=()=>({schemaVersion:'rh-asset-registration-options.v2',family:'business',scope,identityRevision:hash,actors:[{accountId:user.accountId,displayName:user.displayName,isSelf:true}],ownAssets:Array.from({length:7},(_,i)=>({id:id(i+1),kind:'protocol',version:10})),sourcesStatus:'unavailable',sources:[],uploadsStatus:'unavailable',pendingUploads:[]});
test('loading and failed overview never become a false empty registration scope',()=>{
 for(const current of[undefined,{ready:false,creationScopes:[scope]},{ready:true,creationScopes:[]},{ready:true,creationScopes:[{studyGroupId:'g'}]}])assert.equal(assetRegistrationEntryReady(current),false);
 assert.equal(assetRegistrationEntryReady({ready:true,creationScopes:[scope]}),true);
});
test('late shell insertion and identity rerender cannot re-enable registration during an unfinished read',()=>{
 const buttons=[],doc={body:{},querySelectorAll:()=>buttons};let notify,disconnected=false;
 const stop=bindAssetRegistrationEntry(doc,{ready:false,busy:true,observerFactory:fn=>{notify=fn;return{observe:()=>{},disconnect:()=>disconnected=true};}});
 const upload={textContent:'上传资产',disabled:false,setAttribute(k,v){this[k]=v;}};
 buttons.push(upload);notify();assert.equal(upload.disabled,true);assert.equal(upload['aria-busy'],'true');
 upload.disabled=false;notify();assert.equal(upload.disabled,true);
 stop();assert(disconnected);upload.disabled=false;notify();assert.equal(upload.disabled,false);
});
test('editing options select a family by object hint without broadening transport grammar',()=>{
 assert(assetRegistrationRequestAllowed('GET','/research-assets/registrable-sources?assetId=old-asset'));
 assert(!assetRegistrationRequestAllowed('GET','/research-assets/registrable-sources?assetId=old-asset&assetId=other'));
 assert(!assetRegistrationRequestAllowed('GET','/research-assets/registrable-sources?family=business'));
});
test('business options admit multiple same-kind objects without relaxing legacy response guards',()=>{
 const v=options();assert.equal(assertAssetRegistrationOptions(v,{scope,user}).ownAssets.length,7);
 assert.throws(()=>assertAssetRegistrationOptions({...v,schemaVersion:'rh-asset-registration-options.v1',family:undefined},{scope,user}));
 assert.throws(()=>assertAssetRegistrationOptions({...v,schemaVersion:'rh-asset-registration-options.v1',ownAssets:[]},{scope,user}));
 assert.throws(()=>assertAssetRegistrationOptions({...v,ownAssets:[{id:'legacy-id',kind:'protocol',version:10}]},{scope,user}));
 assert.throws(()=>assertAssetRegistrationOptions({...v,family:'catalog'},{scope,user}));
});
test('original registration flow can open another protocol and defaults to available manual input',async()=>{
 const flow=createAssetRegistrationFlow({user,scope,api:{get:async()=>options()}});
 await flow.open();const s=flow.state();assert.equal(s.phase,'editing');assert.equal(s.draft.kind,'protocol');assert.equal(s.draft.mode,'manual');
});
test('a server-declared exhausted local scope uses the original capacity feedback before showing a doomed form',async()=>{
 const flow=createAssetRegistrationFlow({user,scope,api:{get:async()=>({...options(),admission:{canCreate:false,reason:'当前可新增数量已用完，请核对已有资产。'}})}});
 await flow.open();assert.equal(flow.state().phase,'capacity');assert.equal(flow.state().draft,null);assert.match(flow.state().message,/已用完/);
});
test('business editor and reload marker keep fixed high versions and reject forged legacy labels',()=>{
 const v={schemaVersion:'rh-asset-registration-draft.v2',family:'business',...scope,assetId:id(1),kind:'protocol',version:9,expectedRevision:25,metadata:{title:'合成方案',summary:'摘要',purpose:'用途',limitations:'限制',author:'作者'},sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'本人原创',discoveryRecipients:[]},contentMd:'原文',fileRevisionRequiresNewUpload:false,identityRevision:hash};
 assert.equal(assertAssetEditDraft(v,{scope,assetId:id(1),version:9,identityRevision:hash}),v);
 assert.throws(()=>assertAssetEditDraft({...v,assetId:'legacy-id'},{scope,assetId:'legacy-id',version:9}));
 const attempt=createAssetRegistrationAttempt();attempt.restore({assetId:id(1),requestKey:'business-pending-key',expectedVersion:10,expectedRevision:26});assert.equal(attempt.state().phase,'unknown');
 assert.throws(()=>createAssetRegistrationAttempt().restore({assetId:'legacy-id',requestKey:'business-pending-key',expectedVersion:10,expectedRevision:26}));
});
