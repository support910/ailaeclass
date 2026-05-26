import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

/**
 * GET /api/org/{id}/exams
 *
 * Returns all exam exercises for an organization.
 * Requires authentication (user_id header).
 * Uses service-role client to bypass RLS.
 */
export const GET: RequestHandler = async ({ request, params }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const orgId = params.id;
  if (!orgId) {
    return json({ success: false, message: 'Organization ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // Verify user belongs to this org and is verified
    const { data: orgMembership } = await supabase
      .from('organizationmember')
      .select('role_id')
      .eq('organization_id', orgId)
      .eq('profile_id', userId)
      .eq('verified', true)
      .single();

    if (!orgMembership) {
      return json({ success: false, message: 'You do not belong to this organization or your membership is pending approval' }, { status: 403 });
    }

    // 1. Get group IDs for this org
    const { data: groups, error: groupError } = await supabase
      .from('group')
      .select('id')
      .eq('organization_id', orgId);

    if (groupError) {
      console.error('fetchOrgExams group error:', groupError);
      return json({ success: false, message: groupError.message }, { status: 500 });
    }

    if (!groups || groups.length === 0) {
      return json({ success: true, exams: [] });
    }

    const groupIds = groups.map((g) => g.id);

    // 2. Get course IDs for these groups
    const { data: courses, error: courseError } = await supabase
      .from('course')
      .select('id')
      .in('group_id', groupIds);

    if (courseError) {
      console.error('fetchOrgExams course error:', courseError);
      return json({ success: false, message: courseError.message }, { status: 500 });
    }

    if (!courses || courses.length === 0) {
      return json({ success: true, exams: [] });
    }

    const courseIds = courses.map((c) => c.id);

    // 3. Get lesson IDs for these courses
    const { data: lessons, error: lessonError } = await supabase
      .from('lesson')
      .select('id')
      .in('course_id', courseIds);

    if (lessonError) {
      console.error('fetchOrgExams lesson error:', lessonError);
      return json({ success: false, message: lessonError.message }, { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      return json({ success: true, exams: [] });
    }

    const lessonIds = lessons.map((l) => l.id);

    // 3. Get exam exercises
    const { data, error } = await supabase
      .from('exercise')
      .select('*, lesson:lesson_id(id, title, course_id, course:course_id(id, title))')
      .in('lesson_id', lessonIds)
      .eq('assessment_type', 'exam')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchOrgExams exercise error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    return json({ success: true, exams: data || [] });
  } catch (err) {
    console.error('GET /api/org/{id}/exams error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
