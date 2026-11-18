import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

assert.deepEqual(process.argv.slice(2),['--local-synthetic-mock']);
const require=createRequire(import.meta.url);
const {chromium}=require('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
const origin='http://127.0.0.1:19501',runId='h5-quiet-independent-'+randomUUID().slice(0,8);
const directory=new URL('../docs/testing/evidence/research-t11-2026-11-12/'+runId+'/',import.meta.url).pathname;
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const contexts=[],checks=[],errors=[];
const fresh=()=>({assignmentId:'synthetic-assignment',version:0,status:'draft',expiresAt:new Date(Date.now()+300000).toISOString(),schema:{fields:[{key:'value',label:'Synthetic value',type:'number'}]},answers:{value:0}});
const deferred=()=>{let resolve;return {promise:new Promise(done=>resolve=done),resolve:value=>resolve(value)};};
async function setup(name){
 const context=await browser.newContext({viewport:{width:1000,height:700},recordVideo:{dir:directory+name+'-video'}});contexts.push(context);
 const page=await context.newPage();let state=fresh(),hold=null,gets=0,submits=0;
 page.on('pageerror',error=>errors.push(error.name));
 await page.route('**/api/questionnaire-h5/session**',async route=>{
  const request=route.request(),pathname=new URL(request.url()).pathname;
  const reply=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(request.method()==='GET'){
   gets++;
   if(hold){const captured=hold;hold=null;captured.seen.resolve();const result=await captured.release.promise;
    if(result==='abort')return route.abort('failed');
    if(result==='revoked')return reply(403,{code:'QUESTIONNAIRE_SESSION_REVOKED',message:'合成会话已撤销。'});
    return reply(200,captured.snapshot);
   }
   return reply(200,state);
  }
  if(pathname.endsWith('/submit')){
   submits++;const body=request.postDataJSON();
   state={...state,status:'submitted',version:state.version+1,answers:body.answers};
   return reply(200,{assignmentId:state.assignmentId,status:state.status,version:state.version,receipt:{requestKey:body.requestKey,action:'h5.submit',targetId:state.assignmentId}});
  }
  if(pathname==='/api/questionnaire-h5/session')return reply(200,state);
  return reply(400,{code:'UNEXPECTED_SYNTHETIC_REQUEST'});
 });
 await page.goto(origin+'/scripts/fixtures/h5-quiet-review.html');
 await page.waitForFunction(()=>window.__h5ReviewState?.verified&&!window.__h5ReviewState.busy);
 return {page,counts:()=>({gets,submits}),hold(){hold={seen:deferred(),release:deferred(),snapshot:structuredClone(state)};return hold;}};
}
try{
 const first=await setup('failed-read');
 await first.page.evaluate(()=>window.__h5Review.setAnswers({value:7}));
 const before=first.counts().gets,read=first.hold();
 await first.page.evaluate(()=>{void window.__h5Review.check({quiet:true});});
 await read.seen.promise;
 await first.page.evaluate(()=>{void window.__h5Review.check({quiet:true});void window.__h5Review.check({quiet:true});});
 assert.equal(first.counts().gets,before+1);
 assert.deepEqual(await first.page.evaluate(()=>({busy:window.__h5ReviewState.busy,answers:window.__h5ReviewState.answers})),{busy:false,answers:{value:7}});
 read.release.resolve('abort');
 await first.page.waitForFunction(()=>!window.__h5ReviewState.verified&&!!window.__h5ReviewState.error);
 assert.equal(await first.page.evaluate(()=>window.__h5ReviewState.busy),false);
 await first.page.evaluate(()=>{void window.__h5Review.check({quiet:true});});
 await first.page.waitForFunction(()=>window.__h5ReviewState.verified&&!window.__h5ReviewState.error);
 assert.equal(first.counts().gets,before+2);
 assert.deepEqual(await first.page.evaluate(()=>window.__h5ReviewState.answers),{value:7});
 await first.page.screenshot({path:directory+'failure-lock-released.png'});
 checks.push('quiet_reentry_coalesces_and_network_failure_releases_reader_then_current_read_restores_permission_without_losing_dirty_answers');

 const second=await setup('submit-overlap'),old=second.hold();
 await second.page.evaluate(()=>window.__h5Review.setAnswers({value:9}));
 await second.page.evaluate(()=>{void window.__h5Review.check({quiet:true});});
 await old.seen.promise;
 assert.equal(await second.page.evaluate(()=>window.__h5ReviewState.busy),false);
 assert.equal(await second.page.evaluate(()=>window.__h5Review.send('submit')),true);
 await second.page.waitForFunction(()=>window.__h5ReviewState.status==='submitted'&&window.__h5ReviewState.verified&&!window.__h5ReviewState.busy);
 old.release.resolve('revoked');
 await second.page.waitForTimeout(150);
 assert.deepEqual(await second.page.evaluate(()=>({status:window.__h5ReviewState.status,answers:window.__h5ReviewState.answers,verified:window.__h5ReviewState.verified,error:window.__h5ReviewState.error,pending:window.__h5ReviewState.pending,notice:window.__h5ReviewState.notice})),{status:'submitted',answers:{value:9},verified:true,error:'',pending:null,notice:''});
 assert.equal(second.counts().submits,1);
 checks.push('explicit_submit_is_not_swallowed_by_quiet_read_and_old_403_cannot_clear_newer_acknowledged_state');

 const current=second.hold();
 await second.page.evaluate(()=>{void window.__h5Review.check({quiet:true});});
 await current.seen.promise;current.release.resolve('revoked');
 await second.page.waitForFunction(()=>window.__h5ReviewState.status===null&&!window.__h5ReviewState.verified);
 assert.deepEqual(await second.page.evaluate(()=>window.__h5ReviewState.answers),{});
 assert.equal(await second.page.evaluate(()=>window.__h5ReviewState.busy),false);
 checks.push('a_current_quiet_revocation_still_clears_sensitive_state');
 await second.page.screenshot({path:directory+'current-revocation-cleared.png'});
 assert.deepEqual(errors,[]);
 const result={passed:true,at:new Date().toISOString(),runId,checks,errors,actualHook:true,nativeBrowser:'Google Chrome',apiResponses:'intercepted synthetic substitutes only',backendBusinessRequests:0,originalInvitationAccessed:false,emailSent:false,runtimeModified:false};
 writeFileSync(directory+'result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,evidence:directory+'result.json'}));
}catch(error){
 writeFileSync(directory+'failure.json',JSON.stringify({passed:false,message:error.message,checks,errors},null,2));
 console.error(JSON.stringify({passed:false,message:error.message,evidence:directory+'failure.json'}));process.exitCode=1;
}finally{
 for(const context of contexts)await context.close();
 await browser.close();
}
