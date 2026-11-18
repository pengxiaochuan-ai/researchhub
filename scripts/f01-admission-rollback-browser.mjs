// Explicit, isolated HTTP/browser rehearsal. All database changes roll back.
// Uses separate 19711/19712 ports; never stops the shared 19501 runtime.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fixtureClient,validateFixtureConfig,assertFixtureTarget,checkFixtureIdentity,readFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {target} from './f01-admission-migration.mjs';
import {createHubAuth} from '../server/auth/controller.mjs';
import {assembleAdmission} from '../server/admission/assembly.mjs';
import {createWp02Repository} from '../server/wp02/repository.mjs';
import {createAccountAccess} from '../server/wp02/account-service.mjs';
import {createWp02Controllers} from '../server/wp02/controllers.mjs';
import {createAccountMailer} from '../server/wp02/mailer.mjs';
import {readWp02Config} from '../server/wp02/config.mjs';
import {createResearchStudiesController} from '../server/research-studies/controller.mjs';
import {createGovernanceUsers} from '../server/governance-users/service.mjs';
import {createGovernanceUsersController} from '../server/governance-users/controller.mjs';
import {createMyResearchController} from './my-research-overview.mjs';
import {verifyAdmissionBrowser} from './f01-admission-browser.mjs';
import {createHubDefaultSkills} from '../server/ai-agent/default-skills.mjs';
import {createHubSkillController} from '../server/ai-agent/default-skills-controller.mjs';
import {loadSkillCatalog} from '../server/ai-agent/skill-catalog.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function run(){
 const {env,ids}=target();await assertFixtureTarget(env);const config=validateFixtureConfig(env);
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const load=(p,n)=>require(root+'app/server/src/'+p+'.ts')[n];
 const {Module,HttpException}=require('@nestjs/common'),{NestFactory,Reflector}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt');
 const parseDeploymentScope=load('common/deployment-scope','parseDeploymentScope');
 const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
 const origin='http://127.0.0.1:19711',lockAuthorization=load('common/worker-publication','lockAuthorizationMutation');
 const scope=parseDeploymentScope({DEPLOYMENT_ID:'f01-isolated-browser',DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:ids.tenant,DEFAULT_TENANT_ID:ids.tenant,ENABLED_WORKER_KINDS:''});
 const client=fixtureClient(config.directUrl),rollback=new Error('F01_BROWSER_ROLLBACK');let app,vite,report;
 try{await client.$transaction(async tx=>{
  checkFixtureIdentity(config,'direct',await readFixtureIdentity(tx));await tx.$executeRawUnsafe('SET LOCAL statement_timeout=10000');
  await lockAuthorization(tx,ids.tenant);
  assert((await tx.$queryRawUnsafe("SELECT to_regnamespace('rh_admission')::text AS schema"))[0].schema,'F01_MIGRATION_REQUIRED');
  const used=await tx.account.count({where:{tenantId:ids.tenant}});const before=await tx.tenant.findUnique({where:{id:ids.tenant},select:{quotaSeats:true}});
  // Test-only capacity is uncommitted and always rolled back; live quota stays unchanged.
  await tx.tenant.update({where:{id:ids.tenant},data:{quotaSeats:Math.max(before.quotaSeats,used+2)}});
  let queue=Promise.resolve(),number=0;
  const transact=fn=>{const task=queue.then(async()=>{const sp='f01_http_'+(++number);await tx.$executeRawUnsafe('SAVEPOINT '+sp);try{const value=await fn(tx);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+sp);return value;}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+sp);throw e;}});queue=task.catch(()=>{});return task;};
  const db=new Proxy(tx,{get(target,key){if(key==='$transaction')return transact;const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const prisma={elevated:db,app:db,forTenant(t){assert.equal(t,ids.tenant);return db;},withTenantTransaction(t,_g,_p,fn){assert.equal(t,ids.tenant);return transact(fn);}};
  const jwt=new JwtService({secret:runtime.secret,signOptions:{expiresIn:'12h'}});
  const hubAuth=createHubAuth({require,load,jwt,prisma,scope,cookieName:'rh_f01_isolated',origin,secureCookie:()=>false});
  const admission=assembleAdmission({prisma,scope,require,load,origin});
  const mailConfig={...readWp02Config({file:root+'researchhub/.env.smtp.local',approvedMode:'capture'}),baseUrl:origin};
  const mailer=createAccountMailer(mailConfig,{receipt:id=>{assert.match(id,/^[a-f0-9-]{36}$/);const p=root+'.tmp/researchhub-wp02/mail/'+id+'.json';if(!existsSync(p))return null;const m=JSON.parse(readFileSync(p,'utf8'));return{id:m.id,to:m.to,expiresAt:m.expiresAt,digest:m.digest};}});
  const repository=createWp02Repository({tenantId:ids.tenant,transact,lockAuthorization});
  const accounts=createAccountAccess({db:repository,config:mailConfig,mailer,bcrypt:require('bcryptjs'),secret:runtime.secret,registerAdmissionInTransaction:admission.service.registerInTransaction});
  const users=createGovernanceUsers({transact:(_p,fn)=>transact(fn),legacyUpdate:()=>{throw Error('F01_UNRELATED_ACCOUNT_MUTATION_BLOCKED');},legacyChangeMember:()=>{throw Error('F01_UNRELATED_MEMBER_MUTATION_BLOCKED');},canMutate:()=>false});
  const skills=createHubDefaultSkills({scope,tenantId:ids.tenant,agentId:ids.tenant+'-kb-research',catalog:await loadSkillCatalog(new URL('../',import.meta.url)),transaction:transact,lockAuthorization,resolveEffectiveSkillCatalog:load('agents/effective-skills-policy','resolveEffectiveSkillCatalog')});
  class Root{}
  Module({controllers:[hubAuth.Controller,admission.Controller,createHubSkillController({require,skills}),...createWp02Controllers({require,load,accounts,origin,apiHost:'127.0.0.1:19712'}),createGovernanceUsersController({require,service:users,origin}),createResearchStudiesController({require,load,prisma,scope,origin}),createMyResearchController({root,ids,prisma,load,require})]})(Root);
  app=await NestFactory.create(Root,{logger:false});app.setGlobalPrefix('api');
  const reflector=new Reflector();app.useGlobalGuards(hubAuth.guard(reflector),admission.guard(reflector),new(load('common/guards/roles.guard','RolesGuard'))(reflector,prisma),new(load('common/guards/study-group.guard','StudyGroupGuard'))(reflector,prisma));
  app.useGlobalFilters({catch(e,host){const res=host.switchToHttp().getResponse();res.setHeader('Cache-Control','no-store');if(e instanceof HttpException)return res.status(e.getStatus()).json(e.getResponse());return res.status(503).json({code:'F01_CANDIDATE_UNAVAILABLE',message:'合成验收服务暂不可用。'});}});
  await app.listen(19712,'127.0.0.1');
  const {createServer}=await import('../node_modules/vite/dist/node/index.js');
  vite=await createServer({root:root+'researchhub',configFile:root+'researchhub/vite.config.js',cacheDir:root+'researchhub/.tmp/f01-browser-vite',define:{'import.meta.env.VITE_AUTH_TENANT_SLUG':JSON.stringify(ids.tenant)},server:{host:'127.0.0.1',port:19711,strictPort:true,proxy:{'/api':'http://127.0.0.1:19712'}},logLevel:'error'});await vite.listen();
  report=await verifyAdmissionBrowser({base:origin,ids,password:runtime.password,newEmail:'f01-'+randomUUID().slice(0,8)+'@example.test',mailLink:email=>transact(async db=>{
   const rows=await db.$queryRawUnsafe('SELECT "messageId","deliveryStatus" FROM account_action_challenge WHERE "tenantId"=$1 AND email=$2 ORDER BY "createdAt" DESC LIMIT 1',ids.tenant,email);assert.equal(rows[0]?.deliveryStatus,'captured');const m=JSON.parse(readFileSync(root+'.tmp/researchhub-wp02/mail/'+rows[0].messageId+'.json','utf8'));const link=m.text.match(/http:\/\/127\.0\.0\.1:19711\/pages\/p004\/#verify=[A-Za-z0-9_-]{43}/)?.[0];assert(link);return link;
  }),fillSeats:()=>transact(async db=>{const used=await db.account.count({where:{tenantId:ids.tenant}});await db.tenant.update({where:{id:ids.tenant},data:{quotaSeats:used}});}),inspect:accountId=>transact(async db=>({agentAccess:await db.agentAccess.count({where:{accountId}}),tokenGrants:await db.tokenQuotaGrant.count({where:{accountId}}),privateStudyId:(await db.$queryRawUnsafe('SELECT id FROM rh_research.study_binding WHERE tenant_id=$1 ORDER BY id LIMIT 1',ids.tenant))[0]?.id,groupMemberships:await db.studyGroupMembership.count({where:{accountId}}),projectMemberships:await db.researchProjectMembership.count({where:{accountId}}),decisionCount:Number((await db.$queryRawUnsafe("SELECT count(*) AS n FROM rh_admission.event e JOIN rh_admission.application a ON a.id=e.application_id WHERE a.account_id=$1 AND e.action IN ('approve','needs_information','reject')",accountId))[0].n)}))});
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');throw rollback;
 },{timeout:900000,maxWait:8000});}catch(e){if(e!==rollback)throw e;}
 finally{await vite?.close();await app?.close();await client.$disconnect();}
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.equal(process.argv[2],'--run');run().then(()=>console.log('F01 isolated real browser rehearsal passed; database rolled back.')).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});}
