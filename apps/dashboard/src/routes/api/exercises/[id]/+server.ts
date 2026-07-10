import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
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

function getAutoPoints(questionCount: number) {
  if (questionCount <= 0) return [];

  const base = Math.floor(100 / questionCount);
  const remainder = 100 - base * questionCount;
  return Array.from({ length: questionCount }, (_, index) =>
    index >= questionCount - remainder ? base + 1 : base
  );
}

function applyAutoQuestionPoints(questions: any[]) {
  const activeIndexes = (questions || [])
    .map((question, index) => (!question?.deleted_at ? index : -1))
    .filter((index) => index >= 0);
  const autoPoints = getAutoPoints(activeIndexes.length);

  return (questions || []).map((question, index) => {
    const activeIndex = activeIndexes.indexOf(index);
    if (activeIndex === -1) return question;
    return {
      ...question,
      points: autoPoints[activeIndex] ?? 0,
      order: activeIndex
    };
  });
}

function toNumberOrNull(value: unknown) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    is_due_by_dirty,
    score_mode
  } = body;

  try {
    const supabase = getServerSupabase();

    // 1. Verify exercise exists and get lesson/course for permission check
    const { data: exerciseRow, error: exerciseError } = await supabase
      .from('exercise')
      .select('lesson_id, assessment_type, settings')
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
    const scoreMode =
      score_mode === 'auto' || score_mode === 'manual'
        ? score_mode
        : exerciseRow.assessment_type === 'exam' && exerciseRow.settings?.score_mode === 'auto'
          ? 'auto'
          : 'manual';
    const questionsToSave =
      scoreMode === 'auto' ? applyAutoQuestionPoints(questions || []) : questions || [];

    for (const question of questionsToSave) {
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
        points: toNumberOrNull(points) ?? 0,
        order: toNumberOrNull(order) ?? 0,
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
          const optionSlots: any[] = [];
          const deletedOptionIds: string[] = [];
          const activeOptions: Array<{ slotIndex: number; source: any; row: any; isNewOption: boolean }> = [];
          let nextOptionSlotIndex = 0;

          for (const option of options || []) {
            if (option.deleted_at) {
              if (!isNew(option.id)) {
                deletedOptionIds.push(option.id);
              }
              continue;
            }

            const slotIndex = nextOptionSlotIndex;
            nextOptionSlotIndex += 1;
            const newOption = {
              ...(isNew(option.id) ? {} : { id: option.id }),
              label: option.label || '',
              value: isUUID(option.value) ? option.value : crypto.randomUUID(),
              question_id: savedQuestion.id,
              is_correct: option.is_correct === true,
              metadata: option.metadata || {}
            };

            const isNewOption = isNew(option.id);
            if (option.is_dirty || isNewOption) {
              activeOptions.push({ slotIndex, source: option, row: newOption, isNewOption });
            } else {
              const optionImageKey = getOptionImageKey(newOption);
              if (option.metadata?.image && optionImageKey) {
                optionImages[optionImageKey] = option.metadata.image;
              }
              optionSlots[slotIndex] = newOption;
            }
          }

          if (deletedOptionIds.length > 0) {
            const { error: deleteOptionError } = await supabase
              .from('option')
              .delete()
              .in('id', deletedOptionIds);

            if (deleteOptionError) {
              console.error('Delete option error:', deleteOptionError);
              return json({ success: false, message: 'Failed to delete option' }, { status: 500 });
            }
          }

          for (const { slotIndex, source, row, isNewOption } of activeOptions) {
            const saveOption = isNewOption
              ? supabase.from('option').insert(row).select().single()
              : supabase.from('option').upsert(row).select().single();
            let optionRes = await saveOption;

            // If metadata column is missing (remote schema not migrated), retry without metadata.
            if (optionRes.error) {
              const errMsg = optionRes.error.message || '';
              const isMetadataIssue =
                errMsg.includes('metadata') ||
                errMsg.includes('column') ||
                errMsg.includes('schema') ||
                (optionRes.error as any).code === '42703'; // undefined_column
              if (isMetadataIssue) {
                console.warn(
                  `Option save with metadata failed for question ${savedQuestion.id}, retrying without metadata. Error:`,
                  errMsg
                );
                const { id, value, label, question_id, is_correct } = row;
                const fallbackOption = { id, value, label, question_id, is_correct };
                optionRes = isNewOption
                  ? await supabase.from('option').insert(fallbackOption).select().single()
                  : await supabase.from('option').upsert(fallbackOption).select().single();
              }
            }

            if (optionRes.error || !optionRes.data) {
              console.error('Save option error:', optionRes.error);
              return json({ success: false, message: 'Failed to save option' }, { status: 500 });
            }

            const savedOption = optionRes.data;
            const optionImageKey = getOptionImageKey(savedOption);
            if (source.metadata?.image && optionImageKey) {
              optionImages[optionImageKey] = source.metadata.image;
            }
            optionSlots[slotIndex] = savedOption;
          }

          const mergedMetadata = mergeOptionImagesIntoQuestionMetadata(
            savedQuestion.metadata || question.metadata,
            optionImages
          );
          const currentMetadata = savedQuestion.metadata || question.metadata || {};
          const metadataChanged =
            JSON.stringify(mergedMetadata || {}) !== JSON.stringify(currentMetadata || {});

          if (metadataChanged) {
            const { error: metadataUpdateError } = await supabase
              .from('question')
              .update({ metadata: mergedMetadata })
              .eq('id', savedQuestion.id);

            if (metadataUpdateError) {
              console.error('Update question option image metadata error:', metadataUpdateError);
              return json({ success: false, message: 'Failed to save option images' }, { status: 500 });
            }
          }

          savedQuestion.metadata = mergedMetadata;
          savedQuestion.options = mergeOptionImagesIntoOptions(optionSlots.filter(Boolean), optionImages);
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
