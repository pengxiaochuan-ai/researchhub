-- Candidate only; independent review + protected target runner required.
-- Execute inside one outer transaction. No startup/migrate-deploy execution.
LOCK TABLE public.research_method_run IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_constraintdef(c.oid) INTO definition FROM pg_constraint c
 WHERE c.conrelid='public.research_method_run'::regclass AND c.conname='research_method_run_skill_key_check' AND c.convalidated;
 IF definition IS DISTINCT FROM $expected$CHECK (("skillKey" = ANY (ARRAY['study-operations-monitor'::text, 'statistical-power'::text, 'research-data-quality'::text, 'tcm-terminology-governance'::text, 'outcome-scale-governance'::text, 'tcm-protocol-check'::text, 'diagnostic-evidence-assembly'::text])))$expected$
 THEN RAISE EXCEPTION 'T16_PRIOR_SKILL_CHECK_CHANGED' USING ERRCODE='23514'; END IF;
END $$;
ALTER TABLE public.research_method_run DROP CONSTRAINT research_method_run_skill_key_check;
ALTER TABLE public.research_method_run ADD CONSTRAINT research_method_run_skill_key_check CHECK ("skillKey" IN (
 'study-operations-monitor','statistical-power','research-data-quality','tcm-terminology-governance',
 'outcome-scale-governance','tcm-protocol-check','diagnostic-evidence-assembly','descriptive-statistics'
));
