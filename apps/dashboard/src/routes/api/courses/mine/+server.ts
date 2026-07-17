import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const orgId = url.searchParams.get('orgId') || '';
  if (!orgId) return json({ success: false, message: 'orgId is required' }, { status: 400 });

  try {
    const supabase = getServerSupabase();
    const access = await getOrgAccess(supabase, orgId, userId);
    if (!access.membership || access.membership.verified !== true) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const { data: allCourses, error: courseError } = await supabase.rpc('get_courses', {
      org_id_arg: orgId,
      profile_id_arg: userId
    });
    if (courseError) throw courseError;
    if (access.isAdmin) {
      return json({ success: true, courses: allCourses || [] });
    }

    const { data: groups, error: groupError } = await supabase
      .from('group')
      .select('id')
      .eq('organization_id', orgId);
    if (groupError) throw groupError;

    const groupIds = (groups || []).map((group: any) => group.id);
    if (!groupIds.length) return json({ success: true, courses: [] });

    const allowedRoles = access.isTeacher ? [ROLE.TUTOR, ROLE.ADMIN] : [ROLE.STUDENT];
    const { data: memberships, error: membershipError } = await supabase
      .from('groupmember')
      .select('group_id')
      .eq('profile_id', userId)
      .in('group_id', groupIds)
      .in('role_id', allowedRoles);
    if (membershipError) throw membershipError;

    const managedGroupIds = [...new Set((memberships || []).map((member: any) => member.group_id))];
    if (!managedGroupIds.length) return json({ success: true, courses: [] });

    const { data: visibleCourseRows, error: visibleCourseError } = await supabase
      .from('course')
      .select('id')
      .in('group_id', managedGroupIds)
      .eq('status', 'ACTIVE');
    if (visibleCourseError) throw visibleCourseError;

    const visibleCourseIds = new Set((visibleCourseRows || []).map((course: any) => course.id));
    const courses = (allCourses || []).filter((course: any) => visibleCourseIds.has(course.id));
    return json({ success: true, courses });
  } catch (error) {
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load courses'
      },
      { status: 500 }
    );
  }
};
