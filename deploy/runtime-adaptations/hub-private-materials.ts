import{createHash}from'node:crypto';import type{Prisma}from'@prisma/client';import type{JwtUser}from'./types';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const origin='(?:legacy|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})';
export function hubPrivateMaterialToolPermissions(){return{menuPermissions:['knowledge','workbench'],buttonPermissions:['knowledge.edit','chat.use']};}
// This is a current, real-parent permission check, not an acceptance allowlist.
// Ordinary Hub/KB/article jobs retain the original knowledge.search-only rule.
export async function isHubPrivateMaterialTask(tx:Prisma.TransactionClient,user:JwtUser,taskId:string|undefined,groupId:string,projectId:string):Promise<boolean>{
 if(!taskId||!valid(user.accountId)||!valid(user.tenantId))return false;
 const task=await tx.knowledgeChatJob.findUnique({where:{id:taskId}});if(!task||task.tenantId!==user.tenantId||task.accountId!==user.accountId||task.studyGroupId!==groupId||task.researchProjectId!==projectId||!['queued','processing','completed'].includes(task.status))return false;
 const session=await tx.session.findUnique({where:{id:task.sessionId}});if(!session||!valid(session.id)||session.tenantId!==user.tenantId||session.accountId!==user.accountId||session.studyGroupId!==groupId||session.researchProjectId!==projectId||session.channel!=='knowledge'||session.status!=='active'||session.deletedAt||session.agentId!==user.tenantId+'-kb-research'||!new RegExp('^hub-private:v1:'+session.id+':'+origin+'$').test(session.contextKey??''))return false;
 const payload=task.payload as any,p=payload?.hubPrivateEvidence,s=payload?.hubPrivateSelection,n=payload?.hubPrivateNative;
 if(p?.schema!=='hub-private-material-pack.v1'||s?.schema!=='hub-private-selection.v1'||n?.schema!=='hub-native-private.v1'||n.transition?.sessionId!==session.id||n.transition?.contextKey!==session.contextKey||hash(n.transition)!==n.transitionHash)return false;
 const suffix=session.contextKey!.slice(('hub-private:v1:'+session.id+':').length),previous=suffix==='legacy'?'hub:lingshu-xinyu':'hub:lingshu-xinyu:conversation:'+suffix;
 if(n.transition.originalContextKey!==previous)return false;
 const{packHash,...pack}=p,{hash:selectionHash,...selected}=s,b=p.binding,{hash:bindingHash,...binding}=b??{};
 if(hash(pack)!==packHash||hash(selected)!==selectionHash||hash(binding)!==bindingHash||b?.schema!=='hub-private-materials.v1'||b.sessionId!==session.id||s.sessionId!==session.id)return false;
 if(!b.principal||!s.principal||!Array.isArray(b.materials)||!Array.isArray(s.materials)||!Array.isArray(p.sources)||!b.materials.every((m:any)=>m&&valid(m.materialId)&&Number.isSafeInteger(m.version)&&m.version>0)||!s.materials.every((m:any)=>m&&valid(m.materialId))||!p.sources.every((m:any)=>m&&valid(m.materialId)))return false;
 const principal={tenantId:user.tenantId,accountId:user.accountId,studyGroupId:groupId,researchProjectId:projectId};
 if(hash(b.principal)!==hash(principal)||hash(s.principal)!==hash(principal)||!Array.isArray(b.materials)||b.materials.length<1||b.materials.length>20||!Array.isArray(s.materials)||s.materials.length!==b.materials.length||new Set(b.materials.map((m:any)=>m.materialId)).size!==b.materials.length)return false;
 if(!Array.isArray(p.sources)||p.sources.length!==b.materials.length)return false;
 await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true),set_config('app.auth_version',$5,true)",user.tenantId,groupId,projectId,user.accountId,String(user.authVersion));
 const rows=await tx.$queryRawUnsafe<any[]>(`SELECT m.*,k.visibility,k."ownerAccountId" AS owner,f.sha256 AS file_sha,f."createdBy" AS file_owner,f."docId" AS file_doc,
  i.status AS import_status,i.stage AS import_stage,i."createdBy" AS import_owner,i."safetyLevel" AS import_safety,i."docId" AS import_doc,
  d.version AS current_version,d.status AS doc_status,d."safetyLevel" AS doc_safety,d."trashedAt",encode(sha256(convert_to(d."contentMd",'UTF8')),'hex') AS current_sha
  FROM rh_ai.session_materials m
  JOIN public.knowledge_base k ON k.id=m.kb_id AND k."tenantId"=m.tenant_id AND k."studyGroupId"=m.study_group_id AND k."researchProjectId"=m.research_project_id
  JOIN public.knowledge_source_file f ON f.id=m.source_file_id AND f."kbId"=k.id AND f."tenantId"=m.tenant_id AND f."studyGroupId"=m.study_group_id
  JOIN public.knowledge_import_task i ON i.id=m.import_task_id AND i."sourceFileId"=f.id AND i."kbId"=k.id AND i."tenantId"=m.tenant_id AND i."studyGroupId"=m.study_group_id
  JOIN public.knowledge_doc d ON d.id=m.doc_id AND d."kbId"=k.id AND d."tenantId"=m.tenant_id AND d."studyGroupId"=m.study_group_id
  WHERE m.id=ANY($1::text[]) AND m.tenant_id=$2 AND m.study_group_id=$3 AND m.research_project_id=$4 AND m.account_id=$5 AND m.session_id=$6
  FOR SHARE OF m,k,f,i,d`,b.materials.map((m:any)=>m.materialId),user.tenantId,groupId,projectId,user.accountId,session.id);
 if(rows.length!==b.materials.length)return false;
 return b.materials.every((m:any)=>{const r=rows.find(r=>r.id===m.materialId),selected=s.materials.find((v:any)=>v.materialId===m.materialId),source=p.sources.find((v:any)=>v.materialId===m.materialId);
  return r&&selected&&source&&r.deleted_at===null&&r.purpose==='knowledge'&&r.state==='ready'&&r.visibility==='private'&&r.owner===user.accountId&&r.file_owner===user.accountId&&r.import_owner===user.accountId&&r.import_status==='complete'&&r.import_stage==='complete'&&r.import_safety==='allow'&&r.doc_safety==='allow'&&r.trashedAt===null&&['draft','published'].includes(r.doc_status)&&r.file_doc===r.doc_id&&r.import_doc===r.doc_id&&r.current_version===r.doc_version&&r.current_sha===r.content_sha256&&r.file_sha===r.source_sha256&&
   r.id===m.materialId&&r.version===m.version&&r.kb_id===m.kbId&&r.source_file_id===m.sourceFileId&&r.source_sha256===m.sourceSha256&&r.doc_id===m.docId&&r.doc_version===m.docVersion&&r.content_sha256===m.contentSha256&&selected.kbId===m.kbId&&selected.sourceFileId===m.sourceFileId&&selected.sourceSha256===m.sourceSha256&&selected.version<=m.version&&(!selected.docId||selected.version===m.version&&selected.docId===m.docId&&selected.docVersion===m.docVersion&&selected.contentSha256===m.contentSha256)&&source.docId===m.docId&&source.docVersion===m.docVersion&&source.contentSha256===m.contentSha256&&source.sourceFileId===m.sourceFileId&&source.sourceSha256===m.sourceSha256&&source.kbId===m.kbId;
 });
}
