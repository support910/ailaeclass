-- Disable email verification requirement
-- Date: 2026-05-18
-- All existing users are marked as email-verified so they can log in without verification.

-- Temporarily disable the verification protection trigger so we can update profiles
ALTER TABLE "public"."profile" DISABLE TRIGGER profile_email_verification_protection;

-- Mark all existing unverified users as verified
UPDATE "public"."profile"
SET
  is_email_verified = true,
  verified_at = COALESCE(verified_at, NOW())
WHERE is_email_verified = false OR is_email_verified IS NULL;

-- Re-enable the protection trigger (it won't block updates from now on because all users are verified)
ALTER TABLE "public"."profile" ENABLE TRIGGER profile_email_verification_protection;
