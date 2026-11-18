// Pure root-injected QA adapters. No launch, login, fixture, filesystem or import-time I/O.
import assert from 'node:assert/strict';
import {requireWF03Window,atomicEvidence,bodyHash} from './study-workflow-wf03-qa.mjs';
import {assertWF03NativeProof} from './study-workflow-wf03-pg.mjs';
import {POLICY_SECTIONS,policySectionsForSave} from '../src/execution-policy-session.js';

const actions=['policy','check','submit','approve','activate'];
const id=v=>assert(typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v),'OPAQUE_ID_REQUIRED');
const digest=v=>assert.match(v??'',/^[a-f0-9]{64}$/,'OPAQUE_DIGEST_REQUIRED');
const clone=v=>structuredClone(v);
const bindingKeys=['code','action','actorId','authVersion','studyId','protocolId','expectedRevision','requestKey','requestHash','policyVersionId','policyHash','migrateExisting','recipeHash','expectedPolicyId'];
const stateKeys=['sequence','transmission','nativeStatus','accepted','strictProofValidated','operationId','databaseVerificationPending','responseDiscarded','everUnknown','verified','verifiedVia'];
function validateEntry(e){
 assert(Object.keys(e).every(k=>[...bindingKeys,...stateKeys].includes(k)),'OPAQUE_LEDGER_METADATA_ONLY');assert(['A','B','D'].includes(e.code));assert(actions.includes(e.action));
 for(const k of ['actorId','studyId','protocolId','requestKey'])id(e[k]);for(const k of ['expectedRevision','requestHash'])digest(e[k]);assert(Number.isInteger(e.authVersion)&&e.authVersion>=0,'AUTH_VERSION_ZERO_IS_VALID');
 if(e.action==='policy'){digest(e.recipeHash);assert(e.expectedPolicyId===null||typeof e.expectedPolicyId==='string');if(e.expectedPolicyId!==null)id(e.expectedPolicyId);}else{id(e.policyVersionId);digest(e.policyHash);}
 if(e.action==='activate')assert.equal(e.migrateExisting,false,'NO_HISTORICAL_MIGRATION');
 if(e.sequence!==undefined){assert(Number.isSafeInteger(e.sequence)&&e.sequence>0);assert(['forwarded','intercepted-before-native'].includes(e.transmission));for(const k of ['accepted','strictProofValidated','everUnknown','verified'])assert.equal(typeof e[k],'boolean');
  if(e.nativeStatus!==undefined)assert(Number.isInteger(e.nativeStatus)&&e.nativeStatus>=100&&e.nativeStatus<=599);
  if(e.transmission==='intercepted-before-native'){assert.equal(e.nativeStatus,undefined,'SIMULATION_HAS_NO_NATIVE_STATUS');assert.equal(e.operationId,undefined);assert.equal(e.accepted,false);}
  if(e.nativeStatus===200)assert(e.accepted,'NATIVE_200_MUST_RETAIN_ACCEPTED_ON_RESTORE');if(e.accepted)assert(e.nativeStatus===200||e.verifiedVia==='receipt','ACCEPTED_NEEDS_NATIVE_OR_STRICT_RECEIPT');
  if(e.strictProofValidated){assert(e.accepted);id(e.operationId);assert.notEqual(e.action,'policy','POLICY_LEGACY_IS_NOT_STRICT_PROOF');}
  if(e.verified){assert(e.accepted);assert(['ui','receipt','database'].includes(e.verifiedVia));if(e.action==='policy')assert.equal(e.verifiedVia,'database');else assert(e.strictProofValidated);}
  if(e.responseDiscarded)assert.equal(e.nativeStatus,200,'DISCARD_ONLY_ACTUAL_NATIVE_200');
 }
}
const scope=e=>[e.studyId,e.protocolId,e.action].join(':');
// A crash can happen after the durable intent and before the native status is durable.
// Absence of a response is never evidence that the forwarded original did not execute.
const unresolved=e=>!!e&&(e.everUnknown||e.transmission==='forwarded'&&e.nativeStatus===undefined);
function requestBody(e){return{requestKey:e.requestKey,expectedRevision:e.expectedRevision,...(e.action==='activate'?{migrateExisting:false}:{policyVersionId:e.policyVersionId,expectedPolicyHash:e.policyHash})};}

