import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { getCourseAccess } from '$lib/utils/functions/authz.server';

export const GET: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const supabase = getServerSupabase();
  const access = await getCourseAccess(supabase, params.id, userId);
  if (!access.canManageCourse || !access.groupId || !access.orgId) {
    return json({ success: false, message: 'Access denied' }, { status: 403 });
  }

  const { data: currentMembers, error } = await supabase
    .from('groupmember')
    .select('id, group_id, role_id, profile_id, email, created_at, assigned_student_id')
    .eq('group_id', access.groupId);
  if (error) return json({ success: false, message: error.message }, { status: 500 });

  const currentIds = (currentMembers || []).map((member: any) => member.profile_id).filter(Boolean);
  const { data: orgMembers } = await supabase
    .from('organizationmember')
    .select('profile_id, role_id')
    .eq('organization_id', access.orgId)
    .eq('verified', true)
    .in('role_id', access.isAdmin ? [ROLE.TUTOR, ROLE.STUDENT] : [ROLE.STUDENT]);
  const optionIds = (orgMembers || []).map((member: any) => member.profile_id).filter(Boolean);
  const { data: profiles } = optionIds.length
    ? await supabase.from('profile').select('id, fullname, email, avatar_url').in('id', optionIds)
    : { data: [] };
  const roleByProfile = new Map(
    (orgMembers || []).map((member: any) => [member.profile_id, member.role_id])
  );

  return json({
    success: true,
    options: (profiles || [])
      .filter((profile: any) => !currentIds.includes(profile.id))
      .map((profile: any) => ({ ...profile, role_id: roleByProfile.get(profile.id) }))
  });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let body: { email?: string; profileId?: string; roleId?: number };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }
  const roleId = Number(body.roleId || ROLE.STUDENT);
  if (![ROLE.TUTOR, ROLE.STUDENT].includes(roleId)) {
    return json({ success: false, message: 'Invalid course role.' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const access = await getCourseAccess(supabase, params.id, userId);
  if (
    !access.canManageCourse ||
    !access.groupId ||
    !access.orgId ||
    (roleId === ROLE.TUTOR && !access.isAdmin)
  ) {
    return json({ success: false, message: 'Access denied' }, { status: 403 });
  }

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  let profileQuery = supabase.from('profile').select('id, fullname, email, avatar_url');
  profileQuery = body.profileId
    ? profileQuery.eq('id', body.profileId)
    : profileQuery.eq('email', email);
  const { data: profile } = await profileQuery.maybeSingle();
  if (!profile?.id && (!email || !email.includes('@'))) {
    return json(
      { success: false, message: 'Select a valid organization member or enter a student email.' },
      { status: 400 }
    );
  }

  if (profile?.id) {
    const { data: orgMember } = await supabase
      .from('organizationmember')
      .select('role_id, verified')
      .eq('organization_id', access.orgId)
      .eq('profile_id', profile.id)
      .eq('verified', true)
      .maybeSingle();
    if (!orgMember || orgMember.role_id !== roleId) {
      return json(
        {
          success: false,
          message:
            roleId === ROLE.TUTOR
              ? 'Select a verified organization teacher.'
              : 'Select a verified organization student.'
        },
        { status: 409 }
      );
    }
  }

  const duplicateBase = supabase.from('groupmember').select('id').eq('group_id', access.groupId);
  const { data: duplicate } = profile?.id
    ? await duplicateBase.eq('profile_id', profile.id).maybeSingle()
    : await duplicateBase.eq('email', email).maybeSingle();
  if (duplicate)
    return json(
      { success: false, message: 'This member is already in the course.' },
      { status: 409 }
    );

  const { data: member, error } = await supabase
    .from('groupmember')
    .insert({
      group_id: access.groupId,
      role_id: roleId,
      profile_id: profile?.id || null,
      email: profile?.email || email
    })
    .select('id, group_id, role_id, profile_id, email, created_at, assigned_student_id')
    .single();
  if (error || !member)
    return json(
      { success: false, message: error?.message || 'Failed to add member.' },
      { status: 500 }
    );
  return json({ success: true, member: { ...member, profile: profile || null } });
};
