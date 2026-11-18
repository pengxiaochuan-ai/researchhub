-- One additive, private draft column; existing fact/decision constraints stay unchanged.
ALTER TABLE rh_directory.entity ADD COLUMN team_draft jsonb
-- statement
ALTER TABLE rh_directory.entity ADD CONSTRAINT directory_team_draft_check CHECK (
 team_draft IS NULL OR (kind='team' AND jsonb_typeof(team_draft)='object' AND octet_length(team_draft::text)<=262144)
)
-- statement
GRANT UPDATE(team_draft) ON rh_directory.entity TO aisci_app
