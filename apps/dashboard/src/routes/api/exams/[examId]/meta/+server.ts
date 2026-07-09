import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * GET /api/exams/[examId]/meta
 *
 * Returns lightweight exam metadata (title, course_id) for teacher-side pages.
 * Teachers/admins only.
 */
export const GET: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('*')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    if ((examRow as any).deleted_at) {
      return json({ success: false, message: 'Exam has been moved to the recycle bin' }, { status: 410 });
    }

    const { data: lessonRow } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (!lessonRow?.course_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { data: courseRow } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', lessonRow.course_id)
      .single();

    if (!courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess, isStudent } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    if (isStudent) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    return json({
      success: true,
      title: examRow.title,
      course_id: lessonRow.course_id
    });
  } catch (err) {
    console.error('GET /api/exams/[examId]/meta error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
