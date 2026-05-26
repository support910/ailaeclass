-- ============================================================
-- Migration: Exam System Foundation
-- Date: 2026-05-21
-- Description: Adds exam-specific columns to exercise, question,
--              submission, and question_answer tables.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add columns to public.exercise
-- ------------------------------------------------------------
ALTER TABLE "public"."exercise"
  ADD COLUMN IF NOT EXISTS "assessment_type" text NOT NULL DEFAULT 'exercise',
  ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "available_from" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "available_until" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "duration_minutes" integer,
  ADD COLUMN IF NOT EXISTS "attempts_allowed" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "passing_score" double precision,
  ADD COLUMN IF NOT EXISTS "show_result_policy" text NOT NULL DEFAULT 'after_grade',
  ADD COLUMN IF NOT EXISTS "shuffle_questions" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shuffle_options" boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. Add columns to public.question
-- ------------------------------------------------------------
ALTER TABLE "public"."question"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "explanation" text,
  ADD COLUMN IF NOT EXISTS "difficulty" text,
  ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}'::text[];

-- ------------------------------------------------------------
-- 3. Add columns to public.submission
-- ------------------------------------------------------------
ALTER TABLE "public"."submission"
  ADD COLUMN IF NOT EXISTS "attempt_no" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------
-- 4. Add columns to public.question_answer
-- ------------------------------------------------------------
ALTER TABLE "public"."question_answer"
  ADD COLUMN IF NOT EXISTS "is_correct" boolean,
  ADD COLUMN IF NOT EXISTS "auto_score" double precision,
  ADD COLUMN IF NOT EXISTS "feedback" text,
  ADD COLUMN IF NOT EXISTS "answered_at" timestamp with time zone;

-- ------------------------------------------------------------
-- 5. Add check constraints (idempotent via DO blocks)
-- ------------------------------------------------------------

DO $$
BEGIN
  ALTER TABLE "public"."exercise"
    ADD CONSTRAINT "chk_exercise_assessment_type"
    CHECK (assessment_type IN ('exercise', 'exam'));
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint chk_exercise_assessment_type already exists, skipping.';
END $$;

DO $$
BEGIN
  ALTER TABLE "public"."exercise"
    ADD CONSTRAINT "chk_exercise_show_result_policy"
    CHECK (show_result_policy IN ('immediately', 'after_due_date', 'after_grade', 'manual'));
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint chk_exercise_show_result_policy already exists, skipping.';
END $$;

DO $$
BEGIN
  ALTER TABLE "public"."exercise"
    ADD CONSTRAINT "chk_exercise_attempts_allowed"
    CHECK (attempts_allowed >= 1);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint chk_exercise_attempts_allowed already exists, skipping.';
END $$;

DO $$
BEGIN
  ALTER TABLE "public"."exercise"
    ADD CONSTRAINT "chk_exercise_duration_minutes"
    CHECK (duration_minutes IS NULL OR duration_minutes > 0);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint chk_exercise_duration_minutes already exists, skipping.';
END $$;

-- ------------------------------------------------------------
-- 6. Add indexes (idempotent with IF NOT EXISTS)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_exercise_assessment_type"
  ON "public"."exercise" (assessment_type);

CREATE INDEX IF NOT EXISTS "idx_exercise_lesson_id_assessment_type"
  ON "public"."exercise" (lesson_id, assessment_type);

CREATE INDEX IF NOT EXISTS "idx_exercise_available_from_until"
  ON "public"."exercise" (available_from, available_until);

CREATE INDEX IF NOT EXISTS "idx_submission_exercise_submitted_by_attempt"
  ON "public"."submission" (exercise_id, submitted_by, attempt_no);

CREATE INDEX IF NOT EXISTS "idx_submission_started_submitted"
  ON "public"."submission" (started_at, submitted_at);
