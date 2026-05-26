import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';
import { QUESTION_TYPE } from '$lib/components/Question/constants';

const SUBMISSION_STATUS = {
  SUBMITTED: 1,
  IN_PROGRESS: 2,
  GRADED: 3
};

/**
 * GET /api/exams/[examId]/submissions/[submissionId]?courseId=xxx
 *
 * Returns a single submission with full question/answer details.
 * Teachers/admins only.
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
  const examId = params.examId;
  const submissionId = params.submissionId;
  const courseId = url.searchParams.get('courseId');
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!courseId) {
    return json({ success: false, message: 'courseId is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam and course linkage
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('id, lesson_id, title, assessment_type')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    const { data: lessonRow } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (!lessonRow || lessonRow.course_id !== courseId) {
      return json({ success: false, message: 'Exam does not belong to this course' }, { status: 403 });
    }

    // 2. Verify teacher/admin access
    const { data: courseRow } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (!courseRow?.group_id) {
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
    if (isStudent) {
      return json({ success: false, message: 'Students cannot access grading data' }, { status: 403 });
    }

    // 3. Fetch submission without nested groupmember->profile
    const { data: submission, error: subError } = await supabase
      .from('submission')
      .select(
        `
        id, status_id, started_at, submitted_at, expires_at, total, feedback, created_at,
        submitted_by, course_id, exercise_id
      `
      )
      .eq('id', submissionId)
      .eq('exercise_id', examId)
      .eq('course_id', courseId)
      .single();

    if (subError || !submission) {
      return json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    // 3b. Fetch student profile separately
    let studentProfile: any = {};
    let assignedStudentId: string | null = null;
    if (submission.submitted_by) {
      const { data: gm } = await supabase
        .from('groupmember')
        .select('id, profile_id, assigned_student_id')
        .eq('id', submission.submitted_by)
        .single();
      if (gm) {
        assignedStudentId = gm.assigned_student_id;
        if (gm.profile_id) {
          const { data: prof } = await supabase
            .from('profile')
            .select('id, fullname, email, avatar_url')
            .eq('id', gm.profile_id)
            .single();
          if (prof) studentProfile = prof;
        }
      }
    }

    // 4. Fetch questions with correct answers
    // NOTE: PostgREST schema cache often misses FK relationships, so we avoid
    // nested queries and merge manually. question/option tables have no deleted_at.
    const { data: questions, error: qError } = await supabase
      .from('question')
      .select('id, name, title, question_type_id, points, order, exercise_id')
      .eq('exercise_id', examId)
      .order('order', { ascending: true });

    if (qError || !questions) {
      console.error('grading questions fetch error:', qError);
      return json({ success: false, message: 'Failed to load questions' }, { status: 500 });
    }

    const questionIds = questions.map((q: any) => q.id);
    let optionsMap: Record<string, any[]> = {};
    if (questionIds.length > 0) {
      const { data: optionsData, error: optionsError } = await supabase
        .from('option')
        .select('id, value, label, is_correct, question_id')
        .in('question_id', questionIds);

      if (optionsError) {
        console.error('grading options fetch error:', optionsError);
      }

      (optionsData || []).forEach((o: any) => {
        if (!optionsMap[o.question_id]) optionsMap[o.question_id] = [];
        optionsMap[o.question_id].push(o);
      });
    }

    // Attach options to each question for downstream compatibility
    (questions as any[]).forEach((q: any) => {
      q.options = optionsMap[q.id] || [];
    });

    // 5. Fetch question answers
    const { data: answers, error: ansError } = await supabase
      .from('question_answer')
      .select('id, question_id, open_answer, answers, point, is_correct, auto_score, feedback')
      .eq('submission_id', submissionId);

    if (ansError) {
      return json({ success: false, message: 'Failed to load answers' }, { status: 500 });
    }

    const answersByQuestionId = (answers || []).reduce((acc, a) => {
      acc[a.question_id] = a;
      return acc;
    }, {});

    // 6. Build question list with answers and correct options
    const questionList = questions.map((q) => {
      const activeOptions = (q.options || []).map((o) => ({
        id: o.id,
        value: o.value,
        label: o.label,
        is_correct: o.is_correct
      }));

      const correctOptions = activeOptions.filter((o) => o.is_correct);
      const answerRecord = answersByQuestionId[q.id];

      return {
        id: q.id,
        name: q.name,
        title: q.title,
        question_type_id: q.question_type_id,
        points: parseFloat(q.points) || 0,
        order: q.order,
        options: activeOptions,
        correct_options: correctOptions,
        answer: answerRecord
          ? {
              id: answerRecord.id,
              open_answer: answerRecord.open_answer,
              answers: answerRecord.answers,
              point: answerRecord.point,
              is_correct: answerRecord.is_correct,
              auto_score: answerRecord.auto_score,
              feedback: answerRecord.feedback
            }
          : null
      };
    });

    return json({
      success: true,
      submission: {
        id: submission.id,
        status_id: submission.status_id,
        started_at: submission.started_at,
        submitted_at: submission.submitted_at,
        expires_at: submission.expires_at,
        total: submission.total,
        feedback: submission.feedback,
        student: {
          id: submission.submitted_by,
          fullname: studentProfile.fullname || '-',
          email: studentProfile.email || '-',
          avatar_url: studentProfile.avatar_url || '',
          assigned_student_id: assignedStudentId
        }
      },
      exam_title: examRow.title,
      questions: questionList
    });
  } catch (err) {
    console.error('GET /api/exams/[examId]/submissions/[submissionId] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};

/**
 * POST /api/exams/[examId]/submissions/[submissionId]
 * Body: { courseId: string, questionGrades: [{ questionAnswerId, point, feedback }], submissionFeedback?: string }
 *
 * Saves manual grading for a submission.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
  const submissionId = params.submissionId;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    courseId?: string;
    questionGrades?: { questionAnswerId: string; point: number; feedback?: string }[];
    submissionFeedback?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { courseId, questionGrades, submissionFeedback } = body;
  if (!courseId || !Array.isArray(questionGrades)) {
    return json(
      { success: false, message: 'courseId and questionGrades are required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam and course linkage
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('id, lesson_id, assessment_type')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    const { data: lessonRow } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (!lessonRow || lessonRow.course_id !== courseId) {
      return json({ success: false, message: 'Exam does not belong to this course' }, { status: 403 });
    }

    // 2. Verify teacher/admin access
    const { data: courseRow } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (!courseRow?.group_id) {
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
    if (isStudent) {
      return json({ success: false, message: 'Students cannot grade submissions' }, { status: 403 });
    }

    // 3. Verify submission exists and belongs to this exam/course
    const { data: submission, error: subError } = await supabase
      .from('submission')
      .select('id, status_id')
      .eq('id', submissionId)
      .eq('exercise_id', examId)
      .eq('course_id', courseId)
      .single();

    if (subError || !submission) {
      return json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    // 4. Validate and clamp points (server-side enforcement)
    const qaIds = questionGrades.map((g) => g.questionAnswerId).filter(Boolean);
    if (qaIds.length === 0) {
      return json({ success: false, message: 'No valid grades provided' }, { status: 400 });
    }

    const { data: qaRecords, error: qaFetchError } = await supabase
      .from('question_answer')
      .select('id, question_id, question:question_id(points)')
      .eq('submission_id', submissionId)
      .in('id', qaIds);

    if (qaFetchError || !qaRecords) {
      console.error('grade fetch question_answer error:', qaFetchError);
      return json(
        { success: false, message: 'Failed to load answers for grading' },
        { status: 500 }
      );
    }

    const maxPointsByQaId: Record<string, number> = {};
    (qaRecords || []).forEach((qa: any) => {
      maxPointsByQaId[qa.id] = parseFloat(qa.question?.points) || 0;
    });

    let totalScore = 0;
    for (const g of questionGrades) {
      const { questionAnswerId, point, feedback: qaFeedback } = g;
      if (!questionAnswerId || typeof point !== 'number' || isNaN(point)) continue;

      const maxPoint = maxPointsByQaId[questionAnswerId];
      if (maxPoint === undefined) continue; // not found / not owned by this submission

      const clampedPoint = Math.max(0, Math.min(point, maxPoint));

      const { error: updateError } = await supabase
        .from('question_answer')
        .update({
          point: clampedPoint,
          feedback: qaFeedback || null
        })
        .eq('id', questionAnswerId)
        .eq('submission_id', submissionId);

      if (updateError) {
        console.error('grade update question_answer error:', updateError);
        return json({ success: false, message: 'Failed to save grades' }, { status: 500 });
      }

      totalScore += clampedPoint;
    }

    // 5. Re-calculate total from all question_answer rows for this submission
    const { data: allAnswers, error: sumError } = await supabase
      .from('question_answer')
      .select('point')
      .eq('submission_id', submissionId);

    if (sumError) {
      console.error('grade sum question_answer error:', sumError);
      return json({ success: false, message: 'Failed to recalculate total' }, { status: 500 });
    }

    const recalculatedTotal = (allAnswers || []).reduce((sum, a) => {
      const p = typeof a.point === 'number' ? a.point : parseFloat(a.point);
      return sum + (isNaN(p) ? 0 : p);
    }, 0);

    // 6. Update submission status, total, feedback
    const { error: subUpdateError } = await supabase
      .from('submission')
      .update({
        status_id: SUBMISSION_STATUS.GRADED,
        total: recalculatedTotal,
        feedback: submissionFeedback || null
      })
      .eq('id', submissionId);

    if (subUpdateError) {
      console.error('grade update submission error:', subUpdateError);
      return json({ success: false, message: 'Failed to finalize grading' }, { status: 500 });
    }

    return json({
      success: true,
      total: recalculatedTotal,
      status_id: SUBMISSION_STATUS.GRADED
    });
  } catch (err) {
    console.error('POST /api/exams/[examId]/submissions/[submissionId] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
