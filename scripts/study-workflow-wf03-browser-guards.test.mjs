// Offline adapters only: no real page, credentials, fixture, network or browser launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWF03UiLedger,installWF03NativeGate,prepareWF03Policy} from './study-workflow-wf03-browser.mjs';
import {bodyHash} from './study-workflow-wf03-qa.mjs';
import {wf03PolicySections} from './study-workflow-wf03-policy-recipe.mjs';
const windowEnv={STUDY_WORKFLOW_WF03_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
const c={code:'B',studyId:'study-B',protocolId:'protocol-B',role:'reviewer',actorId:'old-importer'},actor={accountId:'actual-admin',authVersion:0},revision='a'.repeat(64),policy={id:'policy-B',contentHash:'b'.repeat(64)};
const command=(action,key=action+'-key')=>({requestKey:key,expectedRevision:revision,...(action==='activate'?{migrateExisting:false}:{policyVersionId:policy.id,expectedPolicyHash:policy.contentHash})});
function proof(action,body){return{receipt:{proofVersion:1,id:'op-'+action,requestKey:body.requestKey,requestHash:bodyHash(body),authVersion:actor.authVersion,actorId:actor.accountId,studyId:c.studyId,action:'protocol.'+action,targetId:c.protocolId},protocol:{id:c.protocolId,revision,status:{check:'draft',submit:'pending_review',approve:'approved',activate:'executing'}[action]},policy:{...policy,status:['approve','activate'].includes(action)?'approved':'draft'},approvedPolicy:['approve','activate'].includes(action)?policy:null};}
function context(){return{handler:null,async route(_pattern,fn){this.handler=fn;},async unroute(_pattern,fn){assert.equal(this.handler,fn);this.handler=null;}};}
function route(action,{body=command(action),method='POST',path='/api/research-studies/'+c.studyId+'/protocols/'+c.protocolId+'/'+action,status=200,result=proof(action,body),trace=[]}={}){return{request:()=>({url:()=>('http://127.0.0.1:19501'+path),method:()=>method,postDataJSON:()=>body}),async continue(){trace.push('continue');},async fetch(){trace.push('fetch');return{status:()=>status,json:async()=>result};},async fulfill(){trace.push('fulfill');},async abort(reason){trace.push('abort:'+reason);}};}
async function setup(options={}){const ctx=context(),ledger=options.ledger??createWF03UiLedger(),gate=await installWF03NativeGate(ctx,{case:c,actor,expectedRevision:revision,policyTuple:policy,ledger,windowEnv,...options});return{ctx,ledger,gate};}
test('window guard runs before context access and policy DOM access',async()=>{
 let touched=0;await assert.rejects(()=>installWF03NativeGate({route(){touched++;}},{case:c,actor,expectedRevision:revision,ledger:createWF03UiLedger(),windowEnv:{}}),/ROOT_WF03/);
 await assert.rejects(()=>prepareWF03Policy({locator(){touched++;}},{recipe:wf03PolicySections('B'),windowEnv:{}}),/ROOT_WF03/);assert.equal(touched,0);
});
test('GET/auth never consume arms; only exact queued real native writes pass after durable metadata',async()=>{
 const order=[],ledger=createWF03UiLedger({persist:async snapshot=>{if(snapshot.attempts.length)order.push('journal');}}),{ctx,gate}=await setup({ledger});gate.arm(['check','submit']);
 const get=[];await ctx.handler(route('check',{method:'GET',trace:get}));assert.deepEqual(get,['continue']);
 const auth=[];await ctx.handler(route('check',{method:'POST',path:'/api/auth/session/extend',trace:auth}));assert.deepEqual(auth,['continue']);
 for(const action of ['check','submit'])await ctx.handler(route(action,{trace:order}));await gate.settle();
 assert(order.indexOf('journal')<order.indexOf('fetch'));assert.equal(ledger.snapshot().attempts.length,2);assert(ledger.snapshot().attempts.every(x=>x.accepted&&x.strictProofValidated&&!x.verified));
 assert.equal(ledger.snapshot().attempts[0].actorId,'actual-admin');assert.equal(ledger.snapshot().attempts[0].authVersion,0);assert.equal(gate.report.failures.length,0);await gate.close();
});
test('unarmed, out of order, wrong target, unpaired tuple and migration requests never forward',async()=>{
 for(const kind of ['unarmed','wrong-action','wrong-target','unpaired','migrate']){
  const {ctx,gate}=await setup();let action='check',body=command(action),path;
  if(kind!=='unarmed')gate.arm(kind==='migrate'?'activate':'check');if(kind==='wrong-action')action='submit';if(kind==='wrong-target')path='/api/research-studies/other/protocols/'+c.protocolId+'/check';if(kind==='unpaired')delete body.expectedPolicyHash;if(kind==='migrate'){action='activate';body=command(action);body.migrateExisting=true;}
  const trace=[];await ctx.handler(route(action,{body,path,trace}));assert(!trace.includes('fetch'));assert(trace.some(x=>x.startsWith('abort:')));await gate.close();
 }
});
test('real accepted response loss is not verified, survives restore, and cannot replay',async()=>{
 const {ctx,ledger,gate}=await setup();gate.arm('approve',{dropResponse:true});const trace=[];await ctx.handler(route('approve',{trace}));await gate.settle();assert(trace.includes('fetch'));assert(trace.includes('abort:failed'));
 const [entry]=ledger.snapshot().attempts;assert(entry.accepted&&entry.responseDiscarded&&entry.everUnknown&&!entry.verified);assert.equal(entry.nativeStatus,200);
 const restored=createWF03UiLedger({initial:ledger.snapshot()}),other=await setup({ledger:restored});assert.throws(()=>other.gate.arm('approve'),/SUCCESSFUL_NATIVE_STEP/);await restored.markVerified(entry.sequence,{via:'receipt',result:proof('approve',command('approve'))});assert(restored.snapshot().attempts[0].verified);await gate.close();await other.gate.close();
});
test('before-native failure has no nativeStatus and permits only explicit exact original-key retry',async()=>{
 const {ctx,ledger,gate}=await setup();gate.arm('activate',{interceptBeforeNative:true});const trace=[];await ctx.handler(route('activate',{trace}));await gate.settle();assert(!trace.includes('fetch'));let [first]=ledger.snapshot().attempts;assert.equal(first.nativeStatus,undefined);assert.equal(first.operationId,undefined);assert.equal(first.transmission,'intercepted-before-native');
 gate.arm('activate',{retry:true,dropResponse:true});await ctx.handler(route('activate'));await gate.settle();const [a,b]=ledger.snapshot().attempts;assert.equal(a.requestKey,b.requestKey);assert.equal(a.requestHash,b.requestHash);assert(b.accepted&&!b.verified);await gate.close();
 for(const patch of [{requestKey:'new-key'},{migrateExisting:true}]){const setup2=await setup({ledger:createWF03UiLedger({initial:{...ledger.snapshot(),attempts:[first]}})});setup2.gate.arm('activate',{retry:true});const t=[];await setup2.ctx.handler(route('activate',{body:{...command('activate'),...patch},trace:t}));assert(!t.includes('fetch'));await setup2.gate.close();}
});
test('native200 is preserved even when strict proof validation fails; policy weak200 waits for DB',async()=>{
 const s=await setup();s.gate.arm('approve');await s.ctx.handler(route('approve',{result:{}}));assert(s.ledger.snapshot().attempts[0].accepted);assert.throws(()=>s.gate.arm('approve'),/SUCCESSFUL_NATIVE_STEP/);await s.gate.close();
 const recipe=wf03PolicySections('B'),p=await setup({recipe});p.gate.arm('policy');await p.ctx.handler(route('policy',{method:'PUT',body:{requestKey:'policy-key',expectedPolicyId:null,sections:recipe},result:{receipt:{id:'old-weak'}}}));await p.gate.settle();const [entry]=p.ledger.snapshot().attempts;assert(entry.accepted&&!entry.strictProofValidated&&!entry.verified);assert(entry.databaseVerificationPending);assert(!JSON.stringify(entry).includes(recipe.ethics.reason));await p.ledger.markVerified(entry.sequence,{via:'database'});assert(p.ledger.snapshot().attempts[0].verified);await p.gate.close();
});
test('restored successful operations retain all five frozen class limits',async()=>{
 const ledger=createWF03UiLedger();for(const code of ['A','B','D'])for(const action of ['policy','check','submit','approve','activate']){const sequence=await ledger.beforeRequest({code,action,actorId:actor.accountId,authVersion:0,studyId:'study-'+code,protocolId:'protocol-'+code,expectedRevision:revision,requestKey:code+'-'+action,requestHash:bodyHash({code,action}),...(action==='policy'?{recipeHash:revision,expectedPolicyId:null}:action==='activate'?{migrateExisting:false,policyVersionId:policy.id,policyHash:policy.contentHash}:{policyVersionId:policy.id,policyHash:policy.contentHash})});await ledger.nativeResponse(sequence,200);}
 const restored=createWF03UiLedger({initial:ledger.snapshot()});assert.deepEqual(restored.counts(),{policy:3,check:3,submit:3,approve:3,activate:3,total:15});await assert.rejects(()=>restored.beforeRequest({code:'A',action:'policy',actorId:actor.accountId,authVersion:0,studyId:'extra',protocolId:'extra',expectedRevision:revision,requestKey:'extra',requestHash:revision,recipeHash:revision,expectedPolicyId:null}),/BUDGET/);
});
test('policy helper validates full explicit recipe before touching DOM and performs no save',async()=>{
 let touched=0;const recipe=wf03PolicySections('B');delete recipe.safety;await assert.rejects(()=>prepareWF03Policy({locator(){touched++;}},{recipe,windowEnv}));assert.equal(touched,0);
 const values=new Map(),actions=[],details={open:false,async evaluate(){return this.open;},locator(){return{click:async()=>{details.open=true;actions.push('open');}};}};
 const panel={getByLabel(label){return{locator:()=>details,async selectOption(value){values.set(label,value);actions.push('select');},async fill(value){values.set(label,value);actions.push('fill');},async inputValue(){return values.get(label);}};}};
 const result=await prepareWF03Policy({locator(selector){assert.equal(selector,'.ep-policy');return panel;}},{recipe:wf03PolicySections('B'),windowEnv});assert.equal(result.recipeHash,bodyHash(wf03PolicySections('B')));assert.equal(values.get('采集更正与审阅独立审核要求'),'required');assert.equal(values.get('伦理依据状态'),'not_applicable');assert(actions.every(x=>['open','select','fill'].includes(x)));
});
test('restore rejects native200 reset, simulated status, sensitive fields and duplicate native success',async()=>{
 const s=await setup();s.gate.arm('approve');await s.ctx.handler(route('approve'));await s.gate.settle();const initial=s.ledger.snapshot();
 for(const mutate of [x=>x.attempts[0].accepted=false,x=>x.attempts[0].transmission='intercepted-before-native',x=>x.attempts[0].cookie='secret',x=>x.attempts.push({...x.attempts[0],sequence:2,code:'A'})]){const changed=structuredClone(initial);mutate(changed);assert.throws(()=>createWF03UiLedger({initial:changed}));}await s.gate.close();
});
test('unknown original remains unknown after same-key 4xx; receipt needs exact actual actor and hash',async()=>{
 const s=await setup();s.gate.arm('activate',{interceptBeforeNative:true});await s.ctx.handler(route('activate'));await s.gate.settle();s.gate.arm('activate',{retry:true,expectedStatus:409});await s.ctx.handler(route('activate',{status:409,result:{}}));await s.gate.settle();let entry=s.ledger.snapshot().attempts[1];assert(entry.everUnknown&&!entry.accepted);assert.equal(entry.nativeStatus,409);
 const result=proof('activate',command('activate'));result.receipt.actorId='old-importer';await assert.rejects(()=>s.ledger.markVerified(entry.sequence,{via:'receipt',result}),/BINDING/);assert.equal(s.ledger.snapshot().attempts[1].verified,false);await s.gate.close();
});
test('journal persistence failure aborts before forward and automatic redirect/retry is disabled',async()=>{
 const s=await setup({ledger:createWF03UiLedger({persist:async()=>{throw Error('secret text must stay out');}})});s.gate.arm('check');const trace=[];await s.ctx.handler(route('check',{trace}));assert(!trace.includes('fetch'));assert(!JSON.stringify(s.gate.report).includes('secret text'));await s.gate.close();
 const ok=await setup();ok.gate.arm('check');const r=route('check'),old=r.fetch;r.fetch=async options=>{assert.deepEqual(options,{maxRedirects:0,maxRetries:0});return old();};await ok.ctx.handler(r);await ok.gate.settle();await ok.gate.close();
});
test('crash after durable forwarded intent and before status requires exact explicit retry on restore and live ledger',async()=>{
 const metadata={code:'B',action:'approve',actorId:actor.accountId,authVersion:0,studyId:c.studyId,protocolId:c.protocolId,expectedRevision:revision,requestKey:'original',requestHash:revision,policyVersionId:policy.id,policyHash:policy.contentHash};
 const ledger=createWF03UiLedger();await ledger.beforeRequest(metadata);const restored=createWF03UiLedger({initial:ledger.snapshot()});assert.equal(restored.snapshot().attempts[0].everUnknown,true);
 for(const candidate of [ledger,restored]){await assert.rejects(()=>candidate.beforeRequest({...metadata,requestKey:'replacement',requestHash:policy.contentHash}),/EXPLICIT_ORIGINAL_KEY_RETRY/);await assert.rejects(()=>candidate.beforeRequest({...metadata,requestKey:'replacement'},{retry:true}),/ORIGINAL_KEY_HASH/);await candidate.beforeRequest(metadata,{retry:true});assert.equal(candidate.snapshot().attempts.length,2);assert(candidate.snapshot().attempts[1].everUnknown);}
});
