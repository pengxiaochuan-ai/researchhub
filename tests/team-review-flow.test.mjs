import test from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/team-review-flow.js';
const {prepareTeamReview}=flow;
const workspace={id:'team',version:2,baseRevision:'a'.repeat(64),hasDraft:true};
test('only clean already-reviewed same-scope workspaces require passive no-change check',()=>{
 const w={...workspace,reviewedVersion:2,publishedAudience:'tenant',currentRevision:'r'};
 assert.equal(typeof flow.teamReviewCheckKey?.(w,false,'tenant'),'string');
 for(const [current,dirty,audience]of [[w,true,'tenant'],[w,false,'public'],[{...w,reviewedVersion:1},false,'tenant'],[{id:null,version:0},false,'tenant']])assert.equal(flow.teamReviewCheckKey?.(current,dirty,audience),null);
 assert.notEqual(flow.teamReviewCheckKey?.(w,false,'tenant'),flow.teamReviewCheckKey?.({...w,version:3,reviewedVersion:3},false,'tenant'));
});
test('passive review check must confirm zero changes rather than infer it from saved version',()=>{
 assert.equal(flow.teamReviewCheckOutcome?.({changes:[],issues:[],canApprove:false}),'unchanged');
 assert.equal(flow.teamReviewCheckOutcome?.({changes:[{kind:'profile'}],issues:[],canApprove:true}),'needed');
 assert.throws(()=>flow.teamReviewCheckOutcome?.({canApprove:false}),/审核状态/);
});
test('only first or expanded public exposure needs a brief confirmation',()=>{
 for(const [audience,current,expected] of [['tenant',null,false],['tenant',{id:'team'},false],['public',null,true],['public',{id:'team'},false]]){
  assert.equal(flow.requiresPublicConfirmation?.({audience,current}),expected);
 }
 assert.equal(flow.requiresPublicConfirmation({audience:'public',current:{id:'team'},publicExposure:true}),true);
});
test('displaying the default manual method is not an edit, but review persists it before preparing a plan',async()=>{
 const calls=[],client={saveTeamWorkspace:async(_id,b)=>{calls.push(b.data.verificationMethod);return{id:'team'};},teamWorkspace:async()=>({...workspace,version:3,data:{verificationMethod:'administrator'}}),previewTeamWorkspace:async()=>({canApprove:true})};
 await prepareTeamReview({client,workspace:{...workspace,data:{}},data:{name:'甲',verificationMethod:'administrator'},dirty:false,requestKey:'manual-key'});
 assert.deepEqual(calls,['administrator']);
});
test('joint review cannot use a newer institution profile than the one actually shown after conflict recovery',async()=>{
 const old={id:'org',profile:{name:'同名机构',summary:'已读说明',organizationType:'研究所'}},next={...old,profile:{...old.profile,summary:'另一管理员新说明'}};
 const preview={jointInstitutions:[next]};
 let refreshed=0;const client={previewTeamWorkspace:async()=>preview,reviewTeamWorkspace:()=>assert.fail('not approved')},data={verificationMethod:'administrator'};
 await assert.rejects(prepareTeamReview({client,workspace:{...workspace,data},data,dirty:false,institutionSnapshots:[old],onInstitutionsChanged:()=>{refreshed++;}}),{code:'DIRECTORY_INSTITUTION_CHANGED'});
 assert.equal(refreshed,1);assert.deepEqual(await prepareTeamReview({client,workspace:{...workspace,data},data,dirty:false,institutionSnapshots:[next]}),preview);
});
test('review entry saves dirty draft, reads it back and only then previews; never approves',async()=>{
 const calls=[],saved={...workspace,version:3},client={saveTeamWorkspace:async(id,b)=>{calls.push(['save',id,b]);return{id};},teamWorkspace:async()=>{calls.push(['read']);return saved;},previewTeamWorkspace:async(id,a)=>{calls.push(['preview',id,a]);return{canApprove:false,issues:['缺少负责人']};},reviewTeamWorkspace:()=>assert.fail('must not approve')};
 const p=await prepareTeamReview({client,workspace,data:{name:'甲',directions:[' 针灸 ','']},dirty:true,audience:'tenant',requestKey:'key',onSaved:w=>calls.push(['saved',w.version])});
 assert.equal(p.canApprove,false);assert.deepEqual(calls.map(x=>x[0]),['save','read','saved','preview']);assert.deepEqual(calls[0][2].data.directions,['针灸']);assert.equal(calls[0][2].requestKey,'key');
});
test('failed or uncertain save cannot continue to preview or approve',async()=>{
 const e=Object.assign(Error('offline'),{status:503,uncertain:true});let request;
 await assert.rejects(prepareTeamReview({client:{saveTeamWorkspace:async()=>{throw e;},previewTeamWorkspace:()=>assert.fail()},workspace,data:{name:'甲',directions:[]},dirty:true,audience:'tenant',requestKey:'key',onRequest:r=>{request=r;}}),x=>x===e);
 assert.equal(request.operation,'save');assert.equal(request.body.requestKey,'key');
});
test('successful draft save followed by read404 preserves the original request for recovery',async()=>{
 let request;const failed=Object.assign(Error('not found'),{status:404});
 await assert.rejects(prepareTeamReview({client:{saveTeamWorkspace:async()=>({id:'team'}),teamWorkspace:async()=>{throw failed;},previewTeamWorkspace:()=>assert.fail('no review after unreadable committed save')},workspace,data:{name:'甲'},dirty:true,requestKey:'saved-key',onRequest:r=>{request=r;}}),e=>e.uncertain===true&&e.status===503&&e.cause===failed);
 assert.equal(request.operation,'save');assert.equal(request.body.requestKey,'saved-key');
});
test('clean draft preview never writes; new draft uses create not save',async()=>{
 const calls=[],client={previewTeamWorkspace:async()=>({canApprove:true}),createTeamWorkspace:async()=>{calls.push('create');return{id:'new'};},teamWorkspace:async()=>({id:'new'})};
 await prepareTeamReview({client,workspace,dirty:false,audience:'tenant'});assert.deepEqual(calls,[]);
 await prepareTeamReview({client,workspace:{id:null},data:{name:'甲',directions:[]},dirty:true,audience:'tenant',requestKey:'key'});assert.deepEqual(calls,['create']);
});
test('changed identity after save prevents private readback and preview',async()=>{
 let current=true;await assert.rejects(prepareTeamReview({client:{saveTeamWorkspace:async()=>{current=false;return{id:'team'};},teamWorkspace:()=>assert.fail()},workspace,data:{name:'甲',directions:[]},dirty:true,audience:'tenant',requestKey:'key',isCurrent:()=>current}),{name:'AbortError'});
});
test('editing a loaded archive uses the revision actually read, not its historical draft baseline',()=>{
 const loaded={...workspace,currentRevision:'b'.repeat(64)};
 assert.equal(flow.teamEditRevision?.(loaded),'b'.repeat(64));
 assert.equal(loaded.baseRevision,'a'.repeat(64),'do not mutate or conceal the original stored baseline');
 assert.equal(flow.teamEditRevision?.(workspace),'a'.repeat(64),'old responses retain their existing guard');
});
test('reviewing an unchanged stale draft first saves with its captured current revision, then reads and previews',async()=>{
 const calls=[],loaded={...workspace,currentRevision:'b'.repeat(64)},data={name:'合成团队',directions:[],members:[{key:'blank',name:'',role:'member'}],evidence:[]};
 const client={saveTeamWorkspace:async(id,body)=>{calls.push(['save',body]);return{id};},teamWorkspace:async()=>{calls.push(['read']);return{...loaded,version:3,baseRevision:'b'.repeat(64)};},previewTeamWorkspace:async()=>{calls.push(['preview']);return{canApprove:false,issues:['请补齐成员姓名和资料依据']};},reviewTeamWorkspace:()=>assert.fail('approval must stay explicit')};
 const p=await prepareTeamReview({client,workspace:loaded,data,dirty:false,audience:'tenant',requestKey:'captured-key'});
 assert.deepEqual(calls.map(x=>x[0]),['save','read','preview']);assert.equal(calls[0][1].baseRevision,'b'.repeat(64));assert.equal(calls[0][1].expectedVersion,2);assert.equal(calls[0][1].requestKey,'captured-key');assert.equal(p.canApprove,false);
});
test('a genuine post-read revision conflict is not refreshed, retried or advanced into review',async()=>{
 let writes=0;const conflict=Object.assign(Error('changed after read'),{status:409,code:'DIRECTORY_VERSION_CONFLICT'});
 await assert.rejects(prepareTeamReview({workspace:{...workspace,currentRevision:'b'.repeat(64)},data:{name:'合成',directions:[]},dirty:true,requestKey:'fixed-key',client:{saveTeamWorkspace:async(_id,b)=>{writes++;assert.equal(b.baseRevision,'b'.repeat(64));throw conflict;},teamWorkspace:()=>assert.fail('no silent rebase'),previewTeamWorkspace:()=>assert.fail('no preview after conflict')}}),e=>e===conflict);
 assert.equal(writes,1);
});
