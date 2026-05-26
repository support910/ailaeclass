import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

const SUBMISSION_STATUS = {
  SUBMITTED: 1,
  IN_PROGRESS: 2,
  GRADED: 3
};

/**
 * POST /api/exams/[examId]/start
 * Body: { courseId: string }
 *
 * Starts or resumes an exam attempt server-side.
 * - Only enrolled students (role_id === ROLE.STUDENT) can create real submissions.
 * - Admins/Tutors get 403; they should use preview mode on the client.
 * - If an IN_PROGRESS submission exists and hasn't expired, return it (resume).
 * - Enforces availability window, published status, and attempts_allowed.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: { courseId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const courseId = body.courseId;
  if (!courseId) {
    return json({ success: false, message: 'courseId is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam exists, is published, belongs to course
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select(
        `
        id, lesson_id, published_at, available_from, available_until,
        duration_minutes, attempts_allowed
      `
      )
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    const { data: lessonRow, error: lessonError } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (lessonError || !lessonRow || lessonRow.course_id !== courseId) {
      return json({ success: false, message: 'Exam does not belong to this course' }, { status: 403 });
    }

    if (!examRow.published_at) {
      return json({ success: false, message: 'Exam not published' }, { status: 403 });
    }

    // 2. Availability window
    const now = Date.now();
    if (examRow.available_from && new Date(examRow.available_from).getTime() > now) {
      return json({ success: false, message: 'Exam not yet available' }, { status: 403 });
    }
    if (examRow.available_until && new Date(examRow.available_until).getTime() <= now) {
      return json({ success: false, message: 'Exam no longer available' }, { status: 403 });
    }

    // 3. Resolve membership
    const { data: courseRow, error: courseError } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (courseError || !courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess, userMembership, isOrgAdmin } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const isStudent = userMembership?.role_id === ROLE.STUDENT && !isOrgAdmin;
    const groupMemberId = userMembership?.id || null;

    if (!isStudent || !groupMemberId) {
      return json(
        { success: false, message: 'Only enrolled students can start an exam' },
        { status: 403 }
      );
    }

    // 4. Resume existing IN_PROGRESS attempt if not expired
    const { data: existingSub, error: existingError } = await supabase
      .from('submission')
      .select('id, status_id, started_at, expires_at, total, answers:question_answer(*)')
      .eq('exercise_id', examId)
      .eq('submitted_by', groupMemberId)
      .eq('course_id', courseId)
      .eq('status_id', SUBMISSION_STATUS.IN_PROGRESS)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingError && existingSub) {
      const expired = existingSub.expires_at && new Date(existingSub.expires_at).getTime() <= now;
      if (!expired) {
        return json({
          success: true,
          submission: existingSub,
          resumed: true
        });
      }
    }

    // 5. Count attempts (all submissions for this exam by this student)
    const { count: attemptCount } = await supabase
      .from('submission')
      .select('*', { count: 'exact', head: true })
      .eq('exercise_id', examId)
      .eq('submitted_by', groupMemberId);

    const attemptsAllowed = examRow.attempts_allowed ?? 1;
    if ((attemptCount || 0) >= attemptsAllowed) {
      return json({ success: false, message: 'No attempts remaining' }, { status: 403 });
    }

    // 6. Create new submission
    const startedAt = new Date().toISOString();
    const payload: Record<string, any> = {
      submitted_by: groupMemberId,
      exercise_id: examId,
      course_id: courseId,
      status_id: SUBMISSION_STATUS.IN_PROGRESS,
      started_at: startedAt
    };

    if (examRow.duration_minutes && examRow.duration_minutes > 0) {
      const expiresAt = new Date(Date.now() + examRow.duration_minutes * 60000).toISOString();
      payload.expires_at = expiresAt;
    }

    const { data: newSub, error: insertError } = await supabase
      .from('submission')
      .insert(payload)
      .select()
      .single();

    if (insertError || !newSub) {
      console.error('startExamAttempt insert error:', insertError);
      return json({ success: false, message: 'Failed to start exam' }, { status: 500 });
    }

    return json({
      success: true,
      submission: newSub,
      resumed: false
    });
  } catch (err) {
    console.error('POST /api/exams/[examId]/start error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
