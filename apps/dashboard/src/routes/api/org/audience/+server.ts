import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  const orgId = url.searchParams.get('orgId');

  if (!orgId) {
    return json({ success: false, message: 'Organization ID is required' }, { status: 400 });
  }

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    // Check if user is a verified admin or tutor of this organization
    const { data: orgMember } = await supabase
      .from('organizationmember')
      .select('role_id')
      .eq('organization_id', orgId)
      .eq('profile_id', userId)
      .in('role_id', [ROLE.ADMIN, ROLE.TUTOR])
      .eq('verified', true)
      .single();

    if (!orgMember) {
      return json(
        {
          success: false,
          message: 'Access denied. User is not a verified member of this organization.'
        },
        { status: 403 }
      );
    }

    // Get all students who are participants in any course belonging to an org
    const { data, error } = await supabase
      .from('profile')
      .select(
        `
        id,
        fullname,
        email,
        avatar_url,
        created_at,
        groupmember!inner(
          role_id,
          group_id:group!inner(
            organization_id
          )
        )
      `
      )
      .eq('groupmember.group.organization_id', orgId)
      .eq('groupmember.role_id', 3); // STUDENT role

    if (error) {
      throw new Error('Error fetching organization audience');
    }

    const audience = (data || []).map((profile) => ({
      id: profile.id,
      name: profile.fullname,
      email: profile.email,
      avatar_url: profile.avatar_url,
      date_joined: new Date(profile.created_at).toDateString()
    }));

    return json({
      success: true,
      audience: audience
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json(
      {
        success: false,
        message
      },
      { status: 500 }
    );
  }
};
