import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE, ROLE_LABEL } from '$lib/utils/constants/roles';

async function assertVerifiedAdmin(supabase: any, orgId: string, userId: string) {
  const { data: orgMember } = await supabase
    .from('organizationmember')
    .select('role_id')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .eq('role_id', ROLE.ADMIN)
    .eq('verified', true)
    .single();

  return !!orgMember;
}

async function getProfilesById(supabase: any, profileIds: string[]) {
  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))];

  if (uniqueProfileIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await supabase
    .from('profile')
    .select('id, fullname, email')
    .in('id', uniqueProfileIds);

  if (error) {
    console.error('GET /api/org/team profile query error:', error);
    return new Map<string, any>();
  }

  return new Map((data || []).map((profile: any) => [profile.id, profile]));
}

function serializeTeamMember(teamMember: any, profileById: Map<string, any>) {
  const memberProfile = teamMember.profile_id ? profileById.get(teamMember.profile_id) : null;

  return {
    id: teamMember.id,
    email: memberProfile?.email || teamMember.email,
    verified: teamMember.verified,
    profileId: teamMember.profile_id,
    fullname: memberProfile?.fullname || '',
    role: ROLE_LABEL[teamMember?.role_id] || '',
    isAdmin: teamMember?.role_id === ROLE.ADMIN
  };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const orgId = url.searchParams.get('orgId');
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!orgId) {
    return json({ success: false, message: 'Organization ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    const isAdmin = await assertVerifiedAdmin(supabase, orgId, userId);
    if (!isAdmin) {
      return json(
        {
          success: false,
          message: 'Access denied. User is not a verified admin of this organization.'
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('organizationmember')
      .select('id, email, verified, role_id, profile_id')
      .eq('organization_id', orgId)
      .neq('role_id', ROLE.STUDENT)
      .order('id', { ascending: false });

    if (error) {
      console.error('GET /api/org/team member query error:', error);
      throw new Error('Error fetching organization team');
    }

    const profileById = await getProfilesById(
      supabase,
      (data || []).map((teamMember) => teamMember.profile_id)
    );
    const team = (data || []).map((teamMember) => serializeTeamMember(teamMember, profileById));

    return json({
      success: true,
      team: team
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

export const PATCH: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: { orgId?: string; memberId?: number; verified?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { orgId, memberId, verified } = body;

  if (!orgId || typeof memberId !== 'number' || verified !== true) {
    return json(
      { success: false, message: 'orgId, memberId, and verified=true are required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabase();

    const isAdmin = await assertVerifiedAdmin(supabase, orgId, userId);
    if (!isAdmin) {
      return json(
        {
          success: false,
          message: 'Access denied. Only verified admins can approve teachers.'
        },
        { status: 403 }
      );
    }

    // Verify target member exists, belongs to same org, and is a TUTOR
    const { data: targetMember, error: targetError } = await supabase
      .from('organizationmember')
      .select('id, role_id, verified')
      .eq('id', memberId)
      .eq('organization_id', orgId)
      .eq('role_id', ROLE.TUTOR)
      .single();

    if (targetError || !targetMember) {
      return json(
        { success: false, message: 'Target member not found or not a teacher in this organization.' },
        { status: 404 }
      );
    }

    if (targetMember.verified === true) {
      return json(
        { success: false, message: 'Member is already verified.' },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('organizationmember')
      .update({ verified: true })
      .eq('id', memberId)
      .eq('organization_id', orgId)
      .select('id, email, verified, role_id, profile_id')
      .single();

    if (updateError || !updated) {
      console.error('PATCH /api/org/team error:', updateError);
      return json(
        { success: false, message: 'Failed to update member verification status.' },
        { status: 500 }
      );
    }

    const profileById = await getProfilesById(supabase, [updated.profile_id]);
    const member = serializeTeamMember(updated, profileById);

    return json({ success: true, member });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
