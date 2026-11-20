import {createHubStudyScopeGuard} from '../auth/study-scope-guard.mjs';
import{closeRuntimeResources}from'./shutdown.mjs';
import{runtimeBodyKind}from'./body-policy.mjs';
import{assertDeploymentRequest}from'../http/deployment-request.mjs';
import {readResearchRuntimeConfig} from './config.mjs';
import {runtimeDependencies} from './dependencies.mjs';
import {createHubAuth} from '../auth/controller.mjs';
import {assembleAdmission} from '../admission/assembly.mjs';
import {assembleAcademicContent} from '../academic-content/assembly.mjs';
import {createHubAssetsService} from '../hub-assets/service.mjs';
import {createHubAssetsController} from '../hub-assets/controller.mjs';
import {createHubAssetSourceReader} from '../hub-assets/source-reader.mjs';
import {createHubReportSourceVerifier} from '../hub-assets/report-source-verifier.mjs';
import {createHubCopyWorkspace} from '../hub-assets/draft-workspace.mjs';
import {withDeploymentTransaction} from '../database/transactions.mjs';
import {createRuntimeMaterials} from './materials.mjs';

// PrismaService captures its URLs synchronously in field initializers. Limit the
// inherited process-env bridge to construction; async lifecycle uses the clients.
function createPrisma(config,load){
 const previous={DATABASE_URL:process.env.DATABASE_URL,DIRECT_URL:process.env.DIRECT_URL};
 try{
  process.env.DATABASE_URL=config.databaseUrl;process.env.DIRECT_URL=config.directUrl;
  return new(load('prisma/prisma.service','PrismaService'))();
 }finally{
  for(const [key,value]of Object.entries(previous)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
}

function installHttpPolicy(app,config,require,foundation){
 const express=require(require.resolve('express',{paths:[require.resolve('@nestjs/platform-express/package.json')]}));
 app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
   if(req.headers.origin!==config.origin||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({code:'RESEARCH_ORIGIN_REJECTED',message:'请从当前站点提交操作。'});
   const kind=foundation?runtimeBodyKind(req.method,req.path??req.url,req.headers['content-type']):/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']??'')?'json':'rejected';
   if(kind==='rejected')return res.status(415).json({code:'RESEARCH_BODY_REQUIRED',message:'请使用此操作支持的请求格式。'});
  }
  if(foundation){try{assertDeploymentRequest(req,foundation.runtimePolicy,{json:false});}catch{return res.status(403).json({code:'RESEARCH_ORIGIN_REJECTED',message:'请从当前站点提交操作。'});}}
  next();
 });
 app.use(express.json({limit:256*1024,strict:true}));
 app.use((error,_req,res,next)=>{
  if(error?.type==='entity.too.large')return res.status(413).json({code:'RESEARCH_REQUEST_TOO_LARGE',message:'输入超过256KiB，请减少内容后重试。'});
  if(error?.type==='entity.parse.failed')return res.status(400).json({code:'RESEARCH_JSON_INVALID',message:'请求内容无效，请检查输入后重试。'});
  if(error)return res.status(400).json({code:'RESEARCH_REQUEST_INVALID',message:'请求无法读取，请重试。'});
  next();
 });
 const {HttpException}=require('@nestjs/common');
 app.useGlobalFilters({catch(error,host){
  const res=host.switchToHttp().getResponse();
  const status=error instanceof HttpException?error.getStatus():500;
  // Only this known configuration state has a public 5xx contract. Never echo
  // arbitrary exception messages (which may contain credentials or endpoints).
  if(status===503&&error instanceof HttpException&&error.getResponse()?.code==='HUB_MAIL_NOT_CONFIGURED')return res.status(503).json({code:'HUB_MAIL_NOT_CONFIGURED',message:'邮件服务尚未启用，请稍后重试或联系管理员。'});
  if(status===503&&error instanceof HttpException&&error.getResponse()?.code==='HUB_CHAT_NOT_CONFIGURED')return res.status(503).json({code:'HUB_CHAT_NOT_CONFIGURED',message:'科研问答尚未配置，请联系管理员。'});
  if(status>=500)return res.status(status).json({code:'RESEARCH_SERVICE_UNAVAILABLE',message:'服务暂时不可用，请保留输入并重试。'});
  const body=error.getResponse();res.status(status).json(typeof body==='string'?{statusCode:status,message:body}:body);
 }});
}

