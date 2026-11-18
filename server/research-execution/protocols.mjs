import {invalid,only,requestHash} from '../research-studies/contract.mjs';
// Mirrors VISIT_REQUIREMENT_KINDS in the shared study-operations policy.
const requirementKinds=new Set(['scale','form_response','profile_field','modality_file','procedure','sample','confirmation']);
const anchors=new Set(['enrollment','randomization','first_intervention','intervention_start','previous_visit','custom_event']);
const str=(v,max=200)=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))invalid();return v.trim();};
const nullableNumber=(v,min=-100000)=>{if(v===undefined||v===null)return null;if(!Number.isSafeInteger(v)||v<min||v>100000)invalid();return v;};
const list=v=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>200)invalid();return v;};
const optionalId=v=>v===undefined?undefined:str(v,200);
export function normalizeConfiguration(input){
 only(input,['title','purpose','primaryOutcomes','secondaryOutcomes','methodsSummary','populationSummary','statisticsSummary','visitPlans']);
 const outcomes=v=>list(v).map(x=>{only(x,['outcomeDefinitionId','versionNumber']);const outcomeDefinitionId=str(x.outcomeDefinitionId);if(!outcomeDefinitionId||!Number.isSafeInteger(x.versionNumber)||x.versionNumber<1)invalid();return{outcomeDefinitionId,versionNumber:x.versionNumber};});
 const plans=list(input.visitPlans).map(p=>{
  only(p,['id','code','name','sequence','anchor','anchorEventKey','targetDayOffset','windowBeforeDays','windowAfterDays','required','allowRepeat','requirements']);
  const anchor=p.anchor??null;if(anchor!==null&&!anchors.has(anchor))invalid();
  if(!Number.isSafeInteger(p.sequence)||p.sequence<1||p.sequence>10000)invalid();
  for(const k of ['required','allowRepeat'])if(p[k]!==undefined&&typeof p[k]!=='boolean')invalid();
  const code=str(p.code),name=str(p.name);if(!code||!name)invalid();
  const requirements=list(p.requirements).map(q=>{
   only(q,['id','kind','code','name','required','config']);const kind=str(q.kind),code=str(q.code),name=str(q.name);if(!requirementKinds.has(kind)||!code||!name)invalid();
   if(q.required!==undefined&&typeof q.required!=='boolean')invalid();
   const config=q.config??{};if(!config||typeof config!=='object'||Array.isArray(config))invalid();
   if(kind==='form_response'){
    only(config,['formVersionId','allowedCaptureModes']);if(!str(config.formVersionId))invalid();
    if(config.allowedCaptureModes!==undefined){const modes=config.allowedCaptureModes;if(!Array.isArray(modes)||modes.length<1||modes.length>2||new Set(modes).size!==modes.length||modes.some(mode=>!['researcher','patient_h5'].includes(mode)))invalid();}
   }
   if(kind==='scale'){only(config,['scaleVersionId']);if(!str(config.scaleVersionId))invalid();}
   return{id:optionalId(q.id),kind,code,name,required:q.required!==false,config};
  });
  if(new Set(requirements.map(q=>q.kind+'\0'+q.code)).size!==requirements.length)invalid();
  return{id:optionalId(p.id),code,name,sequence:p.sequence,anchor,anchorEventKey:p.anchorEventKey==null?null:str(p.anchorEventKey),targetDayOffset:nullableNumber(p.targetDayOffset),windowBeforeDays:nullableNumber(p.windowBeforeDays,0),windowAfterDays:nullableNumber(p.windowAfterDays,0),required:p.required!==false,allowRepeat:p.allowRepeat===true,requirements};
 });
 if(new Set(plans.map(p=>p.code)).size!==plans.length)invalid();
 return{title:str(input.title??''),purpose:str(input.purpose??'',20000),primaryOutcomes:outcomes(input.primaryOutcomes),secondaryOutcomes:outcomes(input.secondaryOutcomes),methodsSummary:input.methodsSummary==null?null:str(input.methodsSummary,20000),populationSummary:input.populationSummary==null?null:str(input.populationSummary,20000),statisticsSummary:input.statisticsSummary==null?null:str(input.statisticsSummary,20000),visitPlans:plans};
}
export const revisionOf=requestHash;

