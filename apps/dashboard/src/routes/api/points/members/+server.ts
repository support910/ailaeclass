import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * GET /api/points/members?orgId=…
 * Member list (id + name + email) for the points page picker.
 * Students get only themselves; teachers/admins get the whole organization.
 */
export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const orgId = url.searchParams.get('orgId');
  if (!orgId) return json({ success: false, message: 'orgId is required' }, { status: 400 });

  const supabase = getServerSupabase();

  const { data: membership } = await supabase
    .from('organizationmember')
    .select('role_id, verified')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (!membership || membership.verified !== true) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  const roleId = Number(membership.role_id);

  try {
    if (roleId === ROLE.STUDENT) {
      const { data: me } = await supabase
        .from('profile')
        .select('id, fullname, email')
        .eq('id', userId)
        .maybeSingle();

      return json({ success: true, members: me ? [{ profile_id: me.id, ...me }] : [] });
    }

    const { data: orgMembers, error } = await supabase
      .from('organizationmember')
      .select('profile_id')
      .eq('organization_id', orgId);

    if (error) throw error;

    const ids = (orgMembers || []).map((m: any) => m.profile_id).filter(Boolean);
    if (!ids.length) return json({ success: true, members: [] });

    const { data: profiles } = await supabase
      .from('profile')
      .select('id, fullname, email')
      .in('id', ids)
      .order('fullname', { ascending: true });

    return json({
      success: true,
      members: (profiles || []).map((p: any) => ({ profile_id: p.id, fullname: p.fullname, email: p.email }))
    });
  } catch (err) {
    console.error('GET /api/points/members error:', err);
    return json({ success: false, message: 'Failed to load members' }, { status: 500 });
  }
};