export async function bootResearchRuntime(env=process.env,options={}){
 const config=readResearchRuntimeConfig(env);
 const {require,load}=runtimeDependencies(config.core);
 const {Module,ValidationPipe}=require('@nestjs/common');
 const {NestFactory,Reflector}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt');
 let app,prisma,closing,foundation,accounts;
 const close=()=>closing??=closeRuntimeResources({foundation,accounts,app,prisma});
 try{
  prisma=options.prisma??createPrisma(config,load);
  const jwt=new JwtService({secret:config.jwtSecret,signOptions:{expiresIn:'12h'}});
  const profileProjection=config.profile==='full'?(await import('./profile.mjs')).runtimeProfileProjection({prisma,scope:config.scope,lockAuthorization:load('common/worker-publication','lockAuthorizationMutation')}):undefined;
  const hubAuth=createHubAuth({require,load,jwt,prisma,scope:config.scope,cookieName:config.cookieName,origin:config.origin,secureCookie:()=>config.secureCookie,profileProjection});
  const admission=assembleAdmission({prisma,scope:config.scope,require,load,origin:config.origin});
  const academic=assembleAcademicContent({prisma,scope:config.scope,require,load,origin:config.origin});
  if(config.profile==='full')foundation=await (await import('./foundation.mjs')).createRuntimeFoundation({config,env,load,require,prisma,jwt});
  if(foundation)accounts=await (await import('./accounts.mjs')).createRuntimeAccounts({env,config,transactionEnv:foundation.transactionEnv,runtimePolicy:foundation.runtimePolicy,admission:admission.service,require,load});
  const analysis=foundation?(await import('./analysis.mjs')).runtimeAnalysisFactory({env,load,prisma,storage:foundation.storage,scope:config.scope}):null;
  const ingestService=foundation?{ingestPreprocessed:(...args)=>app.get(load('ingest/ingest.service','IngestService')).ingestPreprocessed(...args)}:undefined;
  const controllerFactory=options.controllerFactory??(await import('../research-studies/controller.mjs')).createResearchStudiesController;
  const StudiesController=await controllerFactory({require,load,prisma,scope:config.scope,origin:config.origin,...(foundation?{storage:foundation.storage,ingestService,createAnalysisServices:analysis?.create}:{} )});
  const assets=foundation?(await import('./assets.mjs')).createRuntimeAssets({config,foundation,load,require,readReport:analysis?.readReport}):null;
  if(assets)foundation.setHubCopyWorkspace(createHubCopyWorkspace({readTarget:assets.hubBridge.readTarget}));
  const hubAssets=assets?createHubAssetsService({tenantId:config.scope.defaultTenantId,transact:fn=>withDeploymentTransaction(foundation.transactionEnv,'app',fn),lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),...assets.hubBridge,readHubSource:createHubAssetSourceReader({verifyReport:createHubReportSourceVerifier({load,syntheticStudyIds:(env.HUB_SYNTHETIC_STUDY_IDS??'').split(',').filter(Boolean)})})}):null;
  const HubAssetsController=hubAssets?createHubAssetsController({require,service:hubAssets,origin:config.origin}):null;
  const materials=foundation?createRuntimeMaterials({foundation,config,load,require,getService:(path,name)=>app.get(load(path,name))}):null;
  class ResearchRuntimeModule{}
  Module({controllers:[hubAuth.Controller,admission.Controller,...academic.Controllers,StudiesController,...(assets?.Controllers??[]),...(HubAssetsController?[HubAssetsController]:[]),...(materials?[materials.Controller]:[]),...(foundation?.Controllers??[]),...(accounts?.Controllers??[])],providers:foundation?.providers??[{provide:load('prisma/prisma.service','PrismaService'),useValue:prisma}]})(ResearchRuntimeModule);
  app=await NestFactory.create(ResearchRuntimeModule,{logger:false,bodyParser:false,abortOnError:false});
  app.setGlobalPrefix('api');
  installHttpPolicy(app,config,require,foundation);
  app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
  const reflector=new Reflector();
  app.useGlobalGuards(hubAuth.guard(reflector),admission.guard(reflector),new(load('common/guards/roles.guard','RolesGuard'))(reflector,prisma),createHubStudyScopeGuard({native:new(load('common/guards/study-group.guard','StudyGroupGuard'))(reflector,prisma),reflector,prisma,load,allowedTenantIds:config.scope.allowedTenantIds}));
  if(foundation){foundation.bindWorkers(app);load('common/worker-consumer-assembly','assertWorkerConsumerAssembly')(app);}
  if(options.listen===false)await app.init();else await app.listen(config.port,config.host);
  return {app,address:app.getHttpServer().address(),close};
 }catch(error){
  options.onStartupError?.(error);
  await close().catch(()=>{});
  throw new Error('RESEARCH_RUNTIME_START_FAILED');
 }
}
