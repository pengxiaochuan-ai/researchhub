import {createKnowledgeServices} from '../server/research-runtime/knowledge-services.mjs';
import {runtimeDependencies,coreSourcePath} from '../server/research-runtime/dependencies.mjs';
import {createHubStudyScopeGuard} from '../server/auth/study-scope-guard.mjs';
import{createLocalMediaContent}from'./local-session-media-content.mjs';
import{createLocalSessionMediaIngests}from'./local-session-media-ingests.mjs';
import{assembleMediaRegistration}from'./ai-session-media-ingest-assembly.mjs';
// Existing Hub development entry: shared K01 services and native queue lifecycle; other business adapters retained.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer as netServer, createConnection } from 'node:net';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertLocalScope, assertOwnProcess, allowedFetchUrl, stopOwnedChildren, guardViteSignalOwnership } from './local-knowledge-config.mjs';
import { bindRuntimeTransactionsInto, withFixtureTransaction } from '../server/database/transactions.mjs';
import {configureAnalysisListProxy} from '../server/http/analysis-list-lifetime.mjs';
import {isOwnedOpenCodeRequest} from '../server/ai-agent/opencode-runtime.mjs';
import {parseAssetJson} from './research-assets-json.mjs';
import { createLocalKnowledgeAi } from './local-knowledge-ai.mjs';
import {designRequestRoute} from './research-design-contract.mjs';
import {preparationRequestRoute} from './research-execution-preparation-contract.mjs';
import { createLocalAccounts } from './local-accounts.mjs';
import { createMyResearchController } from './my-research-overview.mjs';
import { createHubSourceReviewController } from '../server/hub-sources/review-controller.mjs';
import { createHubSourceReadController } from '../server/hub-sources/read-controller.mjs';
import { createHubSourceAgentController } from '../server/hub-sources/agent-retrieval.mjs';
import { createHubController } from '../server/hub/controller.mjs';
import { createStudyTaskController } from '../server/study-tasks/controller.mjs';
import {createResearchIdentityController,identityRoute} from '../server/research-identity/controller.mjs';
import {createDirectoryController} from '../server/directory/controller.mjs';
import {createReferenceController} from '../server/reference/controller.mjs';
import {createGovernanceAuditController} from '../server/governance-audit/controller.mjs';
import {createGovernanceSystemController} from '../server/governance-system/controller.mjs';
import { assertHubSchema } from './hub-schema.mjs';
import {crfMethodAssetBodyRoute} from '../src/crf-method-assets-session.js';
import {createHubAuth} from '../server/auth/controller.mjs';
import {assembleAdmission} from '../server/admission/assembly.mjs';
import {assembleAcademicContent} from '../server/academic-content/assembly.mjs';
import {installAcademicContentBodyPolicy} from '../server/academic-content/http-policy.mjs';
import {createLocalResearchStudiesController,researchCreationBodyRoute} from './research-creation-local-integration.mjs';
import {applicabilityBodyRoute} from './asset-applicability-contract.mjs';
import {createLocalH5Outreach} from './local-h5-outreach.mjs';
import {createH5QuestionnaireController} from '../server/research-capture/h5-controller.mjs';
import {readStudyMailConfig} from '../server/research-capture/smtp-config.mjs';
import {createStudyMailer} from '../server/research-capture/delivery.mjs';
import {createLocalSessionMaterials} from './local-session-materials.mjs';
import {createLocalSessionMedia} from './local-session-media.mjs';
import {createLocalResearchData} from './local-research-data.mjs';
import {createResearchFormAdapter} from '../server/research-capture/form-core-adapter.mjs';
import {createLocalFullStudySimulation} from './local-full-study-simulation.mjs';

