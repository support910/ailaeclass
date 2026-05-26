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

    // Fetch organization team
    const { data, error } = await supabase
      .from('organizationmember')
      .select(
        `
        id,
        email,
        verified,
        role_id,
        profile(
          id,
          fullname,
          email
        )
      `
      )
      .eq('organization_id', orgId)
      .neq('role_id', ROLE.STUDENT)
      .order('id', { ascending: false });

    if (error) {
      throw new Error('Error fetching organization team');
    }

    const team = (data || []).map((teamMember) => ({
      id: teamMember.id,
      email: teamMember?.profile?.email || teamMember.email,
      verified: teamMember.verified,
      profileId: teamMember?.profile?.id,
      fullname: teamMember?.profile?.fullname || '',
      role: ROLE_LABEL[teamMember?.role_id] || '',
      isAdmin: teamMember?.role_id === ROLE.ADMIN
    }));

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
      .select('id, email, verified, role_id, profile(id, fullname, email)')
      .single();

    if (updateError || !updated) {
      console.error('PATCH /api/org/team error:', updateError);
      return json(
        { success: false, message: 'Failed to update member verification status.' },
        { status: 500 }
      );
    }

    const member = {
      id: updated.id,
      email: updated?.profile?.email || updated.email,
      verified: updated.verified,
      profileId: updated?.profile?.id,
      fullname: updated?.profile?.fullname || '',
      role: ROLE_LABEL[updated?.role_id] || '',
      isAdmin: updated?.role_id === ROLE.ADMIN
    };

    return json({ success: true, member });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
