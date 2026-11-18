import test from 'node:test';
import assert from 'node:assert/strict';
import {requireQAWindow,makeVisitPlans,makePolicySections,syntheticAnswers,sourceProfiles,localMailerTarget,validateFixture,browserSessionCookie,loginBrowserContext,base} from './visit-workflow-qa.mjs';
import {compareProtection} from './visit-workflow-preserve.mjs';
import {assertAtomicProof} from './visit-workflow-atomic-proof.mjs';
test('all live QA requires explicit local synthetic window before fixture or network use',()=>{
 for(const args of [[],['--prepare'],['--local-synthetic','--prepare','extra']])assert.throws(()=>requireQAWindow(args,{}));
 assert.throws(()=>requireQAWindow(['--local-synthetic','--prepare'],{}));
 assert.equal(requireQAWindow(['--local-synthetic','--prepare'],{VISIT_WORKFLOW_QA_WINDOW:'explicit'}),'prepare');
});
test('three fixed original forms retain site-only baseline and explicit dual-mode channel visit',()=>{
 const refs={phq:'p',fang:'f',hamd:'h',legacy:'l'},plans=makeVisitPlans(refs,sourceProfiles());
 assert.deepEqual(plans.map(p=>p.code),['BASELINE','CHANNEL']);
 assert.equal(plans[0].requirements.filter(r=>r.required).length,3);
 assert.deepEqual(plans[0].requirements.slice(0,3).map(r=>r.config.allowedCaptureModes),[['researcher'],['researcher'],['researcher']]);
 assert(plans[0].requirements.some(r=>r.required===false&&r.config.formVersionId==='l'));
 assert.deepEqual(plans[1].requirements.find(r=>r.code==='PHQ').config.allowedCaptureModes,['researcher','patient_h5']);
 assert(plans[1].requirements.some(r=>r.kind==='modality_file'&&r.required&&r.config.modality==='tongue'));
});
test('software policy requires genuine independent review and retains consent/version scope',()=>{
 const s=makePolicySections();assert.equal(s.captureReview.rules.reviewIndependence,'required');assert.equal(s.site.mode,'study_wide');
 assert(s.screening.rules.decisionMethod==='manual');assert(s.researchConsent.rules.textVersion.includes('synthetic'));assert.equal(s.dataUse.rules.scope,'synthetic-visit-workflow-only');
});
test('deterministic synthetic vectors preserve source field keys, zero, HAMD9 and Fang missing total branch',()=>{
 const p=sourceProfiles(),a=syntheticAnswers(p);assert.equal(a.phq.phq9_q1,0);assert.equal(a.hamd9.hamd17_q14,9);
 assert(a.fangConflict.pulse_wiry==='present'&&a.fangConflict.pulse_deep_wiry==='present');assert(a.fangNA.secondary_irregular_menses==='not_applicable');
 for(const name of ['phq','fang','hamd'])assert.deepEqual(Object.keys(a[name]).sort(),p[name].schema.fields.map(f=>f.key).sort());
 assert.deepEqual(a.legacy,{value:0,completed:false});
});
test('loopback invitation target rejects a foreign study, recipient, port or malformed URL',()=>{
 const f={runId:'rh-visit-qa-12345678',study:{id:'rh-study-123'}},m={studyId:f.study.id,address:f.runId+'-h5@example.test',invitationUrl:'http://127.0.0.1:19501/h5/questionnaire/privateToken'};
 assert.equal(localMailerTarget(f,m),true);for(const change of [{address:'jerry_shi@live.cn'},{studyId:'other'},{invitationUrl:'https://remote.example/h5/questionnaire/t'},{invitationUrl:'http://127.0.0.1:19502/h5/questionnaire/t'}])assert.throws(()=>localMailerTarget(f,{...m,...change}));
});
test('fixture guard only accepts dedicated new scope and refuses the historical full study',()=>{
 const f={syntheticOnly:true,purpose:'visit-capture-review-flow-2026-11-16',runId:'rh-visit-qa-12345678',study:{id:'rh-study-new'},scope:{tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-visit-qa-12345678-group',researchProjectId:'new-project'}};
 assert.equal(validateFixture(f),true);assert.throws(()=>validateFixture({...f,study:{id:'rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25'}}));assert.throws(()=>validateFixture({...f,scope:{...f.scope,studyGroupId:'old-group'}}));
});
test('whole protected rows, revisions, snapshots and original Word cannot drift while counts stay the same',()=>{
 const b={scope:{tenantId:'t'},studyId:'s',nativeRuns:Array.from({length:316},(_,id)=>({id,status:'done'})),nativeAudits:[{id:'a'}],revisions:Array.from({length:48},(_,id)=>({id})),childSnapshots:Array.from({length:39},(_,id)=>({id})),scientificFiles:{a:'sha'},word:{sha256:'word'}};
 assert.equal(compareProtection(b,structuredClone(b)),true);for(const key of ['nativeRuns','nativeAudits','revisions','childSnapshots']){const c=structuredClone(b);c[key][0].id='changed';assert.throws(()=>compareProtection(b,c));}const c=structuredClone(b);c.word.sha256='other';assert.throws(()=>compareProtection(b,c));
});
test('exported runner calls cannot bypass the root I/O window by importing the module',async()=>{
 const old=process.env.VISIT_WORKFLOW_QA_WINDOW;delete process.env.VISIT_WORKFLOW_QA_WINDOW;
 try{
  for(const[file,name]of [['./visit-workflow-fixture.mjs','prepareFixture'],['./visit-workflow-api.mjs','runAPI'],['./visit-workflow-h5.mjs','runH5'],['./visit-workflow-recovery-browser.mjs','runRecoveryBrowser'],['./visit-workflow-main-browser.mjs','runMainBrowser'],['./visit-workflow-rejection-browser.mjs','runRejectionBrowser'],['./visit-workflow-h5-review-browser.mjs','runH5ReviewBrowser'],['./visit-workflow-correction-browser.mjs','runCorrectionBrowser'],['./visit-workflow-start-browser.mjs','runStartBrowser'],['./visit-workflow-visual-browser.mjs','runVisualBrowser'],['./visit-workflow-atomic-proof.mjs','runAtomicProof'],['./visit-workflow-preserve.mjs','readProtection']]){
   const module=await import(file);await assert.rejects(module[name](),/ROOT_IO_WINDOW_REQUIRED/);
  }
 }finally{if(old===undefined)delete process.env.VISIT_WORKFLOW_QA_WINDOW;else process.env.VISIT_WORKFLOW_QA_WINDOW=old;}
});
test('atomic proof requires same native/FINISH xmin and separate claim/operation transaction',()=>{
 const ref={responseId:'r',assignmentId:'a',revisionNo:1,contentHash:'h'},common={assignmentId:'a',expectedRef:ref,nativeKeys:{review:'review-key',lock:'lock-key'},requestDigest:'d',expectedStateHash:'s'},audits=[{id:'claim',action:'researchhub.visit.review.claim',target:'batch',accountId:'actor',txid:'100',meta:{...common,requestKey:'key'}},{id:'finish',action:'researchhub.visit.review.finished',target:'batch',accountId:'actor',txid:'101',meta:{...common,status:'completed',claimId:'claim',memberAction:'review_lock'}},{id:'review',action:'formal_response_review_approved',target:'r',accountId:'actor',txid:'101',meta:{assignmentId:'a',requestKey:'review-key',ref}},{id:'lock',action:'formal_response_lock',target:'r',accountId:'actor',txid:'101',meta:{assignmentId:'a',requestKey:'lock-key',ref}}],operations=[{id:'op',audit_id:'claim',request_key:'key',request_hash:'d',action:'visit.review.batch.advance',target_id:'batch',actor_id:'actor',txid:'100',result:{studyId:'study',claimId:'claim',batchId:'batch',assignmentId:'a'}}];
 assert.equal(assertAtomicProof(audits,operations,'study').length,1);for(const index of [0,2,3]){const changed=structuredClone(audits);changed[index].txid='1010';assert.throws(()=>assertAtomicProof(changed,operations,'study'));}const changed=structuredClone(operations);changed[0].txid='102';assert.throws(()=>assertAtomicProof(audits,changed,'study'));assert.throws(()=>assertAtomicProof(audits.filter(a=>a.id!=='lock'),operations,'study'));
});
test('browser session follows native /api cookie path and gets an independent normal login',async()=>{
 assert.equal(browserSessionCookie('test_cookie=private-test-value').path,'/api');assert.equal(browserSessionCookie('test_cookie=private-test-value').domain,'127.0.0.1');const old=process.env.VISIT_WORKFLOW_QA_WINDOW;process.env.VISIT_WORKFLOW_QA_WINDOW='explicit';const calls=[],context={request:{post:async(url,options)=>{calls.push({url,options});return{status:()=>201,json:async()=>({user:{accountId:'new-test-actor'}}),headers:()=>({'set-cookie':'test_cookie=new-independent-token; Path=/api; HttpOnly'})};}},cookies:async()=>[{name:'test_cookie',path:'/api',domain:'127.0.0.1',expires:123,httpOnly:true,sameSite:'Lax',secure:false,value:'new-independent-token'}]};
 try{const result=await loginBrowserContext(context,{tenantSlug:'synthetic',username:'test',password:'private-fake',expectedActorId:'new-test-actor'});assert.equal(calls[0].url,base+'/api/auth/login');assert.equal(result.cookieMetadata.length,1);assert(!JSON.stringify(result).includes('new-independent-token'));assert(!JSON.stringify(result).includes('private-fake'));context.cookies=async()=>[{name:'test_cookie',path:'/',value:'wrong-path'}];await assert.rejects(loginBrowserContext(context,{tenantSlug:'synthetic',username:'test',password:'private-fake',expectedActorId:'new-test-actor'}),/BROWSER_SESSION_COOKIE_PATH_MUST_MATCH_NATIVE/);}finally{if(old===undefined)delete process.env.VISIT_WORKFLOW_QA_WINDOW;else process.env.VISIT_WORKFLOW_QA_WINDOW=old;}
});
