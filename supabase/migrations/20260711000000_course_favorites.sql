CREATE TABLE IF NOT EXISTS public.course_favorite (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_favorite_course_profile_key UNIQUE (course_id, profile_id)
);

ALTER TABLE public.course_favorite ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their course favorites" ON public.course_favorite;
CREATE POLICY "Users can view their course favorites"
  ON public.course_favorite FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can add their course favorites" ON public.course_favorite;
CREATE POLICY "Users can add their course favorites"
  ON public.course_favorite FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their course favorites" ON public.course_favorite;
CREATE POLICY "Users can remove their course favorites"
  ON public.course_favorite FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.course_favorite TO authenticated;
GRANT ALL ON public.course_favorite TO service_role;
