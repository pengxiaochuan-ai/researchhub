// F06 owned synthetic runtime preparation. Never reads an existing DB or env.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRehearsal,rehearsalSql,validateRehearsalState} from '../deploy/rehearsal.mjs';
import {bootstrapRehearsal} from '../deploy/bootstrap-rehearsal.mjs';
import {loadMigrationBundle} from '../deploy/migration-plan.mjs';
import {migrationPlan,applyMigrations,rehearsalDriver} from '../deploy/migration-runner.mjs';
import {referenceDataSql} from '../deploy/reference-data.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const baselineDigest='4f04b36d8dc505866c340731812a3a41b44e6b3a1af1b380648c1a6ebfcbcd6a';
const previous=path.join(root,'.tmp/deployment-delivery-20261118');
const image='researchhub-backend:rehearsal-full-v33-0fbba918';
const save=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const run=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024,...options});
const fail=()=>{throw Error('F06_REHEARSAL_SCOPE_REJECTED');};
function target(directory){const p=path.resolve(directory);if(!p.startsWith(path.join(root,'.tmp/f06-hub-assets-'))||fs.existsSync(p))fail();return p;}
async function freePort(){for(let port=19661;port<=19749;port++){const available=await new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});if(available)return port;}throw Error('F06_REHEARSAL_NO_FREE_PORT');}
export async function prepareF06Rehearsal(directory){
 directory=target(directory);
 const sourceSql=path.join(previous,'source-structure.sql'),securityFile=path.join(previous,'source-catalog-security.json');
 if(createHash('sha256').update(fs.readFileSync(sourceSql)).digest('hex')!==baselineDigest)fail();
 const state=await createRehearsal(directory,{port:await freePort()});
 bootstrapRehearsal({directory,sourceSql,securityFile,expectedSourceDigest:baselineDigest});
 const bundle=loadMigrationBundle(path.join(root,'deploy/migrations/researchhub-production-equivalence-v1')),driver=rehearsalDriver(state),plan=migrationPlan(bundle,driver);
 const applied=applyMigrations(bundle,driver,plan.digest);rehearsalSql(state,referenceDataSql());
 const network=state.runId+'-f06';run(['network','create','--label','researchhub.rehearsal='+state.runId,network]);run(['network','connect','--alias','f06-pg',network,state.container]);
 const urls=JSON.parse(fs.readFileSync(path.join(directory,'runtime-database.json'))),rewrite=value=>{const u=new URL(value);u.hostname='f06-pg';u.port='5432';return u.toString();};
 const release=JSON.parse(fs.readFileSync(path.join(previous,'backend-context-v33/release.json'))),passwords=Object.fromEntries(['admin','owner','invite'].map(k=>[k,randomBytes(24).toString('base64url')]));
 const env={DATABASE_URL:rewrite(urls.databaseUrl),DIRECT_URL:rewrite(urls.directUrl),HUB_CORE_DIR:'/opt/researchhub/core',HUB_CORE_MANIFEST_SHA256:release.coreDigest,HUB_F06_RUN_ID:state.runId,HUB_F06_DATABASE:state.database,DEPLOYMENT_PRODUCT:'researchhub',DEPLOYMENT_ID:state.runId,ALLOWED_TENANT_IDS:'rh-deploy-'+state.runId.slice(-8)+'-tenant',DEFAULT_TENANT_ID:'rh-deploy-'+state.runId.slice(-8)+'-tenant',CONTROL_PLANE_ENABLED:'false',ENABLED_WORKER_KINDS:'',OFFICIAL_JOB_KINDS:''};
 for(const [key,value]of Object.entries(passwords))env['HUB_F06_PASSWORD_'+key.toUpperCase()]=value;
 const envFile=path.join(directory,'seed.env');fs.writeFileSync(envFile,Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});
 save(path.join(directory,'test-identities.private.json'),passwords);
 const stdout=run(['run','--rm','--name',state.runId+'-seed','--label','researchhub.rehearsal='+state.runId,'--network',network,'--env-file',envFile,'--mount',`type=bind,src=${root},dst=/workspace/hub,readonly`,'--mount',`type=bind,src=${directory},dst=/workspace/f06`,'--entrypoint','node',image,'/workspace/hub/scripts/f06-hub-assets-rehearsal.mjs','seed-container']);
 const receipt=JSON.parse(stdout.trim().split('\n').at(-1));save(path.join(directory,'seed-receipt.json'),receipt);
 const result={schemaVersion:1,syntheticOnly:true,runId:state.runId,database:state.database,port:state.port,container:state.container,network,baselineDigest,migrationsApplied:applied.appliedNow,pending:applied.pending.length,...receipt};
 save(path.join(directory,'prepared.json'),result);return result;
}
export async function seedF06Container(){
 const {runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs'),{seedRehearsalFoundation}=await import('../deploy/seed-rehearsal.mjs'),{createResearchStudiesService}=await import('../server/research-studies/commands.mjs');
 const state=validateRehearsalState(JSON.parse(fs.readFileSync('/workspace/f06/rehearsal-state.json')));
 if(state.runId!==process.env.HUB_F06_RUN_ID||state.database!==process.env.HUB_F06_DATABASE)fail();
 const {load,require}=runtimeDependencies({coreRoot:process.env.HUB_CORE_DIR,digest:process.env.HUB_CORE_MANIFEST_SHA256,requirePrivate:true}),prisma=new(load('prisma/prisma.service','PrismaService'))();
 try{
  const foundation=await seedRehearsalFoundation({prisma,load,require,runId:state.runId,database:state.database,passwords:Object.fromEntries(['admin','owner','invite'].map(k=>[k,process.env['HUB_F06_PASSWORD_'+k.toUpperCase()]]))}),ids=foundation.ids;
  const lock=load('common/worker-publication','lockAuthorizationMutation'),admin={accountId:ids.admin,tenantId:ids.tenant,role:'tenant_admin',isTenantAdmin:true,authVersion:0};
  const scope={deploymentId:state.runId,product:'researchhub',allowedTenantIds:[ids.tenant],defaultTenantId:ids.tenant,controlPlaneEnabled:false,officialJobKinds:[],enabledWorkerKinds:[]},core=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma);
  const studies=createResearchStudiesService({prisma,scope,lockAuthorization:lock,createResearchProject:(tx,u,g,input)=>core.createResearchProjectInTransaction(tx,u,g,input)});
  const draft=await studies.create(admin,{requestKey:'f06_target_intent_create',title:'F06合成目标课题',question:'仅验证Hub授权模板进入另一个私有课题，不包含临床资料。',hubKey:'lingshu-xinyu',researchType:'合成技术验证',pico:{p:'合成文稿',i:'跨课题复用',c:'权限拒绝反例',o:'固定版本与来源一致'}});
  const result=await studies.createStudy(admin,draft.item.id,{requestKey:'f06_target_study_create',expectedVersion:draft.item.version,studyGroupId:ids.group}),study=result.item?.study;if(!study?.id||!study.executionProjectId)fail();
  await prisma.elevated.$transaction(async tx=>{await lock(tx,ids.tenant,{includeOfficial:true});const role=ids.reader+'-target-editor';await tx.permissionRole.create({data:{id:role,tenantId:ids.tenant,key:'f06-target-editor',name:'F06合成目标课题编辑者',menuPermissions:['workbench','artifacts'],buttonPermissions:['artifact.read','artifact.create','artifact.edit'],dataScope:'group'}});await tx.studyGroupMembership.create({data:{id:ids.invite+'-target-group',tenantId:ids.tenant,studyGroupId:ids.group,accountId:ids.invite,roleId:role,isDefault:true}});await tx.researchProjectMembership.create({data:{id:ids.invite+'-target-project',tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:study.executionProjectId,accountId:ids.invite,roleKey:'researcher',isDefault:true}});});
  const counts=await prisma.elevated.$transaction(async tx=>({accounts:await tx.account.count(),studies:Number((await tx.$queryRawUnsafe('SELECT count(*)::integer AS n FROM rh_research.study_binding'))[0].n),reuserSourceMemberships:await tx.researchProjectMembership.count({where:{tenantId:ids.tenant,accountId:ids.invite,researchProjectId:ids.project}}),reuserTargetMemberships:await tx.researchProjectMembership.count({where:{tenantId:ids.tenant,accountId:ids.invite,researchProjectId:study.executionProjectId}}),jobs:await tx.processingTask.count(),agentConfigs:await tx.agentConfig.count()}));
  if(counts.accounts!==3||counts.studies!==2||counts.reuserSourceMemberships!==0||counts.reuserTargetMemberships!==1||counts.jobs!==0||counts.agentConfigs!==0)fail();
  return{tenantSlug:foundation.tenantSlug,ids:{...ids,sourceStudy:ids.study,sourceProject:ids.project,targetStudy:study.id,targetProject:study.executionProjectId,reuser:ids.invite},counts,modelCalls:0,oldDatabaseAccessed:false};
 }finally{await prisma.onModuleDestroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const [command,directory]=process.argv.slice(2);const result=command==='prepare'?await prepareF06Rehearsal(directory):command==='seed-container'?await seedF06Container():fail();console.log(JSON.stringify(result));}catch(error){console.error(error.message?.startsWith('F06_')||error.message?.startsWith('REHEARSAL_')||error.message?.startsWith('MIGRATION_')?error.message:'F06_REHEARSAL_PREPARATION_FAILED');process.exitCode=1;}}
