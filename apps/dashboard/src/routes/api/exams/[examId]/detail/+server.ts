import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { refreshExamImageUrls } from '$lib/utils/functions/examImages.server';

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

function getOptionMetadata(question: any, option: any) {
  const optionImages = question?.metadata?.optionImages || {};
  const key = option?.value ? String(option.value) : option?.id ? String(option.id) : '';
  const sidecarImage = key ? optionImages[key] : null;

  return {
    ...(option.metadata || {}),
    ...(sidecarImage && !option.metadata?.image ? { image: sidecarImage } : {})
  };
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

    // 1. Fetch exam, questions, and options separately. This avoids brittle nested
    // PostgREST relationship/schema-cache failures on the editor page.
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('*')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      console.error('fetchExamDetail error:', examError);
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    if ((examRow as any).deleted_at) {
      return json({ success: false, message: 'Exam has been moved to the recycle bin' }, { status: 410 });
    }

    const { data: questionsData, error: questionsError } = await supabase
      .from('question')
      .select('id, name, title, question_type_id, points, order, exercise_id, metadata')
      .eq('exercise_id', examId);

    if (questionsError) {
      console.error('fetchExamDetail questions error:', questionsError);
      return json({ success: false, message: 'Failed to load exam questions' }, { status: 500 });
    }

    const questionIds = (questionsData || []).map((q: any) => q.id);
    let optionsMap: Record<string, any[]> = {};

    if (questionIds.length > 0) {
      let optionsData: any[] | null = null;
      let optionsError: any = null;

      const res1 = await supabase
        .from('option')
        .select('id, value, label, question_id, is_correct, metadata')
        .in('question_id', questionIds);
      optionsData = res1.data;
      optionsError = res1.error;

      if (optionsError) {
        const errMsg = optionsError.message || '';
        const isMetadataIssue =
          errMsg.includes('metadata') ||
          errMsg.includes('column') ||
          errMsg.includes('schema') ||
          (optionsError as any).code === '42703';
        if (isMetadataIssue) {
          const res2 = await supabase
            .from('option')
            .select('id, value, label, question_id, is_correct')
            .in('question_id', questionIds);
          optionsData = res2.data;
          optionsError = res2.error;
        }
      }

      if (optionsError) {
        console.error('fetchExamDetail options error:', optionsError);
        return json({ success: false, message: 'Failed to load exam options' }, { status: 500 });
      }

      (optionsData || []).forEach((option: any) => {
        if (!optionsMap[option.question_id]) optionsMap[option.question_id] = [];
        optionsMap[option.question_id].push(option);
      });
    }

    (examRow as any).questions = (questionsData || []).map((question: any) => ({
      ...question,
      question_type: { id: question.question_type_id },
      options: (optionsMap[question.id] || []).map((option: any) => ({
        ...option,
        metadata: getOptionMetadata(question, option)
      }))
    }));

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

    const { hasAccess, isStudent } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const isTeacher = !isStudent;
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
      await refreshExamImageUrls(supabase, examRow.questions);
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