import {randomUUID} from 'node:crypto';
import * as repository from '../research-studies/repository.mjs';
import {researchError,validateMutation} from '../research-studies/contract.mjs';
import {listCaptureCandidates} from '../research-capture/forms.mjs';
const forbidden=()=>{throw researchError(403,'RESEARCH_FORBIDDEN','当前账号无权配置研究。');};
const missing=()=>{throw researchError(404,'RESEARCH_NOT_FOUND','研究配置不存在或当前账号无权查看。');};
const conflict=()=>{throw researchError(409,'RESEARCH_VERSION_CONFLICT','配置已改变，请刷新核对；输入已保留。');};
const where=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const protocolInclude={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};
export function presentProtocol(p){
 const visitPlans=p.visitPlans.map(v=>({id:v.id,code:v.code,name:v.name,sequence:v.sequence,anchor:v.anchor,anchorEventKey:v.anchorEventKey,targetDayOffset:v.targetDayOffset,windowBeforeDays:v.windowBeforeDays,windowAfterDays:v.windowAfterDays,required:v.required,allowRepeat:v.allowRepeat,requirements:v.requirements.map(q=>({id:q.id,kind:q.kind,code:q.code,name:q.name,required:q.required,config:q.config??{}})).sort((a,b)=>a.id.localeCompare(b.id))}));
 const content={title:p.title,purpose:p.purpose,primaryOutcomes:p.primaryOutcomes,secondaryOutcomes:p.secondaryOutcomes,methodsSummary:p.methodsSummary,populationSummary:p.populationSummary,statisticsSummary:p.statisticsSummary,visitPlans};
 return{id:p.id,versionNumber:p.versionNumber,status:p.status,revision:revisionOf(content),...content};
}
async function checkFeature(tx,ctx){if(!await tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ctx.tenantId,featureKey:'study_operations',enabled:true}}))throw researchError(403,'FEATURE_NOT_ENABLED','该功能尚未向当前租户开放，请联系平台管理员。');}
// Shared by native configuration and template reuse; read access alone cannot copy definitions.
export async function authorizeProtocolConfiguration(tx,user,ctx,required=false){
 await checkFeature(tx,ctx);
 const actor=await tx.account.findFirst({where:{id:user.accountId,tenantId:ctx.tenantId},select:{role:true,isTenantAdmin:true}});
 const admin=actor?.role==='tenant_admin'&&actor.isTenantAdmin===true;
 const intent=await repository.findIntent(tx,user,ctx.projectIntentId);
 const owner=Boolean(intent&&(await repository.roles(tx,user)).some(r=>r.hub_key===intent.hub_key&&r.study_group_id===ctx.studyGroupId));
 let canConfigure=admin||owner;
 if(!canConfigure&&ctx.capabilities.canConfigure){
  const m=await tx.studyGroupMembership.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}});
  canConfigure=Boolean(m?.role?.status==='active'&&m.role.tenantId===ctx.tenantId&&Array.isArray(m.role.buttonPermissions)&&m.role.buttonPermissions.includes('study.configure'));
 }
 if(required&&!canConfigure)forbidden();
 return {...ctx,capabilities:{...ctx.capabilities,canConfigure}};
}
// Caller has already authorized this exact target protocol. Never expose private operation receipts.
export async function protocolTemplateOrigin(tx,ctx,protocolId){
 const row=(await tx.$queryRaw`SELECT result->'origin' AS origin FROM rh_research.operation WHERE tenant_id=${ctx.tenantId} AND action='protocol.template.import' AND target_id=${protocolId} AND result->'receipt'->>'studyId'=${ctx.studyId} LIMIT 1`)[0];
 if(!row?.origin)return undefined;
 const {sourceStudyId,sourceProtocolId,sourceVersionNumber,sourceRevision,sourceFingerprint,importedAt,forms,outcomes}=row.origin;
 return {sourceStudyId,sourceProtocolId,sourceVersionNumber,sourceRevision,sourceFingerprint,importedAt,forms,outcomes};
}
export async function validateProtocolReferences(tx,ctx,data){
 const candidates=await listCaptureCandidates(tx,ctx),forms=new Map(candidates.forms.map(x=>[x.id,x])),scales=new Map(candidates.scales.map(x=>[x.id,x])),outcomes=new Map(candidates.outcomes.map(x=>[x.id,x]));
 for(const o of [...data.primaryOutcomes,...data.secondaryOutcomes]){const row=outcomes.get(o.outcomeDefinitionId);if(!row||row.versionNumber!==o.versionNumber)invalid();}
 for(const p of data.visitPlans)for(const q of p.requirements){if(q.kind==='form_response'){const form=forms.get(q.config.formVersionId);if(!form)invalid();if((q.config.allowedCaptureModes??['researcher']).some(mode=>!form.allowedCaptureModes.includes(mode)))throw researchError(400,'FORM_CAPTURE_MODE_NOT_SUPPORTED','此表由研究人员评定，请选择研究人员录入。');}if(q.kind==='scale'){const s=scales.get(q.config.scaleVersionId);if(!s||s.code.toUpperCase()!==q.code.toUpperCase())invalid();}}
}
async function getProtocol(tx,ctx,id){const p=await tx.studyProtocolVersion.findFirst({where:{...where(ctx),id,acceptanceFixture:false},include:protocolInclude});if(!p)missing();return p;}
async function persistReceipt(tx,user,ctx,body,action,target,protocol){
 const auditId='rh-audit-'+randomUUID(),id='rh-op-'+randomUUID();
 await tx.auditLog.createMany({data:{id:auditId,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId,accountId:user.accountId,action:'researchhub.'+action,target,meta:{requestKey:body.requestKey}}});
 const result={protocol,receipt:{id,requestKey:body.requestKey,action,targetId:target}};
 await repository.saveReceipt(tx,user,{id,key:body.requestKey,hash:requestHash(body),action,target,result,auditId});return result;
}
async function replay(tx,user,body,action,target){const saved=await repository.getReceipt(tx,user,body.requestKey);if(!saved)return null;if(saved.request_hash!==requestHash(body)||saved.action!==action||saved.target_id!==target)throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','该保存请求已用于其他内容，请重新操作。');return saved.result;}
export function createProtocolConfigurationService({studies,core}){
 const run=(user,id,operation,fn)=>studies.withResearchStudyTransaction(user,id,operation,async(tx,ctx)=>{
  ctx=await authorizeProtocolConfiguration(tx,user,ctx,operation==='configure');
  return fn(tx,ctx);
 });
 return{
  get:(user,id)=>run(user,id,'read',async(tx,ctx)=>{const [project,protocols,candidates]=await Promise.all([tx.researchProject.findFirst({where:{tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,id:ctx.executionProjectId}}),tx.studyProtocolVersion.findMany({where:{...where(ctx),acceptanceFixture:false},include:protocolInclude,orderBy:{versionNumber:'desc'}}),listCaptureCandidates(tx,ctx)]);if(!project)missing();return{study:{id,title:project.name},protocols:await Promise.all(protocols.map(async p=>({...presentProtocol(p),origin:await protocolTemplateOrigin(tx,ctx,p.id)}))),...candidates,capabilities:ctx.capabilities};}),
  create:(user,id,body)=>{only(body,['requestKey','title','purpose','primaryOutcomes','secondaryOutcomes','methodsSummary','populationSummary','statisticsSummary','visitPlans']);validateMutation(body);const {requestKey,...raw}=body;const data=normalizeConfiguration(raw);if(data.visitPlans.some(p=>p.id||p.requirements.some(q=>q.id)))invalid();return run(user,id,'configure',async(tx,ctx)=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + ':' + user.accountId + ':' + body.requestKey},0))::text AS locked`;
   const prior=await replay(tx,user,body,'protocol.create',id);if(prior)return prior;await validateProtocolReferences(tx,ctx,data);
   await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${ctx.executionProjectId} AND "tenantId"=${ctx.tenantId} FOR UPDATE`;
   const actor={...user,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};
   const created=await core.createProtocolVersionInTransaction(actor,data,tx,ctx.studyGroupId,ctx.executionProjectId);
   return persistReceipt(tx,user,ctx,body,'protocol.create',id,presentProtocol(created));
  });},
  update:(user,id,protocolId,body)=>{only(body,['requestKey','expectedRevision','title','purpose','primaryOutcomes','secondaryOutcomes','methodsSummary','populationSummary','statisticsSummary','visitPlans']);validateMutation(body);if(typeof body.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedRevision))invalid();const {requestKey,expectedRevision,...raw}=body;const data=normalizeConfiguration(raw);return run(user,id,'configure',async(tx,ctx)=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + ':' + user.accountId + ':' + body.requestKey},0))::text AS locked`;
   await tx.$queryRaw`SELECT id FROM public.study_protocol_version WHERE id=${protocolId} AND "tenantId"=${ctx.tenantId} AND "researchProjectId"=${ctx.executionProjectId} FOR UPDATE`;
   const old=await getProtocol(tx,ctx,protocolId);
   const prior=await replay(tx,user,body,'protocol.update',protocolId);if(prior)return prior;
   if(old.status!=='draft')throw researchError(409,'PROTOCOL_VERSION_LOCKED','方案已锁定，不能修改。');if(presentProtocol(old).revision!==expectedRevision)conflict();await validateProtocolReferences(tx,ctx,data);
   const existing=new Map(old.visitPlans.map(p=>[p.id,p]));const seen=new Set();
   for(const p of data.visitPlans){if(p.id){if(!existing.has(p.id)||seen.has(p.id))invalid();seen.add(p.id);const oldReq=new Set(existing.get(p.id).requirements.map(q=>q.id));const reqSeen=new Set();for(const q of p.requirements){if(q.id&&(!oldReq.has(q.id)||reqSeen.has(q.id)))invalid();if(q.id)reqSeen.add(q.id);}}else if(p.requirements.some(q=>q.id))invalid();}
   const linked=await tx.studyEnrollment.count({where:{...where(ctx),protocolVersionId:protocolId}});if(linked)throw researchError(409,'PROTOCOL_IN_USE','方案已有入组记录，不能修改。');
   const removed=old.visitPlans.filter(p=>!seen.has(p.id));for(const plan of old.visitPlans){if(await tx.studyTaskTemplate.count({where:{...where(ctx),visitPlanId:plan.id}}))throw researchError(409,'PROTOCOL_IN_USE','方案关联任务模板，不能直接修改。');if(await tx.subjectVisit.count({where:{...where(ctx),visitPlanId:plan.id}}))throw researchError(409,'PROTOCOL_IN_USE','方案已有访视记录，不能修改。');}
   for(const plan of removed)await tx.visitPlan.delete({where:{id:plan.id}});
   for(const p of data.visitPlans){const {id:planId,requirements,...fields}=p;let saved;if(planId){saved=await tx.visitPlan.update({where:{id:planId},data:fields});const keep=requirements.filter(q=>q.id).map(q=>q.id);await tx.visitRequirement.deleteMany({where:{visitPlanId:planId,id:{notIn:keep}}});}else saved=await tx.visitPlan.create({data:{...where(ctx),protocolVersionId:protocolId,...fields}});
    for(const q of requirements){const {id:qid,...fields}=q;if(qid)await tx.visitRequirement.update({where:{id:qid},data:fields});else await tx.visitRequirement.create({data:{...where(ctx),visitPlanId:saved.id,...fields}});}
   }
   const {visitPlans,...fields}=data;await tx.studyProtocolVersion.update({where:{id:protocolId},data:fields});return persistReceipt(tx,user,ctx,body,'protocol.update',protocolId,presentProtocol(await getProtocol(tx,ctx,protocolId)));
  });}
 };
}
