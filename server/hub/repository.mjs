const reject = () => { throw new Error('HUB_SCOPE_REJECTED'); };

async function scope(db, tenantId) {
  if (!db || typeof tenantId !== 'string' || !tenantId) reject();
  const rows = await db.$queryRaw`SELECT current_setting('app.tenant_id', true) AS tenant`;
  if (rows[0]?.tenant !== tenantId) reject();
}

async function activeAccount(db, tenantId, principal) {
  if (!principal || principal.tenantId !== tenantId || !principal.accountId || !Number.isInteger(principal.authVersion)) reject();
  const account = await db.account.findFirst({ where: {
    id: principal.accountId, tenantId, status: 'active', authVersion: principal.authVersion,
    tenant: { status: 'active' },
  }, select: { id: true } });
  if (!account) reject();
}

function present(row) {
  return { key: row.hubKey, name: row.name, summary: row.summary,
    scopeStatus: row.scopeStatus, updatedAt: row.updatedAt.toISOString() };
}

export async function listHubs({ db, tenantId }) {
  await scope(db, tenantId);
  const rows = await db.$queryRaw`SELECT hub_key AS "hubKey", name, summary,
    scope_status AS "scopeStatus", updated_at AS "updatedAt"
    FROM rh_hub.hub WHERE tenant_id = ${tenantId} AND status = 'active' ORDER BY hub_key`;
  return rows.map(present);
}

export async function getHub({ db, tenantId, hubKey }) {
  await scope(db, tenantId);
  if (!/^[a-z0-9-]{1,64}$/.test(hubKey || '')) return null;
  const rows = await db.$queryRaw`SELECT hub_key AS "hubKey", name, summary,
    scope_status AS "scopeStatus", updated_at AS "updatedAt"
    FROM rh_hub.hub WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey} AND status = 'active'`;
  return rows[0] ? present(rows[0]) : null;
}

export async function getFollow({ db, tenantId, hubKey, principal }) {
  await scope(db, tenantId);
  await activeAccount(db, tenantId, principal);
  if (!await getHub({ db, tenantId, hubKey })) reject();
  const rows = await db.$queryRaw`SELECT followed FROM rh_hub.hub_follow
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey} AND account_id = ${principal.accountId}`;
  return rows[0]?.followed === true;
}

export async function setFollow({ db, tenantId, hubKey, principal, followed }) {
  await scope(db, tenantId);
  // Match the old AccountsService authorization-mutation lock order. An
  // in-flight disable/password reset must serialize before this final check.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:official'}, 0))`;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`wp01:tenant:${tenantId}`}, 0))`;
  await activeAccount(db, tenantId, principal);
  if (typeof followed !== 'boolean' || !await getHub({ db, tenantId, hubKey })) reject();
  await db.$executeRaw`INSERT INTO rh_hub.hub_follow (tenant_id, hub_key, account_id, followed)
    VALUES (${tenantId}, ${hubKey}, ${principal.accountId}, ${followed})
    ON CONFLICT (tenant_id, hub_key, account_id) DO UPDATE
    SET followed = EXCLUDED.followed, updated_at = now()`;
  return followed;
}
