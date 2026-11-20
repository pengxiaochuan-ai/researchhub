-- DMS: select postgres. Roles stay NOLOGIN until the final password step.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' THEN RAISE EXCEPTION 'MANUAL_SELECT_POSTGRES_FIRST'; END IF;
 IF EXISTS(SELECT 1 FROM pg_database WHERE datname='researchhub') THEN RAISE EXCEPTION 'MANUAL_DATABASE_ALREADY_EXISTS_STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector')) THEN RAISE EXCEPTION 'MANUAL_ROLE_ALREADY_EXISTS_STOP'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR (rolcreatedb AND rolcreaterole))) THEN RAISE EXCEPTION 'MANUAL_USE_EXISTING_RDS_ADMIN'; END IF;
END $guard$;
-- PG16+: grants the creating operator SET on these new roles, not vice versa.
SET LOCAL createrole_self_grant='set';
CREATE ROLE researchhub_demo_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS CONNECTION LIMIT 4;
CREATE ROLE researchhub_demo_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 8;
CREATE ROLE researchhub_demo_analysis_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE researchhub_demo_pmc_collector NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
COMMENT ON ROLE researchhub_demo_owner IS 'ResearchHub independent demo database owner; not a member of aisci application roles';
COMMENT ON ROLE researchhub_demo_app IS 'ResearchHub independent demo application; RLS enforced';
COMMENT ON ROLE researchhub_demo_analysis_reader IS 'ResearchHub narrow analysis definer owner; NOLOGIN';
COMMENT ON ROLE researchhub_demo_pmc_collector IS 'ResearchHub collector policy identity; NOLOGIN; no collector started';
COMMIT;
