-- REVIEW CANDIDATE ONLY: not a Prisma migration; DO NOT APPLY.
-- Independently verify RLS, ACL and integration with the canonical schema first.
ALTER TABLE public.form_response
 ADD COLUMN "currentRevisionId" text,
 ADD COLUMN "version" integer NOT NULL DEFAULT 0 CHECK ("version" >= 0),
 ADD COLUMN "lockedRevisionId" text,
 ADD CONSTRAINT form_response_lock_matches_current CHECK ("lockedRevisionId" IS NULL OR ("currentRevisionId" IS NOT NULL AND "lockedRevisionId"="currentRevisionId"));

CREATE TABLE public.form_response_revision (
 id text PRIMARY KEY,
 "tenantId" text NOT NULL REFERENCES public.tenant(id) ON DELETE RESTRICT,
 "studyGroupId" text NOT NULL REFERENCES public.study_group(id) ON DELETE RESTRICT,
 "researchProjectId" text NOT NULL REFERENCES public.research_project(id) ON DELETE RESTRICT,
 "responseId" text NOT NULL REFERENCES public.form_response(id) ON DELETE RESTRICT,
 "assignmentId" text NOT NULL REFERENCES public.form_assignment(id) ON DELETE RESTRICT,
 "formVersionId" text NOT NULL REFERENCES public.form_version(id) ON DELETE RESTRICT,
 "subjectId" text NOT NULL REFERENCES public.subject(id) ON DELETE RESTRICT,
 "enrollmentId" text NOT NULL REFERENCES public.study_enrollment(id) ON DELETE RESTRICT,
 "subjectVisitId" text REFERENCES public.subject_visit(id) ON DELETE RESTRICT,
 "protocolVersionId" text NOT NULL REFERENCES public.study_protocol_version(id) ON DELETE RESTRICT,
 "policyVersionId" text NOT NULL REFERENCES public.study_execution_policy_version(id) ON DELETE RESTRICT,
 "policyHash" text NOT NULL CHECK ("policyHash" ~ '^[a-f0-9]{64}$'),
 "revisionNo" integer NOT NULL CHECK ("revisionNo">0),
 "previousRevisionId" text,
 answers jsonb NOT NULL, score jsonb, "scoreAlgorithm" text,
 source text NOT NULL CHECK (source IN ('researcher','patient_h5','import','legacy_baseline')),
 "actorKind" text NOT NULL CHECK ("actorKind" IN ('account','h5_session')),
 "actorId" text NOT NULL CHECK (length(btrim("actorId"))>0),
 reason text, changes jsonb NOT NULL,
 "hashVersion" text NOT NULL CHECK ("hashVersion"='formal-response-v1'),
 "contentHash" text NOT NULL CHECK ("contentHash" ~ '^[a-f0-9]{64}$'),
 "sourceSubmittedAt" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("responseId", "revisionNo"), UNIQUE ("responseId", id),
 FOREIGN KEY ("responseId", "previousRevisionId") REFERENCES public.form_response_revision("responseId", id) ON DELETE RESTRICT,
 CHECK (("revisionNo"=1 AND "previousRevisionId" IS NULL) OR
        ("revisionNo">1 AND "previousRevisionId" IS NOT NULL AND length(btrim(coalesce(reason,'')))>0)),
 CHECK ((score IS NULL AND "scoreAlgorithm" IS NULL) OR (score IS NOT NULL AND length(btrim(coalesce("scoreAlgorithm",'')))>0))
);
ALTER TABLE public.form_response
 ADD CONSTRAINT form_response_current_revision_fk FOREIGN KEY (id,"currentRevisionId") REFERENCES public.form_response_revision("responseId",id) ON DELETE RESTRICT,
 ADD CONSTRAINT form_response_locked_revision_fk FOREIGN KEY (id,"lockedRevisionId") REFERENCES public.form_response_revision("responseId",id) ON DELETE RESTRICT;

