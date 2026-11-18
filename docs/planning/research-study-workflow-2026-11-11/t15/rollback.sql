-- Destructive rollback is allowed only for this exact empty schema.
BEGIN;
SET LOCAL row_security=off;
LOCK TABLE rh_analysis.plan,rh_analysis.plan_review,rh_analysis.snapshot IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM rh_analysis.plan) OR EXISTS(SELECT 1 FROM rh_analysis.plan_review) OR EXISTS(SELECT 1 FROM rh_analysis.snapshot) THEN
  RAISE EXCEPTION 'ANALYSIS_ROLLBACK_NONEMPTY';
 END IF;
END $$;
DROP TABLE rh_analysis.snapshot;
DROP TABLE rh_analysis.plan_review;
DROP TABLE rh_analysis.plan;
DROP FUNCTION rh_analysis.parents();
DROP FUNCTION rh_analysis.immutable();
DROP SCHEMA rh_analysis;
COMMIT;
