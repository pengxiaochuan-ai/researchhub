// Real HTTP acceptance on the owned generic synthetic Study; no patient or production data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const accepted=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-current.json')).acceptedFile));
const capture=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t07-current.json')).acceptedFile));
assert(accepted.syntheticOnly&&capture.syntheticOnly&&capture.passed&&capture.studyId===accepted.study.id);
await withFixtureTransaction(env,'direct',async tx=>{const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;assert.equal(marker.manifest.syntheticOnly,true);assert.equal(marker.manifest.studyId,capture.studyId);});
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
cookies.researcher=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-researcher-session.json')).cookie;
const runId='rh-t08-http-'+randomUUID().slice(0,8),base='http://127.0.0.1:19501',root='/research-studies/'+capture.studyId,a=root+'/assignments/'+capture.assignmentId,out=workspaceRoot+'researchhub/docs/testing/evidence/research-t08-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const checks=[],network=[],key=()=>randomUUID();let stage='history';
async function request(path,{method='GET',body,status=200,role='admin'}={}){
 const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[role],Origin:base,...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>null);network.push({at:new Date().toISOString(),stage,method,path,role,status:r.status});assert((Array.isArray(status)?status:[status]).includes(r.status),JSON.stringify({stage,path,actual:r.status,code:data?.code}));return {data,status:r.status};
}
const get=async(path,o)=>(await request(path,o)).data,post=async(path,body,o)=>(await request(path,{...o,method:'POST',body})).data;
try{
 const first=await get(a+'/revisions?limit=1');assert.equal(first.items.length,1);assert(first.nextCursor);const latest=first.items[0];
 const second=await get(a+'/revisions?limit=1&cursor='+encodeURIComponent(first.nextCursor));assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);const old=second.items[0];
 assert.equal(old.answers.value,0);assert.equal(old.answers.completed,false);assert.equal(old.score,null);assert.equal(latest.answers.value,1);
 const ref=old.ref,detail=a+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash});assert.deepEqual((await get(detail)).revision,old);
 await get(a+'/revisions?limit=1&cursor='+encodeURIComponent(first.nextCursor),{role:'researcher',status:400});await get(detail,{role:'owner',status:403});
 await get(detail.replace(ref.contentHash,'f'.repeat(64)),{status:[404,409]});
 checks.push('actual_fixed_history_old_zero_false_unscored_detail_signed_actor_cursor_and_wrong_hash_rejection');
 stage='query-create';const createBody={requestKey:key(),target:{kind:'formal_response_revision',ref,fieldKey:'value'},text:'通用合成疑问：请核对原修订录入依据'},created=await post(root+'/data-queries',createBody),q=root+'/data-queries/'+created.result.id;
 assert.deepEqual(await post(root+'/data-queries',createBody),created);await post(root+'/data-queries',{...createBody,text:'不同内容不能复用原键'},{status:409});
 assert.deepEqual((await get(root+'/data-queries/receipts/'+createBody.requestKey+'?'+new URLSearchParams({action:'create',assignmentId:ref.assignmentId}))).result,created.result);
 await get(root+'/data-queries/receipts/'+createBody.requestKey+'?'+new URLSearchParams({action:'create',assignmentId:ref.assignmentId}),{role:'researcher',status:404});
 let view=await get(q);assert.equal(view.query.target.ref.revisionNo,ref.revisionNo);assert.equal(view.query.status,'open');assert.equal(view.capabilities.canClose,true);
 const researcher=await get(q,{role:'researcher'});assert.equal(researcher.capabilities.canReply,true);assert.equal(researcher.capabilities.canClose,false);
 await post(q+'/close',{requestKey:key(),expectedVersion:view.query.version,expectedRef:ref,text:'未经授权的关闭'},{role:'researcher',status:403});
 checks.push('actual_fixed_historical_query_create_dedup_actor_receipt_and_researcher_close_denial');
 stage='query-race';const replyBase={expectedVersion:view.query.version,expectedRef:ref,text:'通用合成回复：已核对原始记录'},replies=await Promise.all([request(q+'/reply',{method:'POST',body:{...replyBase,requestKey:key()},status:[200,409],role:'researcher'}),request(q+'/reply',{method:'POST',body:{...replyBase,requestKey:key()},status:[200,409],role:'researcher'})]);assert.deepEqual(replies.map(v=>v.status).sort(),[200,409]);
 view=await get(q);assert.equal(view.query.events.length,2);assert.equal(view.query.status,'open');
 checks.push('actual_two_http_replies_one_CAS_effect_and_no_implicit_close');
 stage='correction';let response=await get(a);await post(a+'/unlock',{requestKey:key(),expectedVersion:response.response.version,expectedRef:response.response.ref,reason:'通用合成质疑更正验收'});
 response=await get(a);const correction={requestKey:key(),expectedVersion:response.response.version,expectedRef:response.response.ref,reason:'通用合成核对后第二次更正',answers:{value:2,completed:false}};await post(a+'/correct',correction);
 view=await get(q);assert.equal(view.query.status,'open');assert.deepEqual(view.query.target.ref,ref);assert.deepEqual((await get(detail)).revision,old);
 const closeBody={requestKey:key(),expectedVersion:view.query.version,expectedRef:ref,text:'通用合成关闭：原修订依据已核对，更正另存新修订'},closed=await post(q+'/close',closeBody);assert.equal(closed.result.status,'closed');
 assert.deepEqual(await post(q+'/close',closeBody),closed);view=await get(q);assert.equal(view.query.closeRationale,closeBody.text);assert.equal(view.query.events.length,3);assert.equal(view.capabilities.canReply,false);
 await post(q+'/reply',{requestKey:key(),expectedVersion:view.query.version,expectedRef:ref,text:'已关闭不能继续追加回复'},{status:409});
 const listed=await get(root+'/data-queries?assignmentId='+capture.assignmentId+'&limit=1');assert.equal(listed.items.length,1);assert.equal(listed.items[0].id,created.result.id);assert.equal(listed.nextCursor,null);
 checks.push('actual_correction_preserves_fixed_query_and_immutable_history_explicit_reasoned_close_only');
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,studyId:capture.studyId,assignmentId:capture.assignmentId,queryId:created.result.id,checks,network,browserAcceptance:false,clinicalAcceptance:false,productionAcceptance:false};writeFileSync(out+'result.json',JSON.stringify(result,null,2));writeFileSync(workspaceRoot+'.tmp/researchhub-workflow/t08-current.json',JSON.stringify({acceptedFile:out+'result.json'}),{mode:0o600});console.log(JSON.stringify({passed:true,checks,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,at:new Date().toISOString(),stage,message:String(error.message).slice(0,1400),checks,network},null,2));console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,1000)}));process.exitCode=1;}
