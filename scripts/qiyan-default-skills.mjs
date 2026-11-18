import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {loadSkillCatalog} from '../server/ai-agent/skill-catalog.mjs';
import {createHubDefaultSkills} from '../server/ai-agent/default-skills.mjs';

export async function saveDefaultSkillEvidence(directory,summary){
 await mkdir(directory,{recursive:true,mode:0o700});
 const path=resolve(directory,(summary.applied?'installation-':'catalog-')+randomUUID()+'.json');
 await writeFile(path,JSON.stringify(summary,null,2),{mode:0o600,flag:'wx'});
 return path;
}

export async function createLocalDefaultSkills({env,ids,scope}){
 const require=createRequire(import.meta.url);
 const {lockAuthorizationMutation}=require('../../app/server/dist/common/worker-publication.js');
 const {resolveEffectiveSkillCatalog}=require('../../app/server/dist/agents/effective-skills-policy.js');
 return createHubDefaultSkills({tenantId:ids.tenant,agentId:ids.tenant+'-kb-research',scope,
  catalog:await loadSkillCatalog(new URL('../',import.meta.url)),lockAuthorization:lockAuthorizationMutation,resolveEffectiveSkillCatalog,
  transaction:fn=>withFixtureTransaction(env,'app',async tx=>{
   // Empty Study settings are intentional for tenant-level configuration/audit RLS.
   await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true), set_config('app.study_group_id','',true), set_config('app.research_project_id','',true)",ids.tenant);return fn(tx);
  }),
 });
}

async function main(){
 const workspaceRoot=new URL('../../',import.meta.url);
 const runtime=JSON.parse(await readFile(new URL('.tmp/researchhub-knowledge-local/runtime.json',workspaceRoot),'utf8')),ids=runtime.ids;
 assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
 const {env}=loadFixtureInput(fileURLToPath(new URL('.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',workspaceRoot)));
 const scope={product:'researchhub',allowedTenantIds:[ids.tenant]};
 const service=await createLocalDefaultSkills({env,ids,scope});
 const admin=await withFixtureTransaction(env,'app',async tx=>{
  await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true)",ids.tenant);
  const a=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active'}});assert(a?.role==='tenant_admin');return{accountId:a.id,tenantId:ids.tenant,authVersion:a.authVersion};
 },{readOnly:true});
 const summary={at:new Date().toISOString(),syntheticOnly:true,scope:'hub-agent-defaults',modelCalls:0,applied:false};
 if(process.argv.includes('--apply')){
  const preserved=()=>withFixtureTransaction(env,'direct',async tx=>{
   const hashes={};
   for(const table of ['account','permission_role','agent','agent_config','agent_access','study_group_membership','research_project_membership','token_quota_grant']){
    hashes[table]=(await tx.$queryRawUnsafe(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) hash FROM "${table}" t`))[0].hash;
   }
   hashes.olderSkills=(await tx.$queryRawUnsafe(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) hash FROM skill t WHERE NOT ("tenantId"=$1 AND backend->>'adapter'='hub-medical-defaults.v1')`,ids.tenant))[0].hash;
   hashes.olderAssignments=(await tx.$queryRawUnsafe(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) hash FROM skill_assignment t WHERE "skillId" NOT IN (SELECT id FROM skill WHERE "tenantId"=$1 AND backend->>'adapter'='hub-medical-defaults.v1')`,ids.tenant))[0].hash;
   return hashes;
  },{readOnly:true});
  const before=await preserved();summary.results=await Promise.all([service.install(admin),service.install(admin)]);summary.applied=true;
  summary.preservation={before,after:await preserved()};assert.deepEqual(summary.preservation.before,summary.preservation.after);summary.preservation.unchanged=true;
 }
 summary.catalog=await service.list(admin);
 const dir=fileURLToPath(new URL('../.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/defaults-2026-11-07/',import.meta.url));
 const evidence=await saveDefaultSkillEvidence(dir,summary);
 console.log(JSON.stringify({applied:summary.applied,results:summary.results,count:summary.catalog.items.length,executionReady:false,modelCalls:0,evidence}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
