-- Approved local synthetic migration only; never execute during service startup.
ALTER TABLE public.account
  ADD COLUMN "researchProfile" jsonb,
  ADD COLUMN "researchProfileVersion" integer,
  ADD COLUMN "researchProfileEstablishedAt" timestamptz,
  ADD COLUMN "researchProfileLastMutation" jsonb,
  ADD CONSTRAINT rh_identity_profile_version CHECK ("researchProfileVersion" IS NULL OR "researchProfileVersion">=1),
  ADD CONSTRAINT rh_identity_profile_object CHECK ("researchProfile" IS NULL OR jsonb_typeof("researchProfile")='object'),
  ADD CONSTRAINT rh_identity_receipt_object CHECK ("researchProfileLastMutation" IS NULL OR jsonb_typeof("researchProfileLastMutation")='object'),
  ADD CONSTRAINT rh_identity_profile_consistent CHECK (
    ("researchProfile" IS NULL AND "researchProfileVersion" IS NULL AND "researchProfileEstablishedAt" IS NULL AND "researchProfileLastMutation" IS NULL)
    OR ("researchProfile" IS NOT NULL AND "researchProfileVersion" IS NOT NULL AND "researchProfileLastMutation" IS NOT NULL)
  );
