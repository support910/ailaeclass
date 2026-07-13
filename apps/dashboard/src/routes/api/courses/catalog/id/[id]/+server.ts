import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getCourseOverviewById } from '$lib/utils/functions/courseCatalog.server';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

export const GET: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const course = await getCourseOverviewById(supabase, params.id);
    if (!course) return json({ success: false, message: 'Course not found' }, { status: 404 });

    const { data: group } = await supabase
      .from('group')
      .select('organization_id')
      .eq('id', course.group_id)
      .maybeSingle();
    const access = group?.organization_id
      ? await getOrgAccess(supabase, group.organization_id, userId)
      : null;
    if (!access?.membership || access.membership.verified !== true) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const [{ data: courseMember }, { data: joinRequest }] = await Promise.all([
      supabase
        .from('groupmember')
        .select('id, role_id')
        .eq('group_id', course.group_id)
        .eq('profile_id', userId)
        .maybeSingle(),
      supabase
        .from('course_join_request')
        .select('id, status, created_at')
        .eq('course_id', course.id)
        .eq('profile_id', userId)
        .maybeSingle()
    ]);

    return json({
      success: true,
      course,
      viewer: {
        org_role_id: access.membership.role_id,
        is_course_member: !!courseMember,
        course_role_id: courseMember?.role_id || null,
        application_status: joinRequest?.status || null,
        applied_at: joinRequest?.created_at || null
      }
    });
  } catch (error) {
    return json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to load course' },
      { status: 500 }
    );
  }
};
