-- ============================================================
-- Migration: Add metadata column to option table
-- Date: 2026-06-04
-- Description: Adds metadata jsonb column to option table
--              to support option-level images and other metadata.
-- ============================================================

ALTER TABLE "public"."option"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Rollback:
-- ALTER TABLE "public"."option" DROP COLUMN IF EXISTS "metadata";