CREATE TABLE public.form_response_review_event (
 id text PRIMARY KEY,
 "tenantId" text NOT NULL REFERENCES public.tenant(id) ON DELETE RESTRICT,
 "studyGroupId" text NOT NULL REFERENCES public.study_group(id) ON DELETE RESTRICT,
 "researchProjectId" text NOT NULL REFERENCES public.research_project(id) ON DELETE RESTRICT,
 "responseId" text NOT NULL, "revisionId" text NOT NULL,
 "policyVersionId" text NOT NULL REFERENCES public.study_execution_policy_version(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK (action IN ('review_approved','review_returned','lock','unlock')),
 "actorId" text NOT NULL CHECK (length(btrim("actorId"))>0), reason text,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("responseId","revisionId") REFERENCES public.form_response_revision("responseId",id) ON DELETE RESTRICT,
 CHECK (action NOT IN ('review_returned','unlock') OR length(btrim(coalesce(reason,'')))>0)
);
CREATE TABLE public.form_response_command_receipt (
 id text PRIMARY KEY,
 "tenantId" text NOT NULL REFERENCES public.tenant(id) ON DELETE RESTRICT,
 "studyGroupId" text NOT NULL REFERENCES public.study_group(id) ON DELETE RESTRICT,
 "researchProjectId" text NOT NULL REFERENCES public.research_project(id) ON DELETE RESTRICT,
 "assignmentId" text NOT NULL REFERENCES public.form_assignment(id) ON DELETE RESTRICT,
 "actorKind" text NOT NULL CHECK ("actorKind" IN ('account','h5_session')),
 "actorId" text NOT NULL CHECK (length(btrim("actorId"))>0),
 "requestKey" text NOT NULL CHECK ("requestKey" ~ '^[A-Za-z0-9_-]{8,160}$'),
 "requestHash" text NOT NULL CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK (action IN ('draft','submit','correct','review','lock','unlock')),
 result jsonb NOT NULL,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("tenantId","actorKind","actorId","requestKey")
);
CREATE FUNCTION public.check_form_response_receipt_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.form_assignment a WHERE a.id=NEW."assignmentId" AND a."tenantId"=NEW."tenantId" AND a."studyGroupId"=NEW."studyGroupId" AND a."researchProjectId"=NEW."researchProjectId") OR
 (NEW."actorKind"='account' AND NOT EXISTS (SELECT 1 FROM public.account a WHERE a.id=NEW."actorId" AND a."tenantId"=NEW."tenantId")) OR
 (NEW."actorKind"='h5_session' AND NOT EXISTS (SELECT 1 FROM public.questionnaire_session s WHERE s.id=NEW."actorId" AND s."tenantId"=NEW."tenantId" AND s."studyGroupId"=NEW."studyGroupId" AND s."researchProjectId"=NEW."researchProjectId" AND s."assignmentId"=NEW."assignmentId"))
 THEN RAISE EXCEPTION 'formal response receipt parent mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER form_response_receipt_chain BEFORE INSERT ON public.form_response_command_receipt FOR EACH ROW EXECUTE FUNCTION public.check_form_response_receipt_chain();
CREATE INDEX form_response_revision_scope_idx ON public.form_response_revision ("tenantId","studyGroupId","researchProjectId","responseId","revisionNo");
CREATE INDEX form_response_review_scope_idx ON public.form_response_review_event ("tenantId","studyGroupId","researchProjectId","responseId","revisionId","createdAt");

-- Parent-chain validation runs in addition to service authorization and CAS.
CREATE FUNCTION public.check_form_response_revision_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous text; previous_no integer;
BEGIN
 SELECT r."currentRevisionId" INTO previous FROM public.form_response r
 JOIN public.form_assignment a ON a.id=r."assignmentId"
 JOIN public.subject s ON s.id=a."subjectId"
 JOIN public.study_enrollment e ON e.id=a."enrollmentId"
 LEFT JOIN public.subject_visit v ON v.id=a."subjectVisitId"
 JOIN public.study_protocol_version p ON p.id=e."protocolVersionId"
 JOIN public.study_execution_policy_version ep ON ep.id=p."approvedPolicyVersionId"
 JOIN public.form_version f ON f.id=a."formVersionId"
 WHERE r.id=NEW."responseId" AND a.id=NEW."assignmentId"
 AND r."tenantId"=NEW."tenantId" AND r."studyGroupId"=NEW."studyGroupId" AND r."researchProjectId"=NEW."researchProjectId"
 AND a."tenantId"=NEW."tenantId" AND a."studyGroupId"=NEW."studyGroupId" AND a."researchProjectId"=NEW."researchProjectId"
 AND a."acceptanceFixture"=false AND a."formVersionId"=NEW."formVersionId" AND a."subjectId"=NEW."subjectId" AND a."enrollmentId"=NEW."enrollmentId" AND a."subjectVisitId" IS NOT DISTINCT FROM NEW."subjectVisitId"
 AND s."tenantId"=NEW."tenantId" AND s."studyGroupId"=NEW."studyGroupId" AND s."researchProjectId"=NEW."researchProjectId" AND s."acceptanceFixture"=false
 AND e."tenantId"=NEW."tenantId" AND e."studyGroupId"=NEW."studyGroupId" AND e."researchProjectId"=NEW."researchProjectId" AND e."subjectId"=s.id AND e."acceptanceFixture"=false
 AND p.id=NEW."protocolVersionId" AND p."tenantId"=NEW."tenantId" AND p."studyGroupId"=NEW."studyGroupId" AND p."researchProjectId"=NEW."researchProjectId"
 AND ep.id=NEW."policyVersionId" AND ep."contentHash"=NEW."policyHash" AND p."approvedPolicyHash"=NEW."policyHash" AND ep.status='approved'
 AND (NEW."subjectVisitId" IS NULL OR (v."tenantId"=NEW."tenantId" AND v."studyGroupId"=NEW."studyGroupId" AND v."researchProjectId"=NEW."researchProjectId" AND v."subjectId"=s.id AND v."enrollmentId"=e.id AND v."acceptanceFixture"=false AND v."protocolVersionId"=e."protocolVersionId"))
 AND f."tenantId"=NEW."tenantId" AND f."studyGroupId"=NEW."studyGroupId" AND f."researchProjectId"=NEW."researchProjectId" AND f.status IN ('published','locked')
 FOR UPDATE OF r;
 IF NOT FOUND OR previous IS DISTINCT FROM NEW."previousRevisionId" THEN RAISE EXCEPTION 'formal response parent or current revision mismatch'; END IF;
 IF previous IS NOT NULL THEN
  SELECT "revisionNo" INTO previous_no FROM public.form_response_revision WHERE id=previous AND "responseId"=NEW."responseId";
  IF previous_no IS NULL OR NEW."revisionNo"<>previous_no+1 THEN RAISE EXCEPTION 'formal response revision sequence mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER form_response_revision_chain BEFORE INSERT ON public.form_response_revision FOR EACH ROW EXECUTE FUNCTION public.check_form_response_revision_chain();