export function createWF03UiLedger({initial,persist=async()=>{}}={}){
 assert.equal(typeof persist,'function');const state=initial?clone(initial):{schema:1,attempts:[]};assert.deepEqual(Object.keys(state).sort(),['attempts','schema']);assert.equal(state.schema,1);assert(Array.isArray(state.attempts));
 const counts=()=>{const result=Object.fromEntries(actions.map(k=>[k,0])),seen=new Set();for(const e of state.attempts){validateEntry(e);if(e.accepted){assert(!seen.has(scope(e)),'SUCCESSFUL_NATIVE_STEP_MUST_NOT_REPLAY');seen.add(scope(e));result[e.action]++;assert(result[e.action]<=3,'WF03_PER_CLASS_BUDGET_EXCEEDED');}}return{...result,total:Object.values(result).reduce((a,b)=>a+b,0)};};
 state.attempts.forEach((e,i)=>{assert.equal(e.sequence,i+1,'STABLE_LEDGER_SEQUENCE_REQUIRED');validateEntry(e);if(unresolved(e))e.everUnknown=true;});assert(counts().total<=15,'WF03_FIFTEEN_OPERATION_BUDGET');
 const snapshot=()=>clone(state),flush=()=>persist(snapshot()),entry=n=>{const e=state.attempts[n-1];assert(e&&e.sequence===n,'KNOWN_ATTEMPT_REQUIRED');return e;};
 const canArm=(c,action)=>{assert(actions.includes(action));assert(!state.attempts.some(e=>e.studyId===c.studyId&&e.protocolId===c.protocolId&&e.action===action&&e.accepted),'SUCCESSFUL_NATIVE_STEP_MUST_NOT_REPLAY');assert(counts()[action]<3,'WF03_PER_CLASS_BUDGET_EXCEEDED');};
 return{snapshot,counts,canArm,get:n=>clone(entry(n)),
  async beforeRequest(metadata,{retry=false,interceptBeforeNative=false}={}){
   validateEntry(metadata);canArm(metadata,metadata.action);const prior=state.attempts.filter(e=>scope(e)===scope(metadata)).at(-1);
   if(retry||unresolved(prior)){assert(retry&&prior,'EXPLICIT_ORIGINAL_KEY_RETRY_REQUIRED');for(const k of bindingKeys)assert.equal(metadata[k],prior[k],'ORIGINAL_KEY_HASH_ACTOR_AND_TUPLE_REQUIRED');}
   const e={...clone(metadata),sequence:state.attempts.length+1,transmission:interceptBeforeNative?'intercepted-before-native':'forwarded',accepted:false,strictProofValidated:false,everUnknown:unresolved(prior)||interceptBeforeNative,verified:false};
   state.attempts.push(e);await flush();return e.sequence;
  },
  async nativeResponse(n,status){const e=entry(n);assert.equal(e.transmission,'forwarded');assert(Number.isInteger(status)&&status>=100&&status<=599);e.nativeStatus=status;e.accepted=status===200;if(e.action==='policy'&&e.accepted)e.databaseVerificationPending=true;if(status>=500)e.everUnknown=true;counts();await flush();},
  async nativeProof(n,proof){const e=entry(n);assert(e.accepted);assert.equal(proof.requestKey,e.requestKey);assert.equal(proof.requestHash,e.requestHash);id(proof.operationId);e.operationId=proof.operationId;e.strictProofValidated=true;await flush();},
  async unknown(n,{responseDiscarded=false}={}){const e=entry(n);e.everUnknown=true;if(responseDiscarded){assert.equal(e.nativeStatus,200);e.responseDiscarded=true;}await flush();},
  async markVerified(n,{via,result}={}){
   const e=entry(n);if(e.action==='policy'){assert.equal(via,'database','POLICY_NEEDS_ROOT_DB_VERIFICATION');assert(e.accepted);e.databaseVerificationPending=false;}
   else if(via==='receipt'){const proof=assertWF03NativeProof(e.action,requestBody(e),result,{principal:{accountId:e.actorId,authVersion:e.authVersion},studyId:e.studyId,protocolId:e.protocolId,policy:{id:e.policyVersionId,contentHash:e.policyHash}});e.accepted=true;e.strictProofValidated=true;e.operationId=proof.operationId;}
   else{assert.equal(via,'ui');assert(e.accepted&&e.strictProofValidated,'UI_VERIFICATION_REQUIRES_STRICT_NATIVE_PROOF');}
   e.verified=true;e.verifiedVia=via;counts();validateEntry(e);await flush();return clone(e);
  }
 };
}

