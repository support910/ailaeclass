import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { getCourseAccess } from '$lib/utils/functions/authz.server';

export const DELETE: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const supabase = getServerSupabase();
  const access = await getCourseAccess(supabase, params.id, userId);
  if (!access.canManageCourse || !access.groupId) {
    return json({ success: false, message: 'Access denied' }, { status: 403 });
  }
  const { data: target } = await supabase
    .from('groupmember')
    .select('id, role_id, profile_id')
    .eq('id', params.memberId)
    .eq('group_id', access.groupId)
    .maybeSingle();
  if (!target) return json({ success: false, message: 'Member not found.' }, { status: 404 });
  if (target.role_id === ROLE.ADMIN || (target.role_id === ROLE.TUTOR && !access.isAdmin)) {
    return json(
      { success: false, message: 'Only an organization administrator can remove course teachers.' },
      { status: 403 }
    );
  }
  if (![ROLE.TUTOR, ROLE.STUDENT].includes(target.role_id)) {
    return json({ success: false, message: 'This member cannot be removed.' }, { status: 409 });
  }
  const { error } = await supabase
    .from('groupmember')
    .delete()
    .eq('id', target.id)
    .eq('group_id', access.groupId);
  if (error) return json({ success: false, message: error.message }, { status: 500 });
  return json({ success: true });
};
