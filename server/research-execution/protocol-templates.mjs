import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {authorizeProtocolConfiguration,normalizeConfiguration,presentProtocol,validateProtocolReferences} from './protocols.mjs';
const action='protocol.template.import';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const missing=()=>fail(404,'RESEARCH_NOT_FOUND','已审核方案不存在或当前账号无权复用。');
const blocked=()=>fail(409,'PROTOCOL_TEMPLATE_BLOCKED','模板材料或目标固定版本尚不可用，请核对阻断项。');
const stale=()=>fail(409,'PROTOCOL_TEMPLATE_STALE','源方案或当前研究配置已变化，请重新预览差异。');
const conflict=()=>fail(409,'PROTOCOL_TEMPLATE_COPY_CONFLICT','当前研究已存在不同内容的固定定义，请核对后再带入。');
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const include={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};
const json=v=>JSON.parse(JSON.stringify(v));
const pick=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]??null]));
const outcomeKeys=['key','versionNumber','name','role','sourceType','scaleVersionId','scoreKey','dataFieldKey','unit','direction','timepointCode'];
const formKey=v=>'wf02-'+requestHash({sourceTemplateId:v.templateId,sourceVersionId:v.id}).slice(0,32);
export const templateFingerprint=value=>requestHash(json(value));
export function normalizeTemplateImport(body){
 only(body,['requestKey','sourceStudyId','sourceProtocolId','sourceFingerprint','targetFingerprint']);validateMutation(body);
 if(!id(body.sourceStudyId)||!id(body.sourceProtocolId)||!digest(body.sourceFingerprint)||!digest(body.targetFingerprint))invalid();
 return body;
}
export function templateConfiguration(protocol,mapping={forms:{},outcomes:{}}){
 const p={...pick(protocol,['title','purpose','primaryOutcomes','secondaryOutcomes','methodsSummary','populationSummary','statisticsSummary']),visitPlans:(protocol.visitPlans??[]).map(({id:_,requirements,...v})=>({...pick(v,['code','name','sequence','anchor','anchorEventKey','targetDayOffset','windowBeforeDays','windowAfterDays','required','allowRepeat']),requirements:requirements.map(q=>{const row=pick(q,['kind','code','name','required','config']);row.config=json(q.config??{});if(q.kind==='form_response')row.config.formVersionId=mapping.forms?.[q.config.formVersionId]??q.config.formVersionId;return row;})}))};
 for(const k of ['primaryOutcomes','secondaryOutcomes'])p[k]=(protocol[k]??[]).map(o=>({outcomeDefinitionId:mapping.outcomes?.[o.outcomeDefinitionId]??o.outcomeDefinitionId,versionNumber:o.versionNumber}));
 return normalizeConfiguration(p);
}
export function templateDifferences(source,target){
 return Object.entries({title:'方案名称',purpose:'研究目的',methodsSummary:'研究方法',populationSummary:'研究人群',statisticsSummary:'统计计划',primaryOutcomes:'主要结局',secondaryOutcomes:'次要结局',visitPlans:'访视与采集要求'}).map(([area,label])=>({area,label,state:!target?'added':requestHash(source[area])===requestHash(target[area])?'same':'changed'}));
}
// Cursor payload is encrypted so skipped private candidate IDs are not disclosed.
function cursorCodec(secret){
 const key=createHash('sha256').update(secret).digest();
 return {encode(binding,last){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([c.update(JSON.stringify({binding,last})),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url');},decode(value,binding){try{if(typeof value!=='string'||value.length>4096||!/^[A-Za-z0-9_-]+$/.test(value))invalid();const raw=Buffer.from(value,'base64url'),c=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));c.setAuthTag(raw.subarray(12,28));const p=JSON.parse(Buffer.concat([c.update(raw.subarray(28)),c.final()]));if(requestHash(p.binding)!==requestHash(binding)||!p.last||!id(p.last.study)||typeof p.last.protocol!=='string'||p.last.protocol!==''&&!id(p.last.protocol)||typeof p.last.done!=='boolean')invalid();return p.last;}catch{invalid();}}};
}
async function lockProject(tx,ctx){await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${ctx.executionProjectId} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} FOR UPDATE`;}
async function lockProtocols(tx,ctx){
 await tx.$queryRaw`SELECT id FROM public.study_protocol_version WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND "acceptanceFixture"=false ORDER BY id FOR SHARE`;
 await tx.$queryRaw`SELECT id FROM public.visit_plan WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} ORDER BY id FOR SHARE`;
 await tx.$queryRaw`SELECT id FROM public.visit_requirement WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} ORDER BY id FOR SHARE`;
}
async function lockDefinitions(tx,ctx){
 await tx.$queryRaw`SELECT id FROM public.form_template WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} ORDER BY id FOR SHARE`;
 await tx.$queryRaw`SELECT id FROM public.form_version WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} ORDER BY id FOR SHARE`;
 await tx.$queryRaw`SELECT id FROM public.outcome_definition WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} ORDER BY id FOR SHARE`;
}
async function definitions(tx,ctx){
 await lockDefinitions(tx,ctx);
 const [forms,outcomes,templates]=await Promise.all([tx.formVersion.findMany({where:scope(ctx),include:{template:true},orderBy:{id:'asc'}}),tx.outcomeDefinition.findMany({where:scope(ctx),orderBy:{id:'asc'}}),tx.formTemplate.findMany({where:scope(ctx),orderBy:{id:'asc'}})]);
 return {forms,outcomes,templates};
}
function fixedForms(protocol,forms){const ids=new Set(protocol.visitPlans.flatMap(p=>p.requirements.filter(q=>q.kind==='form_response').map(q=>q.config?.formVersionId)));return forms.filter(f=>ids.has(f.id));}
function exactForm(src,target){return target.template.status==='active'&&target.template.sourceKind==='tenant_published'&&target.template.sourceTemplateId===src.templateId&&target.template.sourceVersionId===src.id&&target.template.name===src.template.name&&target.template.description===src.template.description&&target.versionNumber===src.versionNumber&&target.status==='locked'&&Boolean(target.lockedAt)&&requestHash(target.schema)===requestHash(src.schema)&&requestHash(target.scoring)===requestHash(src.scoring);}
function copyPlan(source,target){
 const forms=source.forms.map(f=>{const key=formKey(f),matches=target.forms.filter(t=>t.template.key===key),old=matches.find(t=>exactForm(f,t));return {source:f,key,existing:old??null,conflict:(matches.length>0||target.templates.some(t=>t.key===key))&&!old};});
 const outcomes=source.outcomes.map(o=>{const old=target.outcomes.find(t=>t.key===o.key&&t.versionNumber===o.versionNumber);return {source:o,existing:old??null,conflict:Boolean(old&&(old.status!=='published'||!old.publishedAt||requestHash(pick(old,outcomeKeys))!==requestHash(pick(o,outcomeKeys))))};});
 return {forms,outcomes};
}
function unsupportedRequirements(protocol){
 const profile=new Set(['onsetAge','episodeCount','currentEpisodeMonths','totalEpisodeMonths','hospitalizationCount','familyHistory','onMedication','medication','education','occupation','ethnicity','residence','maritalStatus','collectionDate','dataDate']);
 return protocol.visitPlans.flatMap(v=>v.requirements).filter(q=>{
  if(['form_response','scale'].includes(q.kind))return false;
  const cfg=q.config??{},keys=Object.keys(cfg);if(!keys.length)return false;
  if(q.kind==='profile_field')return keys.length!==1||keys[0]!=='field'||!profile.has(cfg.field);
  if(q.kind==='modality_file'){
   if(keys.length===1&&keys[0]==='modality')return typeof cfg.modality!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(cfg.modality);
   // Existing synthetic workflows declare preprocessed features, never raw extraction.
   return keys.length!==3||!keys.every(k=>['modality','sourceKind','rawExtractionClaim'].includes(k))||!['tongue','voice','eeg'].includes(cfg.modality)||cfg.sourceKind!=='synthetic_preprocessed_features'||cfg.rawExtractionClaim!==false;
  }
  return true;
 });
}
export function createProtocolTemplateService({studies,core,cursorSecret=randomBytes(32)}){
 if(typeof studies?.withResearchStudyTransaction!=='function'||typeof studies.resolveResearchStudyInTransaction!=='function'||typeof core?.fixedReferenceStatusInTransaction!=='function'||typeof core.createProtocolVersionInTransaction!=='function')throw Error('PROTOCOL_TEMPLATE_DEPENDENCIES_REQUIRED');
 const cursor=cursorCodec(cursorSecret);
 const run=(principal,studyId,fn)=>studies.withResearchStudyTransaction(principal,studyId,'read',async(tx,raw)=>{
  const actor=await tx.account.findFirst({where:{id:principal.accountId,tenantId:raw.tenantId},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}});
  if(!actor||actor.authVersion!==principal.authVersion)fail(401,'AUTH_SESSION_EXPIRED','登录会话已变化，请重新登录。');
  const current={accountId:actor.id,tenantId:raw.tenantId,role:actor.role,isTenantAdmin:actor.isTenantAdmin,authVersion:actor.authVersion};
  return fn(tx,await authorizeProtocolConfiguration(tx,current,raw,true),current);
 });
 async function sourceContext(tx,user,studyId){try{return await authorizeProtocolConfiguration(tx,user,await studies.resolveResearchStudyInTransaction(tx,user,studyId,'read'),true);}catch(e){if([403,404].includes(e.status))missing();throw e;}}
 async function snapshot(tx,user,target,sourceStudyId,sourceProtocolId){
  const src=await sourceContext(tx,user,sourceStudyId);
  await lockProtocols(tx,src);
  const p=await tx.studyProtocolVersion.findFirst({where:{...scope(src),id:sourceProtocolId,acceptanceFixture:false,status:{in:['approved','executing']}},include});if(!p)missing();
  const sourceDefs=await definitions(tx,src),forms=fixedForms(p,sourceDefs.forms),ids=new Set([...(p.primaryOutcomes??[]),...(p.secondaryOutcomes??[])].map(o=>o.outcomeDefinitionId)),outcomes=sourceDefs.outcomes.filter(o=>ids.has(o.id));
  const fixed=await core.fixedReferenceStatusInTransaction(tx,src.tenantId,src.studyGroupId,src.executionProjectId,p.id);
  const referenceIssues=[];try{await validateProtocolReferences(tx,src,templateConfiguration(p));}catch(e){if(e.status===400)referenceIssues.push({code:e.code,message:e.message});else throw e;}
  const scaleIds=[...new Set([...p.visitPlans.flatMap(v=>v.requirements.filter(q=>q.kind==='scale').map(q=>q.config.scaleVersionId)),...outcomes.map(o=>o.scaleVersionId).filter(Boolean)])].sort();
  const scales=[];
  for(const sid of scaleIds){
   const rows=await tx.$queryRaw`SELECT v.*,d.name AS "definitionName",d.code AS "definitionCode" FROM public.scale_version v JOIN public.scale_definition d ON d.id=v."scaleDefinitionId" WHERE v.id=${sid} AND (v."tenantId"=${src.tenantId} OR v."tenantId" IS NULL) AND (d."tenantId"=${src.tenantId} OR d."tenantId" IS NULL) FOR SHARE OF v,d`;
   if(rows[0]){const items=await tx.$queryRaw`SELECT * FROM public.scale_version_item WHERE "scaleVersionId"=${sid} AND ("tenantId"=${src.tenantId} OR "tenantId" IS NULL) ORDER BY id FOR SHARE`;const rules=await tx.$queryRaw`SELECT * FROM public.scoring_rule WHERE "scaleVersionId"=${sid} AND ("tenantId"=${src.tenantId} OR "tenantId" IS NULL) ORDER BY id FOR SHARE`;scales.push({...rows[0],items,rules});}
  }
  const sourceStudy=await tx.researchProject.findFirst({where:{tenantId:src.tenantId,studyGroupId:src.studyGroupId,id:src.executionProjectId}});
  const source={protocol:presentProtocol(p),forms,outcomes,scales};
  await repository.setContext(tx,user,target.studyGroupId,target.executionProjectId);
  await lockProtocols(tx,target);const targetDefs=await definitions(tx,target);
  const protocols=await tx.studyProtocolVersion.findMany({where:{...scope(target),acceptanceFixture:false},include,orderBy:{versionNumber:'desc'}});
  const applicability=[];
  for(const s of scales){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${target.executionProjectId+':'+s.scaleDefinitionId}))::text AS locked`;const rows=await tx.$queryRaw`SELECT * FROM public.scale_version_applicability WHERE "tenantId"=${target.tenantId} AND "studyGroupId"=${target.studyGroupId} AND "researchProjectId"=${target.executionProjectId} AND "scaleDefinitionId"=${s.scaleDefinitionId} ORDER BY sequence DESC LIMIT 1 FOR SHARE`;if(rows[0])applicability.push(rows[0]);}
  const plan=copyPlan(source,targetDefs),blockers=[...(fixed.issues??[]),...referenceIssues];
  if(outcomes.some(o=>!['data_field','scale'].includes(o.sourceType)))blockers.push({code:'TEMPLATE_OUTCOME_SOURCE_NOT_PORTABLE',message:'此方案的总分来源仅用于原研究，当前不能直接带入。请先在当前研究配置可用的结局来源。'});
  if(!fixed.ready&&!blockers.length)blockers.push({code:'PROTOCOL_FIXED_REFERENCES_INVALID',message:'源方案的固定材料尚未就绪。'});
  if(unsupportedRequirements(p).length)blockers.push({code:'UNSUPPORTED_TEMPLATE_REFERENCE',message:'此方案含尚不能跨研究带入的采集配置，请先核对。'});
  if(plan.forms.some(f=>f.conflict)||plan.outcomes.some(o=>o.conflict))blockers.push({code:'PROTOCOL_TEMPLATE_COPY_CONFLICT',message:'当前研究已有不同内容的固定定义，不能覆盖。'});
  if(scales.length!==scaleIds.length||scales.some(s=>s.status!=='published'||s.accessLevel==='C'&&(s.licenseStatus!=='licensed'||!s.itemTextComplete)))blockers.push({code:'SCALE_VERSION_UNAVAILABLE',message:'引用的量表材料或许可当前不可用。'});
  if(scales.some(s=>applicability.some(a=>a.scaleDefinitionId===s.scaleDefinitionId&&a.scaleVersionId!==s.id)))blockers.push({code:'SCALE_APPLICABILITY_CONFLICT',message:'当前研究已适用另一量表版本，请先核对版本。'});
  const configuration=templateConfiguration(p),current=protocols.find(x=>x.status==='draft')??protocols[0];
  const comparison=templateConfiguration(p,{forms:Object.fromEntries(plan.forms.filter(f=>f.existing).map(f=>[f.source.id,f.existing.id])),outcomes:Object.fromEntries(plan.outcomes.filter(o=>o.existing).map(o=>[o.source.id,o.existing.id]))});
  const preview={targetBaseline:current?{id:current.id,versionNumber:current.versionNumber,status:current.status}:null,source:{sourceStudyId,sourceProtocolId,title:p.title,studyTitle:sourceStudy?.name??'',versionNumber:p.versionNumber,status:p.status,revision:source.protocol.revision},sourceFingerprint:templateFingerprint(source),targetFingerprint:templateFingerprint({protocols:protocols.map(presentProtocol),...targetDefs,applicability}),configuration,forms:forms.map(f=>({id:f.id,name:f.template.name,versionNumber:f.versionNumber,schema:f.schema,scoring:f.scoring})),outcomes:outcomes.map(o=>pick(o,['id',...outcomeKeys])),scales:scales.map(s=>({id:s.id,name:s.definitionName,versionNumber:s.versionNumber,versionLabel:s.versionLabel,contentHash:s.contentHash})),differences:templateDifferences(comparison,current?templateConfiguration(current):null),blockers,canImport:blockers.length===0};
  return {preview,plan,sourceContext:src};
 }
 async function authorizeSaved(tx,user,target,saved,bodyOrHash,key){
  const hash=typeof bodyOrHash==='string'?bodyOrHash:requestHash(bodyOrHash),r=saved.result?.receipt;
  if(saved.action!==action||saved.request_hash!==hash||r?.requestHash!==hash||r.requestKey!==key||r.studyId!==target.studyId||r.authVersion!==user.authVersion||r.targetId!==saved.target_id)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','这次操作与原模板带入记录不一致，请核对。');
  await sourceContext(tx,user,r.sourceStudyId);await repository.setContext(tx,user,target.studyGroupId,target.executionProjectId);
  const p=await tx.studyProtocolVersion.findFirst({where:{...scope(target),id:saved.target_id,acceptanceFixture:false},select:{id:true}});if(!p)missing();
  return saved.result;
 }
 return {
  list:(principal,studyId,query={})=>{only(query,['search','cursor','limit']);const search=query.search??'',limit=query.limit===undefined?10:Number(query.limit);if(typeof search!=='string'||search.length>120||search.includes('\0')||!Number.isInteger(limit)||limit<1||limit>20)invalid();return run(principal,studyId,async(tx,target,user)=>{
   const binding={tenant:user.tenantId,actor:user.accountId,authVersion:user.authVersion,studyId,search},after=query.cursor===undefined?null:cursor.decode(query.cursor,binding);
   // Read only tenant-owned opaque bindings before source authorization. Public definition RLS
   // remains in each authorized source scope; no tenant-wide bypass for candidate titles.
   const rows=await tx.$queryRaw`SELECT id FROM rh_research.study_binding WHERE tenant_id=${user.tenantId} AND (id>${after?.study??''} OR (id=${after?.study??''} AND ${after?.done===false})) ORDER BY id LIMIT 100`;
   const items=[];let last=after,more=rows.length===100,budget=100;
   for(const row of rows){
    if(budget<=0||items.length>=limit){more=true;break;}budget--;
    let ctx;try{ctx=await sourceContext(tx,user,row.id);}catch(e){if(e.status!==404)throw e;last={study:row.id,protocol:'',done:true};continue;}
    if(budget<=0){last={study:row.id,protocol:'',done:false};more=true;break;}
    const resume=after?.study===row.id&&!after.done?after.protocol:'',take=Math.min(budget,limit-items.length)+1;
    const candidates=await tx.studyProtocolVersion.findMany({where:{...scope(ctx),id:{gt:resume},acceptanceFixture:false,status:{in:['approved','executing']},title:{contains:search,mode:'insensitive'}},select:{id:true,title:true,status:true,versionNumber:true},orderBy:{id:'asc'},take});
    const project=await tx.researchProject.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,id:ctx.executionProjectId},select:{name:true}});
    for(const p of candidates.slice(0,take-1)){items.push({sourceStudyId:row.id,sourceProtocolId:p.id,title:p.title,studyTitle:project?.name??'',versionNumber:p.versionNumber,status:p.status});last={study:row.id,protocol:p.id,done:false};budget--;}
    if(candidates.length===take){more=true;break;}
    last={study:row.id,protocol:'',done:true};
   }
   await repository.setContext(tx,user,target.studyGroupId,target.executionProjectId);
   return {items,nextCursor:more&&last?cursor.encode(binding,last):null};
  });},
  preview:(principal,studyId,sourceStudyId,sourceProtocolId)=>{if(!id(sourceStudyId)||!id(sourceProtocolId))invalid();return run(principal,studyId,async(tx,target,user)=>(await snapshot(tx,user,target,sourceStudyId,sourceProtocolId)).preview);},
  import:(principal,studyId,input)=>{const body=normalizeTemplateImport(input);return run(principal,studyId,async(tx,target,user)=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const saved=await repository.getReceipt(tx,user,body.requestKey);if(saved)return authorizeSaved(tx,user,target,saved,body,body.requestKey);
   // Stable order avoids cross-import project lock inversion. Both scopes have been authorized.
   const src=await sourceContext(tx,user,body.sourceStudyId);
   for(const ctx of [target,src].sort((a,b)=>a.executionProjectId.localeCompare(b.executionProjectId))){await repository.setContext(tx,user,ctx.studyGroupId,ctx.executionProjectId);await lockProject(tx,ctx);}
   await repository.setContext(tx,user,target.studyGroupId,target.executionProjectId);
   const {preview,plan}=await snapshot(tx,user,target,body.sourceStudyId,body.sourceProtocolId);
   if(preview.sourceFingerprint!==body.sourceFingerprint||preview.targetFingerprint!==body.targetFingerprint)stale();if(!preview.canImport){if(preview.blockers.some(b=>b.code==='PROTOCOL_TEMPLATE_COPY_CONFLICT'))conflict();blocked();}
   const mapping={forms:{},outcomes:{}},formOrigin=[],outcomeOrigin=[],actor={...user,...scope(target)};
   for(const f of plan.forms){let version=f.existing;if(!version){const template=await tx.formTemplate.create({data:{...scope(target),key:f.key,name:f.source.template.name,description:f.source.template.description,sourceKind:'tenant_published',sourceTemplateId:f.source.templateId,sourceVersionId:f.source.id,status:'active',createdBy:user.accountId}});const data={...scope(target),templateId:template.id,versionNumber:f.source.versionNumber,status:'locked',schema:json(f.source.schema),lockedAt:new Date(),createdBy:user.accountId};if(f.source.scoring!==null&&f.source.scoring!==undefined)data.scoring=json(f.source.scoring);version=await tx.formVersion.create({data});}mapping.forms[f.source.id]=version.id;formOrigin.push({sourceVersionId:f.source.id,targetVersionId:version.id,reused:Boolean(f.existing)});}
   for(const o of plan.outcomes){const version=o.existing??await tx.outcomeDefinition.create({data:{...scope(target),...pick(o.source,outcomeKeys),status:'published',publishedAt:new Date(),publishedBy:user.accountId,createdBy:user.accountId}});mapping.outcomes[o.source.id]=version.id;outcomeOrigin.push({sourceOutcomeId:o.source.id,targetOutcomeId:version.id,reused:Boolean(o.existing)});}
   const configuration=templateConfiguration(preview.configuration,mapping);
   await validateProtocolReferences(tx,target,configuration);
   const created=await core.createProtocolVersionInTransaction(actor,configuration,tx,target.studyGroupId,target.executionProjectId);
   const fixed=await core.fixedReferenceStatusInTransaction(tx,target.tenantId,target.studyGroupId,target.executionProjectId,created.id);if(!fixed.ready)blocked();
   const origin={sourceStudyId:body.sourceStudyId,sourceProtocolId:body.sourceProtocolId,sourceTitle:preview.source.title,sourceStudyTitle:preview.source.studyTitle,sourceVersionNumber:preview.source.versionNumber,sourceRevision:preview.source.revision,sourceFingerprint:body.sourceFingerprint,targetFingerprint:body.targetFingerprint,importedAt:new Date().toISOString(),forms:formOrigin,outcomes:outcomeOrigin};
   const auditId='rh-audit-'+randomUUID(),operationId='rh-op-'+randomUUID(),hash=requestHash(body),result={protocol:presentProtocol(created),origin,receipt:{id:operationId,requestKey:body.requestKey,action,targetId:created.id,studyId,sourceStudyId:body.sourceStudyId,sourceProtocolId:body.sourceProtocolId,sourceFingerprint:body.sourceFingerprint,targetFingerprint:body.targetFingerprint,requestHash:hash,authVersion:user.authVersion}};
   await tx.auditLog.createMany({data:{id:auditId,...scope(target),accountId:user.accountId,action:'researchhub.'+action,target:created.id,meta:{requestKey:body.requestKey,requestHash:hash,authVersion:user.authVersion,...origin}}});
   await repository.saveReceipt(tx,user,{id:operationId,key:body.requestKey,hash,action,target:created.id,result,auditId});return result;
  });},
  receipt:(principal,studyId,key,query={})=>{validateMutation({requestKey:key});only(query,['requestHash']);if(!digest(query.requestHash))invalid();return run(principal,studyId,async(tx,target,user)=>{const saved=await repository.getReceipt(tx,user,key);if(!saved)return {found:false};return {found:true,...await authorizeSaved(tx,user,target,saved,query.requestHash,key)};});},
 };
}
