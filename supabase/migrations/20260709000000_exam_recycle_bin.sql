-- ============================================================
-- Migration: Exam recycle bin
-- Date: 2026-07-09
-- Description: Soft delete exam exercises and keep them for 3 days
-- ============================================================

ALTER TABLE "public"."exercise"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "deleted_by" uuid,
  ADD COLUMN IF NOT EXISTS "delete_after" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_exercise_exam_deleted_at"
  ON "public"."exercise" (assessment_type, deleted_at);

CREATE INDEX IF NOT EXISTS "idx_exercise_exam_delete_after"
  ON "public"."exercise" (assessment_type, delete_after);

