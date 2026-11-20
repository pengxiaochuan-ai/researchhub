-- Run ONLY AFTER data import, post-data and verification.
-- Database credentials, not the website admin/owner passwords.
-- Replace both placeholders LOCALLY; never send passwords in chat.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL password_encryption='scram-sha-256';
DO $database$ BEGIN IF current_database()<>'researchhub' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE'; END IF; END $database$;
-- SOURCE_AND_STAGE_GUARD
DO $unbuilt$ BEGIN RAISE EXCEPTION 'MANUAL_GENERATE_PRIVATE_PACKAGE_FIRST'; END $unbuilt$;
DO $passwords$
DECLARE
 owner_password text := '__REPLACE_OWNER_PASSWORD_WITH_32_OR_MORE_CHARACTERS__';
 app_password text := '__REPLACE_APP_PASSWORD_WITH_32_OR_MORE_CHARACTERS__';
 marker jsonb;
BEGIN
 IF current_database()<>'researchhub' THEN RAISE EXCEPTION 'MANUAL_WRONG_DATABASE'; END IF;
 SELECT shobj_description(oid,'pg_database')::jsonb INTO marker FROM pg_database WHERE datname=current_database();
 IF marker->>'purpose' IS DISTINCT FROM 'researchhub-manual-demo' OR marker->>'state' IS DISTINCT FROM 'post-data-complete' THEN RAISE EXCEPTION 'MANUAL_RESTORE_NOT_COMPLETE'; END IF;
 IF owner_password LIKE '__REPLACE_%' OR app_password LIKE '__REPLACE_%' OR length(owner_password)<32 OR length(app_password)<32 OR owner_password=app_password THEN RAISE EXCEPTION 'MANUAL_FILL_TWO_DIFFERENT_PASSWORDS'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('researchhub_demo_owner','researchhub_demo_app') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND (rolbypassrls=(rolname='researchhub_demo_owner')))<>2 THEN RAISE EXCEPTION 'MANUAL_ROLE_STATE_INVALID_STOP'; END IF;
 EXECUTE format('ALTER ROLE researchhub_demo_owner LOGIN PASSWORD %L',owner_password);
 EXECUTE format('ALTER ROLE researchhub_demo_app LOGIN PASSWORD %L',app_password);
END $passwords$;
COMMIT;
