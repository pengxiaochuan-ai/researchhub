import {researchError} from '../server/research-studies/contract.mjs';

// V2-only equivalent of native prepareWorkbench, without its preliminary source
// projection. These two IDs are not a source proof; native create must follow.
export async function prepareFullStudyWorkbench(native,user,dto,{descriptiveReference,canonicalManifestHash,exceptions}={}){
 if(typeof descriptiveReference!=='function'||typeof canonicalManifestHash!=='function'||!['BadRequestException','ConflictException','ForbiddenException','NotFoundException'].every(k=>typeof exceptions?.[k]==='function'))throw researchError(503,'FULL_STUDY_PREPARE_UNAVAILABLE','当前分析准备暂不可用。');
 const {BadRequestException,ConflictException,ForbiddenException,NotFoundException}=exceptions,key='descriptive-statistics';
 native.resolver();const ref=descriptiveReference(dto.input);
 if(typeof dto.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(dto.idempotencyKey))throw new BadRequestException({code:'INVALID_ANALYSIS_INPUT'});
 return native.transaction(user,async tx=>{
  const known=native.deps?.jobAdapter?await tx.researchMethodRun.findUnique({where:{tenantId_idempotencyKey:{tenantId:user.tenantId,idempotencyKey:dto.idempotencyKey}}}):null;
  if(native.deps?.jobAdapter&&!known)await native.legacyBefore(tx,user,'prepare',ref,dto.idempotencyKey);
  const currentUser=await native.accountAuthority(tx,user),s=native.scope(currentUser);await native.workerFeature(tx,s.tenantId);
  const existing=await tx.researchMethodRun.findUnique({where:{tenantId_idempotencyKey:{tenantId:s.tenantId,idempotencyKey:dto.idempotencyKey}}});
  if(existing){
   if(existing.accountId!==user.accountId||existing.skillKey!==key||existing.studyGroupId!==s.studyGroupId||existing.researchProjectId!==s.researchProjectId||canonicalManifestHash(existing.inputSummary)!==canonicalManifestHash(ref))throw new ConflictException({code:'IDEMPOTENCY_KEY_CONFLICT',message:'该请求已用于其他运行。'});
   await native.agentAuthority(tx,currentUser,existing.agentId,existing.skillVersion);await native.authority(tx,currentUser,existing,existing.skillVersion);
   return{sessionId:existing.sessionId,agentId:existing.agentId};
  }
  const agents=await tx.agent.findMany({where:{tenantId:s.tenantId,type:'research',status:'active'},orderBy:[{createdAt:'asc'},{id:'asc'}]});let selected;
  for(const agent of agents){try{await native.agentAuthority(tx,currentUser,agent.id);selected=agent;break;}catch(error){if(!(error instanceof ForbiddenException)&&!(error instanceof NotFoundException))throw error;}}
  if(!selected)throw new NotFoundException({code:'AGENT_NOT_FOUND',message:'未找到已装备描述统计方法的科研 Agent。'});
  const session=await tx.session.findFirst({where:{...s,accountId:user.accountId,agentId:selected.id,channel:'workbench',contextKey:key,deletedAt:null},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  if(session){
   await tx.$queryRaw`SELECT id FROM public.session WHERE id=${session.id} FOR SHARE`;
   const fresh=await tx.session.findUnique({where:{id:session.id}});
   if(!fresh||fresh.deletedAt||fresh.tenantId!==s.tenantId||fresh.studyGroupId!==s.studyGroupId||fresh.researchProjectId!==s.researchProjectId||fresh.accountId!==user.accountId||fresh.agentId!==selected.id||fresh.channel!=='workbench'||fresh.contextKey!==key)throw new ForbiddenException({code:'METHOD_AUTHORIZATION_REVOKED',message:'当前账号、会话或分析方法权限已失效。'});
   return{sessionId:fresh.id,agentId:selected.id};
  }
  const created=await tx.session.create({data:{...s,accountId:user.accountId,agentId:selected.id,title:'描述统计',channel:'workbench',contextKey:key,roleSnapshot:currentUser.role}});
  return{sessionId:created.id,agentId:selected.id};
 });
}
