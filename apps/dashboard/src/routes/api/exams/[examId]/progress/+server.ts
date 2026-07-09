import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

const SUBMISSION_STATUS = {
  IN_PROGRESS: 2
};

export const POST: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
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
    courseId,
    submissionId,
    answers,
    feedbackByQuestion,
    currentQuestionIndex,
    questionOrder,
    optionOrders
  } = body;
  if (!examId || !courseId || !submissionId) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
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

    if (examRow.settings?.exam_mode !== 'quick_practice') {
      return json({ success: false, message: 'Progress save is only for quick practice' }, { status: 400 });
    }

    const { data: lessonRow } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (!lessonRow || lessonRow.course_id !== courseId) {
      return json({ success: false, message: 'Exam does not belong to this course' }, { status: 403 });
    }

    const { data: courseRow } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (!courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess, userMembership, isStudent } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    if (!isStudent || !userMembership?.id) {
      return json({ success: false, message: 'Only enrolled students can save progress' }, { status: 403 });
    }

    const { data: submission, error: submissionError } = await supabase
      .from('submission')
      .select('id, status_id, submitted_by, exercise_id, course_id, expires_at, metadata')
      .eq('id', submissionId)
      .eq('submitted_by', userMembership.id)
      .eq('exercise_id', examId)
      .eq('course_id', courseId)
      .eq('status_id', SUBMISSION_STATUS.IN_PROGRESS)
      .single();

    if (submissionError || !submission) {
      return json({ success: false, message: 'Submission not found or already submitted' }, { status: 403 });
    }

    if (submission.expires_at && new Date(submission.expires_at).getTime() <= Date.now()) {
      return json({ success: false, message: 'Exam time has expired' }, { status: 403 });
    }

    const metadata = {
      ...(submission.metadata || {}),
      quick_practice: {
        answers: answers || {},
        feedbackByQuestion: feedbackByQuestion || {},
        currentQuestionIndex: Number.isFinite(Number(currentQuestionIndex))
          ? Number(currentQuestionIndex)
          : 0,
        questionOrder: Array.isArray(questionOrder) ? questionOrder : [],
        optionOrders: optionOrders && typeof optionOrders === 'object' ? optionOrders : {},
        savedAt: new Date().toISOString()
      }
    };

    const { data, error } = await supabase
      .from('submission')
      .update({ metadata })
      .eq('id', submissionId)
      .select('id, metadata')
      .single();

    if (error) {
      console.error('save quick practice progress error:', error);
      return json({ success: false, message: 'Failed to save progress' }, { status: 500 });
    }

    return json({ success: true, submission: data });
  } catch (err) {
    console.error('POST /api/exams/[examId]/progress error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
