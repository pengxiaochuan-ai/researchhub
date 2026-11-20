-- DMS: switch database to researchhub, using the SAME creating operator.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_database()<>'researchhub' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE'; END IF;
 IF (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'researchhub_demo_owner' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE_OWNER'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p')) THEN RAISE EXCEPTION 'MANUAL_TARGET_NOT_EMPTY'; END IF;
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') THEN RAISE EXCEPTION 'MANUAL_VECTOR_ALREADY_EXISTS_STOP'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app','researchhub_demo_analysis_reader','researchhub_demo_pmc_collector') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND (rolbypassrls=(rolname='researchhub_demo_owner')))<>4 THEN RAISE EXCEPTION 'MANUAL_ROLE_ATTRIBUTES_INVALID'; END IF;
END $guard$;
SET LOCAL ROLE researchhub_demo_owner;
REVOKE ALL ON DATABASE researchhub FROM PUBLIC;
GRANT CONNECT,TEMPORARY ON DATABASE researchhub TO researchhub_demo_owner,researchhub_demo_app;
GRANT CONNECT ON DATABASE researchhub TO SESSION_USER;
ALTER SCHEMA public OWNER TO researchhub_demo_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
-- Only this new DB: the operator needs CREATE to install the provider extension.
GRANT USAGE,CREATE ON SCHEMA public TO SESSION_USER;
RESET ROLE;
CREATE EXTENSION vector WITH SCHEMA public VERSION '0.8.1.2';
SET LOCAL ROLE researchhub_demo_owner;
REVOKE CREATE ON SCHEMA public FROM SESSION_USER;
DO $vector$ BEGIN
 IF public.vector_dims('[1,0,0]'::public.vector)<>3 THEN RAISE EXCEPTION 'MANUAL_VECTOR_CHECK_FAILED'; END IF;
END $vector$;
COMMENT ON DATABASE researchhub IS '{"purpose":"researchhub-manual-demo","syntheticOnly":true,"sourceSchemaSha256":"__SOURCE_SCHEMA_SHA256__","state":"initialized"}';
RESET ROLE;
COMMIT;
