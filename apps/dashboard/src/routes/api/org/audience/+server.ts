import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { getOrgAccess } from '$lib/utils/functions/authz.server';

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

    const orgAccess = await getOrgAccess(supabase, orgId, userId);

    if (!orgAccess.isAdmin) {
      return json(
        {
          success: false,
          message: 'Access denied. Only the system admin can view the organization audience.'
        },
        { status: 403 }
      );
    }

    // Get all students who are participants in any course belonging to an org.
    // Keep profile lookup separate because some deployed Supabase schema caches
    // do not expose the groupmember -> profile relationship to PostgREST.
    const { data: members, error: memberError } = await supabase
      .from('groupmember')
      .select(
        `
        id,
        profile_id,
        email,
        created_at,
        group!inner(
          organization_id
        ),
        role_id
      `
      )
      .eq('group.organization_id', orgId)
      .eq('role_id', 3); // STUDENT role

    if (memberError) {
      console.error('Error fetching organization audience members:', memberError);
      throw new Error(memberError.message || 'Error fetching organization audience');
    }

    const profileIds = [
      ...new Set((members || []).map((member: any) => member.profile_id).filter(Boolean))
    ];

    let profileById = new Map<string, any>();

    if (profileIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from('profile')
        .select('id, fullname, email, avatar_url, created_at')
        .in('id', profileIds);

      if (profileError) {
        console.error('Error fetching organization audience profiles:', profileError);
        throw new Error(profileError.message || 'Error fetching organization audience');
      }

      profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    }

    const audienceByProfileId = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        avatar_url: string;
        date_joined: string;
      }
    >();

    for (const membership of members || []) {
      const profile = membership.profile_id ? profileById.get(membership.profile_id) : null;
      const memberKey = membership.profile_id || membership.email || membership.id;

      if (!memberKey || audienceByProfileId.has(memberKey)) {
        continue;
      }

      audienceByProfileId.set(memberKey, {
        id: membership.profile_id || membership.id,
        name: profile?.fullname || membership.email || 'Student',
        email: profile?.email || membership.email || '',
        avatar_url: profile?.avatar_url || '',
        date_joined: new Date(membership.created_at || profile?.created_at).toDateString()
      });
    }

    const audience = Array.from(audienceByProfileId.values());

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
