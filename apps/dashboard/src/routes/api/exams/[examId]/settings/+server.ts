import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

function emptyToNull(value: unknown) {
  return value === '' || value === undefined ? null : value;
}

function optionalNumber(value: unknown, fieldName: string): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return parsed;
}

/**
 * PATCH /api/exams/[examId]/settings
 *
 * Teacher/Admin only: update exam metadata/settings.
 * Body: any subset of exam fields (title, description, duration_minutes, etc.)
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
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

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam exists
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
      return json({ success: false, message: 'Restore the exam before editing it' }, { status: 409 });
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
      return json({ success: false, message: 'Only teachers can update exam settings' }, { status: 403 });
    }

    // 3. Build update payload
    const allowedFields = [
      'title', 'description', 'show_result_policy', 'shuffle_questions',
      'shuffle_options'
    ];

    const payload: Record<string, any> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        payload[key] = body[key];
      }
    }

    try {
      if (body.duration_minutes !== undefined) {
        const duration = optionalNumber(body.duration_minutes, 'Duration');
        if (duration === null || duration < 1) {
          return json(
            { success: false, message: 'Duration is required and must be at least 1 minute' },
            { status: 400 }
          );
        }
        payload.duration_minutes = duration;
      }

      if (body.passing_score !== undefined) {
        const passingScore = optionalNumber(body.passing_score, 'Passing score');
        if (passingScore !== null && passingScore < 0) {
          return json({ success: false, message: 'Passing score must be at least 0' }, { status: 400 });
        }
        payload.passing_score = passingScore;
      }
    } catch (err) {
      return json(
        { success: false, message: err instanceof Error ? err.message : 'Invalid numeric field' },
        { status: 400 }
      );
    }

    if (body.available_from !== undefined) {
      payload.available_from = emptyToNull(body.available_from);
    }
    if (body.available_until !== undefined) {
      payload.available_until = emptyToNull(body.available_until);
    }

    const existingSettings =
      examRow.settings && typeof examRow.settings === 'object' && !Array.isArray(examRow.settings)
        ? examRow.settings
        : {};
    const incomingSettings =
      body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)
        ? body.settings
        : {};
    const mergedSettings = { ...existingSettings, ...incomingSettings };
    const examMode =
      mergedSettings.exam_mode === 'quick_practice' ? 'quick_practice' : 'traditional';

    if (examMode === 'quick_practice') {
      payload.show_result_policy = 'immediately';
    }

    if (body.attempts_allowed !== undefined) {
      const rawAttempts = body.attempts_allowed;
      const attemptsUnlimited = rawAttempts === null || rawAttempts === '';
      const parsedAttempts = attemptsUnlimited ? 1 : Number(rawAttempts);
      if (!Number.isFinite(parsedAttempts) || parsedAttempts < 1) {
        return json({ success: false, message: 'Attempts must be at least 1 or empty for unlimited' }, { status: 400 });
      }
      payload.attempts_allowed = parsedAttempts;
      mergedSettings.attempts_unlimited = attemptsUnlimited;
    }

    if (body.settings !== undefined || body.attempts_allowed !== undefined) {
      payload.settings = mergedSettings;
    }

    if (Object.keys(payload).length === 0) {
      return json({ success: false, message: 'No fields to update' }, { status: 400 });
    }

    // 4. Update
    const { data, error } = await supabase
      .from('exercise')
      .update(payload)
      .match({ id: examId, assessment_type: 'exam' })
      .select();

    if (error) {
      console.error('updateExamSettings error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    return json({ success: true, exam: data?.[0] });
  } catch (err) {
    console.error('PATCH /api/exams/[examId]/settings error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
