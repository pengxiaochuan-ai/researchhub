import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWF06BrowserArgs,nativeWF06BrowserExpectation,runWF06Browser,wf06BrowserVisits} from './study-workflow-wf06-browser.mjs';
import * as qa from './study-workflow-wf06-browser.mjs';
const env={STUDY_WORKFLOW_WF06_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit',STUDY_WORKFLOW_WF05_QA_WINDOW:'explicit'};
function summary(label){return{studyId:'study',visitId:wf06BrowserVisits[label],visit:{id:wf06BrowserVisits[label],protocolVersionId:'protocol',subject:{id:'subject',subjectId:'SYNTHETIC-QA-'+label},visitPlan:{id:'plan',code:'BASELINE'}},items:['PHQ','Fang','HAMD'].map((title,i)=>({assignmentId:'assignment-'+i,formVersionId:'form-'+i,title,action:null,response:{status:'submitted',locked:true,review:'review_approved',version:3,ref:{responseId:'response-'+i,assignmentId:'assignment-'+i,revisionNo:1,contentHash:'a'.repeat(64)},score:{}},capabilities:{canReview:false,canLock:false}}))};}
test('exact modes and all windows reject before final freeze/dependencies or target I/O',async()=>{
 assert.deepEqual(parseWF06BrowserArgs(['--local-synthetic','--flow','reviewer']),{mode:'flow',role:'reviewer'});
 assert.deepEqual(parseWF06BrowserArgs(['--local-synthetic','--visual','admin']),{mode:'visual',role:'admin'});
 for(const args of [['--local-synthetic','--visual','reviewer'],['--local-synthetic','--flow','admin','extra'],['--flow','admin']])assert.throws(()=>parseWF06BrowserArgs(args),/EXACT_WF06_BROWSER_COMMAND_REQUIRED/);
 await assert.rejects(runWF06Browser({env:{},args:['--local-synthetic','--flow','admin']}),/ROOT_WF06_IO_WINDOW_REQUIRED/);
 await assert.rejects(runWF06Browser({env:{STUDY_WORKFLOW_WF06_QA_WINDOW:'explicit'},args:['--local-synthetic','--flow','admin']}),/SHARED_HELPER_WINDOW_REQUIRED/);
 await assert.rejects(runWF06Browser({env:{...env,STUDY_WORKFLOW_WF05_QA_WINDOW:undefined},args:['--local-synthetic','--flow','admin']}),/ROOT_WF05_IO_WINDOW_REQUIRED/);
 await assert.rejects(runWF06Browser({env,args:['wrong']}),/EXACT_WF06_BROWSER_COMMAND_REQUIRED/);
});
test('CONCURRENT expectation moves only native third HAMD ahead of the original first two',()=>{
 const s=summary('CONCURRENT');s.items[2].response.score={processingStatus:'incomplete_data',scoreComplete:false,unresolvedItems:[{key:'special',status:'not_applicable'}]};Object.defineProperty(s.items[2].response.score,'total',{get(){throw Error('NO_CLINICAL_SCORE_READ');}});
 const e=nativeWF06BrowserExpectation('CONCURRENT',s,'study','protocol');assert.deepEqual(e.all,['assignment-2','assignment-0','assignment-1']);assert.deepEqual(e.attention,['assignment-2']);assert.deepEqual(e.eligible,[]);assert(!JSON.stringify(e).includes('total'));
});
test('SELF locked and approved is never an awaiting-independent positive despite the native reason flag',()=>{
 const s=summary('SELF');for(const i of s.items)i.capabilities.disableReasons={review:'FORM_INDEPENDENT_REVIEW_REQUIRED'};
 const e=nativeWF06BrowserExpectation('SELF',s,'study','protocol');assert.deepEqual(e.awaiting,[]);assert.deepEqual(e.eligible,[]);
 s.items[0].response.locked=false;assert.throws(()=>nativeWF06BrowserExpectation('SELF',s,'study','protocol'));
});
test('RECOVERY checkbox and responsibility expectations come from current native capabilities',()=>{
 const s=summary('RECOVERY');for(const i of s.items.slice(1)){i.response.locked=false;i.response.review=null;i.action='review_lock';i.capabilities.canReview=true;}
 assert.deepEqual(nativeWF06BrowserExpectation('RECOVERY',s,'study','protocol').eligible,['assignment-1','assignment-2']);
 for(const i of s.items.slice(1)){i.capabilities.canReview=false;i.capabilities.disableReasons={review:'FORM_INDEPENDENT_REVIEW_REQUIRED'};i.action=null;}
 const e=nativeWF06BrowserExpectation('RECOVERY',s,'study','protocol');assert.deepEqual(e.eligible,[]);assert.deepEqual(e.awaiting,['assignment-1','assignment-2']);
 assert.throws(()=>nativeWF06BrowserExpectation('RECOVERY',s,'other','protocol'));assert.throws(()=>nativeWF06BrowserExpectation('RECOVERY',s,'study','other'));
});
test('every displayed native answer and unit label is verified; absent special strings never count as observed',()=>{
 assert.equal(typeof qa.verifyWF06DisplayedAnswers,'function');const fields=[{key:'zero',label:'原零值',unit:'分'},{key:'no',label:'原否值'},{key:'na',label:'原不适用',options:[{value:'not_applicable',label:'不适用'}]},{key:'unknown',label:'原不确定'}],answers={zero:0,no:false,na:'not_applicable',unknown:'uncertain'},displayed=[{label:'原零值（分）',value:'0'},{label:'原否值',value:'否'},{label:'原不适用',value:'不适用'},{label:'原不确定',value:'uncertain'}];
 assert.deepEqual(qa.verifyWF06DisplayedAnswers(fields,answers,displayed),{verifiedAnswerCount:4,not_applicable:{observedCount:1,verifiedCount:1},uncertain:{observedCount:1,verifiedCount:1}});
 assert.deepEqual(qa.verifyWF06DisplayedAnswers(fields.slice(0,2),answers,displayed.slice(0,2)),{verifiedAnswerCount:2,not_applicable:{observedCount:0,verifiedCount:0},uncertain:{observedCount:0,verifiedCount:0}});
 for(const change of [x=>x.pop(),x=>x[0].label='原零值',x=>x[1].value='MUST_NOT_EMIT_PRIVATE_ANSWER']){const bad=structuredClone(displayed);change(bad);assert.throws(()=>qa.verifyWF06DisplayedAnswers(fields,answers,bad),error=>!error.message.includes('MUST_NOT_EMIT_PRIVATE_ANSWER'));}
});
test('console and assertion diagnostics classify without exposing raw body, query credentials or answers',()=>{
 assert.equal(typeof qa.wf06ConsoleDiagnostic,'function');assert.equal(typeof qa.wf06FailureDiagnostic,'function');
 const d=qa.wf06ConsoleDiagnostic('Failed to load resource: the server responded with a status of 401; MUST_NOT_EMIT_RAW_BODY',[{method:'GET',path:'/api/auth/me?token=MUST_NOT_EMIT_TOKEN',status:401,requestPhase:'business',observedPhase:'cleanup'}],'cleanup');
 assert.equal(d.category,'http-resource-load');assert.equal(d.httpStatus,401);assert.equal(d.relatedHttp[0].path,'/api/auth/me');assert.equal(d.relatedHttp[0].requestPhase,'business');assert(!JSON.stringify(d).includes('MUST_NOT_EMIT'));
 const e=Object.assign(Error('MUST_NOT_EMIT_RAW_ANSWER'),{name:'AssertionError',code:'ERR_ASSERTION'}),failure=qa.wf06FailureDiagnostic(e,'errors.length === 0');assert.equal(failure.assertionExpression,'errors.length === 0');assert(!JSON.stringify(failure).includes('MUST_NOT_EMIT'));
});
test('cleanup closes app pages before logout, still closes context and rejects logout failure',async()=>{
 assert.equal(typeof qa.closeWF06AppContext,'function');const order=[],settings={url:()=> 'chrome://settings/appearance',goto:async()=>order.push('settings'),locator:()=>({selectOption:async()=>order.push('zoom1')})},page={url:()=> 'http://127.0.0.1:19501/pages/s09/',close:async()=>order.push('page-close')};
 const context={pages:()=>[page,settings],request:{post:async()=>{order.push('logout');return{status:()=>200};}},close:async()=>order.push('context-close')};await qa.closeWF06AppContext(context,settings,[]);assert.deepEqual(order,['page-close','settings','zoom1','logout','context-close']);
 order.length=0;context.request.post=async()=>{order.push('logout');return{status:()=>401};};await assert.rejects(()=>qa.closeWF06AppContext(context,null,[]),/WF06_OWN_AUTH_LOGOUT_STATUS_200/);assert.deepEqual(order,['page-close','logout','context-close']);
});
test('the two unfocused filter buttons retain a distinct pressed background/color',()=>{
 assert.equal(typeof qa.verifyWF06FilterAppearance,'function');const buttons=[{label:'全部',pressed:'true',focused:false,backgroundColor:'rgb(100, 40, 180)',color:'rgb(255, 255, 255)'},{label:'需关注',pressed:'false',focused:false,backgroundColor:'rgb(255, 255, 255)',color:'rgb(60, 60, 60)'}];qa.verifyWF06FilterAppearance(buttons);
 const same=structuredClone(buttons);same[1].backgroundColor=same[0].backgroundColor;same[1].color=same[0].color;assert.throws(()=>qa.verifyWF06FilterAppearance(same),/PRESSED_FILTER_MUST_REMAIN_VISUALLY_DISTINCT_WITHOUT_FOCUS/);
 const focused=structuredClone(buttons);focused[0].focused=true;assert.throws(()=>qa.verifyWF06FilterAppearance(focused));const both=structuredClone(buttons);both[1].pressed='true';assert.throws(()=>qa.verifyWF06FilterAppearance(both));
});
