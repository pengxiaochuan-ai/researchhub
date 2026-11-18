-- Review candidate only; do not apply directly. Existing rows remain unchanged.
ALTER TABLE public.participant_contact DROP CONSTRAINT participant_contact_channel_check;
ALTER TABLE public.participant_contact ADD CONSTRAINT participant_contact_channel_check
  CHECK ("channel" IN ('sms_sandbox', 'wecom_sandbox', 'email'));
