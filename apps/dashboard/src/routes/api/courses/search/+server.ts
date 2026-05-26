import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';

/**
 * GET /api/courses/search?code=XXX
 *
 * Search for a course by its join_code.
 * This endpoint is public (no auth required) so students can find courses.
 *
 * Uses JS filtering to bypass PostgREST schema cache issues
 * when the join_code column was recently added.
 */
export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code')?.trim().toUpperCase();

  if (!code) {
    return json({ success: false, message: 'Course code is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // Fetch all ACTIVE courses (selecting * so PostgREST doesn't need to know join_code)
    // In production with many courses this should be replaced by an RPC or cached index.
    const { data: rows, error } = await supabase
      .from('course')
      .select('*')
      .eq('status', 'ACTIVE')
      .limit(200);

    if (error) {
      console.error('GET /api/courses/search query error:', error);
      return json(
        { success: false, message: 'Course not found. Please check the code and try again.' },
        { status: 404 }
      );
    }

    const matched = (rows || []).find(
      (c: any) => c.join_code && String(c.join_code).toUpperCase() === code
    );

    if (!matched) {
      return json(
        { success: false, message: 'Course not found. Please check the code and try again.' },
        { status: 404 }
      );
    }

    const course = {
      id: matched.id,
      title: matched.title,
      description: matched.description,
      logo: matched.logo,
      group_id: matched.group_id,
      slug: matched.slug
    };

    return json({
      success: true,
      course
    });
  } catch (err) {
    console.error('GET /api/courses/search error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
