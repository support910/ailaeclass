import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';
import { isUUID } from '$lib/utils/functions/isUUID';

function isNew(id: string | undefined) {
  return !id || id.startsWith('new_') || !isUUID(id);
}

/**
 * POST /api/exercises/[id]
 *
 * Upsert questions and options for an exercise (exam or regular exercise).
 * Replaces client-side upsertExercise to bypass RLS.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const exerciseId = params.id;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!exerciseId) {
    return json({ success: false, message: 'Exercise ID is required' }, { status: 400 });
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    questions,
    title,
    description,
    due_by,
    is_title_dirty,
    is_description_dirty,
    is_due_by_dirty
  } = body;

  try {
    const supabase = getServerSupabase();

    // 1. Verify exercise exists and get lesson/course for permission check
    const { data: exerciseRow, error: exerciseError } = await supabase
      .from('exercise')
      .select('lesson_id')
      .eq('id', exerciseId)
      .single();

    if (exerciseError || !exerciseRow) {
      return json({ success: false, message: 'Exercise not found' }, { status: 404 });
    }

    // 2. Permission check
    const { data: lessonRow } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', exerciseRow.lesson_id)
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
      return json({ success: false, message: 'Only teachers can edit exercises' }, { status: 403 });
    }

    // 3. Update exercise metadata
    if (is_description_dirty || is_title_dirty || is_due_by_dirty) {
      const updatePayload: Record<string, any> = {};
      if (is_title_dirty) updatePayload.title = title;
      if (is_description_dirty) updatePayload.description = description;
      if (is_due_by_dirty) updatePayload.due_by = due_by;

      await supabase
        .from('exercise')
        .update(updatePayload)
        .match({ id: exerciseId });
    }

    // 4. Process questions
    const updatedQuestions = [];

    for (const question of questions || []) {
      const { title: qTitle, id, name, question_type, options, deleted_at, order, points, is_dirty } = question;

      if (deleted_at) {
        if (!isNew(id)) {
          await supabase.from('option').delete().match({ question_id: id });
          await supabase.from('question_answer').delete().match({ question_id: id });
          await supabase.from('question').delete().match({ id });
        }
        continue;
      }

      const newQuestion = {
        id: isNew(id) ? undefined : id,
        name: isNew(id) ? undefined : name,
        title: qTitle,
        points,
        order,
        question_type_id: question_type?.id,
        exercise_id: exerciseId
      };
      let questionRes;

      if (is_dirty || isNew(id)) {
        const res = await supabase.from('question').upsert(newQuestion).select();
        if (res.error) {
          console.error('Upsert question error:', res.error);
          return json({ success: false, message: 'Failed to save question' }, { status: 500 });
        }
        questionRes = Array.isArray(res.data) ? res.data[0] : null;
      } else {
        questionRes = Object.assign({}, newQuestion);
      }

      if (questionRes) {
        const savedQuestion: any = {
          ...questionRes,
          question_type: { id: questionRes.question_type_id, label: question_type?.label || '' },
          options: []
        };

        const TEXTAREA_TYPE_ID = 3;
        if (question_type?.id !== TEXTAREA_TYPE_ID) { // skip options for TEXTAREA
          for (const option of options || []) {
            if (option.deleted_at) {
              if (!isNew(option.id)) {
                await supabase.from('option').delete().match({ id: option.id });
              }
              continue;
            }

            const newOption = {
              ...option,
              is_dirty: undefined,
              id: isNew(option.id) ? undefined : option.id,
              value: isUUID(option.value) ? option.value : undefined,
              question_id: savedQuestion.id
            };

            if (option.is_dirty || isNew(option.id)) {
              const { data, error: optionError } = await supabase.from('option').upsert(newOption).select();
              if (optionError) {
                console.error('Upsert option error:', optionError);
                return json({ success: false, message: 'Failed to save option' }, { status: 500 });
              }
              if (Array.isArray(data)) {
                savedQuestion.options.push(data[0]);
              }
            } else {
              savedQuestion.options.push(newOption);
            }
          }
        }

        updatedQuestions.push(savedQuestion);
      }
    }

    return json({ success: true, questions: updatedQuestions });
  } catch (err) {
    console.error('POST /api/exercises/[id] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
