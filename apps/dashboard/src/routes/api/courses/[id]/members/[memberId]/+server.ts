import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { getCourseAccess } from '$lib/utils/functions/authz.server';

export const DELETE: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  const courseId = params.id;
  const memberId = params.memberId;

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();
    const access = await getCourseAccess(supabase, courseId, userId);

    if (!access.canManageCourse || !access.groupId) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const { data: targetMember, error: targetError } = await supabase
      .from('groupmember')
      .select('id, group_id, role_id, profile_id')
      .eq('id', memberId)
      .eq('group_id', access.groupId)
      .single();

    if (targetError || !targetMember) {
      return json({ success: false, message: 'Member not found.' }, { status: 404 });
    }

    if (targetMember.role_id !== ROLE.STUDENT) {
      return json({ success: false, message: 'Only students can be removed from this page.' }, { status: 409 });
    }

    const { error } = await supabase
      .from('groupmember')
      .delete()
      .eq('id', memberId)
      .eq('group_id', access.groupId)
      .eq('role_id', ROLE.STUDENT);

    if (error) {
      console.error('DELETE /api/courses/[id]/members/[memberId] error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
