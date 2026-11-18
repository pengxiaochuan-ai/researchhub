// Explicitly guarded, synthetic-only integration fixture. Never imported by the runtime.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

export const workspaceRoot=fileURLToPath(new URL('../../',import.meta.url));
export const requireServer=createRequire(workspaceRoot+'app/server/package.json');
export function fixtureEnvironment(){
  return loadFixtureInput(workspaceRoot+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json').env;
}
export async function applyCreationSchema(env){
  assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
  const sql=readFileSync(new URL('../server/research-studies/schema.sql',import.meta.url),'utf8');
  const hash=createHash('sha256').update(sql).digest('hex');
  return withFixtureTransaction(env,'direct',async db=>{
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rh-research-creation-schema-v1'))`;
    const [existing]=await db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id='rh-research-creation-schema-v1'`;
    if(existing){assert.equal(existing.manifest.sha256,hash,'CREATION_SCHEMA_CHANGED_REQUIRES_REVIEWED_MIGRATION');return {created:false,sha256:hash};}
    const [{count}]=await db.$queryRaw`SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_research' AND c.relkind='r'`;
    assert.equal(count,0,'CREATION_SCHEMA_UNTRACKED_EXISTING_TABLES');
    const statements=sql.split(/^-- @statement\s*$/m).slice(1).map(s=>s.trim()).filter(Boolean);
    assert(statements.length>0&&!/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i.test(sql));
    for(const statement of statements)await db.$executeRawUnsafe(statement); // Trusted source file, no user SQL.
    await db.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES('rh-research-creation-schema-v1',${JSON.stringify({purpose:'ResearchHub-creation-schema',syntheticOnly:true,sha256:hash})}::jsonb)`;
    return {created:true,sha256:hash};
  });
}

export async function createCreationFixture(env){
  assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
  const runId='rh-create-'+randomUUID().slice(0,8),password=randomBytes(24).toString('base64url');
  const ids={tenant:runId,foreignTenant:runId+'-foreign',group:runId+'-group',otherGroup:runId+'-group2',foreignGroup:runId+'-foreign-group',role:runId+'-configure',hub:runId+'-hub'};
  const accounts=Object.fromEntries(['admin','owner','member','outsider','platform','foreign'].map(role=>[role,runId+'-'+role]));
  const hash=await requireServer('bcryptjs').hash(password,10);
  await withFixtureTransaction(env,'direct',async db=>{
    for(const id of [ids.tenant,ids.foreignTenant])await db.tenant.create({data:{id,slug:id,name:'课题创建合成验证机构',quotaSeats:20,quotaStudyGroups:5}});
    for(const [key,id] of Object.entries(accounts))await db.account.create({data:{id,tenantId:key==='foreign'?ids.foreignTenant:ids.tenant,username:key+'@example.org',passwordHash:hash,displayName:'合成'+({admin:'租户管理员',owner:'领域负责人',member:'科研成员',outsider:'未获组权限成员',platform:'平台管理员',foreign:'其他机构成员'}[key]),role:key==='admin'?'tenant_admin':key==='platform'?'platform_admin':'researcher',isTenantAdmin:key==='admin'}});
    for(const [id,tenantId,name] of [[ids.group,ids.tenant,'合成课题组甲'],[ids.otherGroup,ids.tenant,'合成课题组乙'],[ids.foreignGroup,ids.foreignTenant,'其他机构课题组']])await db.studyGroup.create({data:{id,tenantId,slug:id,name,createdBy:tenantId===ids.tenant?accounts.admin:accounts.foreign}});
    await db.permissionRole.create({data:{id:ids.role,tenantId:ids.tenant,key:'configure',name:'合成课题配置成员',menuPermissions:['workbench'],buttonPermissions:['study.configure'],dataScope:'project'}});
    await db.studyGroupMembership.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:accounts.member,roleId:ids.role,isDefault:true}});
    await db.tenantFeatureEntitlement.create({data:{tenantId:ids.tenant,featureKey:'study_operations',enabled:true,updatedBy:accounts.admin}});
    await db.$executeRaw`INSERT INTO rh_hub.hub(tenant_id,hub_key,name,summary,status,scope_status) VALUES(${ids.tenant},${ids.hub},'合成领域研究','仅用于本轮软件验证','active','confirmed')`;
    await db.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify({purpose:'ResearchHub-creation-20261111',syntheticOnly:true,runId,ids,accounts})}::jsonb)`;
  });
  const privateDirectory=workspaceRoot+'.tmp/researchhub-creation/'+runId+'/';mkdirSync(privateDirectory,{recursive:true,mode:0o700});
  const fixture={runId,ids,accounts,password,privateDirectory};
  writeFileSync(privateDirectory+'fixture.json',JSON.stringify(fixture,null,2),{mode:0o600,flag:'wx'});
  return fixture;
}
