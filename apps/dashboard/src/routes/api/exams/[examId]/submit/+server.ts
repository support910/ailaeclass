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
 * POST /api/exams/[examId]/submit
 * Body: { courseId: string, submissionId: string, answers: Record<string, string | string[]> }
 *
 * Server-side submit + auto-score.
 * - Verifies submission ownership, status, and expiry.
 * - Re-fetches questions with correct answers from DB (never trusts client data).
 * - Auto-scores objective questions; TEXTAREA gets 0 points and requires manual grading.
 * - Deletes old question_answers and inserts new ones atomically (best effort without RPC).
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    courseId?: string;
    submissionId?: string;
    answers?: Record<string, string | string[]>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { courseId, submissionId, answers } = body;
  if (!courseId || !submissionId) {
    return json(
      { success: false, message: 'courseId and submissionId are required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam exists, is published, and belongs to course
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('id, lesson_id, published_at, available_until, assessment_type')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    if (!examRow.published_at) {
      return json({ success: false, message: 'Exam not published' }, { status: 403 });
    }

    const { data: lessonRow, error: lessonError } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (lessonError || !lessonRow || lessonRow.course_id !== courseId) {
      return json(
        { success: false, message: 'Exam does not belong to this course' },
        { status: 403 }
      );
    }

    // 2. Resolve membership
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
        { success: false, message: 'Only enrolled students can submit' },
        { status: 403 }
      );
    }

    // 3. Verify submission ownership and state
    const { data: submission, error: subError } = await supabase
      .from('submission')
      .select('id, status_id, submitted_by, exercise_id, course_id, expires_at')
      .eq('id', submissionId)
      .eq('submitted_by', groupMemberId)
      .eq('exercise_id', examId)
      .eq('course_id', courseId)
      .eq('status_id', SUBMISSION_STATUS.IN_PROGRESS)
      .single();

    if (subError || !submission) {
      return json(
        { success: false, message: 'Submission not found or already submitted' },
        { status: 403 }
      );
    }

    // 4. Expiry and availability checks
    const now = Date.now();

    // If the attempt has a duration timer, allow 10s grace period for auto-submit
    if (submission.expires_at) {
      const expired = new Date(submission.expires_at).getTime() + 10000 <= now;
      if (expired) {
        return json(
          { success: false, message: 'Exam time has expired' },
          { status: 403 }
        );
      }
    } else if (examRow.available_until) {
      // If no duration timer, submission must not exceed the availability window
      if (new Date(examRow.available_until).getTime() <= now) {
        return json(
          { success: false, message: 'Exam is no longer available' },
          { status: 403 }
        );
      }
    }

    // 5. Re-fetch questions with correct answers from DB (server-side only)
    // NOTE: PostgREST schema cache often misses FK relationships, so we avoid
    // nested queries and merge manually. question/option tables have no deleted_at.
    const { data: questions, error: qError } = await supabase
      .from('question')
      .select('id, name, title, question_type_id, points, order, exercise_id')
      .eq('exercise_id', examId)
      .order('order', { ascending: true });

    if (qError || !questions) {
      console.error('submit questions fetch error:', qError);
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
        console.error('submit options fetch error:', optionsError);
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

    // 6. Score every question
    const questionAnswers: Record<string, any>[] = [];
    let totalScore = 0;
    let hasUngraded = false;

    for (const q of questions) {
      const value = answers ? answers[q.name] : undefined;
      const typeId = q.question_type_id;
      const points = parseFloat(q.points) || 0;

      const qa: Record<string, any> = {
        group_member_id: groupMemberId,
        question_id: q.id,
        submission_id: submissionId,
        answered_at: new Date().toISOString()
      };

      // Determine answer representation
      if (typeof value === 'string') {
        qa.open_answer = value;
        qa.answers = [];
      } else if (Array.isArray(value)) {
        qa.open_answer = '';
        qa.answers = value;
      } else {
        qa.open_answer = '';
        qa.answers = [];
      }

      if (typeId === QUESTION_TYPE.TEXTAREA) {
        hasUngraded = true;
        qa.point = 0;
        qa.is_correct = null;
        qa.auto_score = 0;
      } else {
        const score = calculateQuestionScore(q, value);
        qa.point = score.point;
        qa.is_correct = score.is_correct;
        qa.auto_score = score.auto_score;
        totalScore += score.point;
      }

      questionAnswers.push(qa);
    }

    // 7. Delete existing answers then insert new ones
    const { error: delError } = await supabase
      .from('question_answer')
      .delete()
      .eq('submission_id', submissionId);

    if (delError) {
      console.error('submit delete question_answer error:', delError);
      return json({ success: false, message: 'Failed to save answers' }, { status: 500 });
    }

    const { data: qaData, error: qaError } = await supabase
      .from('question_answer')
      .insert(questionAnswers)
      .select();

    if (qaError) {
      console.error('submit insert question_answer error:', qaError);
      return json({ success: false, message: 'Failed to save answers' }, { status: 500 });
    }

    // 8. Update submission
    const statusId = hasUngraded ? SUBMISSION_STATUS.SUBMITTED : SUBMISSION_STATUS.GRADED;
    const { error: updateError } = await supabase
      .from('submission')
      .update({
        status_id: statusId,
        submitted_at: new Date().toISOString(),
        total: totalScore
      })
      .match({
        id: submissionId,
        submitted_by: groupMemberId,
        status_id: SUBMISSION_STATUS.IN_PROGRESS
      });

    if (updateError) {
      console.error('submit update submission error:', updateError);
      return json({ success: false, message: 'Failed to finalize submission' }, { status: 500 });
    }

    return json({
      success: true,
      total: totalScore,
      statusId,
      questionAnswers: qaData || []
    });
  } catch (err) {
    console.error('POST /api/exams/[examId]/submit error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};

function getCorrectOptionValues(options: any[]) {
  return options.filter((o) => o.is_correct).map((o) => o.value);
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function calculateQuestionScore(
  question: any,
  answerValue: string | string[] | undefined
): { point: number; is_correct: boolean; auto_score: number } {
  const typeId = question.question_type_id;
  const activeOptions = question.options || [];
  const correctValues = getCorrectOptionValues(activeOptions);
  const points = parseFloat(question.points) || 0;

  if (typeId === QUESTION_TYPE.RADIO || typeId === QUESTION_TYPE.TRUE_FALSE) {
    const selectedValue = Array.isArray(answerValue) ? answerValue[0] : answerValue;
    const isCorrect = correctValues.length === 1 && selectedValue === correctValues[0];
    return {
      point: isCorrect ? points : 0,
      is_correct: isCorrect,
      auto_score: isCorrect ? points : 0
    };
  }

  if (typeId === QUESTION_TYPE.CHECKBOX) {
    const selectedValues = Array.isArray(answerValue) ? answerValue : [];
    const isCorrect = arraysEqual(selectedValues, correctValues);
    return {
      point: isCorrect ? points : 0,
      is_correct: isCorrect,
      auto_score: isCorrect ? points : 0
    };
  }

  // TEXTAREA: no auto-scoring
  return {
    point: 0,
    is_correct: false,
    auto_score: 0
  };
}
