import test from 'node:test';
import assert from 'node:assert/strict';
import {assetRegistrationDraft,buildAssetRegistrationPayload,createAssetRegistrationAttempt,assetRegistrationRequestAllowed,assetRegistrationHeaders,assertAssetRegistrationOptions,assertAssetEditDraft,assetRegistrationContextKey,assetRegistrationNeedsProtection} from '../src/research-assets-registration.js';
const user={accountId:'owner',authVersion:2,displayName:'合成作者'},options={actors:[{accountId:'owner',displayName:'合成作者',isSelf:true},{accountId:'admin',displayName:'合成管理员',isSelf:false}],sources:[]};
const complete=()=>({...assetRegistrationDraft(user),mode:'manual',metadata:{title:'原创合成方案',summary:'人工摘要',purpose:'方法讨论',limitations:'不含临床数据',author:'合成作者'},contentMd:'保留原文\n\n  不修剪正文。',domains:'情志病，针灸',rightsEvidence:'原创合成说明'});
test('five draft kinds keep labels, scientific raw text and explicit private audience without technical fields',()=>{
 for(const kind of ['protocol','dataset','instrument','analysis','publication']){
  const result=buildAssetRegistrationPayload({...complete(),kind},{user,options});assert.equal(result.kind,kind);assert.equal(result.contentMd,complete().contentMd);assert.deepEqual(result.policy.discoveryRecipients,['owner']);assert.deepEqual(result.metadata.domains,['情志病','针灸']);assert(!('requestKey' in result));assert(!('ownerAccountId' in result));
 }
 assert.equal(assetRegistrationDraft(user).mode,'file');assert.equal(assetRegistrationDraft(user).metadata.author,user.displayName);
});
test('known source is selected directly; a read permission is not an invented asset licence',()=>{
 const source={id:'doc',version:2,binding:{kind:'knowledge',id:'doc',version:2,contentHash:'a'.repeat(64)},contentMd:'源材料',rightsEvidence:'原创合成固定快照许可',discoveryRecipients:['owner']};
 const draft={...complete(),mode:'knowledge',sourceId:'doc'};assert.throws(()=>buildAssetRegistrationPayload(draft,{user,options}));
 const scoped={...options,sources:[source]};const result=buildAssetRegistrationPayload(draft,{user,options:scoped});assert.deepEqual(result.sourceBindings,[source.binding]);
 assert.throws(()=>buildAssetRegistrationPayload({...draft,audience:'named'},{user,options:scoped}));
 assert.throws(()=>buildAssetRegistrationPayload({...complete(),mode:'file'},{user,options}));
 const file=buildAssetRegistrationPayload({...complete(),mode:'file',uploadId:'upload-one'},{user,options});assert.equal(file.uploadId,'upload-one');assert(!('contentMd' in file));
});
test('unknown save results freeze the same payload/key; only an explicit confirmed-not-found retry may submit it again',()=>{
 let made=0;const attempt=createAssetRegistrationAttempt({makeKey:()=>{made++;return'asset-request-'+made;}}),payload=buildAssetRegistrationPayload(complete(),{user,options});
 const first=attempt.begin(payload);attempt.failed({status:0});assert.equal(attempt.state().phase,'unknown');assert.throws(()=>attempt.begin({...payload,contentMd:'changed'}));assert.equal(made,1);
 attempt.lookup({status:'not_found'});assert.equal(attempt.state().phase,'retryable');assert.deepEqual(attempt.retry(),first);assert.equal(made,1);
 assert.equal(attempt.accept({assetId:'asset',version:1,revision:1,status:'committed'}).assetId,'asset');assert.equal(attempt.state().phase,'committed');
});
test('a revision acknowledgement from another object/version cannot become a success or clear input',()=>{
 const attempt=createAssetRegistrationAttempt({makeKey:()=> 'asset-revision-key'});attempt.begin({...buildAssetRegistrationPayload(complete(),{user,options}),baseVersion:2,expectedRevision:4},{assetId:'asset'});
 assert.throws(()=>attempt.accept({assetId:'other',version:3,revision:5,status:'committed'}));assert.equal(attempt.state().phase,'unknown');
 attempt.lookup({assetId:'asset',version:3,revision:5,status:'committed'});assert.equal(attempt.state().phase,'committed');
});
test('marker-only reload can verify a fixed receipt but can never replay a missing scientific payload',()=>{
 const a=createAssetRegistrationAttempt();a.restore({requestKey:'saved-original-key',assetId:'asset',expectedVersion:3,expectedRevision:5});assert.equal(a.state().phase,'unknown');assert(!a.state().payload.contentMd);
 a.lookup({status:'not_found'});assert.equal(a.state().phase,'absent');assert.throws(()=>a.retry());
 const b=createAssetRegistrationAttempt();b.restore({requestKey:'saved-original-key',assetId:'asset',expectedVersion:3,expectedRevision:5});b.lookup({status:'committed',assetId:'asset',version:3,revision:5});assert.equal(b.state().phase,'committed');
 assert.throws(()=>createAssetRegistrationAttempt().restore({requestKey:'x',expectedVersion:0,expectedRevision:0}));
});
test('new transport admits only draft operations and pins actor intent, not review/sharing/export',()=>{
 for(const [method,path]of [['GET','/research-assets/registrable-sources'],['GET','/research-assets/asset/registration?version=2'],['GET','/research-assets/operations/asset-key-1'],['POST','/research-assets'],['POST','/research-assets/asset/versions'],['POST','/research-assets/uploads']])assert(assetRegistrationRequestAllowed(method,path),path);
 for(const [method,path]of [['POST','/research-assets/asset/releases'],['POST','/research-assets/asset/reviews'],['GET','/research-assets/asset/registration?version=1&version=2'],['GET','/research-assets/operations/x'],['GET','/research-assets/asset/export']])assert.equal(assetRegistrationRequestAllowed(method,path),false,path);
 assert.deepEqual(assetRegistrationHeaders(user,true),{'X-ResearchHub-Actor':'owner','X-ResearchHub-Auth-Version':'2','X-ResearchHub-Request':'asset-catalog-v1'});
 assert.throws(()=>assetRegistrationHeaders({...user,authVersion:undefined},true));
});
const scope={studyGroupId:'group',researchProjectId:'study'},identityRevision='b'.repeat(64);
const serverOptions=()=>({schemaVersion:'rh-asset-registration-options.v1',scope,identityRevision,...options,ownAssets:[],sourcesStatus:'ready',sources:[],uploadsStatus:'ready',pendingUploads:[]});
test('registration options bind current actor and Study, validate source licence and never reinterpret failed reads as empty',()=>{
 const value=serverOptions();assert.equal(assertAssetRegistrationOptions(value,{scope,user}),value);
 for(const bad of [{...value,scope:{...scope,researchProjectId:'other'}},{...value,actors:[{...options.actors[0],isSelf:false}]},{...value,sourcesStatus:'failed'},{...value,identityRevision:'bad'},{...value,ownAssets:[{id:'a',kind:'protocol',version:1},{id:'b',kind:'protocol',version:1}]},{...value,pendingUploads:[{uploadId:'f',filename:'f.txt',sizeBytes:5242881,sha256:'a'.repeat(64),status:'pending'}]}])assert.throws(()=>assertAssetRegistrationOptions(bad,{scope,user}));
 const source={id:'doc',title:'已审核原创资料',version:2,binding:{kind:'knowledge',id:'doc',version:2,contentHash:'a'.repeat(64)},contentMd:'原始来源',rightsEvidence:'原创',discoveryRecipients:['owner','admin']};
 assert.equal(assertAssetRegistrationOptions({...value,sources:[source]},{scope,user}).sources.length,1);
 assert.throws(()=>assertAssetRegistrationOptions({...value,sources:[{...source,binding:{...source.binding,id:'other'}}]},{scope,user}));
 assert.throws(()=>assertAssetRegistrationOptions({...value,sources:[{...source,discoveryRecipients:['intruder']}]},{scope,user}));
});
test('editor accepts only requested current fixed version, current identity and owned payload with consistent file mode',()=>{
 const d={schemaVersion:'rh-asset-registration-draft.v1',...scope,assetId:'asset',kind:'protocol',version:2,expectedRevision:3,metadata:complete().metadata,sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'原创',discoveryRecipients:['owner']},contentMd:'原始正文',fileRevisionRequiresNewUpload:false,identityRevision};
 const route={scope,assetId:'asset',version:2,identityRevision};assert.equal(assertAssetEditDraft(d,route),d);
 for(const bad of [{...d,assetId:'other'},{...d,version:1},{...d,identityRevision:'c'.repeat(64)},{...d,expectedRevision:0},{...d,sourceKind:'upload',fileRevisionRequiresNewUpload:false},{...d,metadata:{...d.metadata,title:''}}])assert.throws(()=>assertAssetEditDraft(bad,route));
});
test('registration lifetime uses the current actor/Study, not a first-render empty identity, and protects only real work',()=>{
 assert.equal(assetRegistrationContextKey({}), '');const c={user:{...user,tenantId:'tenant'},scope};assert(assetRegistrationContextKey(c));
 assert.notEqual(assetRegistrationContextKey(c),assetRegistrationContextKey({...c,user:{...c.user,authVersion:3}}));
 assert.notEqual(assetRegistrationContextKey(c),assetRegistrationContextKey({...c,scope:{...scope,researchProjectId:'other'}}));
 for(const phase of ['submitting','uploading','unknown','upload_unknown','retryable'])assert(assetRegistrationNeedsProtection({phase,dirty:false}),phase);
 assert(assetRegistrationNeedsProtection({phase:'editing',dirty:true}));for(const phase of ['idle','editing','committed','absent','invalid'])assert.equal(assetRegistrationNeedsProtection({phase,dirty:false}),false,phase);
});
