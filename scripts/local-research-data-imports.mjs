import {readFileSync,existsSync} from 'node:fs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {validateGeneralUnitScope,assertGeneralUnitRows,assertGeneralUnitManifest} from './ai-research-data-general-scope.mjs';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {createLocalResearchPrisma} from './research-creation-local-integration.mjs';import {createLocalMaterialAccess} from './local-session-materials.mjs';import {createNativeResearchDataPreflight} from './ai-research-data-preflight.mjs';import {createResearchDataImportNative} from './ai-research-data-import-native.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';import {createResearchDataImportAccess} from '../server/ai-agent/research-data-import-access.mjs';import {createResearchDataImports,assertSourcePreflightCancellableInTx} from '../server/ai-agent/research-data-imports.mjs';
const file=new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url);
const deny=()=>{throw Object.assign(Error('DATA_IMPORT_PERMISSION_CHANGED'),{code:'DATA_IMPORT_PERMISSION_CHANGED',status:403});};
function createScopedResearchDataImports({env,ids,load,require,storage},config,boundRows){
 const initial=config();
 const prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:fn=>withFixtureTransaction(env,'app',fn)}),studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('DATA_IMPORT_CREATION_FORBIDDEN');}}),sourceAccess=createLocalMaterialAccess({env,ids,load});
 const authority=createResearchDataImportAccess({authorizeRead:load('study-operations/formal-response-authority','authorizeFormalResponse'),additionalObjects:(user,target,source,scopeKey)=>{const c=config();if(scopeKey!==c.scopeKey||target.studyId!==c.target.studyId||source.sessionId!==c.sessions[user.accountId])deny();return c.registeredObjects[user.accountId]??{subjectIds:[],visitIds:[]};}}),baseNative=createResearchDataImportNative({load,authority}),native=boundRows?{...baseNative,prepareInTx:(tx,u,t,s,o,m)=>{boundRows(config(),u,m);return baseNative.prepareInTx(tx,u,t,s,o,m);}}:baseNative;
 const engine=createNativeResearchDataPreflight({load,require});
 const service=createResearchDataImports({studies,sourceAccess,authority,native,engine,storage,scopeKey:initial.scopeKey,allowedStudyIds:[initial.target.studyId]});
 const bound={};
 for(const key of ['targets','prepare','get','current','receipt','confirm','cancel','analysis'])bound[key]=(user,sid,...args)=>{
  const c=config();if(user.tenantId!==ids.tenant||![ids.owner,ids.admin].includes(user.accountId)||c.sessions[user.accountId]!==sid){if(key==='targets')return Promise.resolve({items:[]});if(key==='current')return Promise.resolve({item:null});deny();}return service[key](user,sid,...args);
 };
 async function readSubjectsInTx(tx,user,ctx){
  const c=config();if(ctx.studyId!==c.target.studyId||user.tenantId!==ids.tenant||![ids.owner,ids.admin].includes(user.accountId))deny();
  const source={sessionId:c.sessions[user.accountId],studyGroupId:ids.group,researchProjectId:ids.project},principal={...user,studyGroupId:source.studyGroupId,researchProjectId:source.researchProjectId};let actor;
  try{actor=await sourceAccess.inTransaction(tx,principal,source.sessionId,async(_tx,current)=>current);}finally{await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,ctx.studyGroupId,ctx.executionProjectId,user.accountId);}
  const target={studyId:ctx.studyId,studyGroupId:ctx.studyGroupId,executionProjectId:ctx.executionProjectId},current=await authority.currentInTx(tx,actor,target,source,{scopeKey:c.scopeKey,capability:'result.read'});
  return{subjectIds:current.allowedSubjectIds,visitIds:current.allowedVisitIds};
 }
 async function withImportTransaction(tx,user,sid,operation){
  const c=config();if(user.tenantId!==ids.tenant||![ids.owner,ids.admin].includes(user.accountId)||c.sessions[user.accountId]!==sid)deny();
  const localPrisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:fn=>fn(tx)}),localStudies=createResearchStudiesService({prisma:localPrisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('DATA_IMPORT_CREATION_FORBIDDEN');}}),localSource=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)});
  const local=createResearchDataImports({studies:localStudies,sourceAccess:localSource,authority,native,engine,storage,scopeKey:initial.scopeKey,allowedStudyIds:[initial.target.studyId]});
  try{return await operation(local);}finally{await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,user.studyGroupId,user.researchProjectId,user.accountId);}
 }
 return{service:bound,analysisInTransaction:(tx,u,sid,id)=>withImportTransaction(tx,u,sid,s=>s.analysis(u,sid,id)),currentInTransaction:(tx,u,sid)=>withImportTransaction(tx,u,sid,s=>s.current(u,sid)),readSubjectsInTx,assertSourceCancellationInTx:assertSourcePreflightCancellableInTx};
}
export function createLocalResearchDataImports(args){
 const {ids}=args,oldConfig=()=>{const c=JSON.parse(readFileSync(file,'utf8'));if(c.schema!=='hub-p05-local-scope.v1'||c.scopeKey!=='p05-import-20261113'||c.target.studyId!=='rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090'||c.target.studyGroupId!==ids.group||c.target.executionProjectId!=='cmwcc7ft60002lua6zkvh0mxj')deny();return c;};
 const unitFile=new URL('../.tmp/ai-file-data-2026-11-12/general-unit-authorized-scope.json',import.meta.url),old=oldConfig(),layers=[{snapshot:old,api:createScopedResearchDataImports(args,oldConfig,null),verify:async()=>{}}];let unitError;
 if(existsSync(unitFile))try{
  const initial=validateGeneralUnitScope(JSON.parse(readFileSync(unitFile,'utf8')),ids),digest=materialDigest(initial),config=()=>{const c=validateGeneralUnitScope(JSON.parse(readFileSync(unitFile,'utf8')),ids);if(materialDigest(c)!==digest)deny();return c;};
  const verify=async()=>{const c=config();await withFixtureTransaction(args.env,'direct',async tx=>{const [r]=await tx.$queryRawUnsafe('SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=$1','rh-general-unit-20261113');assertGeneralUnitManifest(c,r?.manifest);},{readOnly:true});};
  layers.push({snapshot:initial,api:createScopedResearchDataImports(args,config,assertGeneralUnitRows),verify});
 }catch(e){unitError=e;}
 // Select by the fixed startup index. A failed new config must not be read by
 // old P05 calls. Only the selected new scope rechecks its file and registry.
 const choose=(u,sid)=>{const found=layers.filter(x=>x.snapshot.sessions[u.accountId]===sid);if(found.length>1)deny();if(!found.length&&unitError&&['cmwevnq180005lu2arv5lqab9','cmwevnzrb000dlu2a2qm8k5ao'].includes(sid))deny();return found[0]??layers[0];};
 const service={};for(const key of ['targets','prepare','get','current','receipt','confirm','cancel','analysis'])service[key]=async(u,sid,...rest)=>{const layer=choose(u,sid);await layer.verify();return layer.api.service[key](u,sid,...rest);};
 return{service,analysisInTransaction:async(tx,u,sid,id)=>{const layer=choose(u,sid);await layer.verify();return layer.api.analysisInTransaction(tx,u,sid,id);},currentInTransaction:async(tx,u,sid)=>{const layer=choose(u,sid);await layer.verify();return layer.api.currentInTransaction(tx,u,sid);},
  readSubjectsInTx:async(tx,u,ctx)=>{const found=layers.filter(x=>x.snapshot.target.studyId===ctx.studyId);if(found.length!==1)deny();await found[0].verify();return found[0].api.readSubjectsInTx(tx,u,ctx);},assertSourceCancellationInTx:assertSourcePreflightCancellableInTx};
}
