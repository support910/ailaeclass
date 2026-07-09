import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  permanentlyDeleteExam,
  verifyTeacherCanManageExam
} from '$lib/utils/functions/examRecycleBin.server';

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
    const access = await verifyTeacherCanManageExam(supabase, examId, userId);

    if (access.error) {
      return json({ success: false, message: access.error.message }, { status: access.error.status });
    }

    if (!access.exam?.deleted_at) {
      return json(
        { success: false, message: 'Only exams in the recycle bin can be permanently deleted' },
        { status: 409 }
      );
    }

    const error = await permanentlyDeleteExam(supabase, examId);
    if (error) {
      console.error('purgeExam error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    return json({ success: true });
  } catch (err) {
    console.error('DELETE /api/exams/[examId]/purge error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
