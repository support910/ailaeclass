import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { verifyTeacherCanManageExam } from '$lib/utils/functions/examRecycleBin.server';

export const POST: RequestHandler = async ({ params, request }) => {
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
    const access = await verifyTeacherCanManageExam(supabase, examId, userId);

    if (access.error) {
      return json({ success: false, message: access.error.message }, { status: access.error.status });
    }

    const now = new Date().toISOString();
    const { data: exam, error } = await supabase
      .from('exercise')
      .update({
        deleted_at: null,
        deleted_by: null,
        delete_after: null,
        updated_at: now
      })
      .match({ id: examId, assessment_type: 'exam' })
      .select()
      .single();

    if (error) {
      console.error('restoreExam error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    return json({ success: true, exam });
  } catch (err) {
    console.error('POST /api/exams/[examId]/restore error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
