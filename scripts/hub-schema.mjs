import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const schema = readFileSync(new URL('../server/hub/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(';').map(value => value.trim()).filter(Boolean);
const followTenantFunction = `CREATE FUNCTION rh_hub.assert_follow_account_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, rh_hub AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.account
    WHERE id = NEW.account_id AND "tenantId" = NEW.tenant_id) THEN
    RAISE EXCEPTION 'HUB_FOLLOW_ACCOUNT_TENANT_REJECTED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$`;

export const followGuardBody = followTenantFunction.split('AS $$')[1].split('$$')[0].trim();
/** Validate only catalog/seed facts returned by a read-only, guarded transaction. */
export function validateHubSchemaSnapshot(state) {
  const expected=['hub','hub_follow','scope_version'];
  if (!Array.isArray(state.tables) || state.tables.length!==3 || state.tables.map(x=>x.name).sort().join(',')!==expected.join(',') || state.tables.some(x=>!x.rls||!x.forced)) throw new Error('HUB_SCHEMA_INCOMPLETE');
  const expr="(tenant_id = current_setting('app.tenant_id'::text, true))",expectedPolicies=[['hub','hub_tenant',null],['hub_follow','follow_tenant',expr],['scope_version','scope_tenant',null]];
  if(!Array.isArray(state.policies)||state.policies.length!==3||expectedPolicies.some(([table,name,check])=>!state.policies.some(p=>p.table===table&&p.name===name&&p.command==='*'&&p.permissive===true&&JSON.stringify(p.roles)==='[0]'&&p.usingExpression===expr&&p.checkExpression===check)))throw new Error('HUB_POLICY_INCOMPLETE');
  const g=state.guard;
  if (!g || g.name!=='follow_account_tenant_guard' || g.functionSchema!=='rh_hub' || g.functionName!=='assert_follow_account_tenant' || g.enabled!=='O' || g.type!==23 || g.tgattr!=='' || g.tgqual!==null || !g.securityDefiner || g.args!==0 || g.language!=='plpgsql' || g.returnType!=='trigger' || JSON.stringify(g.config)!==JSON.stringify(['search_path=pg_catalog, public, rh_hub']) || typeof g.body!=='string' || g.body.trim()!==followGuardBody) throw new Error('HUB_FOLLOW_GUARD_CONFLICT');
  if(!state.tenantActive||!state.adminActive||!Array.isArray(state.hubs)||state.hubs.length!==1||state.hubs[0]!=='lingshu-xinyu'||state.seed!==true)throw new Error('HUB_FIXTURE_INCOMPLETE');
}
export async function assertHubSchema() {
  const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
  const target=await assertFixtureTarget(env);if(target.databaseName!=='wp01_test_full_baseline')throw new Error('HUB_TARGET_REJECTED');
  const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
  return withFixtureTransaction(env,'direct',db=>inspectHubSchema(db,ids,target.databaseName),{readOnly:true});
}

export async function inspectHubSchema(db,ids,databaseName) {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const tenant=await db.tenant.findUnique({where:{id:ids.tenant},select:{status:true}}),admin=await db.account.findUnique({where:{id:ids.admin},select:{tenantId:true,status:true}});
    const tables=await db.$queryRaw`SELECT c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_hub' AND c.relkind='r'`;
    const guards=await db.$queryRaw`SELECT t.tgname AS name,pn.nspname AS "functionSchema",p.proname AS "functionName",t.tgenabled AS enabled,t.tgtype::int AS type,t.tgattr::text AS tgattr,t.tgqual::text AS tgqual,p.prosecdef AS "securityDefiner",p.proconfig AS config,p.pronargs::int AS args,l.lanname AS language,rt.typname AS "returnType",p.prosrc AS body FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang JOIN pg_type rt ON rt.oid=p.prorettype WHERE n.nspname='rh_hub' AND c.relname='hub_follow' AND t.tgname='follow_account_tenant_guard' AND NOT t.tgisinternal`;
    const policies=await db.$queryRaw`SELECT c.relname AS "table",p.polname AS name,p.polcmd::text AS command,p.polpermissive AS permissive,ARRAY(SELECT r::int FROM unnest(p.polroles) r) AS roles,pg_get_expr(p.polqual,p.polrelid) AS "usingExpression",pg_get_expr(p.polwithcheck,p.polrelid) AS "checkExpression" FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_hub'`;
    if(tables.length!==3||guards.length!==1)throw new Error('HUB_SCHEMA_INCOMPLETE');
    const hubs=await db.$queryRaw`SELECT hub_key FROM rh_hub.hub WHERE tenant_id=${ids.tenant}`;
    const seed=await db.$queryRaw`SELECT EXISTS(SELECT 1 FROM rh_hub.scope_version WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu' AND version=1 AND created_by=${ids.admin} AND definition->>'purpose'='initial_scope') AS present`;
    validateHubSchemaSnapshot({tables,policies,guard:guards[0],tenantActive:tenant?.status==='active',adminActive:admin?.tenantId===ids.tenant&&admin?.status==='active',hubs:hubs.map(x=>x.hub_key),seed:seed[0]?.present});
    return {databaseName,tenantId:ids.tenant,hubKey:'lingshu-xinyu',tables:tables.map(x=>x.name).sort()};
}


export async function applyHubSchema() {
  const { env } = loadFixtureInput(root + '.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
  if (statements.length < 16 || /\b(?:DROP|TRUNCATE|DELETE)\b/i.test(schema)) throw new Error('HUB_SCHEMA_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const tenant = await db.tenant.findUnique({ where: { id: ids.tenant }, select: { status: true } });
    const admin = await db.account.findUnique({ where: { id: ids.admin }, select: { tenantId: true, status: true } });
    if (tenant?.status !== 'active' || admin?.tenantId !== ids.tenant || admin?.status !== 'active')
      throw new Error('HUB_FIXTURE_REJECTED');
    const existing = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'rh_hub'`;
    if (existing.length !== 0 && existing.length !== 3) throw new Error('HUB_SCHEMA_PARTIAL');
    if (existing.length === 0) for (const statement of statements) await db.$executeRawUnsafe(statement);
    const guards = await db.$queryRaw`
      SELECT t.tgname, p.proname, p.prosecdef AS definer
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'rh_hub' AND c.relname = 'hub_follow'
        AND NOT t.tgisinternal AND t.tgname = 'follow_account_tenant_guard'`;
    if (guards.length === 0) {
      await db.$executeRawUnsafe(followTenantFunction);
      await db.$executeRawUnsafe(`CREATE TRIGGER follow_account_tenant_guard
        BEFORE INSERT OR UPDATE ON rh_hub.hub_follow FOR EACH ROW
        EXECUTE FUNCTION rh_hub.assert_follow_account_tenant()`);
    } else if (guards.length !== 1 || guards[0].proname !== 'assert_follow_account_tenant' || !guards[0].definer) {
      throw new Error('HUB_FOLLOW_GUARD_CONFLICT');
    }
    const rows = await db.$queryRaw`SELECT hub_key AS key FROM rh_hub.hub WHERE tenant_id = ${ids.tenant}`;
    if (rows.length === 0) {
      await db.$executeRaw`INSERT INTO rh_hub.hub (tenant_id, hub_key, name, summary, status, scope_status)
        VALUES (${ids.tenant}, 'lingshu-xinyu', '针灸治疗情志病',
          '围绕针灸治疗情志病的可核验研究资料与科研协作。具体纳入范围待专家确认。',
          'active', 'pending_expert_confirmation')`;
      await db.$executeRaw`INSERT INTO rh_hub.scope_version
        (tenant_id, hub_key, version, definition, status, created_by)
        VALUES (${ids.tenant}, 'lingshu-xinyu', 1,
          ${JSON.stringify({ purpose: 'initial_scope', inclusion: null, exclusion: null, note: '待专家确认' })}::jsonb,
          'draft', ${ids.admin})`;
    } else if (rows.length !== 1 || rows[0].key !== 'lingshu-xinyu') {
      throw new Error('HUB_SEED_CONFLICT');
    }
    const checked = await db.$queryRaw`SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'rh_hub' AND c.relkind = 'r'`;
    if (checked.length !== 3 || checked.some(row => !row.rls || !row.forced)) throw new Error('HUB_SCHEMA_INCOMPLETE');
    return { databaseName: target.databaseName, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', tables: checked.map(row => row.relname).sort() };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-schema.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyHubSchema().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write((error.code || error.message) + '\n'); process.exitCode = 1; });
  }
}
