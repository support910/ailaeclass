import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * GET /api/courses/[courseId]/exams
 *
 * Returns all exams (assessment_type='exam') for a course.
 * - Students: only see published exams within availability window.
 * - Teachers/Admins: see all exams for the course.
 */
export const GET: RequestHandler = async ({ params, request }) => {
  const courseId = params.id;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Resolve course -> group
    const { data: courseRow, error: courseError } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (courseError || !courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    // 2. Verify user has access to this course
    const { hasAccess, userMembership, isOrgAdmin } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const isStudent = userMembership?.role_id === ROLE.STUDENT && !isOrgAdmin;

    // 3. Fetch all lessons for this course to get their IDs
    const { data: lessons, error: lessonError } = await supabase
      .from('lesson')
      .select('id')
      .eq('course_id', courseId);

    if (lessonError) {
      console.error('fetchLessons error:', lessonError);
      return json({ success: false, message: 'Failed to load lessons' }, { status: 500 });
    }

    const lessonIds = (lessons || []).map((l) => l.id);
    if (lessonIds.length === 0) {
      return json({ success: true, exams: [] });
    }

    // 4. Fetch all exercises linked to these lessons with assessment_type='exam'
    const { data: exams, error: examError } = await supabase
      .from('exercise')
      .select(
        `
        id, title, description, lesson_id, assessment_type, published_at, available_from, available_until, duration_minutes, attempts_allowed, passing_score, show_result_policy, shuffle_questions, shuffle_options,
        questions:question(count)
      `
      )
      .in('lesson_id', lessonIds)
      .eq('assessment_type', 'exam')
      .order('created_at', { ascending: false });

    if (examError) {
      console.error('fetchCourseExams error:', examError);
      return json({ success: false, message: 'Failed to load exams' }, { status: 500 });
    }

    const now = Date.now();

    // 5. Filter based on role
    const filtered = (exams || []).filter((exam: any) => {
      if (!isStudent) return true; // teachers/admins see all

      // Students: must be published and within availability window
      if (!exam.published_at) return false;

      const inWindow =
        (!exam.available_from || new Date(exam.available_from).getTime() <= now) &&
        (!exam.available_until || new Date(exam.available_until).getTime() > now);

      if (!inWindow) return false;

      // Students: skip published exams that have no questions (avoid empty exam entry)
      const qCount = exam.questions?.[0]?.count ?? 0;
      return qCount > 0;
    });

    return json({ success: true, exams: filtered });
  } catch (err) {
    console.error('GET /api/courses/[id]/exams error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
