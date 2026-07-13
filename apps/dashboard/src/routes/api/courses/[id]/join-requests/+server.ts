import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { ROLE } from '$lib/utils/constants/roles';

export const POST: RequestHandler = async ({ params, request }) => {
  const courseId = params.id;
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const { data: course, error: courseError } = await supabase
      .from('course')
      .select('id, group_id, status')
      .eq('id', courseId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (courseError || !course?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

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
    if (access.membership.role_id !== ROLE.STUDENT) {
      return json({ success: false, message: 'Only students can apply for a course' }, { status: 403 });
    }

    const { data: existingMember } = await supabase
      .from('groupmember')
      .select('id')
      .eq('group_id', course.group_id)
      .eq('profile_id', userId)
      .maybeSingle();
    if (existingMember) {
      return json({ success: true, state: 'joined', member: existingMember });
    }

    const { data: existingRequest } = await supabase
      .from('course_join_request')
      .select('id, status, created_at')
      .eq('course_id', courseId)
      .eq('profile_id', userId)
      .maybeSingle();

    if (existingRequest?.status === 'pending') {
      return json({ success: true, state: 'pending', request: existingRequest });
    }

    const query = existingRequest
      ? supabase
          .from('course_join_request')
          .update({ status: 'pending' })
          .eq('id', existingRequest.id)
      : supabase.from('course_join_request').insert({
          course_id: courseId,
          profile_id: userId,
          status: 'pending'
        });
    const { data: joinRequest, error: requestError } = await query
      .select('id, status, created_at')
      .single();

    if (requestError || !joinRequest) {
      console.error('Create course application error:', requestError);
      return json({ success: false, message: 'Failed to submit course application' }, { status: 500 });
    }

    return json({ success: true, state: 'pending', request: joinRequest });
  } catch (err) {
    console.error('POST /api/courses/[id]/join-requests error:', err);
    return json(
      { success: false, message: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/courses/[id]/join-requests?status=pending
 *
 * Returns join requests for a course.
 * Only teachers/admins (non-students) can access.
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
  const courseId = params.id;
  const userId = await getUserIdFromRequest(request);
  const statusFilter = url.searchParams.get('status') || 'pending';

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Resolve course group_id
    const { data: courseRow, error: courseError } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (courseError || !courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    // 2. Check permissions
    const { hasAccess, isStudent } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    if (isStudent) {
      return json({ success: false, message: 'Students cannot access join requests' }, { status: 403 });
    }

    // 3. Fetch join requests (without nested profile query)
    const { data: requests, error: reqError } = await supabase
      .from('course_join_request')
      .select('id, course_id, profile_id, status, created_at')
      .eq('course_id', courseId)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false });

    if (reqError) {
      console.error('Fetch join requests error:', reqError);
      return json({ success: false, message: 'Failed to load join requests' }, { status: 500 });
    }

    // 4. Enrich with profile data separately
    const profileIds = (requests || []).map((r) => r.profile_id).filter(Boolean);
    let profileMap: Record<string, any> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profile')
        .select('id, fullname, email, avatar_url')
        .in('id', [...new Set(profileIds)]);

      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }

    const enriched = (requests || []).map((r: any) => ({
      ...r,
      profile: profileMap[r.profile_id] || null
    }));

    return json({
      success: true,
      requests: enriched
    });
  } catch (err) {
    console.error('GET /api/courses/[id]/join-requests error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
