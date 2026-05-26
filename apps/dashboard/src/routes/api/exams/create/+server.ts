import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * POST /api/exams/create
 *
 * Teacher/Admin only: create a new exam exercise.
 * Server validates:
 * - User is a member of the course's group with tutor or admin role.
 * - Lesson belongs to the selected course.
 * - Course belongs to the user's current org (implied by group membership).
 *
 * Body: {
 *   title: string;
 *   description?: string;
 *   lesson_id: string;
 *   course_id: string;
 *   duration_minutes?: number;
 *   attempts_allowed?: number;
 *   passing_score?: number;
 *   show_result_policy?: string;
 *   available_from?: string;
 *   available_until?: string;
 * }
 *
 * Response: { success: boolean; exam?: any; message?: string }
 */
export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    title,
    description = '',
    lesson_id,
    course_id,
    duration_minutes,
    attempts_allowed = 1,
    passing_score,
    show_result_policy = 'after_grade',
    available_from,
    available_until
  } = body;

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return json({ success: false, message: 'Title is required (min 2 characters)' }, { status: 400 });
  }
  if (!lesson_id || typeof lesson_id !== 'string') {
    return json({ success: false, message: 'Lesson ID is required' }, { status: 400 });
  }
  if (!course_id || typeof course_id !== 'string') {
    return json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify lesson exists and get its course
    const { data: lessonRow, error: lessonError } = await supabase
      .from('lesson')
      .select('id, course_id, course:course_id(group_id)')
      .eq('id', lesson_id)
      .single();

    if (lessonError || !lessonRow) {
      console.error('Lesson lookup error:', lessonError);
      return json({ success: false, message: 'Lesson not found' }, { status: 404 });
    }

    const groupId = (lessonRow as any).course?.group_id;
    if (!groupId) {
      return json({ success: false, message: 'Course group not found for this lesson' }, { status: 404 });
    }

    // 2. Verify lesson belongs to the selected course
    if (lessonRow.course_id !== course_id) {
      return json(
        { success: false, message: 'Lesson does not belong to the selected course' },
        { status: 400 }
      );
    }

    // 3. Verify user has access and is tutor/admin or org admin
    const { hasAccess, isOrgAdmin, userMembership } = await checkUserCoursePermissions(
      supabase,
      userId,
      groupId
    );

    if (!hasAccess) {
      return json({ success: false, message: 'You do not have access to this course' }, { status: 403 });
    }

    const canCreate = isOrgAdmin || userMembership?.role_id === ROLE.TUTOR || userMembership?.role_id === ROLE.ADMIN;
    if (!canCreate) {
      return json(
        { success: false, message: 'Only teachers or admins can create exams' },
        { status: 403 }
      );
    }

    // 4. Insert exam exercise
    const payload = {
      title: title.trim(),
      description,
      lesson_id,
      assessment_type: 'exam',
      duration_minutes: duration_minutes ? Number(duration_minutes) : null,
      attempts_allowed: Number(attempts_allowed) || 1,
      passing_score: passing_score !== undefined && passing_score !== null ? Number(passing_score) : null,
      show_result_policy,
      available_from: available_from || null,
      available_until: available_until || null,
      settings: {}
    };

    const { data: examData, error: examError } = await supabase
      .from('exercise')
      .insert(payload)
      .select();

    if (examError) {
      console.error('Exam insert error:', examError);
      return json(
        { success: false, message: examError.message || 'Failed to create exam' },
        { status: 500 }
      );
    }

    if (!examData || examData.length === 0) {
      return json({ success: false, message: 'No exam data returned after insert' }, { status: 500 });
    }

    return json({ success: true, exam: examData[0], message: 'Exam created successfully' });
  } catch (err) {
    console.error('POST /api/exams/create error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