function validateRecipe(recipe){
 assert.deepEqual(Object.keys(recipe??{}).sort(),POLICY_SECTIONS.map(x=>x.key).sort(),'ALL_POLICY_SECTIONS_MUST_BE_EXPLICIT');assert.deepEqual(policySectionsForSave(recipe),recipe,'NO_POLICY_DEFAULTS_OR_EXTRA_FIELDS');
 for(const {key,fields}of POLICY_SECTIONS){const s=recipe[key];assert(['configured','not_applicable'].includes(s.status),'NO_IMPLICIT_NA_OR_MISSING_POLICY');assert(s.source.trim()&&s.reason.trim(),'EXPLICIT_SOURCE_AND_REASON_REQUIRED');assert.deepEqual(Object.keys(s.rules).sort(),fields.map(x=>x[0]).sort());
  for(const [field]of fields){assert.equal(typeof s.rules[field],'string');if(s.status==='configured')assert(s.rules[field].trim(),'EXPLICIT_CONFIGURED_RULE_REQUIRED');}
  if(key==='site'&&s.status==='configured')assert.equal(s.mode,'study_wide');if(key==='captureReview'&&s.status==='configured')assert(['required','not_required'].includes(s.rules.reviewIndependence),'EXPLICIT_INDEPENDENCE_REQUIRED');
 }return recipe;
}

export async function installWF03NativeGate(context,{case:c,actor,expectedRevision,policyTuple,recipe,expectedPolicyId=null,ledger,windowEnv=process.env,origin='http://127.0.0.1:19501'}){
 requireWF03Window(windowEnv);assert(['A','B','D'].includes(c?.code));for(const k of ['studyId','protocolId'])id(c[k]);id(actor?.accountId);assert(Number.isInteger(actor.authVersion)&&actor.authVersion>=0);digest(expectedRevision);assert(ledger&&typeof ledger.beforeRequest==='function');
 if(policyTuple){id(policyTuple.id);digest(policyTuple.contentHash);}if(recipe)validateRecipe(recipe);if(expectedPolicyId!==null)id(expectedPolicyId);
 const report={schema:1,code:c.code,actorId:actor.accountId,authVersion:actor.authVersion,requests:[],blocked:[],failures:[]},tasks=new Set(),pattern='**/api/**';let queue=[];
 const base='/api/research-studies/'+c.studyId+'/protocols/'+c.protocolId+'/';
 const handler=route=>{let sequence,record;const operation=(async()=>{
  const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;assert.equal(url.origin,origin,'UNREGISTERED_TARGET_ORIGIN');
  if(['GET','HEAD','OPTIONS'].includes(method)||path.startsWith('/api/auth/'))return route.continue();
  const current=queue[0],action=path.startsWith(base)?path.slice(base.length):null;
  if(!current||action!==current.action||url.search||method!==(action==='policy'?'PUT':'POST')){report.blocked.push({method,path,reason:'not-armed-exact-native-action'});return route.abort('blockedbyclient');}
  const body=req.postDataJSON();let metadata;
  if(action==='policy'){
   assert(recipe,'EXPLICIT_POLICY_RECIPE_REQUIRED');assert.deepEqual(Object.keys(body).sort(),['expectedPolicyId','requestKey','sections']);id(body.requestKey);assert.equal(body.expectedPolicyId,expectedPolicyId);assert.deepEqual(body.sections,recipe,'UI_POLICY_MUST_MATCH_EXPLICIT_RECIPE');
   metadata={code:c.code,action,actorId:actor.accountId,authVersion:actor.authVersion,studyId:c.studyId,protocolId:c.protocolId,expectedRevision,requestKey:body.requestKey,requestHash:bodyHash(body),recipeHash:bodyHash(recipe),expectedPolicyId};
  }else{
   assert(policyTuple,'FROZEN_POLICY_TUPLE_REQUIRED');const evidence=atomicEvidence(action,body,{actorId:actor.accountId,authVersion:actor.authVersion,studyId:c.studyId,protocolId:c.protocolId});assert.equal(body.expectedRevision,expectedRevision,'FROZEN_PROTOCOL_REVISION_REQUIRED');
   if(action!=='activate'){assert.equal(body.policyVersionId,policyTuple.id);assert.equal(body.expectedPolicyHash,policyTuple.contentHash);}
   const {evidenceMode,...opaque}=evidence;metadata={code:c.code,...opaque,policyVersionId:policyTuple.id,policyHash:policyTuple.contentHash};
  }
  sequence=await ledger.beforeRequest(metadata,current);record=ledger.get(sequence);report.requests.push(record);queue.shift();
  if(current.interceptBeforeNative)return route.abort('failed');
  const response=await route.fetch({maxRedirects:0,maxRetries:0});await ledger.nativeResponse(sequence,response.status());Object.assign(record,ledger.get(sequence));
  if(response.status()===200&&action!=='policy'){const proof=assertWF03NativeProof(action,body,await response.json(),{principal:actor,studyId:c.studyId,protocolId:c.protocolId,policy:policyTuple});await ledger.nativeProof(sequence,proof);Object.assign(record,ledger.get(sequence));}
  assert.equal(response.status(),current.expectedStatus,'UNEXPECTED_NATIVE_STATUS_RECONCILE_OR_RECORD_REJECTION');
  if(current.dropResponse){await ledger.unknown(sequence,{responseDiscarded:true});Object.assign(record,ledger.get(sequence));return route.abort('failed');}
  return route.fulfill({response});
 })();const task=operation.catch(async error=>{
  if(sequence){await ledger.unknown(sequence).catch(()=>{});if(record)Object.assign(record,ledger.get(sequence));}
  // Playwright messages, bodies, headers, stack and auth data must not enter evidence.
  report.failures.push({name:/^[A-Za-z][A-Za-z0-9]{0,80}$/.test(error?.name??'')?error.name:'Error'});await route.abort('failed').catch(()=>{});
 }).finally(()=>tasks.delete(task));tasks.add(task);return task;};
 await context.route(pattern,handler);
 return{report,
  arm(input,{dropResponse=false,interceptBeforeNative=false,retry=false,expectedStatus=200}={}){
   assert.equal(queue.length,0,'PREVIOUS_ARM_QUEUE_MUST_BE_CONSUMED');assert.equal(tasks.size,0,'WAIT_FOR_NATIVE_ROUTE_BEFORE_ARM');const requested=Array.isArray(input)?input:[input];assert(requested.length>=1&&requested.length<=2);
   if(requested.length===2)assert(['check,submit','approve,activate'].includes(requested.join(',')),'ONLY_NATIVE_ORDERED_PAIRS');if(dropResponse||interceptBeforeNative||retry)assert.equal(requested.length,1,'RECOVERY_ARMS_ONE_ACTION_ONLY');assert(!(dropResponse&&interceptBeforeNative));
   assert(expectedStatus===200||expectedStatus>=400&&expectedStatus<500);if(dropResponse||interceptBeforeNative)assert.equal(expectedStatus,200);for(const action of requested){ledger.canArm(c,action);if(action==='policy')assert(recipe,'EXPLICIT_POLICY_RECIPE_REQUIRED');else assert(policyTuple,'FROZEN_POLICY_TUPLE_REQUIRED');}
   queue=requested.map(action=>({action,dropResponse,interceptBeforeNative,retry,expectedStatus}));
  },
  disarm(){assert.equal(tasks.size,0,'WAIT_FOR_NATIVE_ROUTE_BEFORE_DISARM');queue=[];},
  async settle({requireConsumed=true}={}){await Promise.allSettled([...tasks]);assert.equal(report.failures.length,0,'WF03_NATIVE_GATE_FAILED_CHECK_ORIGINAL_KEY_ONLY');if(requireConsumed)assert.equal(queue.length,0,'EXPECTED_NATIVE_QUEUE_NOT_CONSUMED');},
  async close(){await Promise.allSettled([...tasks]);await context.unroute(pattern,handler);queue=[];}
 };
}

