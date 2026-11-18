// WF01 acceptance primitives. Importing this module performs no filesystem/network I/O.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';

export const base='http://127.0.0.1:19501';
export const workspace='/Users/mac/aisciencesys/';
export const purpose='study-workflow-simplification-2026-11-17';
export const privateDir=workspace+'.tmp/'+purpose+'/wf01/';
export const evidenceDir=workspace+'researchhub/docs/testing/evidence/'+purpose+'/wf01/';
export const caseRoles={A:'admin',B:'reviewer',C:'collector',D:'admin'};
export const steps={A:['create','continue-child','enter','edit','cas'],B:['create'],C:['draft'],D:['save-loss','recover-save','study-loss','recover-study','new-tab']};
export const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const bodyHash=value=>sha(JSON.stringify(canonical(value)));
export const json=path=>JSON.parse(readFileSync(path,'utf8'));
export function save(path,value,{exclusive=false}={}){
 mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true,mode:0o700});
 const text=JSON.stringify(value,null,2)+'\n';
 if(exclusive){writeFileSync(path,text,{mode:0o600,flag:'wx'});return;}
 const temporary=path+'.tmp';writeFileSync(temporary,text,{mode:0o600});renameSync(temporary,path);
}
export function parseArgs(args,env=process.env){
 if(args.length===1&&args[0]==='--help')return{help:true};
 assert.equal(args[0],'--local-synthetic','SYNTHETIC_TARGET_REQUIRED');
 assert.equal(env.STUDY_WORKFLOW_WF01_QA_WINDOW,'explicit','ROOT_WF01_IO_WINDOW_REQUIRED');
 assert.equal(env.VISIT_WORKFLOW_QA_WINDOW,'explicit','SHARED_HELPER_WINDOW_REQUIRED');
 if(args.length===2&&['--visual','--boundaries','--audit','--reconcile'].includes(args[1]))return{mode:args[1].slice(2)};
 if(args.length===3&&args[1]==='--verify-ui'){
  const[code,step,...rest]=args[2].split('.');assert(!rest.length&&steps[code]?.includes(step),'UNKNOWN_WF01_VERIFY_STEP');return{mode:'verify-ui',code,step};
 }
 assert.equal(args.length,5,'USE_ONE_CASE_AND_ONE_STEP');assert.equal(args[1],'--case');assert.equal(args[3],'--step');
 const code=args[2],step=args[4];assert(steps[code]?.includes(step),'UNKNOWN_WF01_CASE_STEP');
 return{mode:'case',code,step};
}
export function mutationAction(method,path){
 if(method==='POST'&&path==='/api/research-projects')return'intent.create';
 if(method==='PATCH'&&/^\/api\/research-projects\/[^/]+$/.test(path))return'intent.update';
 if(method==='POST'&&/^\/api\/research-projects\/[^/]+\/studies$/.test(path))return'study.create';
 return null;
}
export const expectedNativeStatus=action=>action==='intent.create'?201:200;
export const successfulNativeStatus=status=>status===200||status===201;
export const knownRejected=request=>request.nativeStatus>=400&&request.nativeStatus<500;
export const receiptCandidate=request=>request.dispatched&&!knownRejected(request);
export function receiptPath(request){
 assert(request?.requestKey&&/^[a-f0-9]{64}$/.test(request.requestHash));
 const params=new URLSearchParams({action:request.action,requestHash:request.requestHash,...(request.action==='intent.create'?{}:{targetId:request.targetId})});
 return'/api/research-projects/receipts/'+encodeURIComponent(request.requestKey)+'?'+params;
}
export function metadata(out){
 const item=out?.item;assert(item?.id&&Number.isInteger(item.version),'NATIVE_ITEM_REQUIRED');
 return{id:item.id,version:item.version,status:item.status,titleHash:sha(item.title??''),questionHash:sha(item.question??''),study:item.study?{id:item.study.id,executionProjectId:item.study.executionProjectId,studyGroupId:item.study.studyGroupId}:null,receipt:out.receipt??null};
}
export function verifyReceipt(request,out,authVersion){
 const receipt=out?.receipt;assert(receipt,'AUTH_BOUND_RECEIPT_REQUIRED');
 assert.equal(receipt.requestKey,request.requestKey);assert.equal(receipt.action,request.action);
 assert.equal(receipt.requestHash,request.requestHash);assert.equal(receipt.authVersion,authVersion);
 assert.equal(receipt.targetId,out.item?.id);if(request.targetId)assert.equal(out.item.id,request.targetId);
 return metadata(out);
}
export function assertOpaqueMarker(entries){
 for(const[key,text]of entries){
  assert(key.startsWith('researchhub:project-preparation:v1:'));const x=JSON.parse(text);
  assert(Object.keys(x).every(k=>['schema','actor','origin','prepare','groupId','projectId','version','sourceHash','pending'].includes(k)),'MARKER_MUST_NOT_PERSIST_FORM_BODY');
  assert.equal(x.schema,1);assert.equal(typeof x.actor,'string');assert(Array.isArray(JSON.parse(x.actor)));
  if(x.pending){assert(Object.keys(x.pending).every(k=>['path','method','action','requestKey','requestHash','expectedVersion'].includes(k)));assert.match(x.pending.requestHash,/^[a-f0-9]{64}$/);}
 }
 return true;
}
export function mayExecuteStep(step){
 if(!step)return true;if(step.status==='verified')return false;
 assert(!(step.requests??[]).some(receiptCandidate),'NATIVE_WRITE_ALREADY_DISPATCHED_RECONCILE_ONLY');
 return true;
}
export function createJournal(path){
 const journal=existsSync(path)?json(path):{schema:1,purpose,syntheticOnly:true,createdAt:new Date().toISOString(),cases:{},steps:{}};
 assert.equal(journal.schema,1);assert.equal(journal.purpose,purpose);assert.equal(journal.syntheticOnly,true);
 return{journal,persist(){save(path,journal);},intent(id,extra={}){
  const existing=journal.steps[id];if(!mayExecuteStep(existing))return existing;
  const step=existing??{id,status:'intent',at:new Date().toISOString(),requests:[],events:[]};
  Object.assign(step,extra);journal.steps[id]=step;save(path,journal);return step;
 },event(step,state,extra={}){step.events.push({at:new Date().toISOString(),state,...extra});save(path,journal);},verified(step,extra={}){Object.assign(step,extra,{status:'verified',verifiedAt:new Date().toISOString()});save(path,journal);}};
}
// No guessed PID: openHarness independently validates the current runtime command + fixture marker.
export async function readOldHashes(h){
 return h.read(async tx=>{
  const tables=[['rh_research','project_intent','tenant_id'],['rh_research','study_binding','tenant_id'],['rh_research','operation','tenant_id'],['public','research_project','tenantId'],['public','research_project_membership','tenantId'],['public','study_group','tenantId'],['public','permission_role','tenantId'],['public','account','tenantId'],['public','audit_log','tenantId']];
  const result={};
  for(const[schema,table,tenant]of tables){
   // Identifiers are fixed literals above. Only original IDs and DB-side row hashes leave PG.
   result[schema+'.'+table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM "${schema}"."${table}" t WHERE "${tenant}"=$1 ORDER BY id`,h.runtime.ids.tenant);
  }
  result['rh_research.hub_role']=await tx.$queryRaw`SELECT concat(hub_key,':',account_id) AS id,md5(row_to_json(t)::text) AS hash FROM rh_research.hub_role t WHERE tenant_id=${h.runtime.ids.tenant} ORDER BY id`;
  return result;
 });
}
export function assertOldHashes(before,after){
 for(const[table,rows]of Object.entries(before)){const current=new Map(after[table].map(r=>[r.id,r.hash]));for(const row of rows)assert.equal(current.get(row.id),row.hash,'ORIGINAL_ROW_CHANGED:'+table+':'+row.id);}
 return true;
}
