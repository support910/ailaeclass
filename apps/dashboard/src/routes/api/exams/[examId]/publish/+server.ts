import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * POST /api/exams/[examId]/publish
 *
 * Teacher/Admin only: publish or unpublish an exam.
 * Body: { action: 'publish' | 'unpublish' }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const examId = params.examId;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!examId) {
    return json({ success: false, message: 'Exam ID is required' }, { status: 400 });
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (!action || !['publish', 'unpublish'].includes(action)) {
    return json({ success: false, message: 'action must be "publish" or "unpublish"' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam exists
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('lesson_id')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
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
      return json({ success: false, message: 'Only teachers can publish exams' }, { status: 403 });
    }

    // 3. Validate exam content before publishing
    if (action === 'publish') {
      const { data: questions, error: qErr } = await supabase
        .from('question')
        .select('id, question_type_id')
        .eq('exercise_id', examId);

      if (qErr) {
        console.error('publishExam fetch questions error:', qErr);
        return json({ success: false, message: 'Failed to validate exam content' }, { status: 500 });
      }

      if (!questions || questions.length === 0) {
        return json({ success: false, message: 'Cannot publish an exam with no questions' }, { status: 400 });
      }

      const questionIds = questions.map((q) => q.id);
      const { data: options, error: oErr } = await supabase
        .from('option')
        .select('id, question_id, is_correct')
        .in('question_id', questionIds);

      if (oErr) {
        console.error('publishExam fetch options error:', oErr);
        return json({ success: false, message: 'Failed to validate exam options' }, { status: 500 });
      }

      const optionsByQuestion: Record<string, any[]> = {};
      (options || []).forEach((o) => {
        if (!optionsByQuestion[o.question_id]) optionsByQuestion[o.question_id] = [];
        optionsByQuestion[o.question_id].push(o);
      });

      // Objective types: single_choice (1), multi_choice (2)
      const OBJECTIVE_TYPES = new Set([1, 2]);

      for (const q of questions) {
        const qOpts = optionsByQuestion[q.id] || [];
        if (OBJECTIVE_TYPES.has(q.question_type_id)) {
          if (qOpts.length < 2) {
            return json(
              { success: false, message: `Question has fewer than 2 options` },
              { status: 400 }
            );
          }
          const correctCount = qOpts.filter((o) => o.is_correct).length;
          if (correctCount === 0) {
            return json(
              { success: false, message: `Question has no correct answer` },
              { status: 400 }
            );
          }
          if (q.question_type_id === 1 && correctCount > 1) {
            return json(
              { success: false, message: `Single-choice question has more than one correct answer` },
              { status: 400 }
            );
          }
        }
      }
    }

    // 4. Update published_at
    const published_at = action === 'publish' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('exercise')
      .update({ published_at })
      .match({ id: examId, assessment_type: 'exam' })
      .select();

    if (error) {
      console.error('publishExam error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    return json({ success: true, exam: data?.[0] });
  } catch (err) {
    console.error('POST /api/exams/[examId]/publish error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