export async function prepareWF03Policy(page,{recipe,windowEnv=process.env}){
 requireWF03Window(windowEnv);validateRecipe(recipe);const panel=page.locator('.ep-policy');
 for(const {key,label,fields}of POLICY_SECTIONS){
  const s=recipe[key],status=panel.getByLabel(label+'状态',{exact:true}),details=status.locator('xpath=ancestor::details[1]');if(!await details.evaluate(n=>n.open))await details.locator(':scope > summary').click();
  await status.selectOption(s.status);assert.equal(await status.inputValue(),s.status);
  for(const [name,value]of [[label+'依据',s.source],[label+(s.status==='not_applicable'?'不适用理由':'依据说明'),s.reason]]){const input=panel.getByLabel(name,{exact:true});await input.fill(value);assert.equal(await input.inputValue(),value);}
  if(s.status==='configured'){
   if(key==='site'){const select=panel.getByLabel('中心范围',{exact:true});await select.selectOption(s.mode);assert.equal(await select.inputValue(),s.mode);}
   for(const [field,text]of fields){const input=panel.getByLabel(label+text,{exact:true});if(field==='reviewIndependence')await input.selectOption(s.rules[field]);else await input.fill(s.rules[field]);assert.equal(await input.inputValue(),s.rules[field]);}
  }
 }
 return{prepared:true,recipeHash:bodyHash(recipe),sections:POLICY_SECTIONS.map(({key})=>({key,status:recipe[key].status}))};
}
