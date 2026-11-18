-- Not a standalone migration. scripts/hub-schema.mjs applies this inside the
-- synthetic-target guard and then installs/verifies the cross-tenant account
-- trigger before commit. Running only this SQL leaves hub_follow incomplete.
CREATE SCHEMA IF NOT EXISTS rh_hub;

CREATE TABLE IF NOT EXISTS rh_hub.hub (
  tenant_id text NOT NULL,
  hub_key text NOT NULL,
  name text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'archived')),
  scope_status text NOT NULL CHECK (scope_status IN ('pending_expert_confirmation', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, hub_key)
);
ALTER TABLE rh_hub.hub ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_hub.hub FORCE ROW LEVEL SECURITY;
CREATE POLICY hub_tenant ON rh_hub.hub USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE rh_hub.scope_version (
  tenant_id text NOT NULL,
  hub_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, hub_key, version),
  FOREIGN KEY (tenant_id, hub_key) REFERENCES rh_hub.hub (tenant_id, hub_key)
);
ALTER TABLE rh_hub.scope_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_hub.scope_version FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_tenant ON rh_hub.scope_version USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE rh_hub.hub_follow (
  tenant_id text NOT NULL,
  hub_key text NOT NULL,
  account_id text NOT NULL,
  followed boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, hub_key, account_id),
  FOREIGN KEY (tenant_id, hub_key) REFERENCES rh_hub.hub (tenant_id, hub_key),
  FOREIGN KEY (account_id) REFERENCES public.account (id)
);
ALTER TABLE rh_hub.hub_follow ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_hub.hub_follow FORCE ROW LEVEL SECURITY;
CREATE POLICY follow_tenant ON rh_hub.hub_follow USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT USAGE ON SCHEMA rh_hub TO aisci_app;
GRANT SELECT ON rh_hub.hub, rh_hub.scope_version, rh_hub.hub_follow TO aisci_app;
GRANT INSERT, UPDATE (followed, updated_at) ON rh_hub.hub_follow TO aisci_app;