process.umask(0o077);
const root=fileURLToPath(new URL('../../',import.meta.url)), script=fileURLToPath(import.meta.url);
const dir=root+'.tmp/researchhub-knowledge-local/', stateFile=dir+'runtime.json';
mkdirSync(dir,{recursive:true,mode:0o700});
const save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2),{mode:0o600});
const state=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):null;
const observe=pid=>{
  if(!Number.isInteger(pid)||pid<2)return null;
  try { const line=execFileSync('ps',['-p',String(pid),'-o','pid=,lstart=,command='],{encoding:'utf8'}).trim();
    const match=line.match(/^(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/);
    return match?{pid:Number(match[1]),started:match[2].replace(/\s+/g,' '),command:match[3]}:null;
  } catch { return null; }
};
const owned=()=>{try{assertOwnProcess(state,observe(state?.pid));return true;}catch{return false;}};
const endpoints=[['frontend',19501,'/pages/p003/'],['api',19502,'/api/auth/me'],['parser',19503,'/health'],['embed',19504,'/health'],['quality',19505,'/ready'],['smtp',19506,null],['inbox',19507,'/messages']];
async function health(){return Promise.all(endpoints.map(async([name,port,path])=>{try{
 if(name==='smtp'){const ready=await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});const finish=ok=>{socket.destroy();resolve(ok);};socket.setTimeout(1500);socket.once('data',bytes=>finish(bytes.toString().startsWith('220 ')));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));});return{name,port,ready};}
 const r=await fetch('http://127.0.0.1:'+port+path,{signal:AbortSignal.timeout(1500)});return {name,port,ready:r.status===(['api','inbox'].includes(name)?401:200)};
 }catch{return{name,port,ready:false};}}));}
