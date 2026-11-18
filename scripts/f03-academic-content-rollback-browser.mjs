// Explicit isolated candidate; every F03 database write rolls back. No shared runtime reload.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {target} from './f01-admission-migration.mjs';import {academicStatements} from './f03-academic-content-migration.mjs';
import {assertFixtureTarget,validateFixtureConfig,fixtureClient,checkFixtureIdentity,readFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createHubAuth} from '../server/auth/controller.mjs';import {assembleAdmission} from '../server/admission/assembly.mjs';import {assembleAcademicContent} from '../server/academic-content/assembly.mjs';
import {installAcademicContentBodyPolicy} from '../server/academic-content/http-policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function run({verifyBrowser}={}){
 const {env,ids}=target();await assertFixtureTarget(env);const config=validateFixtureConfig(env),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,n)=>require(root+'app/server/src/'+p+'.ts')[n];
 const {Module,HttpException}=require('@nestjs/common'),{NestFactory,Reflector}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt');const lock=load('common/worker-publication','lockAuthorizationMutation'),origin='http://127.0.0.1:19721';
 const scope=load('common/deployment-scope','parseDeploymentScope')({DEPLOYMENT_ID:'f03-rollback-candidate',DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:ids.tenant,DEFAULT_TENANT_ID:ids.tenant,ENABLED_WORKER_KINDS:''});
 const client=fixtureClient(config.directUrl),rollback=new Error('F03_BROWSER_ROLLBACK');let app,vite,report;
 try{await client.$transaction(async tx=>{
  checkFixtureIdentity(config,'direct',await readFixtureIdentity(tx));await tx.$executeRawUnsafe('SET LOCAL statement_timeout=10000');await lock(tx,ids.tenant);
  if(!(await tx.$queryRawUnsafe("SELECT to_regnamespace('rh_academic')::text AS name"))[0].name)for(const sql of academicStatements())await tx.$executeRawUnsafe(sql);
  let queue=Promise.resolve(),n=0;const transact=fn=>{const task=queue.then(async()=>{const sp='f03_http_'+(++n);await tx.$executeRawUnsafe('SAVEPOINT '+sp);try{const value=await fn(tx);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+sp);return value;}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+sp);throw e;}});queue=task.catch(()=>{});return task;};
  const db=new Proxy(tx,{get(t,k){if(k==='$transaction')return transact;const v=t[k];return typeof v==='function'?v.bind(t):v;}}),prisma={elevated:db,app:db,forTenant(t){assert.equal(t,ids.tenant);return db;},withTenantTransaction(t,_g,_p,fn){assert.equal(t,ids.tenant);return transact(fn);}};
  const auth=createHubAuth({require,load,jwt:new JwtService({secret:runtime.secret,signOptions:{expiresIn:'12h'}}),prisma,scope,cookieName:'rh_f03_candidate',origin,secureCookie:()=>false}),admission=assembleAdmission({prisma,scope,require,load,origin}),academic=assembleAcademicContent({prisma,scope,require,load,origin});
  class Root{}Module({controllers:[auth.Controller,admission.Controller,...academic.Controllers]})(Root);app=await NestFactory.create(Root,{logger:false});app.setGlobalPrefix('api');
  installAcademicContentBodyPolicy(app,{require});const reflector=new Reflector();app.useGlobalGuards(auth.guard(reflector),admission.guard(reflector),new(load('common/guards/roles.guard','RolesGuard'))(reflector,prisma),new(load('common/guards/study-group.guard','StudyGroupGuard'))(reflector,prisma));
  app.useGlobalFilters({catch(e,host){const res=host.switchToHttp().getResponse();res.setHeader('Cache-Control','no-store');if(e instanceof HttpException)return res.status(e.getStatus()).json(e.getResponse());return res.status(503).json({code:'CONTENT_CANDIDATE_UNAVAILABLE',message:'合成验证服务暂不可用。'});}});await app.listen(19722,'127.0.0.1');
  const {createServer}=await import('../node_modules/vite/dist/node/index.js');vite=await createServer({root:root+'researchhub',configFile:root+'researchhub/vite.config.js',cacheDir:root+'researchhub/.tmp/f03-browser-vite',define:{'import.meta.env.VITE_AUTH_TENANT_SLUG':JSON.stringify(ids.tenant)},server:{host:'127.0.0.1',port:19721,strictPort:true,proxy:{'/api':'http://127.0.0.1:19722'}},logLevel:'error'});await vite.listen();
  const verify=verifyBrowser??(await import('./f03-academic-content-browser.mjs')).verifyAcademicBrowser;report=await verify({base:origin,tenantSlug:ids.tenant,password:runtime.password});await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');throw rollback;
 },{timeout:900000,maxWait:8000});}catch(e){if(e!==rollback)throw e;}finally{await vite?.close();await app?.close();await client.$disconnect();}return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.equal(process.argv[2],'--run');run().then(()=>console.log('F03 candidate business proof passed; all DB writes rolled back.')).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});}
