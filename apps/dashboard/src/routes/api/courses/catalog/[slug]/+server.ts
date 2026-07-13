import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getPublicCourseBySlug } from '$lib/utils/functions/courseCatalog.server';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const course = await getPublicCourseBySlug(getServerSupabase(), params.slug);
    if (!course) return json({ success: false, message: 'Course not found' }, { status: 404 });
    return json({ success: true, course });
  } catch (error) {
    return json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to load course' },
      { status: 500 }
    );
  }
};
