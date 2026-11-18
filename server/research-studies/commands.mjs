import {assertApprovedInTransaction} from '../admission/service.mjs';
import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {isTenantAdmin,normalizeIntent,only,researchError,requestHash,selectCreationGroup,validateMutation} from './contract.mjs';
import * as pg from './repository.mjs';
import {createResearchDirectory} from './directory.mjs';
const denied=()=>{throw researchError(403,'RESEARCH_FORBIDDEN','当前账号无权操作此研究。');};
const missing=()=>{throw researchError(404,'RESEARCH_NOT_FOUND','研究不存在或当前账号无权查看。');};
const conflict=()=>{throw researchError(409,'RESEARCH_VERSION_CONFLICT','课题已被更新，请刷新后核对；当前输入已保留。');};
export function protocolPreparation(protocols){
 protocols=protocols.filter(p=>p.acceptanceFixture!==true);
 const scheduled=p=>p.visitPlans?.length>0&&p.visitPlans.every(v=>Boolean(v.anchor)&&v.targetDayOffset!=null&&v.windowBeforeDays!=null&&v.windowAfterDays!=null);
 const executing=protocols.find(p=>p.status==='executing');
 if(executing){const ready=scheduled(executing);return{status:ready?'protocol_executing':'execution_needs_check',label:ready?'方案执行中':'执行安排待核对',canStartCollection:false,executingProtocol:{id:executing.id,versionNumber:executing.versionNumber,title:executing.title},message:ready?'当前方案已启用；具体采集条件请按受试者与访视记录核对。':'当前方案标记为执行中，访视安排尚需核对。'};}
 const approved=protocols.some(p=>p.status==='approved'&&scheduled(p));
 return {status:approved?'protocol_approved':'protocol_required',label:approved?'已批准，待启用':'研究准备中',canStartCollection:false,message:approved?'方案已批准，尚待启用；请核对研究启动条件。':'研究已建立，尚需准备并审批研究方案。'};
}
export function createResearchStudiesService({prisma,scope,lockAuthorization,createResearchProject,repository=pg,legacyHints}){
 const repo=repository;
 const transactionLane=new AsyncLocalStorage();
 if(scope?.product!=='researchhub'||!Array.isArray(scope.allowedTenantIds)||typeof prisma?.withTenantTransaction!=='function'||typeof lockAuthorization!=='function'||typeof createResearchProject!=='function')throw Error('RESEARCH_DEPENDENCIES_REQUIRED');
 async function transact(principal,fn,{includeOfficial=false}={}){
  if(transactionLane.getStore())throw researchError(500,'RESEARCH_NESTED_TRANSACTION','研究事务不能嵌套，请重试。');
  if(!principal||!scope.allowedTenantIds.includes(principal.tenantId)||typeof principal.accountId!=='string'||!Number.isInteger(principal.authVersion))throw researchError(401,'AUTH_SESSION_EXPIRED','登录会话已失效，请重新登录。');
  return transactionLane.run(true,()=>prisma.withTenantTransaction(principal.tenantId,undefined,undefined,async tx=>{
   if(includeOfficial)await lockAuthorization(tx,principal.tenantId,{includeOfficial:true});
   else await lockAuthorization(tx,principal.tenantId);
   const a=await tx.account.findFirst({where:{id:principal.accountId,tenantId:principal.tenantId},include:{tenant:{select:{status:true}}}});
   if(!a||a.status!=='active'||a.tenant?.status!=='active'||a.authVersion!==principal.authVersion)throw researchError(401,'AUTH_SESSION_EXPIRED','登录会话已失效，请重新登录。');
   const user={accountId:a.id,tenantId:a.tenantId,role:a.role,isTenantAdmin:a.isTenantAdmin,authVersion:a.authVersion};
   if(user.role==='platform_admin'||user.isTenantAdmin!==(user.role==='tenant_admin'))denied();
   await repo.setContext(tx,user);await assertApprovedInTransaction(tx,user);return fn(tx,user);
  },{isolationLevel:'ReadCommitted',maxWait:5000,timeout:15000}));
 }
 async function contextIn(tx,user,hubKey=undefined){
  const [groups,memberships,hubRoles,hubs]=await Promise.all([
   tx.studyGroup.findMany({where:{tenantId:user.tenantId,status:'active'},select:{id:true,name:true}}),
   tx.studyGroupMembership.findMany({where:{tenantId:user.tenantId,accountId:user.accountId,status:'active'},include:{role:true}}),
   repo.roles(tx,user),tx.$queryRaw`SELECT hub_key AS "hubKey",name FROM rh_hub.hub WHERE tenant_id=${user.tenantId} AND status='active' ORDER BY name`
  ]);
  const permitted=new Set(memberships.filter(m=>m.role?.tenantId===user.tenantId&&m.role.status==='active'&&Array.isArray(m.role.menuPermissions)&&m.role.menuPermissions.includes('workbench')&&Array.isArray(m.role.buttonPermissions)&&m.role.buttonPermissions.includes('study.configure')).map(m=>m.studyGroupId));
  const ownerGroups=new Set(hubRoles.filter(r=>hubKey===undefined||r.hub_key===hubKey).map(r=>r.study_group_id));
  return{capabilities:{canCreateProject:true},creationGroups:groups.filter(g=>isTenantAdmin(user)||permitted.has(g.id)||ownerGroups.has(g.id)),hubs,hubRoles};
 }
 async function authorize(tx,user,row,write=false){
  if(!row)missing();const study=await repo.binding(tx,user,row.id);
  const role=(await repo.roles(tx,user)).find(r=>r.hub_key===row.hub_key&&(!study||r.study_group_id===study.study_group_id));
  const manage=isTenantAdmin(user)||row.owner_id===user.accountId||Boolean(role);
  if(write&&!manage)denied();
  if(write&&study)await authorizeStudy(tx,user,row,study);
  if(!manage){
   if(!study)missing();await repo.setContext(tx,user,study.study_group_id,study.execution_project_id);
   const [project,member,groupMember]=await Promise.all([
    tx.researchProject.findFirst({where:{id:study.execution_project_id,tenantId:user.tenantId,studyGroupId:study.study_group_id,status:'active'}}),
    tx.researchProjectMembership.findFirst({where:{researchProjectId:study.execution_project_id,tenantId:user.tenantId,studyGroupId:study.study_group_id,accountId:user.accountId,status:'active'}}),
    tx.studyGroupMembership.findFirst({where:{tenantId:user.tenantId,studyGroupId:study.study_group_id,accountId:user.accountId,status:'active'},include:{role:true}})
   ]);
   const groupRead=groupMember?.role?.status==='active'&&groupMember.role.tenantId===user.tenantId&&Array.isArray(groupMember.role.menuPermissions)&&groupMember.role.menuPermissions.includes('workbench')&&groupMember.role.dataScope==='group';
   const memberRead=member&&groupMember?.role?.status==='active'&&groupMember.role.tenantId===user.tenantId&&Array.isArray(groupMember.role.menuPermissions)&&groupMember.role.menuPermissions.includes('workbench');
   if(!project||(!memberRead&&!groupRead))missing();
  }
  return{study,manage};
 }
 async function authorizeStudy(tx,user,row,study){
  if(!study)missing();await repo.setContext(tx,user,study.study_group_id,study.execution_project_id);
  const [project,group,member,groupMember,hubRoles]=await Promise.all([
   tx.researchProject.findFirst({where:{id:study.execution_project_id,tenantId:user.tenantId,studyGroupId:study.study_group_id,status:'active'}}),
   tx.studyGroup.findFirst({where:{id:study.study_group_id,tenantId:user.tenantId,status:'active'}}),
   tx.researchProjectMembership.findFirst({where:{researchProjectId:study.execution_project_id,tenantId:user.tenantId,studyGroupId:study.study_group_id,accountId:user.accountId,status:'active'}}),
   tx.studyGroupMembership.findFirst({where:{tenantId:user.tenantId,studyGroupId:study.study_group_id,accountId:user.accountId,status:'active'},include:{role:true}}),repo.roles(tx,user)
  ]);
  const hubOwner=hubRoles.some(r=>r.hub_key===row.hub_key&&r.study_group_id===study.study_group_id);
  const groupRead=groupMember?.role?.status==='active'&&groupMember.role.tenantId===user.tenantId&&Array.isArray(groupMember.role.menuPermissions)&&groupMember.role.menuPermissions.includes('workbench')&&groupMember.role.dataScope==='group';
  const memberRead=member&&groupMember?.role?.status==='active'&&groupMember.role.tenantId===user.tenantId&&Array.isArray(groupMember.role.menuPermissions)&&groupMember.role.menuPermissions.includes('workbench');
  if(!project||!group||(!isTenantAdmin(user)&&!hubOwner&&!memberRead&&!groupRead))missing();
  const manage=isTenantAdmin(user)||hubOwner||Boolean(memberRead&&member.roleKey==='project_manager');
  const buttons=Array.isArray(groupMember?.role?.buttonPermissions)?groupMember.role.buttonPermissions:[],menus=Array.isArray(groupMember?.role?.menuPermissions)?groupMember.role.menuPermissions:[],nativeReader=isTenantAdmin(user)||Boolean(memberRead);
  return{tenantId:user.tenantId,studyGroupId:study.study_group_id,executionProjectId:study.execution_project_id,projectIntentId:row.id,studyId:study.id,studyTitle:row.title,capabilities:{canRead:true,canConfigure:manage,canEdit:manage,canCollect:false},workflowCapabilities:{canReadVisits:nativeReader,canReadAnalysis:nativeReader&&(isTenantAdmin(user)||buttons.includes('data.analyze')),canReadReports:nativeReader&&(isTenantAdmin(user)||menus.includes('artifacts')&&buttons.includes('artifact.read'))}};
 }
 async function resolveIn(tx,user,studyId,operation='read'){
  if(!['read','configure'].includes(operation))throw researchError(403,'RESEARCH_OPERATION_UNAVAILABLE','当前阶段尚未开放此研究操作。');
  const study=(await tx.$queryRaw`SELECT * FROM rh_research.study_binding WHERE tenant_id=${user.tenantId} AND id=${studyId}`)[0];if(!study)missing();const row=await repo.findIntent(tx,user,study.project_intent_id);if(!row)missing();
  const context=await authorizeStudy(tx,user,row,study);if(operation==='configure'&&!context.capabilities.canConfigure)denied();return context;
 }
 async function result(tx,user,row,auth){const ctx=await contextIn(tx,user,row.hub_key);return{item:repo.present(row,auth.study),capabilities:{canEdit:auth.manage,canCreateStudy:auth.manage&&!auth.study&&ctx.creationGroups.length>0},creationGroups:ctx.creationGroups,hubs:ctx.hubs};}
 async function replay(tx,user,key,hash,action,target){const saved=await repo.getReceipt(tx,user,key);if(!saved)return null;if(saved.request_hash!==hash||saved.action!==action||saved.target_id!==target)throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','该保存请求已用于其他内容，请重新操作。');return saved.result;}
 async function receipt(tx,user,input,action,target,value,groupId){
  const auditId='rh-audit-'+randomUUID();
  await tx.auditLog.createMany({data:{id:auditId,tenantId:user.tenantId,accountId:user.accountId,studyGroupId:groupId??null,researchProjectId:value.item?.study?.executionProjectId??null,action:'researchhub.'+action,target,meta:{requestKey:input.requestKey,version:value.item?.version,authVersion:user.authVersion,requestHash:requestHash(input)}}});
  const id='rh-op-'+randomUUID(),out={...value,receipt:{id,requestKey:input.requestKey,action,targetId:target,requestHash:requestHash(input),authVersion:user.authVersion}};
  await repo.saveReceipt(tx,user,{id,key:input.requestKey,hash:requestHash(input),action,target,result:out,auditId});return out;
 }
 const directory=createResearchDirectory({transact,legacyHints});
 const editableBody=body=>Object.fromEntries(Object.entries(body).filter(([k])=>!['requestKey','expectedVersion'].includes(k)));
 return Object.freeze({
  directory:directory.list,reviewDirectory:directory.listForReview,executionDetail:directory.execution,
  // Internal composition: caller holds current authorization and the transaction.
  resolveResearchStudyInTransaction:async(tx,user,studyId,operation='read')=>{await assertApprovedInTransaction(tx,user);return resolveIn(tx,user,studyId,operation);},
  resolveResearchStudy:(user,studyId,{operation='read',siteId}={})=>transact(user,async(tx,u)=>{if(siteId!==undefined)throw researchError(403,'RESEARCH_SITE_UNAVAILABLE','当前研究尚未开放中心范围操作。');return resolveIn(tx,u,studyId,operation);}),
  async withResearchStudyTransaction(user,studyId,operation,callback,options={}){only(options,['includeOfficial']);if(options.includeOfficial!==undefined&&typeof options.includeOfficial!=='boolean')throw researchError(400,'RESEARCH_INPUT_INVALID','事务选项无效。');return transact(user,async(tx,u)=>{const context=await resolveIn(tx,u,studyId,operation);return callback(tx,context);},options);},
  context:user=>transact(user,async(tx,u)=>{const {hubRoles,...ctx}=await contextIn(tx,u);return ctx;}),
  list:(user,query={})=>transact(user,async(tx,u)=>{
   const limit=query.limit===undefined?30:Number(query.limit);if(!Number.isInteger(limit)||limit<1||limit>100||query.cursor!==undefined&&(typeof query.cursor!=='string'||query.cursor.length>200))throw researchError(400,'RESEARCH_INPUT_INVALID','列表参数无效。');
   const rows=await tx.$queryRaw`SELECT * FROM rh_research.project_intent WHERE tenant_id=${u.tenantId} AND id>${query.cursor??''} ORDER BY id LIMIT 1001`;
   const items=[];let nextCursor=null;for(const row of rows){try{const auth=await authorize(tx,u,row);if(items.length===limit){nextCursor=items.at(-1).id;break;}items.push(repo.present(row,auth.study));}catch(e){if(e.status!==404&&e.status!==403)throw e;}}
   if(!nextCursor&&rows.length===1001)nextCursor=rows.at(-1).id;return{items,nextCursor};
  }),
  detail:(user,id)=>transact(user,async(tx,u)=>{const row=await repo.findIntent(tx,u,id);return result(tx,u,row,await authorize(tx,u,row));}),
  projectReceipt:(user,key,query={})=>{only(query,['action','targetId','requestHash']);validateMutation({requestKey:key});
   if(!['intent.create','intent.update','study.create'].includes(query.action)||!/^[a-f0-9]{64}$/.test(query.requestHash??'')||(query.action!=='intent.create'&&!/^[A-Za-z0-9_-]{1,160}$/.test(query.targetId??''))||(query.targetId!==undefined&&!/^[A-Za-z0-9_-]{1,160}$/.test(query.targetId)))throw researchError(400,'RESEARCH_INPUT_INVALID','无法核对这次课题操作，请从原课题继续。');
   return transact(user,async(tx,u)=>{
    const saved=await repo.getReceipt(tx,u,key);if(!saved)throw researchError(404,'RESEARCH_RECEIPT_NOT_FOUND','上次操作尚无可核定回执，请保留输入后继续核对。');
    if(saved.action!==query.action||saved.request_hash!==query.requestHash||(query.targetId!==undefined&&saved.target_id!==query.targetId))throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','这次操作与原课题不一致，请保留输入并核对。');
    const proof=saved.result?.receipt;
    if(proof?.requestKey!==key||proof.action!==saved.action||proof.targetId!==saved.target_id||proof.requestHash!==saved.request_hash||proof.authVersion!==u.authVersion)throw researchError(409,'RESEARCH_RECEIPT_UNCONFIRMED','尚不能核定上次操作，请保留输入并核对已保存课题。');
    const row=await repo.findIntent(tx,u,saved.target_id),auth=await authorize(tx,u,row,true);
    return {...saved.result,current:await result(tx,u,row,auth)};
   });
  },
  create:(user,body)=>{only(body,['requestKey','title','question','pico','researchType','hubKey']);validateMutation(body);const input=normalizeIntent(editableBody(body));return transact(user,async(tx,u)=>{
   const prior=await repo.getReceipt(tx,u,body.requestKey);if(prior){const row=await repo.findIntent(tx,u,prior.target_id);await authorize(tx,u,row,true);return replay(tx,u,body.requestKey,requestHash(body),'intent.create',prior.target_id);}
   if(input.hubKey&&!((await contextIn(tx,u)).hubs.some(h=>h.hubKey===input.hubKey)))throw researchError(400,'RESEARCH_HUB_UNAVAILABLE','请选择当前可用的领域。');
   const id='rh-project-'+randomUUID();await repo.insertIntent(tx,u,id,input);const row=await repo.findIntent(tx,u,id);return receipt(tx,u,body,'intent.create',id,await result(tx,u,row,{study:null,manage:true}));
  });},
  update:(user,id,body)=>{only(body,['requestKey','expectedVersion','title','question','pico','researchType','hubKey']);validateMutation(body,true);const patch=normalizeIntent(editableBody(body),{partial:true});return transact(user,async(tx,u)=>{
   const row=await repo.findIntent(tx,u,id,{lock:true}),auth=await authorize(tx,u,row,true);const prior=await replay(tx,u,body.requestKey,requestHash(body),'intent.update',id);if(prior)return prior;
   if(row.version!==body.expectedVersion)conflict();if(auth.study&&Object.hasOwn(patch,'hubKey')&&patch.hubKey!==row.hub_key)throw researchError(409,'RESEARCH_HUB_BOUND','研究建立后不能更换所属领域。');
   const input={...repo.present(row,auth.study),...patch};if(input.hubKey&&!((await contextIn(tx,u)).hubs.some(h=>h.hubKey===input.hubKey)))throw researchError(400,'RESEARCH_HUB_UNAVAILABLE','请选择当前可用的领域。');
   if(auth.study)await repo.setContext(tx,u,auth.study.study_group_id,auth.study.execution_project_id);
   if(await repo.updateIntent(tx,u,id,row.version,input,row.status)!==1)conflict();return receipt(tx,u,body,'intent.update',id,await result(tx,u,await repo.findIntent(tx,u,id),auth),auth.study?.study_group_id);
  });},
  createStudy:(user,id,body)=>{only(body,['requestKey','expectedVersion','studyGroupId']);validateMutation(body,true);return transact(user,async(tx,u)=>{
   const row=await repo.findIntent(tx,u,id,{lock:true}),auth=await authorize(tx,u,row,true);const prior=await replay(tx,u,body.requestKey,requestHash(body),'study.create',id);if(prior)return prior;
   if(row.version!==body.expectedVersion)conflict();if(auth.study)throw researchError(409,'RESEARCH_STUDY_EXISTS','该课题已经建立研究，请进入现有研究。');
   const group=selectCreationGroup((await contextIn(tx,u,row.hub_key)).creationGroups,body.studyGroupId);await repo.setContext(tx,u,group.id);
   const project=await createResearchProject(tx,u,group.id,{name:row.title,code:'rh-'+randomUUID(),description:row.question});
   const studyId='rh-study-'+randomUUID();await repo.insertBinding(tx,u,{id:studyId,intentId:id,projectId:project.id,groupId:group.id,hubKey:row.hub_key});
   if(await repo.updateIntent(tx,u,id,row.version,repo.present(row,null),'study_created')!==1)conflict();await repo.setContext(tx,u,group.id,project.id);
   const updated=await repo.findIntent(tx,u,id);return receipt(tx,u,body,'study.create',id,await result(tx,u,updated,{manage:true,study:await repo.binding(tx,u,id)}),group.id);
  });},
  overview:(user,studyId)=>transact(user,async(tx,u)=>{
   const study=(await tx.$queryRaw`SELECT * FROM rh_research.study_binding WHERE tenant_id=${u.tenantId} AND id=${studyId}`)[0];if(!study)missing();const row=await repo.findIntent(tx,u,study.project_intent_id);if(!row)missing();const studyContext=await authorizeStudy(tx,u,row,study);
   await repo.setContext(tx,u,study.study_group_id,study.execution_project_id);const where={tenantId:u.tenantId,studyGroupId:study.study_group_id,researchProjectId:study.execution_project_id};
   const [execution,subjects,members,tasks,protocols]=await Promise.all([
    tx.researchProject.findFirst({where:{id:study.execution_project_id,tenantId:u.tenantId,studyGroupId:study.study_group_id}}),tx.subject.count({where:{...where,deletedAt:null}}),tx.researchProjectMembership.count({where:{...where,status:'active'}}),tx.studyTask.count({where}),tx.studyProtocolVersion.findMany({where:{...where,acceptanceFixture:false},select:{id:true,status:true,versionNumber:true,title:true,visitPlans:{select:{anchor:true,targetDayOffset:true,windowBeforeDays:true,windowAfterDays:true}}},orderBy:{versionNumber:'desc'}})
   ]);if(!execution||execution.status!=='active')missing();const preparation=protocolPreparation(protocols);return{item:{project:repo.present(row,study),study:{id:study.id,executionProjectId:execution.id,studyGroupId:study.study_group_id,name:execution.name,status:execution.status,createdAt:new Date(study.created_at).toISOString()},counts:{subjects,members,tasks,protocols:protocols.length},preparation:{...preparation,protocols:protocols.map(({visitPlans,...p})=>p)},capabilities:studyContext.capabilities,workflowCapabilities:studyContext.workflowCapabilities}};
  }),
  setHubRole:(user,hubKey,accountId,body)=>{only(body,['requestKey','expectedVersion','studyGroupId','role','status']);validateMutation(body);if(body.expectedVersion!==undefined&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0)||typeof body.studyGroupId!=='string'||body.role!=='owner'||!['active','disabled'].includes(body.status))throw researchError(400,'RESEARCH_INPUT_INVALID','领域负责人配置无效。');return transact(user,async(tx,u)=>{
   if(!isTenantAdmin(u))denied();const target=hubKey+':'+accountId;const prior=await replay(tx,u,body.requestKey,requestHash(body),'hub-role.set',target);if(prior)return prior;
   const [a,g,h]=await Promise.all([tx.account.findFirst({where:{id:accountId,tenantId:u.tenantId,status:'active'}}),tx.studyGroup.findFirst({where:{id:body.studyGroupId,tenantId:u.tenantId,status:'active'}}),tx.$queryRaw`SELECT 1 FROM rh_hub.hub WHERE tenant_id=${u.tenantId} AND hub_key=${hubKey} AND status='active'`]);if(!a||a.role==='platform_admin'||!g||!h.length)throw researchError(400,'RESEARCH_HUB_ROLE_SCOPE_INVALID','账号、课题组或领域不可用。');
   const old=(await tx.$queryRaw`SELECT * FROM rh_research.hub_role WHERE tenant_id=${u.tenantId} AND hub_key=${hubKey} AND account_id=${accountId} FOR UPDATE`)[0];if((old?.version??0)!==(body.expectedVersion??0))conflict();
   await tx.$executeRaw`INSERT INTO rh_research.hub_role (tenant_id,hub_key,account_id,study_group_id,role,status) VALUES (${u.tenantId},${hubKey},${accountId},${body.studyGroupId},${body.role},${body.status}) ON CONFLICT(tenant_id,hub_key,account_id) DO UPDATE SET study_group_id=EXCLUDED.study_group_id,role=EXCLUDED.role,status=EXCLUDED.status,version=rh_research.hub_role.version+1,updated_at=now()`;
   return receipt(tx,u,body,'hub-role.set',target,{item:{tenantId:u.tenantId,hubKey,accountId,studyGroupId:body.studyGroupId,role:body.role,status:body.status,version:(old?.version??0)+1}});
  });}
 });
}
