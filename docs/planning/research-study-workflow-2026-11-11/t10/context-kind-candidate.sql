-- Candidate only. Apply only with fixture guard and within a single transaction.
ALTER TABLE rh_study_tasks.context DROP CONSTRAINT context_kind_check;
ALTER TABLE rh_study_tasks.context ADD CONSTRAINT context_kind_check CHECK (kind IN ('none','formal_visit','synthetic_crf_record','formal_response_ref'));
