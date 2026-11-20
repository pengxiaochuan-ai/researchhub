-- DMS: select postgres. Read-only; run before creating anything.
BEGIN READ ONLY;
DO $guard$ BEGIN
 IF current_database()<>'postgres' THEN RAISE EXCEPTION 'MANUAL_SELECT_POSTGRES_FIRST'; END IF;
 IF EXISTS(SELECT 1 FROM pg_database WHERE datname='researchhub') THEN RAISE EXCEPTION 'MANUAL_DATABASE_ALREADY_EXISTS_STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector')) THEN RAISE EXCEPTION 'MANUAL_ROLE_ALREADY_EXISTS_STOP'; END IF;
END $guard$;
SELECT current_database() AS database,current_user AS operator,version();
SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user;
COMMIT;
