-- ============================================================
-- Migration: Fix organization RLS + organizationmember unique constraint
-- Date: 2026-05-26
-- ============================================================
-- Root cause analysis:
-- 1. "organization" table has RLS enabled but NO policies, so
--    anon-key queries (including nested joins from organizationmember)
--    return empty organization rows. This breaks getOrganizations()
--    which relies on nested "organization" data to populate currentOrg.
--    When currentOrg.id is empty, getProfile() thinks the user has
--    no membership and redirects to /signup on every login.
-- 2. "organizationmember" lacks a unique constraint on
--    (organization_id, profile_id), so signup upsert can insert
--    duplicates silently (PostgREST ignores on_conflict without a
--    matching unique constraint).
-- ============================================================

-- 1. Add RLS policy on organization so members can read their orgs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Allow org members to read organization'
    AND polrelid = '"public"."organization"'::regclass
  ) THEN
    CREATE POLICY "Allow org members to read organization"
    ON "public"."organization"
    AS permissive
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM organizationmember
        WHERE organizationmember.organization_id = organization.id
        AND organizationmember.profile_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 2. Remove duplicate organizationmember records (keep the newest by id)
DELETE FROM "public"."organizationmember" a
USING "public"."organizationmember" b
WHERE a.id < b.id
AND a.organization_id = b.organization_id
AND a.profile_id = b.profile_id;

-- 3. Add unique constraint to support upsert in signup flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_org_member'
    AND conrelid = '"public"."organizationmember"'::regclass
  ) THEN
    ALTER TABLE "public"."organizationmember"
    ADD CONSTRAINT "unique_org_member"
    UNIQUE ("organization_id", "profile_id");
  END IF;
END $$;
