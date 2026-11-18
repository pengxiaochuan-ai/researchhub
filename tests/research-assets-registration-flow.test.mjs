import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetRegistrationFlow} from '../src/research-assets-registration-flow.js';
import {createAssetReadBoundary} from '../src/research-assets-read-boundary.js';
const user={tenantId:'tenant',accountId:'owner',authVersion:2,displayName:'原创作者'},scope={studyGroupId:'group',researchProjectId:'study'},identityRevision='a'.repeat(64);
const options=()=>({schemaVersion:'rh-asset-registration-options.v1',scope,identityRevision,actors:[{accountId:'owner',displayName:'原创作者',isSelf:true},{accountId:'admin',displayName:'管理员',isSelf:false}],ownAssets:[],sourcesStatus:'ready',sources:[],uploadsStatus:'ready',pendingUploads:[]});
const fill=f=>f.change({mode:'manual',metadata:{title:'具名合成方案',summary:'原创摘要',purpose:'教学讨论',limitations:'不是临床结果',author:'原创作者'},contentMd:'原文保持\n\n 不改写',rightsEvidence:'本人原创合成材料'});
const apiBase=()=>({get:async()=>options(),post:async()=>({status:'committed',assetId:'asset',version:1,revision:1})});
test('workspace read failure during upload keeps original file but cannot continue to registration',async()=>{
 const boundary=createAssetReadBoundary();boundary.ready();let finish,posted=0;
 const api=boundary.guard({...apiBase(),upload:()=>new Promise(r=>{finish=r;}),post:async()=>posted++}),f=createAssetRegistrationFlow({user,scope,api});
 boundary.subscribe(e=>e.authorizationLost?f.invalidate():f.pause());await f.open();fill(f);const file=new File(['abc'],'合成.txt');f.selectFile(file);
 const saving=f.save();while(!finish)await new Promise(r=>setImmediate(r));boundary.fail({status:503});boundary.ready();finish({uploadId:'upload',filename:'asset_ba7816bf8f01cfea.txt',sizeBytes:3,sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',status:'pending'});await saving;
 assert.equal(posted,0);assert.equal(f.state().phase,'upload_unknown');assert.equal(f.state().file,file);assert.equal(f.state().draft.metadata.title,'具名合成方案');
 boundary.fail({status:403});assert.equal(f.state().draft,null);assert.equal(f.state().file,null);assert.equal(f.state().phase,'invalid');
});
test('read failure during save retains original key, ignores late success and only explicit lookup accepts outcome',async()=>{
 const boundary=createAssetReadBoundary();boundary.ready();let finish,committed=0;const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const receipt={status:'committed',assetId:'asset',version:1,revision:1},api=boundary.guard({...apiBase(),get:async path=>path.includes('/operations/')?receipt:options(),post:()=>new Promise(r=>{finish=r;})}),f=createAssetRegistrationFlow({user,scope,api,storage,onCommitted:()=>committed++});
 boundary.subscribe(e=>e.authorizationLost?f.invalidate():f.pause());await f.open();fill(f);const saving=f.save();boundary.fail({status:503});boundary.ready();finish(receipt);await saving;
 assert.equal(committed,0);assert.equal(f.state().phase,'unknown');assert.equal(values.size,1);await f.lookup();assert.equal(committed,1);assert.equal(values.size,0);
});
test('cancel and reopen preserve unsaved text and only a verified committed receipt clears dirty state',async()=>{
 const f=createAssetRegistrationFlow({user,scope,api:apiBase()});await f.open();fill(f);assert(f.state().dirty);f.close();assert(!f.state().open);await f.open();assert.equal(f.state().draft.metadata.title,'具名合成方案');assert(f.state().dirty);
 await f.save();assert.equal(f.state().phase,'committed');assert(!f.state().dirty);assert.equal(f.state().receipt.assetId,'asset');f.close();await f.open();assert.equal(f.state().phase,'editing');assert.equal(f.state().draft.metadata.title,'');
});
test('network ambiguity freezes editable input and retries only original key/payload after explicit not-found lookup',async()=>{
 const sent=[];let lookup=false;const api={get:async path=>path.includes('/operations/')?(lookup=true,{status:'not_found'}):options(),post:async(_path,p)=>{sent.push(p);if(sent.length===1)throw new Error('lost');return{status:'committed',assetId:'asset',version:1,revision:1};}};
 const f=createAssetRegistrationFlow({user,scope,api});await f.open();fill(f);await f.save();assert.equal(f.state().phase,'unknown');assert.throws(()=>f.change({contentMd:'changed'}));await f.save();assert.equal(sent.length,1);
 await f.lookup();assert(lookup);assert.equal(f.state().phase,'retryable');await f.save();assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);assert.equal(f.state().phase,'committed');
});
test('current identity invalidation clears private text and ignores a late success from the old account',async()=>{
 let finish;const api={...apiBase(),post:()=>new Promise(resolve=>{finish=resolve;})};const f=createAssetRegistrationFlow({user,scope,api});await f.open();fill(f);const pending=f.save();f.invalidate();finish({status:'committed',assetId:'asset',version:1,revision:1});await pending;
 assert.equal(f.state().phase,'invalid');assert.equal(f.state().draft,null);assert.equal(f.state().options,null);assert(!f.state().receipt);
});
test('upload failure retains original file and upload key; invalid metadata never stages a file',async()=>{
 const calls=[],digest='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';const api={...apiBase(),upload:async(_p,form)=>{calls.push(form.get('requestKey'));if(calls.length===1)throw new Error('lost upload');return{uploadId:'upload',filename:'asset_'+digest.slice(0,16)+'.txt',sizeBytes:3,sha256:digest,status:'pending'};}};
 const f=createAssetRegistrationFlow({user,scope,api}),file=new File(['abc'],'合成.txt',{type:'text/plain'});await f.open();f.selectFile(file);await f.save();assert.equal(calls.length,0);fill(f);f.change({mode:'file'});await f.save();assert.equal(f.state().phase,'upload_unknown');assert.equal(f.state().file,file);assert.throws(()=>f.selectFile(new File(['def'],'其他.txt')));
 await f.save();assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.equal(f.state().phase,'committed');
});
test('a staged response with wrong bytes cannot bind another file or be called saved',async()=>{
 const api={...apiBase(),upload:async()=>({uploadId:'upload',filename:'asset_'+('a'.repeat(16))+'.txt',sizeBytes:3,sha256:'a'.repeat(64),status:'pending'}),post:()=>assert.fail('wrong uploaded hash must not register')};
 const f=createAssetRegistrationFlow({user,scope,api});await f.open();fill(f);f.selectFile(new File(['abc'],'原创.txt'));await f.save();assert.equal(f.state().phase,'upload_unknown');assert(f.state().dirty);
});
test('a file registration conflict also requires original-result reconciliation before editing or rebinding',async()=>{
 const digest='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',api={...apiBase(),upload:async()=>({uploadId:'upload',filename:'asset_'+digest.slice(0,16)+'.txt',sizeBytes:3,sha256:digest,status:'pending'}),post:async()=>{throw Object.assign(new Error('conflict after staging intent'),{status:409,code:'ASSET_CATALOG_VERSION_CONFLICT'});}};
 const f=createAssetRegistrationFlow({user,scope,api});await f.open();fill(f);f.selectFile(new File(['abc'],'原创.txt'));await f.save();assert.equal(f.state().phase,'unknown');assert.throws(()=>f.change({title:'changed'}));
});
test('source selection takes real body/rights directly while failures remain errors and dirty work is not silently replaced',async()=>{
 const o=options();o.sources=[{id:'doc',title:'原创资料',version:2,binding:{kind:'knowledge',id:'doc',version:2,contentHash:'d'.repeat(64)},contentMd:'获准原文',rightsEvidence:'本轮原创',discoveryRecipients:['owner','admin']}];
 const f=createAssetRegistrationFlow({user,scope,api:{...apiBase(),get:async()=>o}});await f.open();f.selectSource('doc');assert.equal(f.state().draft.contentMd,'获准原文');assert.equal(f.state().draft.rightsEvidence,'本轮原创');await assert.rejects(f.open({assetId:'other',version:1}),/未保存/);assert.equal(f.state().draft.sourceId,'doc');
 const broken=createAssetRegistrationFlow({user,scope,api:{...apiBase(),get:async()=>{throw Object.assign(new Error('offline'),{status:503});}}});await broken.open();assert.equal(broken.state().phase,'error');assert.equal(broken.state().options,null);
});
test('reload retains only identity-scoped original-operation marker, never scientific text/file; recovery never auto-replays',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const lost=createAssetRegistrationFlow({user,scope,storage,api:{...apiBase(),post:async()=>{throw new Error('response lost');}}});await lost.open();fill(lost);await lost.save();assert.equal(values.size,1);const saved=[...values.values()][0];assert(!saved.includes('具名合成方案'));assert(!saved.includes('原创合成材料'));assert(!saved.includes('contentMd'));
 let posts=0;const reloaded=createAssetRegistrationFlow({user,scope,storage,api:{...apiBase(),get:async()=>({status:'committed',assetId:'asset',version:1,revision:1}),post:()=>posts++}});await reloaded.open();assert.equal(reloaded.state().phase,'unknown');assert.equal(reloaded.state().draft,null);await reloaded.lookup();assert.equal(reloaded.state().phase,'committed');assert.equal(values.size,0);assert.equal(posts,0);
 const otherOptions=options();otherOptions.actors=otherOptions.actors.map(a=>({...a,isSelf:a.accountId==='admin'}));const other=createAssetRegistrationFlow({user:{...user,accountId:'admin'},scope,storage,api:{...apiBase(),get:async()=>otherOptions}});await other.open();assert.equal(other.state().phase,'editing');assert.equal(other.state().draft.metadata.title,'');
});
test('when named creation capacity is full the UI does not invite a guaranteed-failing new draft',async()=>{
 const o=options();o.ownAssets=['protocol','dataset','instrument','analysis','publication'].map(kind=>({id:'asset-'+kind,kind,version:1}));
 const f=createAssetRegistrationFlow({user,scope,api:{...apiBase(),get:async()=>o,post:()=>assert.fail('no creation capacity')}});await f.open();assert.equal(f.state().phase,'capacity');assert.equal(f.state().draft,null);await f.save();f.close();assert.equal(f.state().phase,'idle');
});
test('the original upload entry resumes an unfinished revision instead of stranding it behind a different new-object target',async()=>{
 const editor={schemaVersion:'rh-asset-registration-draft.v1',...scope,assetId:'asset',kind:'protocol',version:1,expectedRevision:1,metadata:{title:'原合成方案',summary:'原摘要',purpose:'方法讨论',limitations:'非临床',author:'原创作者'},sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'原创',discoveryRecipients:['owner']},contentMd:'原创合成正文',fileRevisionRequiresNewUpload:false,identityRevision};
 const f=createAssetRegistrationFlow({user,scope,api:{...apiBase(),get:async path=>path.includes('/registration?')?editor:options()}});await f.open({assetId:'asset',version:1});f.change({metadata:{summary:'未保存说明'}});f.close();await f.open();assert(f.state().open);assert.equal(f.state().edit.assetId,'asset');assert.equal(f.state().draft.metadata.summary,'未保存说明');assert(f.state().dirty);
});
