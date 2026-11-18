import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot} from './research-creation-fixture.mjs';
import {mintSyntheticH5Invitation} from './research-h5-synthetic-invitation.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const b=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/benchmark-current.json')).acceptedFile));
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
const runId='rh-h5-http-'+randomUUID().slice(0,8),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t12-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:19501',root='/research-studies/'+b.study.id,network=[],checks=[],key=()=>randomUUID();let stage='setup';const targets=new Map();
async function request(path,{method='GET',body,status=200,cookie='',origin=base}={}){
 if(path.startsWith('/questionnaire-h5/session')){const target=targets.get(cookie);if(method==='GET'&&!path.includes('expectedAssignmentId=')){assert(target,'H5_EXPECTED_TARGET_REQUIRED');path+=(path.includes('?')?'&':'?')+'expectedAssignmentId='+encodeURIComponent(target);}if(method==='POST'&&/\/(draft|submit)$/.test(path)&&body.expectedAssignmentId===undefined){assert(target,'H5_EXPECTED_TARGET_REQUIRED');body={...body,expectedAssignmentId:target};}}
 const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json().catch(()=>null);
 network.push({at:new Date().toISOString(),stage,method,path,status:r.status});assert((Array.isArray(status)?status:[status]).includes(r.status),JSON.stringify({stage,path,status:r.status,code:value?.code}));
 const nextCookie=r.headers.get('set-cookie')?.split(';')[0];if(nextCookie&&value?.assignmentId)targets.set(nextCookie,value.assignmentId);
 return {value,status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],cookieFlags:r.headers.get('set-cookie')?.split(';').slice(1).map(v=>v.trim().replace(/^Expires=.*/,'Expires=[date]')),cacheControl:r.headers.get('cache-control')};
}
try{
 const cases=[];
 for(const suffix of ['A','B']){
  const created=await request(root+'/subjects',{method:'POST',cookie:cookies.admin,body:{requestKey:key(),subjectId:'SYNTHETIC-H5-HTTP-'+runId.slice(-8)+'-'+suffix}}),subject=created.value.subject;
  const pp=root+'/subjects/'+subject.id+'/participation';
  for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:'synthetic-consent-v1'},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:'synthetic-research-only'}])await request(pp+'/events',{method:'POST',cookie:cookies.admin,body:{requestKey:key(),expectedPolicyVersionId:b.policy.id,expectedPolicyHash:b.policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'合成H5接口验收'}}});
  await request(pp+'/enroll',{method:'POST',cookie:cookies.admin,body:{requestKey:key(),expectedPolicyVersionId:b.policy.id,expectedPolicyHash:b.policy.contentHash}});const list=(await request(root+'/visits?subjectId='+subject.id,{cookie:cookies.admin})).value;cases.push({subject,visitId:list.items[0].id});
 }
 const a=await mintSyntheticH5Invitation(b,cases[0].visitId),c=await mintSyntheticH5Invitation(b,cases[1].visitId),p='/questionnaire-h5/session';
 stage='exchange';await request(p,{method:'POST',body:{token:a.token},origin:'https://untrusted.example',status:403});
 const start=await request(p,{method:'POST',body:{token:a.token},status:201});assert(start.cookie);assert(!('sessionId'in start.value));assert(start.cookieFlags.includes('HttpOnly'));assert(start.cookieFlags.includes('SameSite=Strict'));assert(start.cookieFlags.includes('Path=/api/questionnaire-h5'));assert.equal(start.cacheControl,'no-store');assert.equal(start.value.assignmentId,a.assignmentId);
 await request(p,{method:'POST',body:{token:a.token},status:409});
 const resumed=await request(p,{method:'POST',cookie:start.cookie,body:{token:a.token},status:201});assert.equal(resumed.value.assignmentId,a.assignmentId);
 checks.push('actual_public_exchange_scoped_httponly_cookie_resume_and_no_other_browser_redeem');
 stage='draft';const dk=key(),draft=await request(p+'/draft',{method:'POST',cookie:start.cookie,body:{requestKey:dk,expectedVersion:start.value.version,answers:{value:0,optional_value:null,completed:false}}});
 assert.deepEqual(draft.value.receipt,{requestKey:dk,action:'h5.draft',targetId:a.assignmentId});assert.deepEqual((await request(p+'/receipts/'+dk+'?operation=draft',{cookie:start.cookie})).value,draft.value);
 assert.deepEqual((await request(p,{cookie:start.cookie})).value.answers,{value:0,optional_value:null,completed:false});
 await request(p+'/receipts/'+key()+'?operation=draft',{cookie:start.cookie,status:404});
 checks.push('actual_zero_false_missing_server_draft_and_strict_original_key_receipt');
 stage='switch';const switched=await request(p,{method:'POST',cookie:start.cookie,body:{token:c.token},status:201});assert.equal(switched.value.assignmentId,c.assignmentId);assert.deepEqual(switched.value.answers,{});
 assert.deepEqual((await request(p,{cookie:start.cookie})).value.answers,{value:0,optional_value:null,completed:false});
 await request(p+'?expectedAssignmentId='+a.assignmentId,{cookie:switched.cookie,status:409});
 await request(p+'/draft',{method:'POST',cookie:switched.cookie,body:{requestKey:key(),expectedAssignmentId:a.assignmentId,expectedVersion:0,answers:{value:999,optional_value:null,completed:false}},status:409});
 await request(p+'/receipts/'+dk+'?operation=draft&expectedAssignmentId='+a.assignmentId,{cookie:switched.cookie,status:409});
 assert.deepEqual((await request(p,{cookie:switched.cookie})).value.answers,{});
 checks.push('actual_different_invitation_does_not_show_previous_answers_and_old_tab_cannot_read_write_or_resolve_into_new_target');
 stage='cas';const current=(await request(p,{cookie:start.cookie})).value;
 const racers=await Promise.all([1,3].map(value=>request(p+'/draft',{method:'POST',cookie:start.cookie,body:{requestKey:key(),expectedVersion:current.version,answers:{value,optional_value:null,completed:false}},status:[200,409]})));assert.deepEqual(racers.map(r=>r.status).sort(),[200,409]);
 const fresh=(await request(p,{cookie:start.cookie})).value,sk=key(),submitted=await request(p+'/submit',{method:'POST',cookie:start.cookie,body:{requestKey:sk,expectedVersion:fresh.version,answers:{value:2,optional_value:null,completed:true}}});
 assert.equal(submitted.value.status,'submitted');assert.equal(submitted.value.ref.revisionNo,1);assert.deepEqual((await request(p+'/receipts/'+sk+'?operation=submit',{cookie:start.cookie})).value,submitted.value);
 const admin=(await request(root+'/assignments/'+a.assignmentId,{cookie:cookies.admin})).value;assert.deepEqual(admin.response.answers,{value:2,optional_value:null,completed:true});assert.equal(admin.response.score,null);
 checks.push('actual_two_http_cas_one_winner_submit_fixed_revision_and_backend_collection');
 stage='withdraw';const subject=cases[1].subject.id;
 await request(root+'/subjects/'+subject+'/participation/events',{method:'POST',cookie:cookies.admin,body:{requestKey:key(),expectedPolicyVersionId:b.policy.id,expectedPolicyHash:b.policy.contentHash,event:{kind:'data_use_consent',decision:'withdrawn',effectiveAt:new Date().toISOString(),evidence:'合成H5反例',reason:'合成用途撤回'} }});
 for(const options of [{},{method:'POST',body:{token:c.token}}])await request(p,{cookie:switched.cookie,...options,status:[403,409,410]});
 await request(p+'/draft',{method:'POST',cookie:switched.cookie,body:{requestKey:key(),expectedVersion:0,answers:{value:0,completed:false}},status:[403,409,410]});
 checks.push('actual_current_withdrawal_blocks_read_resume_and_write_without_new_session_fallback');
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,studyId:b.study.id,checks,network,setupDelivery:'unknown-provider-substitute',emailSent:false,browserAcceptance:false,clinicalAcceptance:false,productionAcceptance:false};writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,checks,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,at:new Date().toISOString(),stage,message:String(error.message).slice(0,1000),checks,network},null,2));console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,900)}));process.exitCode=1;}
