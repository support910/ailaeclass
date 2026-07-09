import type { SupabaseClient } from '@supabase/supabase-js';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

export const EXAM_RECYCLE_RETENTION_DAYS = 3;

export function getRecycleDeleteAfter(from = new Date()) {
  return new Date(from.getTime() + EXAM_RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isMissingRecycleBinColumns(error: any) {
  const message = String(error?.message || error?.details || '');
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('deleted_at') ||
    message.includes('delete_after') ||
    message.includes('deleted_by')
  );
}

export async function verifyTeacherCanManageExam(
  supabase: SupabaseClient,
  examId: string,
  userId: string
) {
  const { data: examRow, error: examError } = await supabase
    .from('exercise')
    .select('*')
    .eq('id', examId)
    .eq('assessment_type', 'exam')
    .single();

  if (examError || !examRow) {
    return { error: { status: 404, message: 'Exam not found' }, exam: null };
  }

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
    return { error: { status: 404, message: 'Course not found' }, exam: null };
  }

  const { hasAccess, isStudent } = await checkUserCoursePermissions(
    supabase,
    userId,
    courseRow.group_id
  );

  if (!hasAccess) {
    return { error: { status: 403, message: 'Access denied' }, exam: null };
  }

  if (isStudent) {
    return { error: { status: 403, message: 'Only teachers can manage exams' }, exam: null };
  }

  return { error: null, exam: examRow };
}

export async function permanentlyDeleteExam(supabase: SupabaseClient, examId: string) {
  const { data: submissions, error: submissionsError } = await supabase
    .from('submission')
    .select('id')
    .eq('exercise_id', examId);

  if (submissionsError) return submissionsError;

  const submissionIds = submissions?.map((s: any) => s.id) || [];
  const { data: questions, error: questionsError } = await supabase
    .from('question')
    .select('id')
    .eq('exercise_id', examId);

  if (questionsError) return questionsError;

  const questionIds = questions?.map((q: any) => q.id) || [];

  if (submissionIds.length > 0) {
    const { error } = await supabase.from('question_answer').delete().in('submission_id', submissionIds);
    if (error) return error;
  }

  if (questionIds.length > 0) {
    const { error: optionError } = await supabase.from('option').delete().in('question_id', questionIds);
    if (optionError) return optionError;

    const { error: answerError } = await supabase.from('question_answer').delete().in('question_id', questionIds);
    if (answerError) return answerError;

    const { error: questionError } = await supabase.from('question').delete().in('id', questionIds);
    if (questionError) return questionError;
  }

  const { error: submissionError } = await supabase.from('submission').delete().eq('exercise_id', examId);
  if (submissionError) return submissionError;

  const { error: deleteError } = await supabase
    .from('exercise')
    .delete()
    .match({ id: examId, assessment_type: 'exam' });

  return deleteError;
}

export async function purgeExpiredDeletedExams(supabase: SupabaseClient, lessonIds: string[]) {
  if (lessonIds.length === 0) return null;

  const { data: expired, error } = await supabase
    .from('exercise')
    .select('id')
    .in('lesson_id', lessonIds)
    .eq('assessment_type', 'exam')
    .not('deleted_at', 'is', null)
    .lte('delete_after', new Date().toISOString());

  if (error) {
    return isMissingRecycleBinColumns(error) ? null : error;
  }

  for (const exam of expired || []) {
    const deleteError = await permanentlyDeleteExam(supabase, exam.id);
    if (deleteError) return deleteError;
  }

  return null;
}
