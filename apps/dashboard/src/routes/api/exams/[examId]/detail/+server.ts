import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

function mergeOptionImagesFromQuestionMetadata(question: any) {
  const optionImages = question?.metadata?.optionImages || {};

  question.options = (question.options || []).map((option: any) => {
    const key = option?.value ? String(option.value) : option?.id ? String(option.id) : '';
    const sidecarImage = key ? optionImages[key] : null;

    return {
      ...option,
      metadata: {
        ...(option.metadata || {}),
        ...(sidecarImage && !option.metadata?.image ? { image: sidecarImage } : {})
      }
    };
  });
}

/**
 * GET /api/exams/[examId]/detail
 *
 * Teacher/Admin only: fetch full exam details including correct answers.
 * Bypasses RLS by using service-role client.
 */
export const GET: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!examId) {
    return json({ success: false, message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Fetch exam with questions and options
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select(
        `
        id, title, description, lesson_id, assessment_type, published_at,
        available_from, available_until, due_by, duration_minutes, attempts_allowed,
        passing_score, show_result_policy, shuffle_questions, shuffle_options,
        settings,
        questions:question(*, options:option(*), question_type:question_type_id(id, label))
      `
      )
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      console.error('fetchExamDetail error:', examError);
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    // 2. Verify user is teacher/admin of this course
    const { data: lessonRow } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    const { data: courseRow } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', lessonRow?.course_id)
      .single();

    if (!courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess, isOrgAdmin, userMembership } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const isTeacher = isOrgAdmin || userMembership?.role_id === ROLE.TUTOR || userMembership?.role_id === ROLE.ADMIN;
    if (!isTeacher) {
      return json({ success: false, message: 'Only teachers can view exam details' }, { status: 403 });
    }

    // 3. Sort questions and normalize question_type
    if (Array.isArray(examRow.questions)) {
      examRow.questions.forEach((q: any) => {
        if (q.question_type) {
          q.question_type_id = q.question_type.id;
        }
        mergeOptionImagesFromQuestionMetadata(q);
      });
      examRow.questions = examRow.questions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    } else {
      examRow.questions = [];
    }

    return json({ success: true, exam: examRow });
  } catch (err) {
    console.error('GET /api/exams/[examId]/detail error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
