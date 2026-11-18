-- Review only. Refuse rollback if any email contact exists, including RLS-hidden rows.
BEGIN;
SET LOCAL row_security = off;
LOCK TABLE public.participant_contact IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.participant_contact WHERE "channel" = 'email') THEN
    RAISE EXCEPTION 'EMAIL_CONTACTS_EXIST: rollback would invalidate retained records';
  END IF;
END $$;
ALTER TABLE public.participant_contact DROP CONSTRAINT participant_contact_channel_check;
ALTER TABLE public.participant_contact ADD CONSTRAINT participant_contact_channel_check
  CHECK ("channel" IN ('sms_sandbox', 'wecom_sandbox'));
COMMIT;
