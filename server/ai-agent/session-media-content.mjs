import {randomUUID} from 'node:crypto';
import {contentFail as fail,contentId,contentOnly,normalizeContentRequest,validateContentOutput} from './session-media-content-contract.mjs';
import {materialDigest} from './session-material-contract.mjs';
import {assertMediaObject} from './session-media.mjs';
const table='rh_ai.session_media_content_runs';
const channels=['audio','visual'];
const terminal=s=>['complete','not_applicable'].includes(s);
export function createSessionMediaContent({access,storage,configHash,authorizeStudy,onQueued=()=>{},clock=()=>new Date(),leaseMs=90000}){
 if(typeof authorizeStudy!=='function')throw Error('MEDIA_CONTENT_STUDY_AUTHORIZER_REQUIRED');
 const transaction=(u,sid,fn)=>access.transaction(u,sid,fn);
 async function source(tx,u,sid,mid){
  if(!contentId(sid)||!contentId(mid))fail('MEDIA_CONTENT_INPUT',400);
  const [m]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE id=$1 AND session_id=$2 AND account_id=$3 AND tenant_id=$4 FOR SHARE`,mid,sid,u.accountId,u.tenantId);
  if(!m)fail('MEDIA_CONTENT_NOT_FOUND',404);
  if(m.archive_state!=='archived'||m.inspection_state!=='complete'||m.inspection_classification!=='valid')fail('MEDIA_CONTENT_SOURCE');
  return m;
 }
 async function current(tx,u,sid,mid,runId,{lock=true}={}){
  const m=await source(tx,u,sid,mid);
  const [root]=await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE media_id=$1 AND session_id=$2 AND account_id=$3 AND tenant_id=$4 AND source_version=$5 AND attempt_no=0`,mid,sid,u.accountId,u.tenantId,m.version);
  if(!root||root.grant_revoked_at||new Date(root.grant_expires_at)<=clock())fail('MEDIA_CONTENT_PERMISSION',403);
  if(root.config_hash!==configHash||root.source_sha256!==m.source_sha256||Number(root.source_bytes)!==Number(m.byte_size))fail('MEDIA_CONTENT_SOURCE_VERSION');
  if(lock)await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,'hub-media-content:'+root.id);
  // Re-read after the common lock, also locking the grant against revoke/publication.
  const [g]=await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE id=$1 FOR SHARE`,root.id);
  if(g.grant_revoked_at||new Date(g.grant_expires_at)<=clock())fail('MEDIA_CONTENT_PERMISSION',403);
  const [study]=await tx.$queryRawUnsafe(`SELECT b.id FROM rh_research.study_binding b JOIN public.research_project p ON p.id=b.execution_project_id AND p."tenantId"=b.tenant_id WHERE b.id=$1 AND b.tenant_id=$2 AND b.study_group_id=$3 AND p.status='active' FOR SHARE OF p`,g.study_id,u.tenantId,u.studyGroupId);
  if(!study)fail('MEDIA_CONTENT_PARENT',403);
  try{await authorizeStudy(tx,u,g.study_id);}finally{await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,u.studyGroupId,u.researchProjectId,u.accountId);}
  const [latest]=await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE root_id=$1 ORDER BY attempt_no DESC LIMIT 1`,g.id);
  const run=runId?(await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE id=$1 AND root_id=$2`,runId,g.id))[0]:latest;
  if(!run)fail('MEDIA_CONTENT_NOT_FOUND',404);
  return{m,root:g,run,latest};
 }
 async function update(tx,run,values){
  const [r]=await tx.$queryRawUnsafe(`UPDATE ${table} SET channels=$1::jsonb,request_key=$2,input_hash=$3,manifest=$4::jsonb,version=version+1 WHERE id=$5 AND version=$6 RETURNING *`,JSON.stringify(values.channels??run.channels),values.requestKey??run.request_key,values.inputHash??run.input_hash,(values.manifest??run.manifest)?JSON.stringify(values.manifest??run.manifest):null,run.id,run.version);
  if(!r)fail('MEDIA_CONTENT_VERSION');return r;
 }
 async function view(tx,c){
  const {run,m,latest}=c,evidence=[];
  for(const channel of channels){
   const state=run.channels[channel];if(!terminal(state.state))continue;
   const origin=state.resultRowId??run.id;
   const rows=await tx.$queryRawUnsafe(`SELECT e.evidence_key,e.body FROM rh_ai.session_media_content_evidence e JOIN ${table} r ON r.id=e.row_id WHERE e.row_id=$1 AND e.root_id=$2 AND e.channel=$3 AND e.account_id=$4 AND r.source_sha256=$5 ORDER BY (e.body->>'startUs')::bigint,e.evidence_key`,origin,run.root_id,channel,m.account_id,m.source_sha256);
   evidence.push(...rows.map(x=>{const{imageKey,...body}=x.body;return{...body,channel};}));
  }
  return{schema:'hub-media-content-run.v1',id:run.id,rootId:run.root_id,attemptNo:run.attempt_no,version:run.version,requestKey:run.request_key,mediaId:m.id,mediaVersion:m.version,sourceSha256:m.source_sha256,latest:run.id===latest.id,manifest:run.manifest,channels:Object.fromEntries(channels.map(k=>{const{leaseToken,leaseExpiresAt,...s}=run.channels[k];return[k,s];})),evidence};
 }
 const read=async(u,sid,mid,rid)=>{await verifySource(u,sid,mid,rid);return transaction(u,sid,async(tx,actor)=>view(tx,await current(tx,actor,sid,mid,rid)));};
 async function create(u,sid,mid,input){
  const n=normalizeContentRequest(input),hash=materialDigest(n);
  const result=await transaction(u,sid,async(tx,actor)=>{
   const c=await current(tx,actor,sid,mid);
   const[old]=await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE root_id=$1 AND request_key=$2`,c.root.id,n.requestKey);
   if(old){if(old.input_hash!==hash)fail('MEDIA_CONTENT_KEY_CONFLICT');return view(tx,{...c,run:old});}
   if(c.m.version!==n.expectedMediaVersion)fail('MEDIA_CONTENT_SOURCE_VERSION');
   if(c.root.request_key)fail('MEDIA_CONTENT_ALREADY_STARTED');
   const run=await update(tx,c.root,{requestKey:n.requestKey,inputHash:hash,channels:Object.fromEntries(channels.map(k=>[k,{state:'queued',version:2,authVersion:actor.authVersion}]))});
   await audit(tx,actor,sid,run,'queued');return view(tx,{...c,run,latest:run});
  });onQueued({user:u,sessionId:sid,mediaId:mid,runId:result.id});return result;
 }
 async function audit(tx,u,sid,r,action){await tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:u.studyGroupId,accountId:u.accountId,action:'hub_media_content_'+action,target:r.id,meta:{sessionId:sid,mediaId:r.media_id,attempt:r.attempt_no,sourceVersion:r.source_version}}});}
 async function receipt(u,sid,mid,key){await verifySource(u,sid,mid);if(!contentId(key))fail('MEDIA_CONTENT_INPUT',400);return transaction(u,sid,async(tx,actor)=>{const c=await current(tx,actor,sid,mid);const[r]=await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE root_id=$1 AND request_key=$2`,c.root.id,key);return r?{found:true,item:await view(tx,{...c,run:r})}:{found:false};});}
 async function claim(u,sid,mid,rid,channel){
  if(!channels.includes(channel))fail('MEDIA_CONTENT_INPUT',400);
  return transaction(u,sid,async(tx,actor)=>{const c=await current(tx,actor,sid,mid,rid),r=c.run,s=r.channels[channel];if(r.id!==c.latest.id||s.state!=='queued')return null;
   const token=randomUUID(),next={authVersion:u.authVersion,state:'running',version:s.version+1,leaseToken:token,leaseExpiresAt:new Date(clock().getTime()+leaseMs).toISOString(),startedAt:clock().toISOString()};
   const run=await update(tx,r,{channels:{...r.channels,[channel]:next}});await audit(tx,actor,sid,run,'claim');return{runId:rid,channel,token,channelVersion:next.version,media:c.m};});
 }
 async function lease(tx,u,sid,mid,rid,claim){const c=await current(tx,u,sid,mid,rid),s=c.run.channels[claim.channel];if(c.latest.id!==rid||s.state!=='running'||s.leaseToken!==claim.token||s.version!==claim.channelVersion||new Date(s.leaseExpiresAt)<=clock())fail('MEDIA_CONTENT_LEASE');return c;}
 async function heartbeat(u,sid,mid,rid,claim){return transaction(u,sid,async(tx,actor)=>{const c=await lease(tx,actor,sid,mid,rid,claim),s=c.run.channels[claim.channel];const r=await update(tx,c.run,{channels:{...c.run.channels,[claim.channel]:{...s,version:s.version+1,leaseExpiresAt:new Date(clock().getTime()+leaseMs).toISOString()}}});return{...claim,channelVersion:r.channels[claim.channel].version};});}
 async function publish(u,sid,mid,rid,claim,manifest,output){
  validateContentOutput(output,manifest,claim.channel);
  return transaction(u,sid,async(tx,actor)=>{const c=await lease(tx,actor,sid,mid,rid,claim),r=c.run;
   if(manifest.sourceSha256!==r.source_sha256||manifest.sourceVersion!==r.source_version||manifest.configHash!==configHash)fail('MEDIA_CONTENT_SOURCE_VERSION');
   // Freeze manifest before evidence; both it and terminal state commit in this transaction.
   if(r.manifest&&materialDigest(r.manifest)!==materialDigest(manifest))fail('MEDIA_CONTENT_MANIFEST');
   const frozen=r.manifest?r:await update(tx,r,{manifest});
   for(const e of output.evidence)await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_content_evidence(id,row_id,root_id,tenant_id,study_group_id,research_project_id,account_id,session_id,media_id,channel,evidence_key,claim_token,channel_version,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::uuid,$13,$14::jsonb)`, 'rh-mce-'+randomUUID(),rid,r.root_id,actor.tenantId,actor.studyGroupId,actor.researchProjectId,actor.accountId,sid,mid,claim.channel,e.id,claim.token,claim.channelVersion,JSON.stringify(e));
   const s=frozen.channels[claim.channel],run=await update(tx,frozen,{channels:{...frozen.channels,[claim.channel]:{...s,state:output.status,version:s.version+1,coverage:output.coverage,usage:output.usage,...(output.reason?{reason:output.reason}:{}),completedAt:clock().toISOString()}}});
   await audit(tx,actor,sid,run,'publish');return view(tx,{...c,run});
  });
 }
 async function failed(u,sid,mid,rid,claim,{code='EXECUTOR_FAILED',outcomeKnown=false,usage={}}={}){return transaction(u,sid,async(tx,actor)=>{const c=await lease(tx,actor,sid,mid,rid,claim),s=c.run.channels[claim.channel],run=await update(tx,c.run,{channels:{...c.run.channels,[claim.channel]:{...s,state:'failed',version:s.version+1,code,outcomeKnown,usage,completedAt:clock().toISOString()}}});await audit(tx,actor,sid,run,'failed');return view(tx,{...c,run});});}
 async function retry(u,sid,mid,rid,input){
  contentOnly(input,['requestKey','expectedVersion','channel']);if(!contentId(input.requestKey)||!channels.includes(input.channel)||!Number.isSafeInteger(input.expectedVersion))fail('MEDIA_CONTENT_INPUT',400);const hash=materialDigest(input);
  const result=await transaction(u,sid,async(tx,actor)=>{const c=await current(tx,actor,sid,mid,rid);const[old]=await tx.$queryRawUnsafe(`SELECT * FROM ${table} WHERE root_id=$1 AND request_key=$2`,c.root.id,input.requestKey);if(old){if(old.input_hash!==hash)fail('MEDIA_CONTENT_KEY_CONFLICT');return view(tx,{...c,run:old});}
   if(c.run.id!==c.latest.id||c.run.version!==input.expectedVersion)fail('MEDIA_CONTENT_VERSION');const s=c.run.channels[input.channel];if(s.state!=='failed'||s.outcomeKnown!==true)fail('MEDIA_CONTENT_RETRY_UNCERTAIN');
   if(channels.some(k=>['queued','running'].includes(c.run.channels[k].state)))fail('MEDIA_CONTENT_BUSY');
   const copied=Object.fromEntries(channels.map(k=>[k,k===input.channel?{state:'queued',version:1,authVersion:actor.authVersion}:{...c.run.channels[k],resultRowId:c.run.channels[k].resultRowId??c.run.id}]));const id='rh-mc-'+randomUUID();
   const[r]=await tx.$queryRawUnsafe(`INSERT INTO ${table}(id,root_id,attempt_no,tenant_id,study_group_id,research_project_id,account_id,session_id,media_id,study_id,source_version,source_sha256,source_bytes,request_key,input_hash,origin_id,config_hash,manifest,channels) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb) RETURNING *`,id,c.root.id,c.run.attempt_no+1,actor.tenantId,actor.studyGroupId,actor.researchProjectId,actor.accountId,sid,mid,c.root.study_id,c.run.source_version,c.run.source_sha256,c.run.source_bytes,input.requestKey,hash,c.run.id,configHash,c.run.manifest?JSON.stringify(c.run.manifest):null,JSON.stringify(copied));await audit(tx,actor,sid,r,'retry');return view(tx,{...c,run:r,latest:r});
  });onQueued({user:u,sessionId:sid,mediaId:mid,runId:result.id});return result;
 }
 async function invalidateQueued(u,sid,mid,rid,channel){return transaction(u,sid,async(tx,actor)=>{const c=await current(tx,actor,sid,mid,rid),s=c.run.channels[channel];if(c.latest.id!==rid||s.state!=='queued'||s.authVersion===actor.authVersion)return false;const run=await update(tx,c.run,{channels:{...c.run.channels,[channel]:{...s,state:'failed',version:s.version+1,code:'MEDIA_CONTENT_AUTHORIZATION_CHANGED',outcomeKnown:true,usage:{executor:channel,requests:0},completedAt:clock().toISOString()}}});await audit(tx,actor,sid,run,'authorization_changed');return true;});}
 async function recover(u,sid,mid,rid,channel){return transaction(u,sid,async(tx,actor)=>{const c=await current(tx,actor,sid,mid,rid),s=c.run.channels[channel];if(c.latest.id!==rid||s.state!=='running'||new Date(s.leaseExpiresAt)>clock())return false;const run=await update(tx,c.run,{channels:{...c.run.channels,[channel]:{...s,state:'failed',version:s.version+1,code:'MEDIA_CONTENT_INTERRUPTED_UNKNOWN',outcomeKnown:false,completedAt:clock().toISOString()}}});await audit(tx,actor,sid,run,'interrupted');return true;});}
 async function verifySource(u,sid,mid,rid){const c=await transaction(u,sid,(tx,actor)=>current(tx,actor,sid,mid,rid));try{assertMediaObject(c.m,await storage.statObject(c.m.storage_key));}catch(e){if(['NoSuchKey','NotFound','NoSuchObject','MEDIA_SOURCE_CHANGED'].includes(e.code)||e.statusCode===404)fail('MEDIA_CONTENT_SOURCE_UNAVAILABLE',410);throw e;}await transaction(u,sid,(tx,actor)=>current(tx,actor,sid,mid,rid));return c.m;}
 async function evidence(u,sid,mid,rid,eid){await verifySource(u,sid,mid,rid);if(!contentId(eid))fail('MEDIA_CONTENT_INPUT',400);return transaction(u,sid,async(tx,actor)=>{const c=await current(tx,actor,sid,mid,rid),v=await view(tx,c),e=v.evidence.find(x=>x.id===eid);if(!e)fail('MEDIA_CONTENT_NOT_FOUND',404);return{...e,sourceSha256:c.m.source_sha256,mediaVersion:c.m.version,playbackUs:e.startUs};});}
 return{create,read,receipt,retry,claim,heartbeat,publish,failed,invalidateQueued,recover,verifySource,evidence,transaction,current};
}
