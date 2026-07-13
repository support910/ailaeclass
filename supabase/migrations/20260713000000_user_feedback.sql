CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  reporter_email text NOT NULL,
  reporter_name text NOT NULL DEFAULT '',
  organization_id uuid REFERENCES public.organization(id) ON DELETE SET NULL,
  issue_location text NOT NULL,
  description text NOT NULL,
  occurred_at timestamptz NOT NULL,
  page_url text NOT NULL,
  page_port text NOT NULL DEFAULT '',
  screenshot_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_status_created_at_idx
  ON public.user_feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS user_feedback_reporter_idx
  ON public.user_feedback (reporter_profile_id, created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_feedback FROM anon, authenticated;
GRANT ALL ON public.user_feedback TO service_role;

COMMENT ON TABLE public.user_feedback IS
  'User-submitted product feedback. Access is mediated by authenticated server APIs.';
