import{readResearchRuntimeConfig}from'../server/research-runtime/config.mjs';
import{runtimeDependencies}from'../server/research-runtime/dependencies.mjs';
import{createAdmissionService}from'../server/admission/service.mjs';
import{createResearchStudiesService}from'../server/research-studies/commands.mjs';
import{pathToFileURL}from'node:url';import{resolve}from'node:path';
const fail=()=>{throw Error('REHEARSAL_SEED_SCOPE_REJECTED');};
export async function seedRehearsalFoundation({prisma,load,require,runId,database,passwords}){
 if(!/^rh-deploy-\d{8}-[a-f0-9]{8}$/.test(runId??'')||database!=='rh_deploy_'+runId.slice(-8)||!['admin','owner','invite'].every(k=>typeof passwords?.[k]==='string'&&passwords[k].length>=20&&passwords[k].length<=64))fail();
 const prefix='rh-deploy-'+runId.slice(-8)+'-',ids={tenant:prefix+'tenant',admin:prefix+'admin',owner:prefix+'owner',invite:prefix+'invite',group:prefix+'group',reader:prefix+'reader'},tenantSlug=prefix+'tenant';
 const lock=load('common/worker-publication','lockAuthorizationMutation'),bcrypt=require('bcryptjs');
 const hashes=Object.fromEntries(await Promise.all(['admin','owner','invite'].map(async k=>[k,await bcrypt.hash(passwords[k],10)])));
 const admission=createAdmissionService({tenantId:ids.tenant,transact:fn=>prisma.elevated.$transaction(fn),lockAuthorization:lock});
 const admin={accountId:ids.admin,tenantId:ids.tenant,role:'tenant_admin',isTenantAdmin:true,authVersion:0};
 await prisma.elevated.$transaction(async tx=>{
  const [actual]=await tx.$queryRawUnsafe("SELECT current_database() AS name,current_user AS role,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()");
  let marker;try{marker=JSON.parse(actual.marker);}catch{fail();}
  if(actual.name!==database||actual.role!=='aisci_owner'||marker.syntheticOnly!==true||marker.runId!==runId||marker.purpose!=='researchhub-deployment-rehearsal')fail();
  await lock(tx,ids.tenant,{includeOfficial:true});
  if(await tx.tenant.count()||await tx.account.count()||await tx.researchProject.count())fail();
  await tx.tenant.create({data:{id:ids.tenant,name:'灵枢心域·独立部署合成验证',slug:tenantSlug,quotaSeats:4,quotaStudyGroups:1}});
  for(const kind of ['admin','owner','invite'])await tx.account.create({data:{id:ids[kind],tenantId:ids.tenant,username:'deploy.'+kind+'@example.test',emailNormalized:'deploy.'+kind+'@example.test',emailVerifiedAt:new Date(),displayName:{admin:'合成管理员',owner:'合成科研人员',invite:'合成受邀科研人员'}[kind],passwordHash:hashes[kind],role:kind==='admin'?'tenant_admin':'researcher',isTenantAdmin:kind==='admin'}});
  await tx.permissionRole.create({data:{id:ids.reader,tenantId:ids.tenant,key:'deployment-study-reader',name:'研究只读成员',menuPermissions:['workbench','knowledge','artifacts'],buttonPermissions:['artifact.read'],dataScope:'group'}});
  await tx.studyGroup.create({data:{id:ids.group,tenantId:ids.tenant,name:'独立部署合成研究组',slug:prefix+'group',createdBy:ids.admin}});
  await tx.studyGroupMembership.create({data:{id:prefix+'owner-membership',tenantId:ids.tenant,studyGroupId:ids.group,accountId:ids.owner,roleId:ids.reader,isDefault:true}});
  await tx.$executeRawUnsafe("INSERT INTO rh_hub.hub(tenant_id,hub_key,name,summary,status,scope_status) VALUES($1,'lingshu-xinyu','灵枢心域','仅用于独立部署的合成验证，不含临床数据。','active','pending_expert_confirmation')",ids.tenant);
  for(const kind of ['admin','owner','invite']){
   const account=await tx.account.findUnique({where:{id:ids[kind]}});await admission.legacyInTransaction(tx,admin,account,'deploy_admission_'+kind);
  }
 },{maxWait:5000,timeout:20000});
 const scope={deploymentId:runId,product:'researchhub',allowedTenantIds:[ids.tenant],defaultTenantId:ids.tenant,controlPlaneEnabled:false,officialJobKinds:[],enabledWorkerKinds:[]},core=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma);
 const studies=createResearchStudiesService({prisma,scope,lockAuthorization:lock,createResearchProject:(tx,user,group,input)=>core.createResearchProjectInTransaction(tx,user,group,input)});
 const project=await studies.create(admin,{requestKey:'deploy_intent_create',title:'独立部署合成科研流程',question:'仅校验部署、账号和真实数据库边界，不生成科研结论。',hubKey:'lingshu-xinyu',researchType:'合成技术验证',pico:{p:'合成材料',i:'部署验证',c:'无',o:'软件边界证据'}});
 if(!project.item?.id||!project.item?.version)fail();
 const created=await studies.createStudy(admin,project.item.id,{requestKey:'deploy_study_create',expectedVersion:project.item.version,studyGroupId:ids.group});
 const study=created.item?.study;if(!study?.id||!study.executionProjectId)fail();
 await prisma.withTenantTransaction(ids.tenant,ids.group,study.executionProjectId,async tx=>{await lock(tx,ids.tenant,{includeOfficial:true});await tx.$executeRawUnsafe("SELECT set_config('app.account_id',$1,true),set_config('app.auth_version','0',true)",ids.admin);return tx.researchProjectMembership.create({data:{id:prefix+'owner-project-membership',tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:study.executionProjectId,accountId:ids.owner,roleKey:'researcher',isDefault:true}});});
 return{schemaVersion:1,runId,syntheticOnly:true,ids:{...ids,project:study.executionProjectId,study:study.id,intent:project.item.id},tenantSlug,accounts:['admin','owner','invite'].map(kind=>({kind,id:ids[kind],email:'deploy.'+kind+'@example.test'})),bounds:{accounts:4,studies:1,permissionRoles:1,knowledgeBases:1,documents:1,tasks:1,reportDrafts:1,assetCandidates:1,challenges:2,invitations:1},tokenQuotaGranted:false,modelCalls:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let prisma;
 try{
  if(process.env.HUB_REHEARSAL_SEED!=='approved-0fbba918')fail();
  const config=readResearchRuntimeConfig(process.env),{load,require}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();
  const result=await seedRehearsalFoundation({prisma,load,require,runId:config.scope.deploymentId,database:config.identity.database,passwords:{admin:process.env.HUB_SEED_ADMIN_PASSWORD,owner:process.env.HUB_SEED_OWNER_PASSWORD,invite:process.env.HUB_SEED_INVITE_PASSWORD}});console.log(JSON.stringify(result));
 }catch(error){console.error(error.message?.startsWith('REHEARSAL_')?error.message:'REHEARSAL_SEED_FAILED');process.exitCode=1;}
 finally{await prisma?.onModuleDestroy?.();}
}
