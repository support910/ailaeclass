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
 * GET /api/exams/[examId]?courseId=xxx
 *
 * Returns the exam stripped of correct-answer flags,
 * plus the current student's attempt state, attempt count, and result visibility.
 *
 * Question visibility rules:
 * - Preview users (teacher/admin): always receive full questions.
 * - Students with an active IN_PROGRESS attempt: receive questions to continue.
 * - Students within availability window: receive questions for intro/start.
 * - Students outside availability window with no active attempt: receive empty questions.
 *
 * Result data stripping:
 * - hidden_result / manual policy: attempt.total and answer scoring fields are stripped.
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
  const examId = params.examId;
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

    // 1. Verify exam exists, is published, belongs to course
    // NOTE: PostgREST schema cache often misses FK relationships, so we avoid
    // nested queries (questions:question(...options:option(...))) and merge manually.
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select(
        `
        id, title, description, lesson_id, assessment_type, published_at,
        available_from, available_until, due_by, duration_minutes, attempts_allowed,
        passing_score, show_result_policy, shuffle_questions, shuffle_options
      `
      )
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      console.error('GET /api/exams/[examId] exercise fetch error:', examError);
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    // Fetch questions separately to avoid PostgREST nested FK issues
    const { data: questionsData, error: questionsError } = await supabase
      .from('question')
      .select('id, name, title, question_type_id, points, order, exercise_id, metadata')
      .eq('exercise_id', examId);

    if (questionsError) {
      console.error('GET /api/exams/[examId] questions fetch error:', questionsError);
    }

    const questionIds = (questionsData || []).map((q: any) => q.id);

    // Fetch options separately
    let optionsMap: Record<string, any[]> = {};
    if (questionIds.length > 0) {
      let optionsData: any[] | null = null;
      let optionsError: any = null;

      const res1 = await supabase
        .from('option')
        .select('id, value, label, question_id, metadata')
        .in('question_id', questionIds);
      optionsData = res1.data;
      optionsError = res1.error;

      // Retry without metadata if remote schema lacks the column
      if (optionsError) {
        const errMsg = optionsError.message || '';
        const isMetadataIssue =
          errMsg.includes('metadata') ||
          errMsg.includes('column') ||
          errMsg.includes('schema') ||
          (optionsError as any).code === '42703';
        if (isMetadataIssue) {
          console.warn('Option select with metadata failed, retrying without metadata. Error:', errMsg);
          const res2 = await supabase
            .from('option')
            .select('id, value, label, question_id')
            .in('question_id', questionIds);
          optionsData = res2.data;
          optionsError = res2.error;
        }
      }

      if (optionsError) {
        console.error('GET /api/exams/[examId] options fetch error:', optionsError);
      }

      (optionsData || []).forEach((o: any) => {
        if (!optionsMap[o.question_id]) optionsMap[o.question_id] = [];
        optionsMap[o.question_id].push(o);
      });
    }

    // Merge questions + options into examRow for downstream compatibility
    (examRow as any).questions = (questionsData || []).map((q: any) => ({
      ...q,
      options: optionsMap[q.id] || []
    }));

    // Verify exam belongs to the given course via lesson
    const { data: lessonRow, error: lessonError } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (lessonError || !lessonRow || lessonRow.course_id !== courseId) {
      return json({ success: false, message: 'Exam does not belong to this course' }, { status: 403 });
    }

    // Verify published
    if (!examRow.published_at) {
      return json({ success: false, message: 'Exam not published' }, { status: 403 });
    }

    // Guard: reject empty exams for everyone (prevent student from starting an exam with no questions)
    const totalQuestions = (questionsData || []).length;
    if (totalQuestions === 0) {
      return json({ success: false, message: 'This exam has no questions' }, { status: 400 });
    }

    // 2. Resolve course -> group -> membership
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
    const isPreview = !isStudent;

    // 3. Build questions (always strip is_correct)
    const allQuestions = (examRow.questions || [])
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .map((q: any) => {
        const opts = (q.options || [])
          .map((o: any) => ({
            id: o.id,
            value: o.value,
            label: o.label,
            metadata: getOptionMetadata(q, o)
          }));
        return {
          id: q.id,
          name: q.name,
          title: q.title,
          question_type_id: q.question_type_id,
          question_type: { id: q.question_type_id },
          points: q.points,
          order: q.order,
          metadata: q.metadata || {},
          options: opts
        };
      });

    // 4. Student-only: fetch attempt state
    let attempt: any = null;
    let attemptCount = 0;
    let canStart = false;
    let view: 'intro' | 'runner' | 'result' | 'hidden_result' = 'intro';

    if (isStudent && groupMemberId) {
      // Latest submission for this exam
      const { data: latestSub, error: subError } = await supabase
        .from('submission')
        .select('id, status_id, started_at, submitted_at, expires_at, total, answers:question_answer(*)')
        .eq('exercise_id', examId)
        .eq('submitted_by', groupMemberId)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subError && latestSub) {
        attempt = latestSub;
      }

      // Count all attempts
      const { count } = await supabase
        .from('submission')
        .select('*', { count: 'exact', head: true })
        .eq('exercise_id', examId)
        .eq('submitted_by', groupMemberId)
        .eq('course_id', courseId);

      attemptCount = count || 0;

      // Determine view
      if (attempt) {
        if (attempt.status_id === SUBMISSION_STATUS.IN_PROGRESS) {
          const expired = attempt.expires_at && new Date(attempt.expires_at).getTime() <= Date.now();
          view = expired ? 'intro' : 'runner';
        } else if (attempt.status_id === SUBMISSION_STATUS.SUBMITTED || attempt.status_id === SUBMISSION_STATUS.GRADED) {
          view = shouldShowResult(examRow, attempt) ? 'result' : 'hidden_result';
        }
      }

      // Determine canStart
      const now = Date.now();
      const inWindow =
        (!examRow.available_from || new Date(examRow.available_from).getTime() <= now) &&
        (!examRow.available_until || new Date(examRow.available_until).getTime() > now);

      const hasInProgress = attempt?.status_id === SUBMISSION_STATUS.IN_PROGRESS;
      const attemptsAllowed = examRow.attempts_allowed ?? 1;
      const underLimit = attemptCount < attemptsAllowed;
      canStart = inWindow && (hasInProgress || underLimit);
    }

    // 5. Determine whether to return questions based on role + state
    let returnQuestions = true;
    if (isStudent) {
      const now = Date.now();
      const inWindow =
        (!examRow.available_from || new Date(examRow.available_from).getTime() <= now) &&
        (!examRow.available_until || new Date(examRow.available_until).getTime() > now);

      const hasActiveInProgress =
        attempt?.status_id === SUBMISSION_STATUS.IN_PROGRESS &&
        (!attempt.expires_at || new Date(attempt.expires_at).getTime() > now);

      // Students see questions only if:
      // - they have an active IN_PROGRESS attempt, OR
      // - they are within the availability window (intro/start), OR
      // - they are on the result view (answer review)
      if (!hasActiveInProgress && !inWindow && view !== 'result') {
        returnQuestions = false;
      }
    }

    const exam = {
      id: examRow.id,
      title: examRow.title,
      description: examRow.description,
      duration_minutes: examRow.duration_minutes,
      attempts_allowed: examRow.attempts_allowed,
      passing_score: examRow.passing_score,
      show_result_policy: examRow.show_result_policy || 'after_grade',
      available_from: examRow.available_from,
      available_until: examRow.available_until,
      due_by: examRow.due_by,
      questions: returnQuestions ? allQuestions : []
    };

    // 6. Strip sensitive result data for hidden_result / manual policy
    if (view === 'hidden_result' && attempt) {
      attempt.total = undefined;
      if (Array.isArray(attempt.answers)) {
        attempt.answers = attempt.answers.map((a: any) => ({
          question_id: a.question_id,
          open_answer: a.open_answer,
          answers: a.answers
          // strip point, is_correct, auto_score
        }));
      }
    }

    return json({
      success: true,
      exam,
      attempt,
      attemptCount,
      canStart,
      view,
      isPreview,
      groupMemberId: isStudent ? groupMemberId : null
    });
  } catch (err) {
    console.error('GET /api/exams/[examId] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};

function shouldShowResult(exam: any, submission: any): boolean {
  const policy = exam.show_result_policy || 'after_grade';
  if (policy === 'immediately') return true;
  if (policy === 'after_grade') return submission.status_id === SUBMISSION_STATUS.GRADED;
  if (policy === 'after_due_date') {
    const deadline = exam.available_until || exam.due_by;
    if (!deadline) return true;
    return new Date(deadline).getTime() <= Date.now();
  }
  if (policy === 'manual') return false;
  return false;
}

/**
 * DELETE /api/exams/[examId]
 *
 * Teacher/Admin only: permanently delete a draft exam and all its questions/options.
 */
export const DELETE: RequestHandler = async ({ params, request }) => {
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

    // 1. Verify exam exists
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('lesson_id, published_at')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    if (examRow.published_at) {
      return json(
        { success: false, message: 'Only draft exams can be deleted. Unpublish the exam first.' },
        { status: 409 }
      );
    }

    // 2. Verify user is teacher/admin
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
      return json({ success: false, message: 'Only teachers can delete exams' }, { status: 403 });
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from('submission')
      .select('id')
      .eq('exercise_id', examId);

    if (submissionsError) {
      console.error('deleteExam submissions fetch error:', submissionsError);
      return json({ success: false, message: submissionsError.message }, { status: 500 });
    }

    // 3. Delete in correct order: options -> question answers -> questions -> exercise
    const submissionIds = submissions?.map((s) => s.id) || [];
    const { data: questions } = await supabase
      .from('question')
      .select('id')
      .eq('exercise_id', examId);

    const questionIds = questions?.map((q) => q.id) || [];

    if (submissionIds.length > 0) {
      await supabase.from('question_answer').delete().in('submission_id', submissionIds);
    }

    if (questionIds.length > 0) {
      await supabase.from('option').delete().in('question_id', questionIds);
      await supabase.from('question_answer').delete().in('question_id', questionIds);
      await supabase.from('question').delete().in('id', questionIds);
    }

    await supabase.from('submission').delete().eq('exercise_id', examId);

    const { error: deleteError } = await supabase
      .from('exercise')
      .delete()
      .match({ id: examId, assessment_type: 'exam' });

    if (deleteError) {
      console.error('deleteExam error:', deleteError);
      return json({ success: false, message: deleteError.message }, { status: 500 });
    }

    return json({ success: true, message: 'Draft exam deleted' });
  } catch (err) {
    console.error('DELETE /api/exams/[examId] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