async function vacant(){for(const [,port] of endpoints){const s=netServer();await new Promise((ok,no)=>{s.once('error',()=>no(new Error('LOCAL_PORT_IN_USE:'+port)));s.listen(port,'127.0.0.1',ok);});await new Promise(ok=>s.close(ok));}}
const action=process.argv[2];
if(action==='status'){
  const services=owned()?await health():[];
  console.log(JSON.stringify({owned:owned(),pid:owned()?state.pid:null,services,url:'http://127.0.0.1:19501/pages/p003/',credentials:dir+'体验账号.txt'}));
}else if(action==='stop'){
  if(!owned())throw new Error('LOCAL_PROCESS_IDENTITY_REJECTED');
  process.kill(state.pid,'SIGTERM');
  for(let n=0;n<100&&owned();n++)await new Promise(ok=>setTimeout(ok,200));
  assert.equal(owned(),false,'LOCAL_STOP_TIMEOUT');
  console.log('Owned local runtime stopped; data retained.');
}else if(action==='start'){
  if(owned()){console.log('Already running. Use status.');process.exit(0);}
  await vacant();
  // Exclusive reservation prevents concurrent initializers; startup failure releases it.
  const lock=dir+'starting.lock'; let fd;
  try{fd=openSync(lock,'wx',0o600);}catch{throw new Error('LOCAL_START_IN_PROGRESS_CHECK_LOG');}
  try{
    const key=state?.key??'rh-kb-local-'+randomUUID().slice(0,8);
    const log=openSync(dir+'runtime.log','a',0o600);
    const child=spawn(process.execPath,[script,'serve',key],{cwd:root,detached:true,stdio:['ignore',log,log],env:{PATH:process.env.PATH,LANG:'en_US.UTF-8',CI:'true'}});
    child.unref();closeSync(log);
    for(let n=0;n<180;n++){
      await new Promise(ok=>setTimeout(ok,500));
      if(existsSync(stateFile)){
        const current=JSON.parse(readFileSync(stateFile,'utf8'));
        if(current.pid===child.pid&&current.ready){console.log(JSON.stringify({started:true,pid:child.pid,url:'http://127.0.0.1:19501/pages/p003/',credentials:dir+'体验账号.txt'}));process.exitCode=0;break;}
      }
      if(!observe(child.pid))throw new Error('LOCAL_START_FAILED_CHECK_PRIVATE_LOG');
      if(n===179)throw new Error('LOCAL_START_TIMEOUT_CHECK_PRIVATE_LOG');
    }
  }finally{closeSync(fd);unlinkSync(lock);}
}else if(action==='serve'){
  const key=process.argv[3]; assert.match(key,/^rh-kb-local-[a-f0-9]{8}$/);
  if(state)assert.equal(state.key,key);
  await vacant();
  const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
  await assertFixtureTarget(env);
  let ai,accounts,runtimeApp,runtimeDirect;
  // The old Sessions publication transaction owns its authorization lock. Add
  // our source-version fence on the SAME transaction before assistant creation.
  const fence=tx=>new Proxy(tx,{get(target,name){
    if(name==='knowledgeChatJob')return new Proxy(target.knowledgeChatJob,{get(model,method){if(method!=='create')return model[method];return args=>ai?.onJobCreate?ai.onJobCreate(tx,args,next=>model.create(next)):model.create(args);}});
    if(name!=='message')return target[name];
    return new Proxy(target.message,{get(model,method){if(method!=='create')return model[method];return async args=>{if(args.data.role==='assistant')await ai?.beforeAssistant(tx);return model.create(args);};}});
  }});
  const direct=cb=>withFixtureTransaction(env,'direct',tx=>cb(fence(tx)));
  process.env.HUB_CORE_DIR=root+'researchhub/.private/core';
  process.env.HUB_CORE_MANIFEST_SHA256=JSON.parse(readFileSync(root+'researchhub/deploy/release-policy.json','utf8')).coreDigest;
  process.env.HUB_REQUIRE_PRIVATE_CORE='true';process.env.DEPLOYMENT_PRODUCT='researchhub';
  const {require,load}=runtimeDependencies({coreRoot:process.env.HUB_CORE_DIR,digest:process.env.HUB_CORE_MANIFEST_SHA256,requirePrivate:true});
  const {Module,ValidationPipe,Logger}=require('@nestjs/common');Logger.overrideLogger(false);
  const {NestFactory,Reflector}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt');
  const ids=state?.ids??Object.fromEntries(['tenant','owner','admin','uninvited','viewer','group','project','role','viewRole'].map(name=>[name,key+'-'+name]));
  const password=state?.password??randomBytes(18).toString('base64url'),secret=state?.secret??randomBytes(48).toString('hex');
  // Hub transactions must use the bundled core Prisma: server modules build
  // Prisma.Sql fragments with core's copy, while the legacy fixture client is a
  // separate install, so mixing them binds fragments as jsonb parameters.
  const identitySql=`SELECT current_database() AS database,current_user AS role,r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",encode(sha256(convert_to(coalesce(shobj_description(d.oid,'pg_database'),''),'UTF8')),'hex') AS "markerDigest" FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`;
  const {PrismaClient}=require('@prisma/client');
  runtimeApp=new PrismaClient({datasources:{db:{url:env.WP01_TEST_DATABASE_URL}}});
  runtimeDirect=new PrismaClient({datasources:{db:{url:env.WP01_TEST_DIRECT_URL}}});
  await runtimeApp.$connect();await runtimeDirect.$connect();
  const [runtimeAppIdentity]=await runtimeApp.$queryRawUnsafe(identitySql),[runtimeDirectIdentity]=await runtimeDirect.$queryRawUnsafe(identitySql);
  bindRuntimeTransactionsInto(env,{prisma:{app:runtimeApp,elevated:runtimeDirect},expected:{database:runtimeAppIdentity.database,appRole:runtimeAppIdentity.role,directRole:runtimeDirectIdentity.role,markerDigest:runtimeAppIdentity.markerDigest,deploymentId:key,tenantId:ids.tenant}});
  process.env.CONTACT_ENCRYPTION_KEY=createHmac('sha256',secret).update('researchhub:local-contact:v1').digest('hex');
  const current={key,ids,password,secret,pid:process.pid,started:observe(process.pid).started,ready:false};
  save(stateFile,current);
  const children=[];let app,vite,mediaContent,stopping=false;
  async function shutdown(code=0){if(stopping)return;stopping=true;current.ready=false;save(stateFile,current);ai?.stop();mediaContent?.close?.();await vite?.close();app?.getHttpServer()?.closeIdleConnections?.();await app?.close();await accounts?.close();await runtimeApp?.$disconnect();await runtimeDirect?.$disconnect();await stopOwnedChildren(children);process.exit(code);}
  process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
  try{
    const existing=await direct(tx=>tx.tenant.findUnique({where:{id:ids.tenant}}));
    if(!existing){
      assert.equal(state,null,'MISSING_PERSISTED_LOCAL_TENANT');
      const bcrypt=require('bcryptjs'),hash=bcrypt.hashSync(password,12);
      await direct(async tx=>{
        const reserved=await tx.$queryRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES (${key},${JSON.stringify({syntheticOnly:true,purpose:'ResearchHub-local-knowledge-standing',ids})}::jsonb) ON CONFLICT DO NOTHING RETURNING run_id`;assert.equal(reserved.length,1);
        await tx.tenant.create({data:{id:ids.tenant,slug:ids.tenant,name:'本机知识体验合成租户'}});
        for(const actor of ['owner','admin','viewer','uninvited'])await tx.account.create({data:{id:ids[actor],tenantId:ids.tenant,username:actor+'@example.org',passwordHash:hash,displayName:({owner:'合成科研人员',admin:'合成租户管理员',viewer:'合成只读用户',uninvited:'合成未邀请用户'})[actor],role:actor==='admin'?'tenant_admin':'researcher'}});
        await tx.studyGroup.create({data:{id:ids.group,tenantId:ids.tenant,slug:key,name:'本机合成研究组'}});
        await tx.researchProject.create({data:{id:ids.project,tenantId:ids.tenant,studyGroupId:ids.group,code:'SYNTHETIC',name:'合成针灸研究',createdBy:ids.owner}});
        for(const [name,buttons]of [['role',['knowledge.edit']],['viewRole',[]]])await tx.permissionRole.create({data:{id:ids[name],tenantId:ids.tenant,key:name,name:'合成知识资料角色',menuPermissions:['knowledge'],buttonPermissions:buttons}});
        for(const actor of ['owner','admin','viewer']){
          await tx.studyGroupMembership.create({data:{id:ids[actor]+'-membership',tenantId:ids.tenant,studyGroupId:ids.group,accountId:ids[actor],roleId:actor==='viewer'?ids.viewRole:ids.role}});
          await tx.researchProjectMembership.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[actor]}});
        }
      });
    }
    await assertHubSchema();
    writeFileSync(dir+'体验账号.txt',`仅限本机合成体验，禁止上传真实数据。\n登录：http://127.0.0.1:19501/pages/p003/\n登录成功后打开：http://127.0.0.1:19501/pages/k01/\n科研人员：owner@example.org\n管理员：admin@example.org\n只读：viewer@example.org\n未邀请：uninvited@example.org\n以上账号共用本次随机密码：${password}\n上传样例：${root}researchhub/docs/testing/synthetic-knowledge-sample.html\n流程：新建库→上传→抽取预览→审核通过→检索“针灸辅助抑郁障碍”→编辑保存→历史版本→删除/回收站恢复。编辑后须重新审核才可检索。\n科研 Agent 问答已接通：仅 owner/admin，当前库已审核合成资料；可展开来源版本、摘录和 SHA256。本轮新增费用合计上限5元，不充值/续额；报价24小时后需重新核对，不清空账本。账号注册/找回/邀请不在本环境开放。\n`,{mode:0o600});
    const systemState={};
    for(const[kind,port,python]of [['parser',19503,'researchhub/.private/python/parser/bin/python'],['embedding',19504,'researchhub/.private/python/embedding/bin/python']]){
      const child=spawn(root+python,[root+'researchhub/services/knowledge/run.py',kind,'--port',String(port)],{cwd:root,env:{PATH:process.env.PATH,LANG:'en_US.UTF-8',PYTHONDONTWRITEBYTECODE:'1',KB_DOC_PARSER_OCR_ENGINE:'tesseract',KB_EMBED_MODEL_PATH:root+'researchhub/.private/models/bge-small-zh-v1.5'},stdio:'inherit'});children.push(child);
      child.once('exit',()=>{if(!stopping){console.error('LOCAL_DEPENDENCY_EXIT:'+kind);void shutdown(1);}});
      let ready=false;for(let n=0;n<160;n++){try{if((await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,200));}assert.ok(ready,kind+' not ready');
      systemState[kind==='embedding'?'vector':'parser']={configured:true,check:{status:'passed',checkedAt:new Date().toISOString()}};
    }
    const qualityFile=dir+'quality-worker.json';
    if(!existsSync(qualityFile))save(qualityFile,{token:randomBytes(32).toString('hex')});
    const qualityToken=JSON.parse(readFileSync(qualityFile)).token;assert.match(qualityToken,/^[a-f0-9]{64}$/);
    const qualityChild=spawn('python3',['-B',root+'app/research-methods-worker/serve.py'],{cwd:root+'app/research-methods-worker',env:{PATH:process.env.PATH,LANG:'en_US.UTF-8',PYTHONDONTWRITEBYTECODE:'1',RESEARCH_METHODS_WORKER_HOST:'127.0.0.1',RESEARCH_METHODS_WORKER_PORT:'19505',RESEARCH_METHODS_WORKER_TOKEN:qualityToken},stdio:'inherit'});children.push(qualityChild);
    qualityChild.once('exit',()=>{if(!stopping){console.error('LOCAL_DEPENDENCY_EXIT:quality');void shutdown(1);}});
    let qualityReady=false;for(let n=0;n<60;n++){try{if((await fetch('http://127.0.0.1:19505/ready',{signal:AbortSignal.timeout(500)})).ok){qualityReady=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,100));}assert.ok(qualityReady,'LOCAL_QUALITY_NOT_READY');
    const storageEnv=JSON.parse(readFileSync(root+'.tmp/wp01-pre-release/rehearsal-o7gOnS/runtime.json')).profiles[0].env;
    assert.equal(storageEnv.S3_ENDPOINT,'http://127.0.0.1:19402');
    for(const name of ['S3_ENDPOINT','S3_ACCESS_KEY','S3_SECRET_KEY','S3_REGION'])process.env[name]=storageEnv[name];
    process.env.S3_BUCKET=key;process.env.KB_DOC_PARSER_URL='http://127.0.0.1:19503';process.env.KB_EMBED_URL='http://127.0.0.1:19504';
    const nativeFetch=globalThis.fetch;globalThis.fetch=(url,init)=>{assert.ok(allowedFetchUrl(url)||isOwnedOpenCodeRequest(url,init),'LOCAL_OUTBOUND_HTTP_DENIED');return nativeFetch(url,{...init,redirect:'error'});};
    const scoped=cb=>withFixtureTransaction(env,'app',async tx=>{await tx.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;await tx.$executeRaw`SELECT set_config('app.study_group_id',${ids.group},true)`;await tx.$executeRaw`SELECT set_config('app.research_project_id',${ids.project},true)`;return cb(fence(tx));});
    const allowed=new Set(['tenant','tenantTheme','account','auditLog','studyGroupMembership','researchProjectMembership','researchProject','researchArtifact','studyTask','permissionRole','knowledgeBase','knowledgeDoc','knowledgeDocVersion','knowledgeChunk','knowledgeAssignment','knowledgeSourceFile','knowledgeImportTask','knowledgeDeduplicationPlan','accountCapability','agent','agentConfig','agentAccess','session','message','knowledgeChatJob','skillAssignment','modelProfile','tokenQuotaGrant','tokenQuotaReservation','usageRecord','artifact','terminologyProjectReference','terminologyEntry']);
    const db=transaction=>new Proxy({}, {get(_,name){if(name==='then')return undefined;if(name==='$transaction')return cb=>transaction(cb);if(['$queryRaw','$queryRawUnsafe','$executeRaw','$executeRawUnsafe'].includes(name))return(...args)=>transaction(tx=>tx[name](...args));assert.ok(allowed.has(name),'LOCAL_MODEL_REJECTED');return new Proxy({}, {get:(_inner,method)=>(...args)=>transaction(tx=>tx[name][method](...args))});}});
    const prisma={elevated:db(direct),app:db(scoped),forTenant(t,g,p){assertLocalScope(ids,t,g,p);return db(scoped);},withTenantTransaction(t,g,p,cb){assertLocalScope(ids,t,g,p);return scoped(cb);}};
    // K01 uses the same real scope as production. Legacy workflow adapters keep
    // their existing scoped facade until their own module is unified.
    const knowledgeScope=(t,g,p,cb)=>{
      assert.equal(t,ids.tenant,'KNOWLEDGE_TENANT_REJECTED');
      return withFixtureTransaction(env,'app',async tx=>{
        await tx.$executeRaw`SELECT set_config('app.tenant_id',${t},true),set_config('app.study_group_id',${g??''},true),set_config('app.research_project_id',${p??''},true)`;
        return cb(fence(tx));
      });
    };
    const knowledgePrisma={elevated:db(direct),app:db(cb=>knowledgeScope(ids.tenant,undefined,undefined,cb)),forTenant(t,g,p){return db(cb=>knowledgeScope(t,g,p,cb));},withTenantTransaction:knowledgeScope};

    const {parseDeploymentScope,AUTH_COOKIE_NAME}=require(coreSourcePath('common/deployment-scope'));
    process.env.HUB_EXECUTION_PROFILE='standard';process.env.HUB_PAID_AI_ENABLED='true';
    const scope=parseDeploymentScope({DEPLOYMENT_ID:key,DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:ids.tenant,DEFAULT_TENANT_ID:ids.tenant,ENABLED_WORKER_KINDS:'knowledge-import,knowledge-chat'});
    const storage=new(load('storage/storage.service','StorageService'))();storage.onModuleInit();for(let n=0;n<50&&!storage.available;n++)await new Promise(ok=>setTimeout(ok,100));assert.ok(storage.available,'LOCAL_STORAGE_NOT_READY');
    const {embedding,ingestion,extract,queue,grounding,knowledge,retrieval,tools}=createKnowledgeServices({load,require,prisma:knowledgePrisma,storage,scope,embeddingMode:'service',parserConfigured:Boolean(process.env.KB_DOC_PARSER_URL)});
    const materials=createLocalSessionMaterials({env,ids,load,require,queue,storage,scope,ingestion,extract,grounding});
    const researchData=createLocalResearchData({env,ids,load,require,storage});
    const media=await createLocalSessionMedia({env,ids,load,require,storage,directory:dir+'session-media-chunks'});
    const mediaIngest=await assembleMediaRegistration({create:createLocalSessionMediaIngests,options:{env,ids,load,require,storage}});media.ingests=mediaIngest.service;media.registrationState=mediaIngest.status;
    try{mediaContent=await createLocalMediaContent({env,ids,load,require,storage,directory:root+'researchhub/.tmp/ai-media-content-implementation-2026-11-17'});media.content=mediaContent.service;media.contentState='ready';}
    catch(e){media.contentState='unavailable';console.error('LOCAL_MEDIA_CONTENT_UNAVAILABLE',e.code??e.message??'Error');}
    ai=await createLocalKnowledgeAi({root,dir,env,ids,prisma,knowledgePrisma,knowledge,retrieval,grounding,tools,storage,scope,load,require,nativeFetch,researchData,media});
    const jwt=new JwtService({secret,signOptions:{expiresIn:'12h'}}),cookie='rh_kb_local_'+key.slice(-8);
    const hubAuth=createHubAuth({require,load,jwt,prisma,scope,cookieName:cookie,origin:'http://127.0.0.1:19501',secureCookie:()=>false});
    const admission=assembleAdmission({prisma,scope,require,load,origin:'http://127.0.0.1:19501'});
    const academic=assembleAcademicContent({prisma,scope,require,load,origin:'http://127.0.0.1:19501'});
    accounts=await createLocalAccounts({root,ids,prisma,load,require,secret,env,admission:admission.service});
    const StudyTaskController=await createStudyTaskController({env,ids,load,require,secret,readTaskSynthetic:ai.readTaskSynthetic});
    const ResearchIdentityController=await createResearchIdentityController({env,ids,load,require});
    const DirectoryController=await createDirectoryController({env,ids,require});
    const ReferenceController=await createReferenceController({env,require});
    const GovernanceAuditController=createGovernanceAuditController({env,ids,require,load});
    const GovernanceSystemController=createGovernanceSystemController({env,ids,require,readState:()=>({...systemState,account:{configured:Boolean(hubAuth)},email:{configured:Boolean(accounts)},ai:{configured:Boolean(ai)}})});
    let studyMailer;
    try{studyMailer=createStudyMailer(readStudyMailConfig({file:root+'researchhub/env.prod'}));current.outreach={smtpConfigured:true};}
    catch{current.outreach={smtpConfigured:false,code:'OUTREACH_CHANNEL_UNAVAILABLE'};}
    const fullStudy=await createLocalFullStudySimulation({root,env,ids,load,require,studyMailer,captureReceipt:accounts.captureReceipt});
    const ResearchStudiesController=await createLocalResearchStudiesController({env,ids,load,require,scope,studyMailer,storage,qualityToken,fullStudy,limitedImportRead:researchData.readImportSubjectsInTx,limitedMediaRead:mediaIngest.limitedReadInTx});
    const H5QuestionnaireController=createH5QuestionnaireController({require,service:createLocalH5Outreach({ids,direct,load:fullStudy?.formAdapter.load??createResearchFormAdapter({require,load}).load}),origin:'http://127.0.0.1:19501'});
    const MyResearchController=createMyResearchController({root,ids,prisma,load,require,canOpenApplicability:ai.canOpenApplicabilityDraft});
    assert.equal(typeof ai.ResearchAssetsReadController,'function','RESEARCH_ASSETS_READ_CONTROLLER_REQUIRED');
    assert.equal(typeof ai.AssetCatalogController,'function','RESEARCH_ASSET_CATALOG_CONTROLLER_REQUIRED');
    assert.equal(typeof ai.AssetRegistrationController,'function','RESEARCH_ASSET_REGISTRATION_CONTROLLER_REQUIRED');
    class LocalRoot{}
    Module({controllers:[hubAuth.Controller,admission.Controller,...academic.Controllers,load('knowledge/knowledge.controller','KnowledgeController'),materials.Controller,...media.Controllers,...mediaIngest.Controllers,...(mediaContent?.Controllers??[]),researchData.Controller,MyResearchController,StudyTaskController,ResearchIdentityController,DirectoryController,ReferenceController,GovernanceAuditController,GovernanceSystemController,ResearchStudiesController,H5QuestionnaireController,createHubController({env,ids,require}),createHubSourceReviewController({env,ids,require}),createHubSourceReadController({env,ids,require,secret}),createHubSourceAgentController({env,ids,require}),ai.Controller,ai.BillingController,ai.DefaultSkillsController,ai.PlansController,ai.AssetRegistrationController,ai.AssetCatalogController,ai.ResearchAssetsReadController,ai.GuidanceCitationsController,ai.DesignController,ai.PreparationController,ai.EdcController,ai.CrfMethodsController,ai.CrfMethodAssetsController,ai.AssetApplicabilityController,ai.SyntheticController,ai.AssetsController,...accounts.Controllers],providers:[{provide:load('auth/auth.service','AuthService'),useValue:new(load('auth/auth.service','AuthService'))(prisma,jwt,scope)},{provide:load('knowledge/knowledge.service','KnowledgeService'),useValue:knowledge},{provide:load('knowledge/knowledge-import.service','KnowledgeImportService'),useValue:queue},{provide:load('sessions/knowledge-chat-queue.service','KnowledgeChatQueueService'),useValue:ai.worker},{provide:AUTH_COOKIE_NAME,useValue:cookie}]})(LocalRoot);
    app=await NestFactory.create(LocalRoot,{logger:false});app.setGlobalPrefix('api');
    installAcademicContentBodyPolicy(app,{require});
    const express=createRequire(require.resolve('@nestjs/platform-express/package.json'))('express');
    app.use('/api/research-assets',express.json({limit:512*1024,strict:true,verify:(_req,_res,bytes)=>{parseAssetJson(bytes);}}),(error,_req,res,next)=>{
      if(error?.type==='entity.too.large')return res.status(413).json({code:'ASSET_CATALOG_REQUEST_TOO_LARGE',message:'内容超过请求上限，请改用文件上传；原输入请保留。'});
      if(error?.code?.startsWith('ASSET_CATALOG_')||['entity.verify.failed','entity.parse.failed'].includes(error?.type))return res.status(400).json({code:'ASSET_CATALOG_INPUT_INVALID',message:'资产请求格式无效，请核对后重试。'});
      next(error);
    });
    app.use((req,res,next)=>researchCreationBodyRoute(req.path)?express.json({limit:256*1024,strict:true})(req,res,next):next(),(error,_req,res,next)=>{
      if(error?.type==='entity.too.large')return res.status(413).json({code:'RESEARCH_REQUEST_TOO_LARGE',message:'课题内容超过256KiB，请减少输入。'});
      if(error?.type==='entity.parse.failed')return res.status(400).json({code:'RESEARCH_JSON_INVALID',message:'课题请求格式无效，请检查输入。'});
      next(error);
    });
    app.use((req,res,next)=>identityRoute(req.path)?express.json({limit:'48kb'})(req,res,next):next(),(error,_req,res,next)=>{
      if(error?.type==='entity.too.large')return res.status(413).json({code:'IDENTITY_REQUEST_TOO_LARGE',message:'科研资料请求超过48KiB，请减少输入。'});
      next(error);
    });
    app.use(['/api/account-access','/api/member-invitations','/api/member-invitation-previews','/api/member-invitation-acceptances'],express.json({limit:'16kb'}));
    app.use('/api/questionnaire-h5',express.json({limit:'32kb',strict:true}),(error,_req,res,next)=>{
      if(error?.type==='entity.too.large')return res.status(413).json({code:'H5_REQUEST_TOO_LARGE',message:'问卷内容超过32KiB，请减少输入。'});
      if(error?.type==='entity.parse.failed')return res.status(400).json({code:'H5_JSON_INVALID',message:'问卷请求格式无效，请核对输入。'});
      next(error);
    });
    app.use('/api/hub-sources',express.json({limit:'8kb'}));
    app.use('/api/study-tasks',express.json({limit:'32kb'}),(error,_req,res,next)=>{
      if(error?.type==='entity.too.large')return res.status(400).json({code:'STUDY_TASK_REQUEST_TOO_LARGE',message:'任务请求超过32KiB字节上限，请减少本次输入或引用数量。'});
      next(error);
    });
    app.use((req,res,next)=>/^\/api\/hubs\/[^/]+\/directory-admin(?:\/|$)/.test(req.path)?express.json({limit:'48kb'})(req,res,next):next(),(error,_req,res,next)=>{
      if(error?.type==='entity.too.large')return res.status(413).json({code:'DIRECTORY_REQUEST_TOO_LARGE',message:'目录请求超过48KiB，请减少输入。'});
      next(error);
    });
    app.use('/api/hubs',express.json({limit:'8kb'}));
    app.use(/^\/api\/research-plan-drafts\/[^/]+\/synthetic-collections(?:\/.*)?\/?$/i,express.json({limit:'32kb'}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'EDC_REQUEST_TOO_LARGE',message:'合成采集请求超过32KiB。'});next(error);});
    app.use(crfMethodAssetBodyRoute(),express.json({limit:'32kb'}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'CRF_ASSET_REQUEST_TOO_LARGE',message:'资产候选请求超过32KiB。'});next(error);});
    app.use(applicabilityBodyRoute(),express.json({limit:'32kb'}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'APPLICABILITY_REQUEST_TOO_LARGE',message:'资产核对请求超过32KiB。'});next(error);});
    for(const [kind,limit]of [['versions','128kb'],['small','32kb']])app.use(preparationRequestRoute(kind),express.json({limit,verify:(req,_res,bytes)=>{req.preparationBytes=bytes.length;}}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'PREPARATION_REQUEST_TOO_LARGE',message:'执行准备请求超过字节上限。'});next(error);});
    app.use(designRequestRoute('jobs'),express.json({limit:'32kb',verify:(req,_res,bytes)=>{req.researchDesignBytes=bytes.length;}}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'DESIGN_REQUEST_TOO_LARGE',message:'设计任务请求超过32KiB字节上限。'});next(error);});
    app.use(designRequestRoute('decisions'),express.json({limit:'128kb',verify:(req,_res,bytes)=>{req.researchDesignBytes=bytes.length;}}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'DESIGN_REQUEST_TOO_LARGE',message:'设计处置请求超过128KiB字节上限。'});next(error);});
    app.use(designRequestRoute('versions'),express.json({limit:'192kb',verify:(req,_res,bytes)=>{req.researchDesignBytes=bytes.length;}}),(error,_req,res,next)=>{if(error?.type==='entity.too.large')return res.status(400).json({code:'DESIGN_REQUEST_TOO_LARGE',message:'方案正文请求超过192KiB字节上限。'});next(error);});
    // A scoped middleware named jsonParser makes Nest skip its default global
    // parser. Explicitly preserve the legacy 100kb parser for the other APIs.
    app.use(express.json());
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    const reflector=new Reflector();app.useGlobalGuards(hubAuth.guard(reflector),admission.guard(reflector),new(load('common/guards/roles.guard','RolesGuard'))(reflector,prisma),createHubStudyScopeGuard({native:new(load('common/guards/study-group.guard','StudyGroupGuard'))(reflector,prisma),reflector,prisma,load,allowedTenantIds:scope.allowedTenantIds}));await app.listen(19502,'127.0.0.1');ai.start();
    const {createServer}=await import(root+'researchhub/node_modules/vite/dist/node/index.js');
    const priorTermHandlers=new Set(process.listeners('SIGTERM'));
    vite=await createServer({root:root+'researchhub',configFile:root+'researchhub/vite.config.js',cacheDir:root+'researchhub/.tmp/vite-runtime-'+key,define:{'import.meta.env.VITE_AUTH_TENANT_SLUG':JSON.stringify(ids.tenant)},server:{host:'127.0.0.1',port:19501,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:19502',changeOrigin:true,configure:configureAnalysisListProxy}}},logLevel:'error'});await vite.listen();
    // Vite 6 installs a handler that calls process.exit after closing only Vite.
    // This host owns API + Python children too; retain our single shutdown owner.
    guardViteSignalOwnership(vite,priorTermHandlers);
    current.ready=true;save(stateFile,current);console.log('LOCAL_KNOWLEDGE_READY');
  }catch(error){console.error('LOCAL_KNOWLEDGE_FAILED',error?.code??error?.name??'Error');await shutdown(1);}
}else{throw new Error('Usage: node researchhub/scripts/local-knowledge.mjs start|status|stop');}
