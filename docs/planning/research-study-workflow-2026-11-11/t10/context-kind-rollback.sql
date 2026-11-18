-- Candidate only; never erase existing references to make rollback succeed.
BEGIN;
SET LOCAL row_security = off;
LOCK TABLE rh_study_tasks.context IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM rh_study_tasks.context WHERE kind='formal_response_ref') THEN
  RAISE EXCEPTION 'FORMAL_RESPONSE_CONTEXT_EXISTS';
 END IF;
END $$;
ALTER TABLE rh_study_tasks.context DROP CONSTRAINT context_kind_check;
ALTER TABLE rh_study_tasks.context ADD CONSTRAINT context_kind_check CHECK (kind IN ('none','formal_visit','synthetic_crf_record'));
COMMIT;
