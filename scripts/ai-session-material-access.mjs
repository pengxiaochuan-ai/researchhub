import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {applyMaterialSchemaInTransaction,inspectMaterialSchema} from './ai-session-material-schema.mjs';

const profile='app-material-rw.v1';
const expected={usage:true,select:true,insert:true,update:true,delete:false,truncate:false,references:false,trigger:false,create:false,function_execute:false};
const noAccess=Object.fromEntries(Object.keys(expected).map(key=>[key,false]));
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
let native;
function services(){
  if(native)return native;
  require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
  native={Agents:require('../../app/server/src/agents/agents.service.ts').AgentsService,
    lock:require('../../app/server/src/common/worker-publication.ts').lockAuthorizationMutation};
  return native;
}
export function readMaterialAccess(tx){return tx.$queryRawUnsafe(`SELECT
  has_schema_privilege('aisci_app',n.oid,'USAGE') AS usage,
  has_table_privilege('aisci_app',c.oid,'SELECT') AS select,
  has_table_privilege('aisci_app',c.oid,'INSERT') AS insert,
  has_table_privilege('aisci_app',c.oid,'UPDATE') AS update,
  has_table_privilege('aisci_app',c.oid,'DELETE') AS delete,
  has_table_privilege('aisci_app',c.oid,'TRUNCATE') AS truncate,
  has_table_privilege('aisci_app',c.oid,'REFERENCES') AS references,
  has_table_privilege('aisci_app',c.oid,'TRIGGER') AS trigger,
  has_schema_privilege('aisci_app',n.oid,'CREATE') AS create,
  has_function_privilege('aisci_app','rh_ai.check_session_material()','EXECUTE') AS function_execute
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname='session_materials'`);}

export async function applyMaterialAccessInTransaction(tx,env){
  await applyMaterialSchemaInTransaction(tx,env);
  const before=await inspectMaterialSchema(tx),rights=(await readMaterialAccess(tx))[0];
  if(before.receipt.accessProfile===profile){assert.deepEqual(rights,expected,'MATERIAL_ACCESS_CONFLICT');return {changed:false,profile};}
  assert.equal(before.receipt.accessProfile,undefined,'MATERIAL_ACCESS_CONFLICT');
  assert.deepEqual(rights,noAccess,'MATERIAL_ACCESS_CONFLICT');
  await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA rh_ai TO aisci_app');
  await tx.$executeRawUnsafe('GRANT SELECT,INSERT,UPDATE ON TABLE rh_ai.session_materials TO aisci_app');
  assert.deepEqual((await readMaterialAccess(tx))[0],expected,'MATERIAL_ACCESS_CONFLICT');
  const after=await inspectMaterialSchema(tx),receipt={...before.receipt,accessProfile:profile,catalogHash:after.catalogHash};
  await tx.$executeRawUnsafe("COMMENT ON TABLE rh_ai.session_materials IS '"+JSON.stringify(receipt).replaceAll("'","''")+"'");
  await applyMaterialSchemaInTransaction(tx,env);
  return {changed:true,profile};
}

export async function enableNamedMaterialFileReadInTransaction(tx,ids){
  assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/,'MATERIAL_LOCAL_SCOPE_REQUIRED');
  const {Agents,lock}=services();await lock(tx,ids.tenant,{official:true});
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true)`,ids.tenant,ids.group,ids.project);
  const agentId=ids.tenant+'-kb-research';
  const [tenant,agent,admin,actors,accesses]=await Promise.all([
    tx.tenant.findFirst({where:{id:ids.tenant,status:'active'}}),
    tx.agent.findFirst({where:{id:agentId,tenantId:ids.tenant,status:'active',type:'research'}}),
    tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active',role:'tenant_admin'}}),
    tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]},tenantId:ids.tenant,status:'active'}}),
    tx.agentAccess.findMany({where:{agentId,tenantId:ids.tenant}}),
  ]);
  assert(tenant&&agent&&admin&&actors.length===2,'MATERIAL_LOCAL_SCOPE_REQUIRED');
  assert(accesses.length===2&&accesses.every(a=>[ids.owner,ids.admin].includes(a.accountId)&&a.scopeKey===a.accountId&&a.enabled),'MATERIAL_AGENT_ACCESS_CONFLICT');
  const configs=await tx.agentConfig.findMany({where:{agentId,tenantId:ids.tenant,active:true,archivedAt:null}});
  assert.equal(configs.length,1,'MATERIAL_AGENT_CONFIG_CONFLICT');const original=configs[0];
  if(JSON.stringify(original.tools)===JSON.stringify(['knowledge.search','file.read']))return {changed:false,version:original.version};
  assert.deepEqual(original.tools,['knowledge.search'],'MATERIAL_AGENT_CONFIG_CONFLICT');
  const latest=await tx.agentConfig.findFirst({where:{agentId},orderBy:{version:'desc'}});
  const created=await tx.agentConfig.create({data:{tenantId:ids.tenant,agentId,version:latest.version+1,active:false,
    identity:original.identity,model:original.model,env:original.env,tools:['knowledge.search','file.read'],skillsEnabled:original.skillsEnabled}});
  const facade={forTenant:t=>{assert.equal(t,ids.tenant);return tx;},withTenantTransaction:(t,_g,_p,cb)=>{assert.equal(t,ids.tenant);return cb(tx);}};
  const service=new Agents(facade),user={tenantId:ids.tenant,accountId:ids.admin,role:admin.role,isTenantAdmin:admin.isTenantAdmin,authVersion:admin.authVersion,studyGroupId:ids.group,researchProjectId:ids.project};
  await service.activateConfig(user,agentId,created.id,original.version);
  await tx.auditLog.createMany({data:{tenantId:ids.tenant,accountId:ids.admin,action:'config_agent',target:agentId+'#v'+created.version,
    meta:{approval:'2026-11-12-user-serial-material-slice1',toolsAdded:['file.read'],fromVersion:original.version,toVersion:created.version,originalConfigHash:createHash('sha256').update(JSON.stringify({model:original.model,env:original.env})).digest('hex')}}});
  return {changed:true,version:created.version,previousVersion:original.version};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--apply-slice1-access']);
    const {env}=loadFixtureInput(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
    const {ids}=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8'));
    const result=await withFixtureTransaction(env,'direct',async tx=>({table:await applyMaterialAccessInTransaction(tx,env),agent:await enableNamedMaterialFileReadInTransaction(tx,ids)}));
    console.log(JSON.stringify({passed:true,...result}));
  }catch(e){console.error(JSON.stringify({passed:false,code:e.meta?.code??e.code??'MATERIAL_ACCESS_UNAVAILABLE'}));process.exitCode=1;}
}
