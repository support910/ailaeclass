import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * POST /api/courses/join-requests/[id]/reject
 *
 * Teacher/admin rejects a join request.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const requestId = params.id;
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Fetch the join request
    const { data: joinRequest, error: reqError } = await supabase
      .from('course_join_request')
      .select('id, course_id, status')
      .eq('id', requestId)
      .single();

    if (reqError || !joinRequest) {
      return json({ success: false, message: 'Join request not found' }, { status: 404 });
    }

    if (joinRequest.status !== 'pending') {
      return json(
        { success: false, message: `Request is already ${joinRequest.status}` },
        { status: 400 }
      );
    }

    // 2. Resolve course group_id
    const { data: courseRow, error: courseError } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', joinRequest.course_id)
      .single();

    if (courseError || !courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    // 3. Check permissions (teacher/admin only)
    const { hasAccess, userMembership, isOrgAdmin } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const isStudent = userMembership?.role_id === ROLE.STUDENT && !isOrgAdmin;
    if (isStudent) {
      return json({ success: false, message: 'Students cannot reject requests' }, { status: 403 });
    }

    // 4. Update request status
    const { error: updateError } = await supabase
      .from('course_join_request')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Reject join request error:', updateError);
      return json({ success: false, message: 'Failed to reject application' }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Application rejected'
    });
  } catch (err) {
    console.error('POST /api/courses/join-requests/[id]/reject error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
