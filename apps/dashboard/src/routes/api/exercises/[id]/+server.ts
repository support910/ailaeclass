import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';
import { isUUID } from '$lib/utils/functions/isUUID';

function isNew(id: unknown) {
  if (id === undefined || id === null || id === '') return true;

  const value = String(id);
  return value.startsWith('new_') || (!isUUID(value) && Number.isNaN(Number(value)));
}

function getOptionImageKey(option: any) {
  return option?.value ? String(option.value) : option?.id ? String(option.id) : '';
}

function mergeOptionImagesIntoQuestionMetadata(metadata: Record<string, any> | undefined, optionImages: Record<string, any>) {
  const nextMetadata = { ...(metadata || {}) };

  if (Object.keys(optionImages).length) {
    nextMetadata.optionImages = optionImages;
  } else {
    delete nextMetadata.optionImages;
  }

  return nextMetadata;
}

function mergeOptionImagesIntoOptions(options: any[], optionImages: Record<string, any>) {
  return (options || []).map((option) => {
    const key = getOptionImageKey(option);
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
        title: qTitle || '',
        points,
        order,
        question_type_id: question_type?.id,
        exercise_id: exerciseId,
        metadata: question.metadata || {}
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
          const optionImages: Record<string, any> = {};

          for (const option of options || []) {
            if (option.deleted_at) {
              if (!isNew(option.id)) {
                await supabase.from('option').delete().match({ id: option.id });
              }
              continue;
            }

            const newOption = {
              ...option,
              label: option.label || '',
              is_dirty: undefined,
              id: isNew(option.id) ? undefined : option.id,
              value: isUUID(option.value) ? option.value : undefined,
              question_id: savedQuestion.id,
              metadata: option.metadata || {}
            };

            if (option.is_dirty || isNew(option.id)) {
              let optionRes = await supabase.from('option').upsert(newOption).select();
              // If metadata column is missing (remote schema not migrated), retry without metadata
              if (optionRes.error) {
                const errMsg = optionRes.error.message || '';
                const isMetadataIssue =
                  errMsg.includes('metadata') ||
                  errMsg.includes('column') ||
                  errMsg.includes('schema') ||
                  (optionRes.error as any).code === '42703'; // undefined_column
                if (isMetadataIssue) {
                  console.warn(
                    `Option upsert with metadata failed for question ${savedQuestion.id}, retrying without metadata. Error:`,
                    errMsg
                  );
                  const { id, value, label, question_id, is_correct } = newOption;
                  const fallbackOption = { id, value, label, question_id, is_correct };
                  optionRes = await supabase.from('option').upsert(fallbackOption).select();
                }
              }
              if (optionRes.error) {
                console.error('Upsert option error:', optionRes.error);
                return json({ success: false, message: 'Failed to save option' }, { status: 500 });
              }
              if (Array.isArray(optionRes.data)) {
                const savedOption = optionRes.data[0];
                const optionImageKey = getOptionImageKey(savedOption);
                if (option.metadata?.image && optionImageKey) {
                  optionImages[optionImageKey] = option.metadata.image;
                }
                savedQuestion.options.push(savedOption);
              }
            } else {
              const optionImageKey = getOptionImageKey(newOption);
              if (option.metadata?.image && optionImageKey) {
                optionImages[optionImageKey] = option.metadata.image;
              }
              savedQuestion.options.push(newOption);
            }
          }

          const mergedMetadata = mergeOptionImagesIntoQuestionMetadata(
            savedQuestion.metadata || question.metadata,
            optionImages
          );

          const { error: metadataUpdateError } = await supabase
            .from('question')
            .update({ metadata: mergedMetadata })
            .eq('id', savedQuestion.id);

          if (metadataUpdateError) {
            console.error('Update question option image metadata error:', metadataUpdateError);
            return json({ success: false, message: 'Failed to save option images' }, { status: 500 });
          }

          savedQuestion.metadata = mergedMetadata;
          savedQuestion.options = mergeOptionImagesIntoOptions(savedQuestion.options, optionImages);
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