CREATE FUNCTION public.check_form_response_review_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.form_response_revision rev JOIN public.study_execution_policy_version pol ON pol.id=NEW."policyVersionId"
 JOIN public.study_enrollment e ON e.id=rev."enrollmentId"
 WHERE rev.id=NEW."revisionId" AND rev."responseId"=NEW."responseId" AND rev."tenantId"=NEW."tenantId" AND rev."studyGroupId"=NEW."studyGroupId" AND rev."researchProjectId"=NEW."researchProjectId"
 AND pol.id=rev."policyVersionId" AND pol."contentHash"=rev."policyHash" AND pol."tenantId"=NEW."tenantId" AND pol."studyGroupId"=NEW."studyGroupId" AND pol."researchProjectId"=NEW."researchProjectId" AND pol."protocolVersionId"=rev."protocolVersionId" AND pol.status='approved')
 THEN RAISE EXCEPTION 'formal response review scope or policy mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER form_response_review_chain BEFORE INSERT ON public.form_response_review_event FOR EACH ROW EXECUTE FUNCTION public.check_form_response_review_chain();

CREATE FUNCTION public.form_response_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'formal response history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER form_response_revision_immutable BEFORE UPDATE OR DELETE ON public.form_response_revision FOR EACH ROW EXECUTE FUNCTION public.form_response_history_guard();
CREATE TRIGGER form_response_review_immutable BEFORE UPDATE OR DELETE ON public.form_response_review_event FOR EACH ROW EXECUTE FUNCTION public.form_response_history_guard();
CREATE TRIGGER form_response_receipt_immutable BEFORE UPDATE OR DELETE ON public.form_response_command_receipt FOR EACH ROW EXECUTE FUNCTION public.form_response_history_guard();
ALTER TABLE public.form_response_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_revision FORCE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_review_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_review_event FORCE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_command_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_command_receipt FORCE ROW LEVEL SECURITY;
CREATE POLICY form_revision_scope ON public.form_response_revision FOR ALL USING ("tenantId"=current_setting('app.tenant_id',true) AND "studyGroupId"=current_setting('app.study_group_id',true) AND "researchProjectId"=current_setting('app.research_project_id',true)) WITH CHECK ("tenantId"=current_setting('app.tenant_id',true) AND "studyGroupId"=current_setting('app.study_group_id',true) AND "researchProjectId"=current_setting('app.research_project_id',true));
CREATE POLICY form_review_scope ON public.form_response_review_event FOR ALL USING ("tenantId"=current_setting('app.tenant_id',true) AND "studyGroupId"=current_setting('app.study_group_id',true) AND "researchProjectId"=current_setting('app.research_project_id',true)) WITH CHECK ("tenantId"=current_setting('app.tenant_id',true) AND "studyGroupId"=current_setting('app.study_group_id',true) AND "researchProjectId"=current_setting('app.research_project_id',true));
CREATE POLICY form_receipt_scope ON public.form_response_command_receipt FOR ALL USING ("tenantId"=current_setting('app.tenant_id',true) AND "studyGroupId"=current_setting('app.study_group_id',true) AND "researchProjectId"=current_setting('app.research_project_id',true)) WITH CHECK ("tenantId"=current_setting('app.tenant_id',true) AND "studyGroupId"=current_setting('app.study_group_id',true) AND "researchProjectId"=current_setting('app.research_project_id',true));
REVOKE ALL ON public.form_response_revision, public.form_response_review_event, public.form_response_command_receipt FROM PUBLIC, aisci_app;
GRANT SELECT, INSERT ON public.form_response_revision, public.form_response_review_event, public.form_response_command_receipt TO aisci_app;
-- Actor/session, policy hash, content-hash, lock ownership and explicit CAS remain service responsibilities.
