-- ============================================================
-- Migration: Course join code & join request system
-- Date: 2026-05-26
-- ============================================================

-- 1. Add join_code to course table
ALTER TABLE "public"."course"
  ADD COLUMN IF NOT EXISTS "join_code" character varying;

-- Add unique constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_join_code_key'
    AND conrelid = '"public"."course"'::regclass
  ) THEN
    ALTER TABLE "public"."course"
      ADD CONSTRAINT "course_join_code_key" UNIQUE ("join_code");
  END IF;
END $$;

-- Auto-generate join_code for existing courses that don't have one
UPDATE "public"."course"
SET join_code = upper(substring(md5(random()::text) from 1 for 6))
WHERE join_code IS NULL;

-- 2. Create course_join_request table
CREATE TABLE IF NOT EXISTS "public"."course_join_request" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "course_id" uuid NOT NULL,
    "profile_id" uuid NOT NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "unique_course_profile_request" UNIQUE ("course_id", "profile_id")
);

-- Add check constraint for status values
DO $$
BEGIN
  ALTER TABLE "public"."course_join_request"
    ADD CONSTRAINT "chk_course_join_request_status"
    CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint already exists, skipping.';
END $$;

-- Add foreign keys
DO $$
BEGIN
  ALTER TABLE "public"."course_join_request"
    ADD CONSTRAINT "course_join_request_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'FK course_id already exists, skipping.';
END $$;

DO $$
BEGIN
  ALTER TABLE "public"."course_join_request"
    ADD CONSTRAINT "course_join_request_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'FK profile_id already exists, skipping.';
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "idx_course_join_request_course_status"
  ON "public"."course_join_request" ("course_id", "status");

CREATE INDEX IF NOT EXISTS "idx_course_join_request_profile_id"
  ON "public"."course_join_request" ("profile_id");

-- Add updated_at trigger
DO $$
BEGIN
  CREATE TRIGGER "handle_updated_at_course_join_request"
    BEFORE UPDATE ON "public"."course_join_request"
    FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Trigger already exists, skipping.';
END $$;

-- 3. Create helper function to generate unique join_code on course insert
CREATE OR REPLACE FUNCTION "public"."generate_course_join_code"()
RETURNS TRIGGER AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    LOOP
      new_code := upper(substring(md5(random()::text) from 1 for 6));
      SELECT EXISTS (
        SELECT 1 FROM "public"."course" WHERE join_code = new_code
      ) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.join_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to course table
DO $$
BEGIN
  CREATE TRIGGER "trg_generate_course_join_code"
    BEFORE INSERT ON "public"."course"
    FOR EACH ROW EXECUTE FUNCTION "public"."generate_course_join_code"();
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Trigger already exists, skipping.';
END $$;
